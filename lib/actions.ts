'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { headers, cookies } from 'next/headers';
import { db } from './db.ts';
import * as escrow from './escrow.ts';
import { sharpen } from './referee.ts';

/** Server actions: every form posts straight to one of these. */

const back = (id: string, q: Record<string, string> = {}) => {
  revalidatePath(`/c/${id}`);
  revalidatePath('/');
  const s = new URLSearchParams(q).toString();
  redirect(`/c/${id}${s ? '?' + s : ''}` as any);
};
const msg = (e: unknown) => e instanceof Error ? e.message : String(e);

/** May this visitor make a paid AI call now? */
async function gate(kind: 'referee' | 'sharpen' | 'agent') {
  const { allowAI, clientIp } = await import('./limits.ts');
  return allowAI(db(), clientIp(await headers()), kind);
}

async function origin(): Promise<string> {
  if (process.env.FAIRPAY_BASE_URL) return process.env.FAIRPAY_BASE_URL.replace(/\/$/, '');
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (/^(localhost|127\.)/.test(host) ? 'http' : 'https');
  return `${proto}://${host}`;
}

export async function setRole(formData: FormData) {
  const role = formData.get('role') === 'freelancer' ? 'freelancer' : 'client';
  (await cookies()).set('fp_role', role, { path: '/', sameSite: 'lax' });
  const to = String(formData.get('to') ?? '/');
  redirect((to.startsWith('/') ? to : '/') as any);
}

export async function setTheme(formData: FormData) {
  const theme = formData.get('theme') === 'dark' ? 'dark' : 'light';
  (await cookies()).set('fp_theme', theme, { path: '/', sameSite: 'lax', maxAge: 60 * 60 * 24 * 365 });
  const to = String(formData.get('to') ?? '/');
  redirect((to.startsWith('/') ? to : '/') as any);
}

export interface Created { error?: string }

export async function createContract(_: Created | null, formData: FormData): Promise<Created> {
  const titles = formData.getAll('m_title').map(String);
  const criteria = formData.getAll('m_criteria').map(String);
  const amounts = formData.getAll('m_amount').map(v => Number(String(v).replace(/[$,\s]/g, '')));
  let id: string;
  try {
    id = escrow.createContract(db(), {
      title: String(formData.get('title') ?? ''),
      scope: String(formData.get('scope') ?? ''),
      clientName: String(formData.get('client') ?? ''),
      freelancerName: String(formData.get('freelancer') ?? ''),
      freelancerEmail: String(formData.get('email') ?? ''),
      milestones: titles.map((t, i) => ({ title: t, criteria: criteria[i] ?? '', amountUsd: amounts[i] ?? 0 })),
    });
  } catch (e) { return { error: msg(e) }; }
  revalidatePath('/');
  redirect(`/c/${id}` as any);
}

/** Make a milestone's criteria checkable before money is committed. */
export async function sharpenCriteria(title: string, draft: string): Promise<{ criteria?: string[]; error?: string }> {
  const g = await gate('sharpen');
  try { return { criteria: await sharpen(title, draft, !g.ok), error: g.ok ? undefined : g.why }; }
  catch (e) { return { error: msg(e) }; }
}

export async function fund(formData: FormData) {
  const id = String(formData.get('contract'));
  let url: string;
  try { url = await escrow.startFunding(db(), id, await origin()); }
  catch (e) { return back(id, { error: msg(e) }); }
  redirect(url as any);
}

export async function submitWork(formData: FormData) {
  const id = String(formData.get('contract'));
  try {
    const g = await gate('referee');
    await escrow.submit(db(), String(formData.get('milestone')), {
      note: String(formData.get('note') ?? ''), url: String(formData.get('url') ?? ''),
    }, fetch, { offline: g.ok ? undefined : g.why });
  } catch (e) { return back(id, { error: msg(e) }); }
  back(id, { done: 'Submitted. The referee has checked it — the client will see the same verdict.' });
}

export async function rereview(formData: FormData) {
  const id = String(formData.get('contract'));
  const g = await gate('referee');
  try { await escrow.review(db(), String(formData.get('milestone')), fetch, { offline: g.ok ? undefined : g.why }); }
  catch (e) { return back(id, { error: msg(e) }); }
  back(id);
}

export async function releasePayment(formData: FormData) {
  const id = String(formData.get('contract'));
  const raw = String(formData.get('amount') ?? '').replace(/[$,\s]/g, '');
  let done: string;
  try {
    const r = await escrow.release(db(), String(formData.get('milestone')), raw ? Number(raw) : undefined);
    done = `$${r.amount.toFixed(2)} released and paid out through PayPal.`;
  } catch (e) { return back(id, { error: msg(e) }); }
  back(id, { done });
}

export async function requestChanges(formData: FormData) {
  const id = String(formData.get('contract'));
  try { escrow.requestChanges(db(), String(formData.get('milestone')), String(formData.get('message') ?? '')); }
  catch (e) { return back(id, { error: msg(e) }); }
  back(id, { done: 'Sent back to the freelancer with the referee\'s notes.' });
}

export async function closeContract(formData: FormData) {
  const id = String(formData.get('contract'));
  let returned: number;
  try { returned = await escrow.close(db(), id); }
  catch (e) { return back(id, { error: msg(e) }); }
  back(id, { done: `Contract closed. $${returned.toFixed(2)} returned to the client.` });
}

/* ── the built-in Cairn agent ──────────────────────────────────────────── */

export interface Hired { error?: string; output?: string }

export async function hireWithAgent(_: Hired | null, formData: FormData): Promise<Hired> {
  const brief = String(formData.get('brief') ?? '').trim();
  if (brief.length < 12) return { error: 'Say what, how much, and who gets paid.' };
  const g = await gate('agent');
  if (!g.ok) return { error: g.why };
  const { hire } = await import('./agent.ts');
  const { contractId, result } = await hire(db(), brief, await origin());
  if (!contractId) return { error: result.status === 'error' ? result.output : undefined, output: result.output || 'The agent did not open an escrow.' };
  revalidatePath('/');
  redirect(`/c/${contractId}?done=${encodeURIComponent('Opened by the agent. Fund it to start.')}` as any);
}

export async function settleWithAgent(formData: FormData) {
  const id = String(formData.get('contract'));
  const g = await gate('agent');
  if (!g.ok) return back(id, { error: g.why! });
  const { settle } = await import('./agent.ts');
  const r = await settle(db(), id, await origin());
  if (r.status === 'error' || r.status === 'failed') return back(id, { error: r.output });
  back(id);
}

export async function decideAgent(formData: FormData) {
  const id = String(formData.get('contract'));
  const { decide } = await import('./agent.ts');
  const r = await decide(db(), String(formData.get('run')), String(formData.get('call')), formData.get('answer') === 'yes', await origin());
  if (r.status === 'error' || r.status === 'failed') return back(id, { error: r.output });
  back(id);
}
