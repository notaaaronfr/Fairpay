import Link from 'next/link';
import type { Contract, Milestone, Event } from '../lib/db.ts';
import { usd } from '../lib/ui.ts';
import { Mark } from './Brand.tsx';
import { Arrow, Down, Up, In, Lock, Doc, Spark, Check, Back } from './Icons.tsx';

type Row = Event & { contract_title?: string; milestone_title?: string | null };
const parse = (raw: string) => { try { return JSON.parse(raw); } catch { return {}; } };
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const when = (iso: string) => {
  const d = new Date(iso), t = new Date(), y = new Date(t); y.setDate(t.getDate() - 1);
  const day = d.toDateString() === t.toDateString() ? 'Today' : d.toDateString() === y.toDateString() ? 'Yesterday'
    : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  return `${day} · ${time(iso)}`;
};

/* ── the huge balance ──────────────────────────────────────────────────── */

export function BigMoney({ value }: { value: number }) {
  const [w, c] = Number(value || 0).toFixed(2).split('.');
  return <div className="big-money">${Number(w).toLocaleString('en-US')}<span className="c">.{c}</span></div>;
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
  const lastVerdict = ms.map(m => m.review && JSON.parse(m.review)).filter(Boolean).pop();
  const fill = `calc((100% - 12px) * ${Math.max(0, reached - 1) / (steps.length - 1)})`;
  const live = c.status !== 'closed';
  const label = !c.authorization_id ? 'Waiting for funding' : c.status === 'closed' ? 'Settled' : 'Held in PayPal';

  return (
    <Link href={`/c/${c.id}`} className="track">
      <span className="go" aria-hidden><Arrow /></span>
      <div className="title">{c.title} {live && <span className="live">{label}</span>}</div>
      <div className="body">
        <div className="count">{paidCount}<small>of {ms.length} paid</small></div>
        <div className="line">
          <span className="fill" style={{ width: fill }} />
          {steps.map((s, i) => (
            <span key={s.name} className={`st ${i < reached - 1 || (i === reached - 1 && !live) ? 'done' : i === reached - 1 ? 'now' : ''}`}>
              <i />{s.name}<span>{s.at ? time(s.at) : '—'}</span>
            </span>
          ))}
        </div>
      </div>
      <div className="foot">
        <span>{c.freelancer_name} · PayPal payee · {lastVerdict ? `referee ${lastVerdict.checks.filter((x: any) => x.status === 'met').length}/${lastVerdict.checks.length} met` : 'no submission yet'}</span>
        <span>Amount <b>{usd(c.total_usd)}</b> &nbsp; {c.authorization_id ? `✓ Auth ${c.authorization_id.slice(-4)}` : 'Not authorized yet'}</span>
      </div>
    </Link>
  );
}

/* ── the PayPal hold, drawn as a card ──────────────────────────────────── */

export function HoldCard({ c, held, paid, children }: { c: Contract | null; held: number; paid: number; children?: React.ReactNode }) {
  const pct = c?.total_usd ? Math.min(100, (paid / c.total_usd) * 100) : 0;
  return (
    <div className="panel">
      <div className="panel-head"><h2>PayPal hold</h2>{c && <Link href={`/c/${c.id}`} className="more">Manage ›</Link>}</div>
      <div className="holdcard">
        <div className="plastic">
          <div className="lbl">ESCROW</div>
          <div className="emv" />
          <div className="num">···· {c?.authorization_id ? c.authorization_id.slice(-4) : '0000'}</div>
          <span className="big-mark"><Mark size={130} /></span>
        </div>
        <div className="stack" style={{ gap: 6 }}>
          <div className="dim" style={{ fontStyle: 'italic' }}>Authorized · USD</div>
          <div className="dim" style={{ fontStyle: 'italic' }}>Released on proof</div>
          <div style={{ fontSize: 18, fontStyle: 'italic' }}>{usd(paid)} of {usd(c?.total_usd ?? 0)}</div>
          <div className="meter"><i style={{ width: `${pct}%` }} /></div>
          <div className="dim" style={{ fontStyle: 'italic', marginTop: 6 }}>{usd(held)} still held{c?.hold_expires ? ` · until ${c.hold_expires.slice(0, 10)}` : ''}</div>
          {children}
        </div>
      </div>
    </div>
  );
}

/* ── recent activity ───────────────────────────────────────────────────── */

export function describe(e: Row): { ic: React.ReactNode; title: string; sub: string; amount?: string; tone?: string; live?: boolean } {
  const d = parse(e.detail);
  const where = e.milestone_title ?? e.contract_title ?? '';
  switch (e.kind) {
    case 'contract.created': return { ic: <Doc />, title: `Escrow created · ${e.contract_title ?? ''}`, sub: when(e.at), amount: usd(d.total) };
    case 'funding.started': return { ic: <Lock />, title: 'Sent to PayPal to fund', sub: `${e.contract_title ?? ''}`, amount: usd(d.amount), live: true };
    case 'funding.held': return { ic: <Lock />, title: 'Funds held in PayPal', sub: d.payer ? `${when(e.at)} · ${d.payer}` : when(e.at), amount: `+${usd(d.amountUsd)}`, tone: 'pos' };
    case 'funding.cancelled': return { ic: <Back />, title: 'Funding cancelled', sub: when(e.at) };
    case 'work.submitted': return { ic: <Up />, title: `Work submitted · ${where}`, sub: when(e.at), live: true };
    case 'referee.verdict': return { ic: <Spark />, title: `Referee: ${String(d.recommendation ?? '').replace('_', ' ')}`, sub: `${where} · ${d.met}/${d.of} criteria met`, amount: `${d.percent}%` };
    case 'referee.failed': return { ic: <Spark />, title: 'Referee failed', sub: d.error ?? '' };
    case 'changes.requested': return { ic: <Back />, title: `Changes requested · ${where}`, sub: when(e.at) };
    case 'payment.released': return { ic: <In />, title: `Paid out · ${where}`, sub: `${when(e.at)} · PayPal Payouts`, amount: `+${usd(d.amount)}`, tone: 'pos' };
    case 'payment.failed': return { ic: <In />, title: 'Payment failed', sub: d.error ?? '', tone: 'neg' };
    case 'contract.closed': return { ic: <Check />, title: `Settled · ${e.contract_title ?? ''}`, sub: when(e.at), amount: `−${usd(d.returnedToClient ?? 0)}` };
    case 'refund.failed': return { ic: <Down />, title: 'Returning funds failed', sub: d.error ?? '', tone: 'neg' };
    default: return { ic: <Doc />, title: e.kind, sub: when(e.at) };
  }
}

export function Activity({ rows, link = false, limit }: { rows: Row[]; link?: boolean; limit?: number }) {
  const shown = limit ? rows.slice(0, limit) : rows;
  if (!shown.length) return <p className="dim" style={{ padding: '10px 0', fontStyle: 'italic' }}>Nothing yet. Holds, verdicts and payouts appear here.</p>;
  return (
    <div>
      {shown.map(e => {
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
        return link
          ? <Link key={e.id} href={`/c/${e.contract_id}`} className="act-row">{body}</Link>
          : <div key={e.id} className="act-row">{body}</div>;
      })}
    </div>
  );
}

/* ── FAQs ──────────────────────────────────────────────────────────────── */

export const FAQS: [string, string][] = [
  ['Is the money really held before work starts?', 'Yes. Funding creates a PayPal order with intent AUTHORIZE: the client approves the full amount, PayPal holds it, and nothing is captured until a milestone is released.'],
  ['What does the AI referee do?', 'It reads the submission — the note and the linked page or repo — and checks each acceptance criterion as met, partial, missing or unverifiable, with evidence. Then it suggests how much to release.'],
  ['Can the AI pay anyone?', 'No. The referee only recommends. Money moves when a person clicks Release; agents using the API can never release more than the referee recommended.'],
  ['What happens to money that is never released?', 'When the contract is closed, the rest of the PayPal authorization is voided, so the client is never charged for it.'],
];

export function Faqs() {
  return (
    <div className="panel faq" id="faq">
      <div className="panel-head"><h2>How it works</h2></div>
      {FAQS.map(([q, a], i) => <details key={q} open={i === 0}><summary>{q}</summary><p>{a}</p></details>)}
    </div>
  );
}

export const AV_COLORS = ['#0070e0', '#003087', '#009cde', '#7a5cff', '#0a9a5b', '#e0791a'];
export const initials = (s: string) => s.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
