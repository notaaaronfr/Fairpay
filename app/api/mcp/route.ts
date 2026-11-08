/**
 * Fairpay for AI agents — a Model Context Protocol server (streamable HTTP,
 * stateless JSON responses) at /api/mcp.
 *
 * An agent can hire a person (or another agent) on proof: open an escrow,
 * hand its human the PayPal link to fund it, submit delivered work, and
 * release payment. Two guardrails make it safe to give an agent money:
 *
 *   1. Funding always needs a human: the tool returns PayPal's approval link,
 *      it cannot approve on anyone's behalf.
 *   2. An agent can never release more than the AI referee recommended for
 *      that milestone. Paying beyond the evidence needs a person in the app.
 *
 * Set FAIRPAY_AGENT_KEY to require `Authorization: Bearer <key>`.
 */
import { db, contract, milestones, milestone } from '../../../lib/db.ts';
import * as escrow from '../../../lib/escrow.ts';
import { round2 } from '../../../lib/paypal.ts';
import { allowAI, clientIp } from '../../../lib/limits.ts';

export const dynamic = 'force-dynamic';

const TOOLS = [
  {
    name: 'create_escrow',
    annotations: { title: 'Open an escrow', readOnlyHint: false, destructiveHint: false },
    description: 'Open a pay-on-proof contract: milestones with acceptance criteria and USD amounts. Returns the contract id and a PayPal link a human must open to fund it (the money is held, not taken).',
    inputSchema: {
      type: 'object', additionalProperties: false,
      required: ['title', 'client_name', 'freelancer_name', 'freelancer_paypal_email', 'milestones'],
      properties: {
        title: { type: 'string' }, scope: { type: 'string' },
        client_name: { type: 'string' }, freelancer_name: { type: 'string' },
        freelancer_paypal_email: { type: 'string', description: 'Where payouts are sent.' },
        milestones: {
          type: 'array', minItems: 1,
          items: {
            type: 'object', additionalProperties: false, required: ['title', 'criteria', 'amount_usd'],
            properties: {
              title: { type: 'string' },
              criteria: { type: 'array', items: { type: 'string' }, description: 'Checkable acceptance criteria.' },
              amount_usd: { type: 'number' },
            },
          },
        },
      },
    },
  },
  {
    name: 'get_escrow',
    annotations: { title: 'Check an escrow', readOnlyHint: true },
    description: 'Where a contract stands: money held, paid and returned, each milestone\'s status and the referee\'s latest verdict.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['contract_id'], properties: { contract_id: { type: 'string' } } },
  },
  {
    name: 'submit_work',
    annotations: { title: 'Submit work for review', readOnlyHint: false, destructiveHint: false },
    description: 'Submit a milestone\'s deliverable (a note and/or a public link). The AI referee checks it against every criterion and returns its verdict.',
    inputSchema: {
      type: 'object', additionalProperties: false, required: ['milestone_id'],
      properties: { milestone_id: { type: 'string' }, note: { type: 'string' }, url: { type: 'string' } },
    },
  },
  {
    name: 'release_payment',
    annotations: { title: 'Release payment (moves money)', readOnlyHint: false, destructiveHint: true },
    description: 'Release a submitted milestone: captured from the PayPal hold and paid out to the freelancer. Agents may release at most what the referee recommended.',
    inputSchema: {
      type: 'object', additionalProperties: false, required: ['milestone_id'],
      properties: { milestone_id: { type: 'string' }, amount_usd: { type: 'number', description: 'Defaults to the referee\'s recommendation.' } },
    },
  },
  {
    name: 'request_changes',
    annotations: { title: 'Request changes', readOnlyHint: false, destructiveHint: false },
    description: 'Send a submitted milestone back to the freelancer with a message (the referee\'s note is a good default).',
    inputSchema: {
      type: 'object', additionalProperties: false, required: ['milestone_id', 'message'],
      properties: { milestone_id: { type: 'string' }, message: { type: 'string' } },
    },
  },
];

function summary(id: string) {
  const d = db();
  const c = contract(d, id);
  if (!c) throw new escrow.EscrowError('No such contract.');
  const ms = milestones(d, id);
  return {
    contract_id: c.id, title: c.title, status: c.status,
    total_usd: c.total_usd, held_usd: escrow.heldUsd(c, ms),
    paid_usd: round2(ms.reduce((s, m) => s + m.paid_usd, 0)), returned_usd: c.refunded_usd,
    milestones: ms.map(m => {
      const v = m.review ? JSON.parse(m.review) : null;
      return {
        milestone_id: m.id, title: m.title, amount_usd: m.amount_usd, status: m.status, paid_usd: m.paid_usd,
        criteria: m.criteria.split('\n'),
        referee: v && { recommendation: v.recommendation, release_percent: v.release_percent, summary: v.summary,
                        checks: v.checks, message_to_freelancer: v.message_to_freelancer },
      };
    }),
  };
}

async function call(name: string, a: any, origin: string, ip = 'unknown'): Promise<unknown> {
  const d = db();
  switch (name) {
    case 'create_escrow': {
      const id = escrow.createContract(d, {
        title: String(a.title ?? ''), scope: a.scope ? String(a.scope) : '',
        clientName: String(a.client_name ?? ''), freelancerName: String(a.freelancer_name ?? ''),
        freelancerEmail: String(a.freelancer_paypal_email ?? ''),
        milestones: (Array.isArray(a.milestones) ? a.milestones : []).map((m: any) => ({
          title: String(m.title ?? ''), amountUsd: Number(m.amount_usd),
          criteria: (Array.isArray(m.criteria) ? m.criteria : [m.criteria]).filter(Boolean).join('\n'),
        })),
      });
      const fundUrl = await escrow.startFunding(d, id, origin);
      return { ...summary(id), fund_url: fundUrl, view_url: `${origin}/c/${id}`,
               next: 'Give fund_url to the human paying. Work should start once status is "funded".' };
    }
    case 'get_escrow': return summary(String(a.contract_id ?? ''));
    case 'submit_work': {
      const g = allowAI(d, ip, 'referee');
      const v = await escrow.submit(d, String(a.milestone_id ?? ''), { note: String(a.note ?? ''), url: a.url ? String(a.url) : undefined }, fetch, { offline: g.ok ? undefined : g.why });
      return { verdict: v };
    }
    case 'release_payment': {
      const m = milestone(d, String(a.milestone_id ?? ''));
      if (!m) throw new escrow.EscrowError('No such milestone.');
      const v = m.review ? JSON.parse(m.review) : null;
      const cap = v ? round2(m.amount_usd * v.release_percent / 100) : 0;
      const amount = a.amount_usd === undefined ? cap : round2(Number(a.amount_usd));
      if (!(cap > 0)) throw new escrow.EscrowError('The referee has not recommended releasing anything for this milestone. A person can still decide in the app.');
      if (amount > cap + 0.001) throw new escrow.EscrowError(`Agents can release at most the referee's recommendation ($${cap.toFixed(2)}). A person can release more in the app.`);
      const r = await escrow.release(d, m.id, amount);
      return { released_usd: r.amount, ...summary(m.contract_id) };
    }
    case 'request_changes': {
      escrow.requestChanges(d, String(a.milestone_id ?? ''), String(a.message ?? ''));
      return { ok: true };
    }
    default: throw new RpcError(-32602, `Unknown tool: ${name}`);
  }
}

class RpcError extends Error { code: number; constructor(code: number, message: string) { super(message); this.code = code; } }

async function handle(msg: any, origin: string, ip = 'unknown'): Promise<any | null> {
  const { id, method, params } = msg ?? {};
  const ok = (result: unknown) => ({ jsonrpc: '2.0', id, result });
  if (id === undefined || id === null) return null; // a notification: nothing to answer
  try {
    switch (method) {
      case 'initialize':
        return ok({
          protocolVersion: params?.protocolVersion ?? '2025-06-18',
          capabilities: { tools: {} },
          serverInfo: { name: 'fairpay', version: '0.1.0' },
          instructions: 'Pay-on-proof escrow on PayPal. Create an escrow, have a human fund it, submit work for the AI referee, release payment up to the referee\'s recommendation.',
        });
      case 'ping': return ok({});
      case 'tools/list': return ok({ tools: TOOLS });
      case 'tools/call': {
        try {
          const out = await call(params?.name, params?.arguments ?? {}, origin, ip);
          return ok({ content: [{ type: 'text', text: JSON.stringify(out, null, 2) }], structuredContent: out });
        } catch (e) {
          if (e instanceof RpcError) throw e;
          return ok({ content: [{ type: 'text', text: (e as Error).message }], isError: true });
        }
      }
      default: throw new RpcError(-32601, `Method not found: ${method}`);
    }
  } catch (e) {
    const err = e instanceof RpcError ? e : new RpcError(-32603, (e as Error).message);
    return { jsonrpc: '2.0', id, error: { code: err.code, message: err.message } };
  }
}

export async function POST(req: Request) {
  const key = process.env.FAIRPAY_AGENT_KEY;
  if (key && req.headers.get('authorization') !== `Bearer ${key}`) {
    return Response.json({ jsonrpc: '2.0', id: null, error: { code: -32001, message: 'Unauthorized' } }, { status: 401 });
  }
  const origin = process.env.FAIRPAY_BASE_URL?.replace(/\/$/, '') ?? new URL(req.url).origin;
  const ip = clientIp(req.headers);
  let body: any;
  try { body = await req.json(); }
  catch { return Response.json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, { status: 400 }); }

  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map(m => handle(m, origin, ip)))).filter(Boolean);
    return out.length ? Response.json(out) : new Response(null, { status: 202 });
  }
  const out = await handle(body, origin, ip);
  return out ? Response.json(out) : new Response(null, { status: 202 });
}

export async function GET() {
  // No server-initiated stream: this server only answers requests.
  return new Response('Fairpay MCP endpoint. POST JSON-RPC here.', { status: 405, headers: { Allow: 'POST' } });
}
