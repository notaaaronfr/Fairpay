import Link from 'next/link';
import { db, recent } from '../../lib/db.ts';
import { Activity } from '../../components/Escrow.tsx';
import { BlurText, CountUp, Rise, Spotlight } from '../../components/Motion.tsx';

export const dynamic = 'force-dynamic';

const FILTERS: Record<string, { label: string; kinds: string[] }> = {
  all: { label: 'All', kinds: [] },
  money: { label: 'Money', kinds: ['funding.held', 'payment.released', 'contract.closed'] },
  referee: { label: 'Referee', kinds: ['referee.verdict', 'work.submitted', 'changes.requested'] },
  agent: { label: 'Agent', kinds: ['agent.hired', 'agent.waiting', 'agent.done', 'agent.approved', 'agent.denied'] },
};

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const { f = 'all' } = await searchParams;
  const all = recent(db(), 500);
  const filter = FILTERS[f] ?? FILTERS.all;
  const rows = filter.kinds.length ? all.filter(e => filter.kinds.includes(e.kind)) : all;
  const moved = all.filter(e => e.kind === 'payment.released').reduce((s, e) => s + (Number(JSON.parse(e.detail).amount) || 0), 0);

  const days = new Map<string, typeof rows>();
  for (const e of rows) {
    const k = new Date(e.at).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    days.set(k, [...(days.get(k) ?? []), e]);
  }

  return (
    <>
      <section className="balance-row">
        <div>
          <div className="welcome"><BlurText text="Paid on proof" /><span className="chip">{all.length} events</span></div>
          <div className="big-money"><CountUp value={moved} /></div>
        </div>
        <nav className="tabs" aria-label="Filter" style={{ alignSelf: 'flex-end' }}>
          {Object.entries(FILTERS).map(([k, v]) => <Link key={k} href={`/activity?f=${k}`} aria-current={f === k}>{v.label}</Link>)}
        </nav>
      </section>
      <div className="stack" style={{ gap: 20 }}>
        {[...days.entries()].map(([day, list], i) => (
          <Rise key={day} i={i}>
            <Spotlight className="panel">
              <div className="panel-head"><h2>{day}</h2><span className="dim">{list.length}</span></div>
              <Activity rows={list} link />
            </Spotlight>
          </Rise>
        ))}
        {!rows.length && <div className="panel dim">Nothing here yet.</div>}
      </div>
    </>
  );
}
