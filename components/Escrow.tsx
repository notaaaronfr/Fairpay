import Link from 'next/link';
import type { Contract, Event } from '../lib/db.ts';
import { usd } from '../lib/ui.ts';

const TONES = ['', 'violet', 'green'];

/** The contract as a card: what is held right now, and for whom. */
export function EscrowCard({ c, held, paid, index = 0 }: { c: Contract; held: number; paid: number; index?: number }) {
  const shown = c.status === 'closed' ? paid : held || c.total_usd;
  const label = c.status === 'closed' ? 'Paid out' : held ? 'Held in PayPal' : 'To be held';
  return (
    <div>
      <div className={`ecard ${TONES[index % TONES.length]}`}>
        <div className="top"><span>FAIRPAY ESCROW</span><span>USD</span></div>
        <div className="num">
          •••• {c.id.slice(-8, -4).toUpperCase()} {c.id.slice(-4).toUpperCase()}
          <small>{c.title}</small>
        </div>
        <div className="foot">
          <div className="amt"><small>{label}</small>{usd(shown)}</div>
          <div className="brand">{c.freelancer_name}<br /><span style={{ fontWeight: 400, fontStyle: 'normal', fontSize: 11, opacity: .75 }}>for {c.client_name}</span></div>
        </div>
      </div>
      <div className="ecard-shadow" />
    </div>
  );
}

type Row = Event & { contract_title?: string; milestone_title?: string | null };

const parse = (raw: string) => { try { return JSON.parse(raw); } catch { return {}; } };

/** One event as a statement line: who, what, and the money it moved. */
export function describe(e: Row): { av: string; avClass: string; title: string; sub: string; amount?: string; tone?: string; note?: string } {
  const d = parse(e.detail);
  const where = e.milestone_title ?? e.contract_title ?? '';
  switch (e.kind) {
    case 'contract.created': return { av: '＋', avClass: '', title: 'Contract created', sub: e.contract_title ?? `${d.milestones} milestones`, amount: usd(d.total), note: 'total' };
    case 'funding.started': return { av: 'P', avClass: 'pp', title: 'Sent to PayPal to fund', sub: e.contract_title ?? '', amount: usd(d.amount), note: d.mode };
    case 'funding.held': return { av: 'P', avClass: 'pp', title: 'Funds held', sub: d.payer ? `Authorized by ${d.payer}` : 'Authorized in PayPal', amount: usd(d.amountUsd), tone: 'pos', note: 'held' };
    case 'funding.cancelled': return { av: 'P', avClass: 'pp', title: 'Funding cancelled', sub: e.contract_title ?? '' };
    case 'work.submitted': return { av: '↑', avClass: '', title: 'Work submitted', sub: where };
    case 'referee.verdict': return { av: '✦', avClass: 'ai', title: `Referee: ${String(d.recommendation ?? '').replace('_', ' ')}`, sub: `${where} · ${d.met}/${d.of} criteria met`, amount: `${d.percent}%`, tone: d.percent >= 95 ? 'pos' : d.percent > 0 ? '' : 'neg', note: 'suggested' };
    case 'referee.failed': return { av: '✦', avClass: 'ai', title: 'Referee failed', sub: d.error ?? '' };
    case 'changes.requested': return { av: '↺', avClass: '', title: 'Changes requested', sub: where };
    case 'payment.released': return { av: 'P', avClass: 'pp', title: 'Paid out', sub: `${where}${d.followedReferee ? ' · as the referee suggested' : ''}`, amount: `+${usd(d.amount)}`, tone: 'pos', note: (d.status ?? '').toLowerCase() };
    case 'payment.failed': return { av: 'P', avClass: 'pp', title: 'Payment failed', sub: d.error ?? '', tone: 'neg' };
    case 'contract.closed': return { av: '✓', avClass: '', title: 'Settled', sub: e.contract_title ?? 'Unreleased funds voided', amount: d.returnedToClient ? `−${usd(d.returnedToClient)}` : usd(0), note: 'returned to client' };
    case 'refund.failed': return { av: 'P', avClass: 'pp', title: 'Returning funds failed', sub: d.error ?? '', tone: 'neg' };
    default: return { av: '•', avClass: '', title: e.kind, sub: '' };
  }
}

const dayLabel = (iso: string) => {
  const d = new Date(iso), t = new Date();
  const y = new Date(t); y.setDate(t.getDate() - 1);
  const f = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
  return d.toDateString() === t.toDateString() ? `Today, ${f}` : d.toDateString() === y.toDateString() ? `Yesterday, ${f}` : f;
};

export function Activity({ rows, link = false }: { rows: Row[]; link?: boolean }) {
  if (!rows.length) return <p className="dim" style={{ padding: '18px 0' }}>Nothing yet. Holds, verdicts and payouts will appear here.</p>;
  let last = '';
  return (
    <div>
      {rows.map(e => {
        const day = dayLabel(e.at);
        const head = day !== last ? (last = day, <div className="day" key={`d-${e.id}`}>{day}</div>) : null;
        const x = describe(e);
        const body = (
          <>
            <span className="t">{new Date(e.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
            <span className={`av ${x.avClass}`}>{x.av}</span>
            <span><span className="name">{x.title}</span><br /><span className="sub">{x.sub}</span></span>
            <span className={`amt ${x.tone ?? ''}`}>{x.amount ?? ''}{x.note && <small>{x.note}</small>}</span>
          </>
        );
        return [head, link
          ? <Link className="tx" key={e.id} href={`/c/${e.contract_id}`}>{body}</Link>
          : <div className="tx" key={e.id}>{body}</div>];
      })}
    </div>
  );
}
