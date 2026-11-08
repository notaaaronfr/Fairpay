import Link from 'next/link';
import { db, contracts, milestones, recent } from '../lib/db.ts';
import { heldUsd } from '../lib/escrow.ts';
import { usd, STATUS, role, modes } from '../lib/ui.ts';
import { Activity, Metrics, Faqs } from '../components/Escrow.tsx';
import { RoleTabs } from '../components/RoleTabs.tsx';
import { Wallet, Bot, External, Shield, Doc } from '../components/Icons.tsx';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const d = db();
  const who = await role();
  const m = modes();
  const all = contracts(d).map(c => {
    const ms = milestones(d, c.id);
    return { c, ms, held: heldUsd(c, ms), paid: ms.reduce((s, x) => s + x.paid_usd, 0) };
  });
  const lead = all.find(x => x.c.status !== 'closed') ?? all[0];
  const totals = all.reduce((t, x) => ({ held: t.held + x.held, paid: t.paid + x.paid, back: t.back + x.c.refunded_usd }), { held: 0, paid: 0, back: 0 });
  const events = recent(d, 200);

  const next = !lead ? null
    : !lead.c.authorization_id ? (who === 'client' ? `Fund ${usd(lead.c.total_usd)} in PayPal` : 'Waiting for the client to fund')
    : lead.ms.some(x => x.status === 'submitted') ? (who === 'client' ? 'Review the referee’s verdict' : 'Waiting for the client to release')
    : lead.c.status === 'closed' ? 'Settled' : (who === 'client' ? 'Waiting for work' : 'Submit your next milestone');

  return (
    <div className="page">
      {/* ── left: the action panel ── */}
      <div className="col">
        <div className="panel stack" style={{ gap: 14 }}>
          <RoleTabs role={who} />
          <div className="two">
            <div className="mini"><small>Held in PayPal</small><b><span className="coin held sm">$</span>{usd(totals.held)}</b></div>
            <div className="mini"><small>Paid on proof</small><b><span className="coin paid sm">✓</span>{usd(totals.paid)}</b></div>
          </div>

          {lead ? (
            <Link href={`/c/${lead.c.id}`} className="hero" style={{ display: 'block' }}>
              <div className="label">{who === 'client' ? 'Your escrow with' : 'Your escrow from'} {who === 'client' ? lead.c.freelancer_name : lead.c.client_name}</div>
              <div className="big"><span>{usd(lead.held || lead.c.total_usd)}</span><span className="chip">{STATUS[lead.c.status].label}</span></div>
              <div style={{ fontSize: 14, opacity: .9, marginTop: 4 }}>{lead.c.title}</div>
              <div className="divider" />
              <div className="foot"><Wallet /> {next}</div>
            </Link>
          ) : (
            <Link href="/new" className="hero" style={{ display: 'block' }}>
              <div className="label">Hire someone and pay only on proof</div>
              <div className="big"><span>$0.00 held</span><span className="chip">PayPal</span></div>
              <div className="divider" />
              <div className="foot"><Wallet /> Start your first escrow</div>
            </Link>
          )}

          {lead && (
            <details className="ovd" open>
              <summary>Escrow overview</summary>
              <div className="ov">
                <div className="k"><span>Contract total</span><span>{usd(lead.c.total_usd)}</span></div>
                <div className="k"><span>Held in PayPal</span><span>{usd(lead.held)}</span></div>
                <div className="k"><span>Paid to {lead.c.freelancer_name}</span><span className="pos">{usd(lead.paid)}</span></div>
                <div className="k"><span>Milestones</span><span>{lead.ms.filter(x => x.status === 'released').length} of {lead.ms.length} paid</span></div>
              </div>
            </details>
          )}

          <div className="inset promo">
            <span className="art"><Bot /></span>
            <div>
              <div>Let an AI agent hire for you — on proof</div>
              <Link href="/agents" className="link">Fairpay for agents <External /></Link>
            </div>
          </div>

          <Link href={lead ? `/c/${lead.c.id}` : '/new'} className="btn primary block">
            {lead ? (lead.c.authorization_id ? 'Open escrow' : who === 'client' ? 'Fund with PayPal' : 'Open escrow') : 'Start an escrow'}
          </Link>
        </div>

        <div className="panel stack" style={{ gap: 12 }}>
          <h3>Your escrows</h3>
          {all.length ? all.map(({ c, held, paid }) => (
            <Link key={c.id} href={`/c/${c.id}`} className="item">
              <div style={{ minWidth: 0 }}>
                <div>{c.title}</div>
                <div className="dim">{c.client_name} → {c.freelancer_name} · {usd(paid)} paid · {usd(held)} held</div>
              </div>
              <span className="ic"><Doc /></span>
            </Link>
          )) : <p className="dim">None yet.</p>}
          <div className="item"><div><div>Protected by PayPal</div><div className="dim">Authorized, not captured, until a person releases it.</div></div><span className="ic"><Shield /></span></div>
        </div>
      </div>

      {/* ── right: stats, metrics, activity, faqs ── */}
      <div className="col">
        <h2>Escrow stats</h2>
        <div className="two">
          <div className="stat"><small>Total held in PayPal</small><b><span className="coin held">$</span>{usd(totals.held)}</b></div>
          <div className="stat"><small>Total paid on proof</small><b><span className="coin paid">✓</span>{usd(totals.paid)}</b></div>
        </div>

        <div className="row between">
          <h2>Metrics</h2>
          <span className="pill blue">{m.paypal === 'simulated' ? 'Simulated PayPal' : m.paypalLabel}</span>
        </div>
        <Metrics rows={events} />

        <div className="panel" id="activity">
          <div className="row between"><h2>Activity</h2><span className="dim">{usd(totals.back)} returned to clients</span></div>
          <Activity rows={events} link limit={12} />
        </div>

        <Faqs />
      </div>
    </div>
  );
}
