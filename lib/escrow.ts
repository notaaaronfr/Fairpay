import type { DatabaseSync } from 'node:sqlite';
import * as paypal from './paypal.ts';
import { round2 } from './paypal.ts';
import { referee, readDeliverable, criteriaList, type Verdict } from './referee.ts';
import { contract, milestones, milestone, log, update, newId, now, type Contract, type Milestone } from './db.ts';

/**
 * The escrow, start to finish.
 *
 *   create   → a contract with milestones, each with criteria and a price
 *   fund     → the client approves the total in PayPal; it is HELD
 *   submit   → the freelancer delivers a milestone (a note and a link)
 *   referee  → the AI checks every criterion and recommends a release
 *   release  → the client releases (all or part): capture + PayPal Payout
 *   changes  → or sends it back with the referee's specific feedback
 *   close    → whatever was never released is voided back to the client
 *
 * Every step is an event both parties can read. Money only moves on a
 * person's click; the referee only recommends.
 */

export class EscrowError extends Error {}
const fail = (m: string): never => { throw new EscrowError(m); };

export interface NewContract {
  title: string; scope?: string;
  clientName: string; freelancerName: string; freelancerEmail: string;
  milestones: { title: string; criteria: string; amountUsd: number }[];
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function createContract(d: DatabaseSync, c: NewContract): string {
  if (!c.title.trim()) fail('Give the contract a title.');
  if (!c.clientName.trim() || !c.freelancerName.trim()) fail('Name both the client and the freelancer.');
  if (!EMAIL.test(c.freelancerEmail.trim())) fail('The freelancer needs a PayPal email address to be paid at.');
  const ms = c.milestones.filter(m => m.title.trim());
  if (!ms.length) fail('Add at least one milestone.');
  for (const m of ms) {
    if (!(m.amountUsd > 0)) fail(`"${m.title}" needs an amount above zero.`);
    if (!criteriaList(m.criteria).length) fail(`"${m.title}" needs at least one acceptance criterion — that is what the referee checks.`);
  }
  const id = newId('ctr');
  const total = round2(ms.reduce((s, m) => s + m.amountUsd, 0));
  d.prepare(`INSERT INTO contracts (id,title,scope,client_name,freelancer_name,freelancer_email,status,total_usd,created_at)
             VALUES (?,?,?,?,?,?,'draft',?,?)`)
    .run(id, c.title.trim(), (c.scope ?? '').trim(), c.clientName.trim(), c.freelancerName.trim(),
         c.freelancerEmail.trim(), total, now());
  ms.forEach((m, i) => d.prepare(`INSERT INTO milestones (id,contract_id,position,title,criteria,amount_usd) VALUES (?,?,?,?,?,?)`)
    .run(newId('ms'), id, i + 1, m.title.trim(), criteriaList(m.criteria).join('\n'), round2(m.amountUsd)));
  log(d, { contract: id, actor: 'client', kind: 'contract.created', detail: { total, milestones: ms.length } });
  return id;
}

/** Money still held: the authorized total less what was released or returned. */
export function heldUsd(c: Contract, ms: Milestone[]): number {
  if (!c.authorization_id) return 0;
  return round2(c.total_usd - ms.reduce((s, m) => s + m.paid_usd, 0) - c.refunded_usd);
}

/* ── fund ──────────────────────────────────────────────────────────────── */

export async function startFunding(d: DatabaseSync, id: string, origin: string): Promise<string> {
  const c = contract(d, id) ?? fail('No such contract.');
  if (c.authorization_id) fail('This contract is already funded.');
  const back = `${origin}/c/${id}/paypal`;
  const h = await paypal.createHold({
    contractId: id, title: c.title, amountUsd: c.total_usd, returnUrl: back, cancelUrl: `${back}?cancel=1`,
  });
  update(d, 'contracts', id, { order_id: h.orderId, status: 'awaiting_funds' });
  log(d, { contract: id, actor: 'client', kind: 'funding.started', detail: { orderId: h.orderId, amount: c.total_usd, mode: paypal.config().mode } });
  return h.approveUrl;
}

export async function confirmFunding(d: DatabaseSync, id: string, orderId: string): Promise<void> {
  const c = contract(d, id) ?? fail('No such contract.');
  if (c.authorization_id && c.order_id === orderId) return; // the return page refreshed
  if (c.order_id !== orderId) fail('That PayPal approval is not the one this contract started.');
  const a = await paypal.authorize(orderId, c.total_usd);
  update(d, 'contracts', id, { authorization_id: a.authorizationId, payer: a.payer ?? null,
                               hold_expires: a.expires ?? null, status: 'funded' });
  log(d, { contract: id, actor: 'paypal', kind: 'funding.held', detail: { ...a } });
}

export function cancelFunding(d: DatabaseSync, id: string) {
  const c = contract(d, id) ?? fail('No such contract.');
  if (c.authorization_id) return;
  update(d, 'contracts', id, { status: 'draft', order_id: null });
  log(d, { contract: id, actor: 'client', kind: 'funding.cancelled' });
}

/* ── submit and referee ────────────────────────────────────────────────── */

export async function submit(d: DatabaseSync, milestoneId: string, s: { note: string; url?: string },
                             fetcher: typeof fetch = fetch): Promise<Verdict> {
  const m = milestone(d, milestoneId) ?? fail('No such milestone.');
  const c = contract(d, m.contract_id)!;
  if (c.status !== 'funded') fail('Work can be submitted once the contract is funded — that is the freelancer\'s guarantee.');
  if (m.status === 'released' || m.status === 'cancelled') fail('That milestone is already settled.');
  const note = s.note.trim();
  const url = s.url?.trim() || null;
  if (!note && !url) fail('Describe what you delivered, or link to it.');

  update(d, 'milestones', m.id, { submission_note: note, submission_url: url, submitted_at: now(), status: 'submitted' });
  log(d, { contract: c.id, milestone: m.id, actor: 'freelancer', kind: 'work.submitted', detail: { url, note: note.slice(0, 280) } });
  return review(d, m.id, fetcher);
}

/** Run (or re-run) the referee on the current submission. */
export async function review(d: DatabaseSync, milestoneId: string, fetcher: typeof fetch = fetch): Promise<Verdict> {
  const m = milestone(d, milestoneId) ?? fail('No such milestone.');
  const c = contract(d, m.contract_id)!;
  const urlText = await readDeliverable(m.submission_url, fetcher);
  let v: Verdict;
  try {
    v = await referee({
      contractTitle: c.title, scope: c.scope,
      milestone: { title: m.title, criteria: m.criteria, amountUsd: m.amount_usd },
      note: m.submission_note ?? '', url: m.submission_url, urlText,
    });
  } catch (e) {
    log(d, { contract: c.id, milestone: m.id, actor: 'referee', kind: 'referee.failed', detail: { error: (e as Error).message } });
    throw e;
  }
  update(d, 'milestones', m.id, { review: JSON.stringify(v) });
  log(d, { contract: c.id, milestone: m.id, actor: 'referee', kind: 'referee.verdict',
           detail: { recommendation: v.recommendation, percent: v.release_percent, model: v.model,
                     met: v.checks.filter(x => x.status === 'met').length, of: v.checks.length } });
  return v;
}

/* ── release, or send back ─────────────────────────────────────────────── */

export async function release(d: DatabaseSync, milestoneId: string, amountUsd?: number) {
  const m = milestone(d, milestoneId) ?? fail('No such milestone.');
  const c = contract(d, m.contract_id)!;
  if (!c.authorization_id || c.status !== 'funded') fail('There is no money held for this contract.');
  if (m.status === 'released' || m.status === 'cancelled') fail('That milestone was already settled.');
  if (m.status !== 'submitted') fail('Nothing has been submitted for this milestone yet.');

  const v: Verdict | null = m.review ? JSON.parse(m.review) : null;
  const suggested = v ? round2(m.amount_usd * v.release_percent / 100) : m.amount_usd;
  const amount = round2(amountUsd ?? suggested);
  if (!(amount > 0)) fail('Release an amount above zero, or request changes instead.');
  if (amount > m.amount_usd + 0.001) fail(`This milestone is $${m.amount_usd.toFixed(2)}; you can release at most that.`);
  const held = heldUsd(c, milestones(d, c.id));
  if (amount > held + 0.001) fail(`Only $${held.toFixed(2)} is still held.`);

  let captureId: string | null = null;
  try {
    ({ captureId } = await paypal.capture({ authorizationId: c.authorization_id!, amountUsd: amount,
                                            invoiceId: `fp-${m.id}`, note: `${c.title}: ${m.title}` }));
    const out = await paypal.payout({
      email: c.freelancer_email, amountUsd: amount, batchId: `fp-${m.id}`,
      subject: `Payment released: ${m.title}`,
      note: `${c.client_name} released $${amount.toFixed(2)} for "${m.title}" (${c.title}) via Fairpay.`,
    });
    update(d, 'milestones', m.id, { status: 'released', paid_usd: amount, capture_id: captureId,
                                    payout_batch_id: out.batchId, payout_status: out.status });
    log(d, { contract: c.id, milestone: m.id, actor: 'paypal', kind: 'payment.released',
             detail: { amount, of: m.amount_usd, followedReferee: Math.abs(amount - suggested) < 0.01,
                       captureId, payoutBatchId: out.batchId, status: out.status } });
  } catch (e) {
    log(d, { contract: c.id, milestone: m.id, actor: 'paypal', kind: 'payment.failed',
             detail: { amount, captureId, error: (e as Error).message } });
    throw e;
  }
  // A partial release closes the milestone: the rest stays held and returns on close.
  if (milestones(d, c.id).every(x => x.status === 'released' || x.status === 'cancelled')) await close(d, c.id);
  return { amount };
}

export function requestChanges(d: DatabaseSync, milestoneId: string, message: string) {
  const m = milestone(d, milestoneId) ?? fail('No such milestone.');
  if (m.status !== 'submitted') fail('Only a submitted milestone can be sent back.');
  update(d, 'milestones', m.id, { status: 'changes_requested' });
  log(d, { contract: m.contract_id, milestone: m.id, actor: 'client', kind: 'changes.requested', detail: { message: message.trim() } });
}

/* ── close ─────────────────────────────────────────────────────────────── */

/** Settle the contract: cancel what is left and void the rest of the hold back to the client. */
export async function close(d: DatabaseSync, id: string) {
  const c = contract(d, id) ?? fail('No such contract.');
  if (c.status === 'closed') return 0;
  const ms = milestones(d, id);
  const back = heldUsd(c, ms);
  if (c.authorization_id && back > 0) {
    try { await paypal.release(c.authorization_id); }
    catch (e) {
      log(d, { contract: id, actor: 'paypal', kind: 'refund.failed', detail: { error: (e as Error).message } });
      throw e;
    }
  }
  for (const m of ms) if (m.status !== 'released') update(d, 'milestones', m.id, { status: 'cancelled' });
  update(d, 'contracts', id, { status: 'closed', refunded_usd: round2(c.refunded_usd + Math.max(0, back)) });
  log(d, { contract: id, actor: 'paypal', kind: 'contract.closed', detail: { returnedToClient: back } });
  return back;
}
