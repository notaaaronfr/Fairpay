import Link from 'next/link';
import type { Event } from '../lib/db.ts';
import { usd } from '../lib/ui.ts';

type Row = Event & { contract_title?: string; milestone_title?: string | null };
const parse = (raw: string) => { try { return JSON.parse(raw); } catch { return {}; } };

/* ── statement lines ───────────────────────────────────────────────────── */

export function describe(e: Row): { av: string; avClass: string; title: string; sub: string; amount?: string; tone?: string; note?: string } {
  const d = parse(e.detail);
  const where = e.milestone_title ?? e.contract_title ?? '';
  switch (e.kind) {
    case 'contract.created': return { av: '+', avClass: '', title: 'Contract created', sub: e.contract_title ?? `${d.milestones} milestones`, amount: usd(d.total), note: 'total' };
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

export function Activity({ rows, link = false, limit }: { rows: Row[]; link?: boolean; limit?: number }) {
  const shown = limit ? rows.slice(0, limit) : rows;
  if (!shown.length) return <p className="dim" style={{ padding: '14px 4px' }}>Nothing yet. Holds, verdicts and payouts will appear here.</p>;
  let last = '';
  return (
    <div>
      {shown.map(e => {
        const day = dayLabel(e.at);
        const head = day !== last ? (last = day, <div className="day" key={`d-${e.id}`}>{day}</div>) : null;
        const x = describe(e);
        const body = (
          <>
            <span className="t">{new Date(e.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
            <span className={`av ${x.avClass}`}>{x.av}</span>
            <span style={{ minWidth: 0 }}><span className="name">{x.title}</span><br /><span className="sub">{x.sub}</span></span>
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

/* ── metrics: money held and paid over time ────────────────────────────── */

export function series(rows: Row[]) {
  const asc = [...rows].sort((a, b) => a.id - b.id);
  let held = 0, paid = 0;
  const pts: { at: number; held: number; paid: number }[] = [];
  for (const e of asc) {
    const d = parse(e.detail);
    if (e.kind === 'funding.held') held += Number(d.amountUsd) || 0;
    else if (e.kind === 'payment.released') { held -= Number(d.amount) || 0; paid += Number(d.amount) || 0; }
    else if (e.kind === 'contract.closed') held -= Number(d.returnedToClient) || 0;
    else continue;
    pts.push({ at: Date.parse(e.at), held: Math.max(0, held), paid });
  }
  return pts;
}

export function Metrics({ rows }: { rows: Row[] }) {
  const pts = series(rows);
  const W = 720, H = 240, L = 8, R = 8, T = 18, B = 30;
  const now = Date.now();
  const start = pts.length ? Math.min(pts[0].at, now - 6 * 864e5) : now - 6 * 864e5;
  const full = [{ at: start, held: 0, paid: 0 }, ...pts, ...(pts.length ? [{ ...pts[pts.length - 1], at: now }] : [{ at: now, held: 0, paid: 0 }])];
  const max = Math.max(100, ...full.map(p => Math.max(p.held, p.paid))) * 1.15;
  const x = (t: number) => L + ((t - start) / Math.max(1, now - start)) * (W - L - R);
  const y = (v: number) => T + (1 - v / max) * (H - T - B);
  const step = (key: 'held' | 'paid') => full.map((p, i) => {
    const px = x(p.at), py = y(p[key]);
    if (i === 0) return `M${px.toFixed(1)},${py.toFixed(1)}`;
    const prev = full[i - 1];
    const mid = (x(prev.at) + px) / 2;
    return `C${mid.toFixed(1)},${y(prev[key]).toFixed(1)} ${mid.toFixed(1)},${py.toFixed(1)} ${px.toFixed(1)},${py.toFixed(1)}`;
  }).join(' ');
  const paidLine = step('paid');
  const heldLine = step('held');
  const lastP = full[full.length - 1];
  const totalPaid = lastP.paid;
  const peak = full.reduce((m, p) => p.paid + p.held > m.paid + m.held ? p : m, full[0]);
  const days = Array.from({ length: 7 }, (_, i) => start + (i * (now - start)) / 6);

  return (
    <div className="panel" style={{ position: 'relative', overflow: 'hidden' }}>
      <div className="chart-head">
        <div><b>{usd(totalPaid)}</b><span className="delta">paid on proof</span></div>
        <div className="legend">
          <span><i style={{ background: 'var(--accent)' }} />Paid out</span>
          <span><i style={{ background: 'var(--sky)' }} />Held in PayPal</span>
        </div>
      </div>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Money paid and held over time">
        <defs>
          <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--accent)" stopOpacity=".28" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
          <pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="var(--line-2)" />
          </pattern>
        </defs>
        <rect x="0" y="0" width={W} height={H - B} fill="url(#dots)" opacity=".7" />
        <path d={`${paidLine} L${x(now)},${H - B} L${L},${H - B} Z`} fill="url(#area)" />
        <path d={heldLine} className="ln2" />
        <path d={paidLine} className="ln" />
        {peak.paid + peak.held > 0 && <line x1={x(peak.at)} x2={x(peak.at)} y1={T} y2={H - B} stroke="var(--accent)" strokeDasharray="3 5" opacity=".6" />}
        <circle cx={x(lastP.at)} cy={y(lastP.paid)} r="5.5" className="dot" />
        {days.map((t, i) => (
          <text key={i} x={i === 0 ? L : i === 6 ? W - R : x(t)} y={H - 8} className="ax" textAnchor={i === 0 ? 'start' : i === 6 ? 'end' : 'middle'}>
            {new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </text>
        ))}
      </svg>
      {peak.paid + peak.held > 0 && (
        <div className="inset" style={{ position: 'absolute', right: 22, top: 74, padding: '10px 14px', fontSize: 13, backdropFilter: 'blur(6px)' }}>
          <div>{new Date(peak.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</div>
          <div style={{ fontSize: 15 }}>{usd(peak.held + peak.paid)}</div>
          <div className="dim">Peak in escrow</div>
        </div>
      )}
    </div>
  );
}

/* ── FAQs ──────────────────────────────────────────────────────────────── */

export const FAQS: [string, string][] = [
  ['Is the money really held before work starts?', 'Yes. Funding creates a PayPal order with intent AUTHORIZE: the client approves the full amount, PayPal holds it, and nothing is captured until a milestone is released.'],
  ['What does the AI referee do?', 'It reads the freelancer’s submission — the note and the linked page or repo — and checks each acceptance criterion as met, partial, missing or unverifiable, with the evidence. Then it suggests how much to release.'],
  ['Can the AI pay anyone?', 'No. The referee only recommends. Money moves when a person clicks Release; agents using the API can never release more than the referee recommended.'],
  ['What happens to money that is never released?', 'When the contract is closed, the rest of the PayPal authorization is voided, so the client is never charged for it.'],
  ['How is the freelancer paid?', 'Exactly the released amount is captured from the hold and sent with PayPal Payouts to the freelancer’s PayPal email.'],
];

export function Faqs() {
  return (
    <div className="panel faq" id="faq">
      <h2 style={{ marginBottom: 16 }}>FAQs</h2>
      {FAQS.map(([q, a], i) => (
        <details key={q} open={i === 0}><summary>{q}</summary><p>{a}</p></details>
      ))}
    </div>
  );
}
