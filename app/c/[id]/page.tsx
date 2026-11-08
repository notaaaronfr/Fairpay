import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db, contract, milestones, events, type Milestone } from '../../../lib/db.ts';
import { heldUsd } from '../../../lib/escrow.ts';
import { criteriaList, type Verdict } from '../../../lib/referee.ts';
import { role, usd, ago, STATUS, modes } from '../../../lib/ui.ts';
import { fund, submitWork, releasePayment, requestChanges, closeContract, rereview } from '../../../lib/actions.ts';
import { Submit } from '../../../components/Submit.tsx';
import { Activity, Metrics } from '../../../components/Escrow.tsx';
import { RoleTabs } from '../../../components/RoleTabs.tsx';
import { Wallet, Shield, Spark } from '../../../components/Icons.tsx';

export const dynamic = 'force-dynamic';

const MARK: Record<string, string> = { met: '✓', partial: '½', missing: '✕', unverifiable: '?' };
const REC: Record<string, { label: string; tone: string }> = {
  release: { label: 'Release', tone: 'pos' }, partial: { label: 'Partial release', tone: 'amb' },
  request_changes: { label: 'Request changes', tone: 'neg' },
};
const TONE: Record<string, string> = { green: 'pos', red: 'neg', amber: 'amb', blue: 'blue' };

export default async function ContractPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; done?: string }>;
}) {
  const { id } = await params;
  const { error, done } = await searchParams;
  const d = db();
  const c = contract(d, id);
  if (!c) notFound();
  const ms = milestones(d, id);
  const log = events(d, id);
  const who = await role();
  const m = modes();

  const paid = ms.reduce((s, x) => s + x.paid_usd, 0);
  const held = heldUsd(c, ms);
  const funded = c.status === 'funded';
  const stage = c.status === 'closed' ? 6 : ms.some(x => x.status === 'released') ? 4 : ms.some(x => x.submitted_at) ? 3 : c.authorization_id ? 2 : 1;
  const STEPS = ['Agree', 'Fund', 'Prove', 'Pay', 'Settle'];

  return (
    <div className="page">
      {/* ── left: the money ── */}
      <div className="col">
        <div className="panel stack" style={{ gap: 14 }}>
          <RoleTabs role={who} />
          <div className="two">
            <div className="mini"><small>Held in PayPal</small><b><span className="coin held sm">$</span>{usd(held)}</b></div>
            <div className="mini"><small>Paid to {c.freelancer_name.split(' ')[0]}</small><b><span className="coin paid sm">✓</span>{usd(paid)}</b></div>
          </div>

          <div className="hero">
            <div className="label">{c.client_name} → {c.freelancer_name}</div>
            <div className="big"><span>{usd(c.status === 'closed' ? paid : held || c.total_usd)}</span><span className="chip">{STATUS[c.status].label}</span></div>
            <div style={{ fontSize: 14, opacity: .9, marginTop: 4 }}>{c.title}</div>
            <div className="divider" />
            <div className="foot">
              <Wallet />
              {c.authorization_id ? <>Held by PayPal · <span className="mono" style={{ opacity: .85 }}>{c.authorization_id}</span></> : 'Not funded yet'}
            </div>
          </div>

          <div className="steps" aria-label="Progress">
            {STEPS.map((s, i) => (
              <span key={s} style={{ display: 'contents' }}>
                {i > 0 && <span className="gap">··</span>}
                <span className={`s ${i + 1 < stage ? 'done' : i + 1 === stage ? 'now' : ''}`}><span className="c">{i + 1 < stage ? '✓' : i + 1}</span>{s}</span>
              </span>
            ))}
          </div>

          {done && <div className="note ok" role="status">{done}</div>}
          {error && <div className="note err" role="alert">{error}</div>}

          <details className="ovd" open>
            <summary>Escrow overview</summary>
            <div className="ov">
              <div className="k"><span>Contract total</span><span>{usd(c.total_usd)}</span></div>
              <div className="k"><span>Held in PayPal</span><span>{usd(held)}</span></div>
              <div className="k"><span>Paid out</span><span className="pos">{usd(paid)}</span></div>
              <div className="k"><span>Returned to client</span><span>{usd(c.refunded_usd)}</span></div>
              <div className="k"><span>Payouts go to</span><span className="mono">{c.freelancer_email}</span></div>
              {c.payer && <div className="k"><span>Funded by</span><span className="mono">{c.payer}</span></div>}
              {c.hold_expires && <div className="k"><span>Hold valid until</span><span>{c.hold_expires.slice(0, 10)}</span></div>}
            </div>
          </details>

          {c.scope && <div className="inset promo"><span className="art"><Spark /></span><div className="muted" style={{ fontSize: 14 }}>{c.scope}</div></div>}

          {who === 'client' && !c.authorization_id && c.status !== 'closed' && (
            <form action={fund}>
              <input type="hidden" name="contract" value={c.id} />
              <Submit className="btn primary block" pending="Opening PayPal…">Fund {usd(c.total_usd)} with PayPal</Submit>
            </form>
          )}
          {who === 'client' && funded && held > 0 && (
            <form action={closeContract}>
              <input type="hidden" name="contract" value={c.id} />
              <Submit className="btn block" pending="Returning…">Close &amp; return {usd(held)} to the client</Submit>
            </form>
          )}
          {who === 'freelancer' && !c.authorization_id && <div className="note">Wait until the client has funded it — the money held in PayPal is your guarantee.</div>}
          {m.paypal === 'simulated' && <p className="dim">PayPal is simulated (no keys): ids start with SIM- and no money moves.</p>}
        </div>

        <div className="panel">
          <h3>Record</h3>
          <p className="dim" style={{ marginTop: 4 }}>Every hold, verdict and payment — both sides see the same.</p>
          <Activity rows={log} />
        </div>
      </div>

      {/* ── right: the work ── */}
      <div className="col">
        <div className="row between">
          <div className="stack" style={{ gap: 4 }}>
            <Link href="/" className="dim">← All escrows</Link>
            <h1>{c.title}</h1>
          </div>
          <span className={`pill ${TONE[STATUS[c.status].tone] ?? ''}`}>{STATUS[c.status].label}</span>
        </div>
        <div className="two">
          <div className="stat"><small>Held in PayPal</small><b><span className="coin held">$</span>{usd(held)}</b></div>
          <div className="stat"><small>Paid on proof</small><b><span className="coin paid">✓</span>{usd(paid)}</b></div>
        </div>
        <h2>Milestones</h2>
        {ms.map(x => <MilestoneCard key={x.id} m={x} contractId={c.id} funded={funded} who={who} />)}
        {log.some(e => e.kind === 'funding.held') && <><h2>Metrics</h2><Metrics rows={log} /></>}
        <div className="item"><div><div>Protected by PayPal</div><div className="dim">Authorized, not captured, until a person releases it. Unreleased money is voided back.</div></div><span className="ic"><Shield /></span></div>
      </div>
    </div>
  );
}

function MilestoneCard({ m, contractId, funded, who }: { m: Milestone; contractId: string; funded: boolean; who: 'client' | 'freelancer' }) {
  const s = !funded && m.status === 'open' ? { label: 'Waiting for funding', tone: '' } : STATUS[m.status];
  const v: Verdict | null = m.review ? JSON.parse(m.review) : null;
  const suggested = v ? Math.round(m.amount_usd * v.release_percent) / 100 : m.amount_usd;
  const canSubmit = who === 'freelancer' && funded && (m.status === 'open' || m.status === 'changes_requested');
  const settled = m.status === 'released' || m.status === 'cancelled';

  return (
    <article className="panel ms">
      <div className="ms-head">
        <div className="row" style={{ flexWrap: 'nowrap', gap: 12 }}>
          <span className="n">{m.position}</span>
          <h3 style={{ fontSize: 18 }}>{m.title}</h3>
        </div>
        <span className="price">{usd(m.amount_usd)}</span>
      </div>
      <div className="row between" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
        <ul className="criteria">{criteriaList(m.criteria).map((c, i) => <li key={i}>{c}</li>)}</ul>
        <span className={`pill ${TONE[s.tone] ?? ''}`} style={{ flex: 'none' }}>{s.label}</span>
      </div>

      {m.status === 'released' && (
        <div className="note ok">
          {usd(m.paid_usd)} paid out via PayPal{m.paid_usd < m.amount_usd ? ` · ${usd(m.amount_usd - m.paid_usd)} not released` : ''}
          <div className="mono" style={{ marginTop: 4, opacity: .8 }}>capture {m.capture_id} · payout {m.payout_batch_id} · {(m.payout_status ?? '').toLowerCase()}</div>
        </div>
      )}

      {(m.submission_note || m.submission_url) && (
        <div className="inset">
          <div className="dim">Submitted {m.submitted_at ? ago(m.submitted_at) : ''}</div>
          {m.submission_note && <p style={{ marginTop: 6 }}>{m.submission_note}</p>}
          {m.submission_url && <a className="mono link" style={{ marginTop: 6, wordBreak: 'break-all' }} href={m.submission_url} target="_blank" rel="noreferrer noopener">{m.submission_url}</a>}
        </div>
      )}

      {v && !settled && (
        <div className="inset" style={{ padding: 18 }}>
          <div className="row between">
            <div className="row" style={{ gap: 10 }}>
              <span className="coin back sm">✦</span>
              <b style={{ fontWeight: 500 }}>AI Referee</b>
              <span className={`pill ${REC[v.recommendation].tone}`}>{REC[v.recommendation].label} · {v.release_percent}%</span>
            </div>
            <span className="dim">{v.confidence} confidence{v.read_url ? ' · read the link' : m.submission_url ? ' · link unreadable' : ''}</span>
          </div>
          <p style={{ margin: '12px 0 6px' }}>{v.summary}</p>
          {v.checks.map((ch, i) => (
            <div className="check" key={i}>
              <span className={`mk ${ch.status}`}>{MARK[ch.status] ?? '?'}</span>
              <span>{ch.criterion}<br /><span className="dim">{ch.evidence}</span></span>
            </div>
          ))}
          {v.message_to_freelancer && (
            <div className="check"><span className="mk unverifiable">✎</span><span><span className="dim">Note for the freelancer</span><br />{v.message_to_freelancer}</span></div>
          )}
          <div className="dim" style={{ marginTop: 8 }}>{v.model === 'offline' ? 'Offline referee (no AI key)' : v.model}</div>

          {who === 'client' && m.status === 'submitted' && (
            <div className="stack" style={{ marginTop: 16, gap: 10 }}>
              <form action={releasePayment} className="row" style={{ alignItems: 'end' }}>
                <input type="hidden" name="contract" value={contractId} />
                <input type="hidden" name="milestone" value={m.id} />
                <label style={{ width: 160 }}>Release (USD)<input name="amount" inputMode="decimal" defaultValue={suggested.toFixed(2)} /></label>
                <Submit className="btn primary" pending="Paying via PayPal…">Release &amp; pay with PayPal</Submit>
              </form>
              <form action={requestChanges}>
                <input type="hidden" name="contract" value={contractId} />
                <input type="hidden" name="milestone" value={m.id} />
                <input type="hidden" name="message" value={v.message_to_freelancer} />
                <Submit className="btn small" pending="Sending…">Request changes instead</Submit>
              </form>
            </div>
          )}
          {who === 'freelancer' && m.status === 'submitted' && <p className="dim" style={{ marginTop: 12 }}>The client sees this same verdict and decides what to release.</p>}
        </div>
      )}

      {m.status === 'submitted' && !v && (
        <form action={rereview}>
          <input type="hidden" name="contract" value={contractId} /><input type="hidden" name="milestone" value={m.id} />
          <Submit className="btn small" pending="Reviewing…">Run the referee</Submit>
        </form>
      )}

      {canSubmit && (
        <form action={submitWork} className="hero stack" style={{ gap: 12 }}>
          <input type="hidden" name="contract" value={contractId} />
          <input type="hidden" name="milestone" value={m.id} />
          <div className="label">{m.status === 'changes_requested' ? 'The client asked for changes — submit again when it’s fixed' : 'Submit your work — the AI referee checks it against every criterion'}</div>
          <input name="url" type="url" placeholder="Link to the work (page, repo, Figma, doc)" aria-label="Link to the work" />
          <textarea name="note" rows={3} placeholder="What you delivered, criterion by criterion" aria-label="What you delivered"
                    style={{ background: 'rgba(255,255,255,.14)', borderColor: 'rgba(255,255,255,.3)', color: '#fff' }} />
          <div className="divider" style={{ margin: 0 }} />
          <div><Submit className="btn sun" pending="The referee is checking…">Submit for review</Submit></div>
        </form>
      )}
      {who === 'freelancer' && !funded && !settled && <p className="dim">You can submit once the client has funded the contract.</p>}
    </article>
  );
}
