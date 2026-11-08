import Link from 'next/link';
import { db, contracts, milestones, recent, events } from '../lib/db.ts';
import { heldUsd } from '../lib/escrow.ts';
import { usd, STATUS, role } from '../lib/ui.ts';
import { BigMoney, Tracker, HoldCard, Activity, Faqs, AV_COLORS, initials } from '../components/Escrow.tsx';
import { Plus, Lock, Up, In } from '../components/Icons.tsx';

export const dynamic = 'force-dynamic';

export default async function Home({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = 'all' } = await searchParams;
  const d = db();
  const who = await role();
  const all = contracts(d).map(c => {
    const ms = milestones(d, c.id);
    return { c, ms, held: heldUsd(c, ms), paid: ms.reduce((s, x) => s + x.paid_usd, 0) };
  });
  const lead = all.find(x => x.c.status === 'funded') ?? all.find(x => x.c.status !== 'closed') ?? all[0];
  const held = all.reduce((s, x) => s + x.held, 0);
  const today = new Date().toDateString();
  const feed = recent(d, 60);
  const paidToday = feed.filter(e => e.kind === 'payment.released' && new Date(e.at).toDateString() === today)
    .reduce((s, e) => s + (Number(JSON.parse(e.detail).amount) || 0), 0);

  const funded = all.filter(x => x.c.status === 'funded');
  const settled = all.filter(x => x.c.status === 'closed');
  const pct = (n: number) => all.length ? Math.round((n / all.length) * 100) : 0;
  const rows = tab === 'funded' ? funded : tab === 'settled' ? settled : all;
  const toFund = all.find(x => !x.c.authorization_id && x.c.status !== 'closed');
  const toReview = all.find(x => x.ms.some(m => m.status === 'submitted'));
  const toSubmit = all.find(x => x.c.status === 'funded' && x.ms.some(m => m.status === 'open' || m.status === 'changes_requested'));

  return (
    <>
      <section className="balance-row">
        <div>
          <div className="welcome">
            Welcome back{who === 'client' ? ', client' : ', freelancer'} · Total held in escrow
            <span className="chip pos">▲ {usd(paidToday)} paid today</span>
            <span>USD</span>
          </div>
          <BigMoney value={held} />
        </div>
        <div className="actions">
          <Link href="/new" className="act"><Plus />New escrow</Link>
          <Link href={toFund ? `/c/${toFund.c.id}` : '/new'} className="act"><Lock />Fund</Link>
          <Link href={toSubmit ? `/c/${toSubmit.c.id}` : '/'} className="act"><Up />Submit work</Link>
          <Link href={toReview ? `/c/${toReview.c.id}` : '/'} className="act"><In />Release</Link>
        </div>
      </section>

      <div className="grid">
        <div className="col">
          {lead ? <Tracker c={lead.c} ms={lead.ms} log={events(d, lead.c.id)} /> : (
            <Link href="/new" className="track">
              <div className="title">Your first escrow <span className="live">Ready</span></div>
              <div className="body"><div className="count">0<small>escrows</small></div><div style={{ fontStyle: 'italic' }}>Hire someone. Hold the money in PayPal. Pay only on proof.</div></div>
            </Link>
          )}

          <div className="panel">
            <div className="panel-head">
              <h2>Escrows</h2>
              <nav className="tabs" aria-label="Filter">
                <Link href="/?tab=all" aria-current={tab === 'all'}>All</Link>
                <Link href="/?tab=funded" aria-current={tab === 'funded'}>Funded<span>{pct(funded.length)}%</span></Link>
                <Link href="/?tab=settled" aria-current={tab === 'settled'}>Settled<span>{pct(settled.length)}%</span></Link>
              </nav>
            </div>
            <div className="split-bar">
              <i style={{ flex: Math.max(1, funded.length), background: 'var(--sun)' }} />
              <i style={{ flex: Math.max(1, all.length - funded.length), background: 'var(--line-2)' }} />
            </div>
            <table className="t">
              <thead><tr><th>Escrow</th><th className="hide-sm">Milestones</th><th className="hide-sm">Held</th><th>Paid</th><th>Value</th></tr></thead>
              <tbody>
                {rows.map(({ c, ms, held, paid }, i) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/c/${c.id}`} className="who">
                        <span className="av" style={{ background: AV_COLORS[i % AV_COLORS.length] }}>{initials(c.freelancer_name)}</span>
                        <span>{c.title}<small>{c.freelancer_name} · {STATUS[c.status].label}</small></span>
                      </Link>
                    </td>
                    <td className="hide-sm">{ms.filter(m => m.status === 'released').length}/{ms.length}</td>
                    <td className="hide-sm">{usd(held)}</td>
                    <td className={paid ? 'pos' : ''}>{paid ? `+${usd(paid)}` : '—'}</td>
                    <td><b style={{ fontWeight: 600 }}>{usd(c.total_usd)}</b></td>
                  </tr>
                ))}
                {!rows.length && <tr><td colSpan={5} className="dim">Nothing here yet. <Link href="/new" className="more">Start an escrow ›</Link></td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="col">
          <HoldCard c={lead?.c ?? null} held={lead?.held ?? 0} paid={lead?.paid ?? 0}>
            <div className="row between" style={{ marginTop: 10 }}>
              <span style={{ fontStyle: 'italic' }}>Pay only on proof</span>
              <span className="switch" role="switch" aria-checked="true" aria-label="Pay only on proof (always on)" />
            </div>
          </HoldCard>

          <div className="panel" id="activity">
            <div className="panel-head"><h2>Recent activity</h2><Link href="/?tab=all#activity" className="more">View all ›</Link></div>
            <Activity rows={feed} link limit={7} />
          </div>

          <Faqs />
        </div>
      </div>
    </>
  );
}
