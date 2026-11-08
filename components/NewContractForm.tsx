'use client';

import { useActionState, useState, useTransition } from 'react';
import { createContract, sharpenCriteria } from '../lib/actions.ts';

interface M { key: number; title: string; criteria: string; amount: string }

const EXAMPLE: M[] = [
  { key: 1, title: 'Design mockups', criteria: 'Mobile and desktop mockups for the home page\nUses the brand colours from the brief\nShared as a public link', amount: '400' },
  { key: 2, title: 'Build and launch', criteria: 'Site deployed to a public URL\nContact form works\nPage loads fast on mobile', amount: '600' },
];

export function NewContractForm() {
  const [state, action, pending] = useActionState(createContract, null);
  const [ms, setMs] = useState<M[]>(EXAMPLE);
  const [busy, setBusy] = useState<number | null>(null);
  const [, start] = useTransition();
  const total = ms.reduce((s, m) => s + (Number(m.amount) || 0), 0);

  const set = (key: number, patch: Partial<M>) => setMs(xs => xs.map(m => m.key === key ? { ...m, ...patch } : m));
  const sharpen = (m: M) => {
    setBusy(m.key);
    start(async () => {
      const r = await sharpenCriteria(m.title, m.criteria);
      if (r.criteria) set(m.key, { criteria: r.criteria.join('\n') });
      setBusy(null);
    });
  };

  return (
    <form action={action} className="stack">
      {state?.error && <div className="note err" role="alert">{state.error}</div>}

      <div className="panel stack">
        <label>Contract title<input name="title" required defaultValue="Bakery website" /></label>
        <label>Scope <span className="dim">(optional — gives the referee context)</span>
          <textarea name="scope" defaultValue="A simple website for a neighbourhood bakery: home, menu and contact pages." />
        </label>
        <div className="grid2">
          <label>Client<input name="client" required defaultValue="Rosa's Bakery" /></label>
          <label>Freelancer<input name="freelancer" required defaultValue="Lina Haddad" /></label>
        </div>
        <label>Freelancer&rsquo;s PayPal email <span className="dim">(where payouts go)</span>
          <input name="email" type="email" required defaultValue={process.env.NEXT_PUBLIC_DEMO_PAYEE ?? 'lina@freelancer.example'} />
        </label>
      </div>

      {ms.map((m, i) => (
        <div className="panel stack" key={m.key}>
          <div className="row between">
            <h3>Milestone {i + 1}</h3>
            {ms.length > 1 && <button type="button" className="btn small" onClick={() => setMs(xs => xs.filter(x => x.key !== m.key))}>Remove</button>}
          </div>
          <div className="grid2">
            <label>What is delivered<input name="m_title" value={m.title} onChange={e => set(m.key, { title: e.target.value })} required /></label>
            <label>Amount (USD)<input name="m_amount" inputMode="decimal" value={m.amount} onChange={e => set(m.key, { amount: e.target.value })} required /></label>
          </div>
          <label>Acceptance criteria <span className="dim">(one per line — this is what the referee checks)</span>
            <textarea name="m_criteria" rows={4} value={m.criteria} onChange={e => set(m.key, { criteria: e.target.value })} />
          </label>
          <div className="row">
            <button type="button" className="btn small sun" onClick={() => sharpen(m)} disabled={busy !== null}>
              {busy === m.key ? 'Sharpening…' : '✦ Make criteria checkable with AI'}
            </button>
            <span className="dim">Vague criteria are where disputes come from.</span>
          </div>
        </div>
      ))}

      <div className="row between">
        <button type="button" className="btn" onClick={() => setMs(xs => [...xs, { key: Date.now(), title: '', criteria: '', amount: '' }])}>+ Add milestone</button>
        <div className="row">
          <span className="muted">Total to hold in PayPal: <b style={{ color: 'var(--ink)' }}>${total.toFixed(2)}</b></span>
          <button className="btn primary" disabled={pending}>{pending ? 'Creating…' : 'Create escrow'}</button>
        </div>
      </div>
    </form>
  );
}
