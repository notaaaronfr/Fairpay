import Link from 'next/link';
import type { Contract, Milestone, Event } from '../lib/db.ts';
import { usd } from '../lib/ui.ts';
import { Mark } from './Brand.tsx';
import { Arrow, Down, Up, In, Lock, Doc, Spark, Check, Back } from './Icons.tsx';
import { CountUp, Rise, Spotlight, Tilt, Fill, TrackFill } from './Motion.tsx';

type Row = Event & { contract_title?: string; milestone_title?: string | null };
const parse = (raw: string) => { try { return JSON.parse(raw); } catch { return {}; } };
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const when = (iso: string) => {
  const d = new Date(iso), t = new Date(), y = new Date(t); y.setDate(t.getDate() - 1);
  const day = d.toDateString() === t.toDateString() ? 'Today' : d.toDateString() === y.toDateString() ? 'Yesterday'
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return `${day} · ${time(iso)}`;
};

/* ── the huge balance, counting up ─────────────────────────────────────── */
export function BigMoney({ value }: { value: number }) {
  return <div className="big-money"><CountUp value={value} /></div>;
}

/* ── the yellow live tracker ───────────────────────────────────────────── */
export function Tracker({ c, ms, log }: { c: Contract; ms: Milestone[]; log: Row[] }) {
  const first = (k: string) => log.filter(e => e.kind === k).sort((a, b) => a.id - b.id)[0]?.at;
  const steps = [
    { name: 'Agreed', at: c.created_at },
    { name: 'Funded', at: first('funding.held') },
    { name: 'Proven', at: first('work.submitted') },
    { name: 'Paid', at: first('payment.released') },
    { name: 'Settled', at: first('contract.closed') },
  ];
  const reached = steps.filter(s => s.at).length;
  const paidCount = ms.filter(m => m.status === 'released').length;
  const live = c.status !== 'closed';
  const label = !c.authorization_id ? 'Unfunded' : c.status === 'closed' ? 'Settled' : 'Live';

  return (
    <Rise>
      <Link href={`/c/${c.id}`} className="track">
        <span className="go" aria-hidden><Arrow /></span>
        <div className="title">{c.title} <span className="live">{label}</span></div>
        <div className="body">
          <div className="count">{paidCount}<small>/{ms.length} paid</small></div>
          <div className="line">
            <TrackFill ratio={Math.max(0, reached - 1) / (steps.length - 1)} />
            {steps.map((s, i) => (
              <span key={s.name} className={`st ${i < reached - 1 || (i === reached - 1 && !live) ? 'done' : i === reached - 1 ? 'now' : ''}`}>
                <i />{s.name}<span>{s.at ? time(s.at) : '—'}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="foot">
          <span>{c.freelancer_name}</span>
          <span><b>{usd(c.total_usd)}</b>{c.authorization_id ? ` · ✓ ${c.authorization_id.slice(-4)}` : ''}</span>
        </div>
      </Link>
    </Rise>
  );
}

/* ── the PayPal hold, drawn as a card ──────────────────────────────────── */
export function HoldCard({ c, held, paid, children }: { c: Contract | null; held: number; paid: number; children?: React.ReactNode }) {
  const pct = c?.total_usd ? Math.min(100, (paid / c.total_usd) * 100) : 0;
  return (
    <Rise i={1}>
      <Spotlight className="panel">
        <div className="panel-head"><h2>PayPal hold</h2>{c && <Link href={`/c/${c.id}`} className="more">Open ›</Link>}</div>
        <div className="holdcard">
          <Tilt className="plastic">
            <div className="lbl">ESCROW</div>
            <div className="emv" />
            <div className="num">···· {c?.authorization_id ? c.authorization_id.slice(-4) : '0000'}</div>
            <span className="big-mark"><Mark size={130} /></span>
          </Tilt>
          <div className="stack" style={{ gap: 6 }}>
            <div className="dim">Released</div>
            <div style={{ fontSize: 20 }}><CountUp value={paid} cents={false} /> <span className="dim">/ {usd(c?.total_usd ?? 0)}</span></div>
            <div className="meter"><Fill pct={pct} /></div>
            <div className="dim" style={{ marginTop: 6 }}>{usd(held)} held</div>
            {children}
          </div>
        </div>
      </Spotlight>
    </Rise>
  );
}

/* ── recent activity: short lines, staggered in ────────────────────────── */
export function describe(e: Row): { ic: React.ReactNode; title: string; sub: string; amount?: string; tone?: string; live?: boolean } {
  const d = parse(e.detail);
  const where = e.milestone_title ?? e.contract_title ?? '';
  switch (e.kind) {
    case 'contract.created': return { ic: <Doc />, title: 'Created', sub: e.contract_title ?? '', amount: usd(d.total) };
    case 'funding.started': return { ic: <Lock />, title: 'Funding', sub: e.contract_title ?? '', amount: usd(d.amount), live: true };
    case 'funding.held': return { ic: <Lock />, title: 'Held', sub: when(e.at), amount: `+${usd(d.amountUsd)}`, tone: 'pos' };
    case 'funding.cancelled': return { ic: <Back />, title: 'Funding cancelled', sub: when(e.at) };
    case 'work.submitted': return { ic: <Up />, title: 'Submitted', sub: where, live: true };
    case 'referee.verdict': return { ic: <Spark />, title: `Referee · ${d.met}/${d.of}`, sub: where, amount: `${d.percent}%` };
    case 'referee.failed': return { ic: <Spark />, title: 'Referee failed', sub: d.error ?? '' };
    case 'changes.requested': return { ic: <Back />, title: 'Changes asked', sub: where };
    case 'payment.released': return { ic: <In />, title: 'Paid', sub: where, amount: `+${usd(d.amount)}`, tone: 'pos' };
    case 'payment.failed': return { ic: <In />, title: 'Payment failed', sub: d.error ?? '', tone: 'neg' };
    case 'contract.closed': return { ic: <Check />, title: 'Settled', sub: e.contract_title ?? '', amount: `−${usd(d.returnedToClient ?? 0)}` };
    case 'refund.failed': return { ic: <Down />, title: 'Return failed', sub: d.error ?? '', tone: 'neg' };
    default: return { ic: <Doc />, title: e.kind, sub: when(e.at) };
  }
}

export function Activity({ rows, link = false, limit }: { rows: Row[]; link?: boolean; limit?: number }) {
  const shown = limit ? rows.slice(0, limit) : rows;
  if (!shown.length) return <p className="dim" style={{ padding: '10px 0' }}>Nothing yet.</p>;
  return (
    <div>
      {shown.map((e, i) => {
        const x = describe(e);
        const body = (
          <>
            <span className="ic">{x.ic}</span>
            <span style={{ minWidth: 0 }}>
              <div className="ttl">{x.title}</div>
              <div className="sub">{x.live && <span className="ld" />}{x.sub}</div>
            </span>
            <span className={`amt ${x.tone ?? ''}`}>{x.amount ?? ''}</span>
          </>
        );
        return (
          <Rise key={e.id} i={i}>
            {link ? <Link href={`/c/${e.contract_id}`} className="act-row">{body}</Link> : <div className="act-row">{body}</div>}
          </Rise>
        );
      })}
    </div>
  );
}

export const AV_COLORS = ['#0070e0', '#003087', '#009cde', '#7a5cff', '#0a9a5b', '#e0791a'];
export const initials = (s: string) => s.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
