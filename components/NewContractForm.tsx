'use client';

import { useActionState, useState, useTransition } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { createContract, sharpenCriteria } from '../lib/actions.ts';
import { Mark } from './Brand.tsx';
import { Spark, Plus } from './Icons.tsx';

interface M { key: number; title: string; criteria: string[]; amount: string }

const EXAMPLE: M[] = [
  { key: 1, title: 'Design mockups', criteria: ['Mobile and desktop home page', 'Brand colours from the brief', 'Shared as a public link'], amount: '400' },
  { key: 2, title: 'Build and launch', criteria: ['Live on a public URL', 'Contact form works', 'Fast on mobile'], amount: '600' },
];
const TINTS = ['#0070e0', '#003087', '#009cde', '#7a5cff'];
const EASE = [0.22, 1, 0.36, 1] as const;

export function NewContractForm() {
  const [state, action, pending] = useActionState(createContract, null);
  const [ms, setMs] = useState<M[]>(EXAMPLE);
  const [who, setWho] = useState({ client: "Rosa's Bakery", freelancer: 'Lina Haddad', email: process.env.NEXT_PUBLIC_DEMO_PAYEE ?? 'lina@freelancer.example' });
  const [busy, setBusy] = useState<number | null>(null);
  const [, start] = useTransition();
  const total = ms.reduce((s, m) => s + (Number(m.amount) || 0), 0);

  const set = (key: number, patch: Partial<M>) => setMs(xs => xs.map(m => m.key === key ? { ...m, ...patch } : m));
  const setCrit = (key: number, i: number, v: string) => setMs(xs => xs.map(m => m.key === key ? { ...m, criteria: m.criteria.map((c, j) => j === i ? v : c) } : m));
  const sharpen = (m: M) => {
    setBusy(m.key);
    start(async () => {
      const r = await sharpenCriteria(m.title, m.criteria.join('\n'));
      if (r.criteria) set(m.key, { criteria: r.criteria });
      setBusy(null);
    });
  };

  return (
    <form action={action} className="builder">
      <div className="stack" style={{ gap: 16, minWidth: 0 }}>
        {state?.error && <div className="note err" role="alert">{state.error}</div>}

        <div className="panel parties">
          <input name="title" required defaultValue="Bakery website" aria-label="Title" className="ghost big" />
          <div className="party-row">
            <input name="client" required value={who.client} onChange={e => setWho({ ...who, client: e.target.value })} aria-label="Client" className="ghost" />
            <span className="arrow">→</span>
            <input name="freelancer" required value={who.freelancer} onChange={e => setWho({ ...who, freelancer: e.target.value })} aria-label="Freelancer" className="ghost" />
            <input name="email" type="email" required value={who.email} onChange={e => setWho({ ...who, email: e.target.value })} aria-label="Payout email" className="ghost mono-in" />
          </div>
          <input type="hidden" name="scope" value="" />
        </div>

        <AnimatePresence initial={false}>
          {ms.map((m, i) => (
            <motion.div key={m.key} className="panel mcard" layout
              initial={{ opacity: 0, y: 16, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: .96 }}
              transition={{ duration: .45, ease: EASE }}>
              <div className="mtop">
                <span className="av" style={{ background: TINTS[i % TINTS.length] }}>{i + 1}</span>
                <input name="m_title" value={m.title} onChange={e => set(m.key, { title: e.target.value })} required placeholder="Deliverable" aria-label="Deliverable" className="ghost big" />
                <label className="money-in"><span>$</span><input name="m_amount" inputMode="decimal" value={m.amount} onChange={e => set(m.key, { amount: e.target.value })} required aria-label="Amount" /></label>
              </div>
              <input type="hidden" name="m_criteria" value={m.criteria.filter(Boolean).join('\n')} />
              <div className="crit-list">
                {m.criteria.map((c, j) => (
                  <motion.div key={j} className="crit-row" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: j * .04, ease: EASE }}>
                    <span className="tick">✓</span>
                    <input value={c} onChange={e => setCrit(m.key, j, e.target.value)} className="ghost" aria-label={`Criterion ${j + 1}`} placeholder="Checkable criterion" />
                    <button type="button" className="x" aria-label="Remove criterion" onClick={() => set(m.key, { criteria: m.criteria.filter((_, k) => k !== j) })}>×</button>
                  </motion.div>
                ))}
              </div>
              <div className="row between">
                <div className="row" style={{ gap: 8 }}>
                  <button type="button" className="btn small" onClick={() => set(m.key, { criteria: [...m.criteria, ''] })}><Plus />Criterion</button>
                  <button type="button" className="btn small sun" onClick={() => sharpen(m)} disabled={busy !== null}><Spark />{busy === m.key ? 'Sharpening…' : 'Sharpen'}</button>
                </div>
                {ms.length > 1 && <button type="button" className="btn small" onClick={() => setMs(xs => xs.filter(x => x.key !== m.key))}>Remove</button>}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        <button type="button" className="add-tile" onClick={() => setMs(xs => [...xs, { key: Date.now(), title: '', criteria: [''], amount: '' }])}>
          <Plus />Milestone
        </button>
      </div>

      <aside className="summary">
        <div className="panel stack" style={{ gap: 16 }}>
          <div className="plastic" style={{ aspectRatio: '1.6' }}>
            <div className="lbl">ESCROW · USD</div>
            <div className="emv" />
            <div className="num">{who.freelancer || '—'}</div>
            <span className="big-mark"><Mark size={130} /></span>
          </div>
          <div>
            <div className="dim">To hold in PayPal</div>
            <motion.div key={total} className="total" initial={{ opacity: .4, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .35, ease: EASE }}>
              ${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </motion.div>
          </div>
          <div className="splitbar">
            {ms.map((m, i) => (
              <motion.i key={m.key} layout style={{ flex: Math.max(0.0001, Number(m.amount) || 0), background: TINTS[i % TINTS.length] }} transition={{ ease: EASE }} />
            ))}
          </div>
          <div className="legend-list">
            {ms.map((m, i) => (
              <div key={m.key} className="row between"><span><i className="sw" style={{ background: TINTS[i % TINTS.length] }} />{m.title || `Milestone ${i + 1}`}</span><span>${Number(m.amount || 0).toLocaleString('en-US')}</span></div>
            ))}
          </div>
          <button className="btn primary block" disabled={pending}>{pending ? 'Creating…' : 'Create escrow'}</button>
        </div>
      </aside>
    </form>
  );
}
