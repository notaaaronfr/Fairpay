'use client';

import { useActionState, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { hireWithAgent } from '../lib/actions.ts';
import { Spark } from './Icons.tsx';

const IDEAS = [
  'Logo for my bakery, 2 milestones, $300, pay lina@freelancer.example',
  'Landing page in Next.js, 3 milestones, $1,200, pay sam@dev.example',
  'Translate my app to Arabic, $450, pay noor@words.example',
];

/** One sentence in; the Cairn agent opens the escrow. */
export function AgentBrief({ ready, why }: { ready: boolean; why?: string }) {
  const [state, action, pending] = useActionState(hireWithAgent, null);
  const [text, setText] = useState('');
  return (
    <form action={action} className="track brief">
      <div className="title">Describe it <span className="live">Cairn agent</span></div>
      <textarea name="brief" value={text} onChange={e => setText(e.target.value)} rows={2}
        placeholder="What, how much, who gets paid" aria-label="Describe the job" disabled={!ready || pending} />
      <div className="ideas">
        {IDEAS.map(i => <button type="button" key={i} onClick={() => setText(i)} disabled={pending}>{i.split(',')[0]}</button>)}
      </div>
      <div className="foot" style={{ alignItems: 'center' }}>
        <span>{ready ? 'Splits it into milestones, criteria and prices' : why}</span>
        <button className="btn primary" disabled={!ready || pending || text.trim().length < 12}>
          <Spark />{pending ? 'Building…' : 'Build escrow'}
        </button>
      </div>
      <AnimatePresence>
        {pending && (
          <motion.div className="agent-steps" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            {['Reading the brief', 'Splitting milestones', 'Writing criteria', 'Opening the escrow'].map((s, i) => (
              <motion.span key={s} initial={{ opacity: 0.25 }} animate={{ opacity: [0.25, 1, 0.25] }} transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.6 }}>{s}</motion.span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      {state?.error && <div className="note err" style={{ marginTop: 12 }}>{state.error}</div>}
      {!state?.error && state?.output && <div className="note" style={{ marginTop: 12 }}>{state.output}</div>}
    </form>
  );
}
