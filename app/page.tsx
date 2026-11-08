import Link from 'next/link';
import { db, contracts, milestones, recent } from '../lib/db.ts';
import { heldUsd } from '../lib/escrow.ts';
import { usd, STATUS } from '../lib/ui.ts';
import { EscrowCard, Activity } from '../components/Escrow.tsx';
import { Plus, Lock, Upload, Send } from '../components/Icons.tsx';

export const dynamic = 'force-dynamic';

export default function Home() {
  const d = db();
  const all = contracts(d).map(c => {
    const ms = milestones(d, c.id);
    return { c, ms, held: heldUsd(c, ms), paid: ms.reduce((s, m) => s + m.paid_usd, 0) };
  });
  const lead = all.find(x => x.c.status !== 'closed') ?? all[0];
  const toFund = all.find(x => x.c.status === 'draft' || x.c.status === 'awaiting_funds');
  const inFlight = all.find(x => x.c.status === 'funded');
  const totals = all.reduce((t, x) => ({ held: t.held + x.held, paid: t.paid + x.paid }), { held: 0, paid: 0 });

  return (
    <div className="split">
      {/* ── left: the escrow and what to do next ── */}
      <section className="stack" style={{ alignContent: 'start', gap: 22 }}>
        <div className="row between">
          <h1>My Escrows</h1>
          <Link href="/new" className="btn">New contract <span className="plus">+</span></Link>
        </div>

        {lead ? (
          <Link href={`/c/${lead.c.id}`} aria-label={`Open ${lead.c.title}`}><EscrowCard c={lead.c} held={lead.held} paid={lead.paid} /></Link>
        ) : (
          <div>
            <div className="ecard">
              <div className="top"><span>FAIRPAY ESCROW</span><span>USD</span></div>
              <div className="num">•••• •••• PAY ON PROOF<small>Your first contract</small></div>
              <div className="foot"><div className="amt"><small>Held in PayPal</small>$0.00</div><div className="brand">Fairpay</div></div>
            </div>
            <div className="ecard-shadow" />
          </div>
        )}

        <div className="tiles">
          <Link href="/new" className="tile blue"><span className="ic"><Plus /></span>Start a Contract</Link>
          <Link href={toFund ? `/c/${toFund.c.id}` : '/new'} className="tile violet"><span className="ic"><Lock /></span>Fund in PayPal</Link>
          <Link href={inFlight ? `/c/${inFlight.c.id}` : '/new'} className="tile indigo"><span className="ic"><Upload /></span>Submit Work</Link>
          <Link href="/agents" className="tile plum"><span className="ic"><Send /></span>Hire with an Agent</Link>
        </div>

        <div className="row" style={{ gap: 28 }}>
          <div><div className="dim">Held now</div><div style={{ fontSize: 22 }}>{usd(totals.held)}</div></div>
          <div><div className="dim">Paid on proof</div><div style={{ fontSize: 22 }} className="pos">{usd(totals.paid)}</div></div>
          <div><div className="dim">Contracts</div><div style={{ fontSize: 22 }}>{all.length}</div></div>
        </div>

        {all.length > 0 && (
          <div>
            <div className="day">All contracts</div>
            {all.map(({ c, held, paid }) => (
              <Link key={c.id} href={`/c/${c.id}`} className="tx" style={{ gridTemplateColumns: '1fr auto' }}>
                <span><span className="name">{c.title}</span><br /><span className="sub">{c.client_name} → {c.freelancer_name} · {STATUS[c.status].label}</span></span>
                <span className="amt">{usd(c.total_usd)}<small>{usd(paid)} paid · {usd(held)} held</small></span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ── right: the statement ── */}
      <section>
        <h2 style={{ paddingTop: 8 }}>Activity</h2>
        <p className="dim" style={{ marginTop: 6 }}>Every hold, verdict and payout across your contracts.</p>
        <Activity rows={recent(d, 40)} link />
        {!all.length && (
          <div className="panel" style={{ marginTop: 18 }}>
            <h3>How Fairpay works</h3>
            <ol className="criteria" style={{ marginTop: 10 }}>
              <li><b>Agree</b> milestones, each with criteria a referee can check.</li>
              <li><b>Fund</b>: the client&rsquo;s money is held in PayPal, not taken.</li>
              <li><b>Prove</b>: the freelancer submits; the AI referee checks every criterion.</li>
              <li><b>Pay</b>: released on a click, captured from the hold and paid out.</li>
            </ol>
          </div>
        )}
      </section>
    </div>
  );
}
