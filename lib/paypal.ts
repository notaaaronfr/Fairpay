/**
 * PayPal, for the money a contract moves.
 *
 *   hold     — the client approves the contract total in PayPal. It is
 *              AUTHORIZED, not captured: promised, not taken.
 *   capture  — when a milestone is released, exactly its amount is taken from
 *              that hold (final_capture: false keeps the rest held).
 *   payout   — the same amount goes to the freelancer through PayPal Payouts.
 *   release  — whatever was never released is voided back to the client.
 *
 * Sandbox by default. With no credentials it runs SIMULATED: every call
 * answers with an id starting "SIM-" and nothing leaves the server.
 */

export type Mode = 'sandbox' | 'live' | 'simulated';

export interface PayPalConfig { mode: Mode; base: string; clientId?: string; secret?: string }

export function config(env: Record<string, string | undefined> = process.env): PayPalConfig {
  const clientId = env.PAYPAL_CLIENT_ID?.trim();
  const secret = env.PAYPAL_CLIENT_SECRET?.trim();
  if (!clientId || !secret) return { mode: 'simulated', base: '' };
  const live = env.PAYPAL_ENV === 'live';
  return {
    mode: live ? 'live' : 'sandbox',
    base: live ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com',
    clientId, secret,
  };
}

/** Swappable so tests can answer for PayPal without a network. */
let fetcher: typeof fetch = (input, init) => fetch(input, init);
export function useFetch(f: typeof fetch) { fetcher = f; token = null; }

let token: { value: string; until: number; key: string } | null = null;

async function accessToken(c: PayPalConfig): Promise<string> {
  const key = c.clientId!;
  if (token && token.key === key && token.until > Date.now() + 60_000) return token.value;
  const r = await fetcher(`${c.base}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${c.clientId}:${c.secret}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!r.ok) throw new PayPalError('sign-in to PayPal failed', r.status, await r.text());
  const j: any = await r.json();
  token = { value: j.access_token, until: Date.now() + (j.expires_in ?? 300) * 1000, key };
  return token.value;
}

export class PayPalError extends Error {
  status: number;
  body: string;
  constructor(what: string, status: number, body: string) {
    super(`${what} (PayPal ${status}${detailOf(body)})`);
    this.status = status;
    this.body = body;
  }
}

/** PayPal's own words for what went wrong, when it gave any. */
function detailOf(body: string): string {
  try {
    const j = JSON.parse(body);
    const issue = j.details?.[0]?.issue ?? j.name;
    const desc = j.details?.[0]?.description ?? j.message;
    return issue ? `: ${issue}${desc ? ' — ' + desc : ''}` : '';
  } catch { return ''; }
}

async function call(c: PayPalConfig, what: string, method: string, path: string,
                    body?: unknown, idempotencyKey?: string): Promise<any> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${await accessToken(c)}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };
  // A retry, a double click, a timeout that succeeded on PayPal's side: the
  // same request id makes the second one a no-op instead of a second payment.
  if (idempotencyKey) headers['PayPal-Request-Id'] = idempotencyKey;
  const r = await fetcher(`${c.base}${path}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  if (!r.ok) throw new PayPalError(what, r.status, text);
  return text ? JSON.parse(text) : {};
}

const usd = (n: number) => ({ currency_code: 'USD', value: round2(n).toFixed(2) });
export const round2 = (n: number) => Math.round(n * 100) / 100;
const sim = (p: string) => `SIM-${p}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;

/* ── hold ──────────────────────────────────────────────────────────────── */

export interface Hold { orderId: string; approveUrl: string }

/**
 * Ask the client to approve the budget. Nothing is held until they approve
 * and `authorize` runs on their return.
 */
export async function createHold(o: {
  contractId: string; title: string; amountUsd: number; returnUrl: string; cancelUrl: string;
}, c = config()): Promise<Hold> {
  if (!(o.amountUsd > 0)) throw new Error('A hold needs an amount above zero.');
  if (c.mode === 'simulated') {
    const orderId = sim('ORDER');
    const u = new URL(o.returnUrl);
    u.searchParams.set('token', orderId);
    return { orderId, approveUrl: u.toString() };
  }
  const order = await call(c, 'creating the hold', 'POST', '/v2/checkout/orders', {
    intent: 'AUTHORIZE',
    purchase_units: [{
      reference_id: o.contractId,
      custom_id: o.contractId,
      description: `Escrow: ${o.title}`.slice(0, 127),
      amount: usd(o.amountUsd),
    }],
    payment_source: {
      paypal: {
        experience_context: {
          brand_name: 'Fairpay',
          user_action: 'CONTINUE',
          shipping_preference: 'NO_SHIPPING',
          return_url: o.returnUrl,
          cancel_url: o.cancelUrl,
        },
      },
    },
  }, `hold-${o.contractId}-${Date.now()}`);
  const approve = (order.links ?? []).find((l: any) => l.rel === 'payer-action' || l.rel === 'approve');
  if (!approve) throw new Error('PayPal created the order but sent no approval link.');
  return { orderId: order.id, approveUrl: approve.href };
}

export interface Authorized { authorizationId: string; amountUsd: number; expires?: string; payer?: string }

/** The client approved: turn the order into money held for this contract. */
export async function authorize(orderId: string, amountUsd: number, c = config()): Promise<Authorized> {
  if (c.mode === 'simulated') return { authorizationId: sim('AUTH'), amountUsd, payer: 'simulated buyer' };
  const r = await call(c, 'holding the budget', 'POST', `/v2/checkout/orders/${encodeURIComponent(orderId)}/authorize`,
                       {}, `auth-${orderId}`);
  const a = r.purchase_units?.[0]?.payments?.authorizations?.[0];
  if (!a || a.status !== 'CREATED') throw new Error(`PayPal did not hold the budget (status ${a?.status ?? r.status}).`);
  return {
    authorizationId: a.id,
    amountUsd: Number(a.amount?.value ?? amountUsd),
    expires: a.expiration_time,
    payer: r.payer?.email_address ?? r.payment_source?.paypal?.email_address,
  };
}

/* ── capture and payout ────────────────────────────────────────────────── */

/** Take one accepted piece of work's price out of the hold. */
export async function capture(o: {
  authorizationId: string; amountUsd: number; invoiceId: string; note: string; final?: boolean;
}, c = config()): Promise<{ captureId: string }> {
  if (c.mode === 'simulated') return { captureId: sim('CAP') };
  const r = await call(c, 'taking the payment from the hold', 'POST',
    `/v2/payments/authorizations/${encodeURIComponent(o.authorizationId)}/capture`, {
      amount: usd(o.amountUsd),
      invoice_id: o.invoiceId.slice(0, 127),
      note_to_payer: o.note.slice(0, 255),
      final_capture: !!o.final,
    }, `cap-${o.invoiceId}`);
  if (r.status !== 'COMPLETED' && r.status !== 'PENDING') throw new Error(`PayPal capture is ${r.status}.`);
  return { captureId: r.id };
}

/** Send the money to whoever did the work. */
export async function payout(o: {
  email: string; amountUsd: number; batchId: string; note: string; subject: string;
}, c = config()): Promise<{ batchId: string; status: string }> {
  if (c.mode === 'simulated') return { batchId: sim('BATCH'), status: 'SUCCESS' };
  const r = await call(c, 'paying the worker', 'POST', '/v1/payments/payouts', {
    sender_batch_header: {
      sender_batch_id: o.batchId.slice(0, 127),
      email_subject: o.subject.slice(0, 255),
      email_message: o.note.slice(0, 1000),
    },
    items: [{
      recipient_type: 'EMAIL',
      receiver: o.email,
      amount: { currency: 'USD', value: round2(o.amountUsd).toFixed(2) },
      note: o.note.slice(0, 4000),
      sender_item_id: o.batchId.slice(0, 63),
    }],
  }, `payout-${o.batchId}`);
  return { batchId: r.batch_header?.payout_batch_id, status: r.batch_header?.batch_status ?? 'PENDING' };
}

/** Give back what the contract never needed. */
export async function release(authorizationId: string, c = config()): Promise<void> {
  if (c.mode === 'simulated') return;
  await call(c, 'releasing the rest of the hold', 'POST',
    `/v2/payments/authorizations/${encodeURIComponent(authorizationId)}/void`, undefined, `void-${authorizationId}`);
}
