import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db, contract, milestones, events, type Milestone } from '../../../lib/db.ts';
import { heldUsd } from '../../../lib/escrow.ts';
import { criteriaList, type Verdict } from '../../../lib/referee.ts';
import { role, usd, ago, STATUS, modes } from '../../../lib/ui.ts';
import { fund, submitWork, releasePayment, requestChanges, closeContract, rereview } from '../../../lib/actions.ts';
import { Submit } from '../../../components/Submit.tsx';
import { BigMoney, Tracker, HoldCard, Activity, AV_COLORS } from '../../../components/Escrow.tsx';
import { Lock, Back, Down } from '../../../components/Icons.tsx';

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

  return (
    <>
      <section className="balance-row">
        <div>
          <div className="welcome">
            {c.client_name} → {c.freelancer_name} · {c.status === 'closed' ? 'Paid on proof' : 'Held in PayPal'}
            <span className={`chip ${paid ? 'pos' : ''}`}>{paid ? `▲ ${usd(paid)} paid` : STATUS[c.status].label}</span>
            <span>USD</span>
          </div>
          <BigMoney value={c.status === 'closed' ? paid : held || c.total_usd} />
        </div>
        <div className="actions">
          <Link href="/" className="act"><Back />Escrows</Link>
          {who === 'client' && !c.authorization_id && c.status !== 'closed' && (
            <form action={fund}>
              <input type="hidden" name="contract" value={c.id} />
              <Submit className="act" pending="Opening PayPal…"><Lock />Fund {usd(c.total_usd)}</Submit>
            </form>
          )}
          {who === 'client' && funded && held > 0 && (
            <form action={closeContract}>
              <input type="hidden" name="contract" value={c.id} />
              <Submit className="act" pending="Returning…"><Down />Close &amp; return {usd(held)}</Submit>
            </form>
          )}
        </div>
      </section>

      {(done || error) && <div className={`note ${done ? 'ok' : 'err'}`} role={done ? 'status' : 'alert'} style={{ marginBottom: 20 }}>{done ?? error}</div>}

      <div className="grid">
        <div className="col">
          <Tracker c={c} ms={ms} log={log} />
          <div className="panel">
            <div className="panel-head"><h2>Milestones</h2><span className="dim" style={{ fontStyle: 'italic' }}>{ms.filter(x => x.status === 'released').length} of {ms.length} paid</span></div>
            {c.scope && <p className="muted" style={{ fontStyle: 'italic', marginBottom: 8 }}>{c.scope}</p>}
            {ms.map(x => <MilestoneRow key={x.id} m={x} contractId={c.id} funded={funded} who={who} />)}
          </div>
        </div>

        <div className="col">
          <HoldCard c={c} held={held} paid={paid}>
            <div className="stack" style={{ gap: 6, marginTop: 10, fontSize: 13.5, fontStyle: 'italic' }}>
              <div className="row between"><span className="dim">Payouts to</span><span className="mono">{c.freelancer_email}</span></div>
              {c.payer && <div className="row between"><span className="dim">Funded by</span><span className="mono">{c.payer}</span></div>}
              <div className="row between"><span className="dim">Returned</span><span>{usd(c.refunded_usd)}</span></div>
            </div>
          </HoldCard>
          {who === 'freelancer' && !c.authorization_id && <div className="note">Wait until the client has funded it — the money held in PayPal is your guarantee.</div>}
          {m.paypal === 'simulated' && <div className="note">PayPal is simulated (no keys): ids start with SIM- and no money moves.</div>}
          <div className="panel">
            <div className="panel-head"><h2>Record</h2><span className="dim" style={{ fontStyle: 'italic' }}>Both sides see the same</span></div>
            <Activity rows={log} />
          </div>
        </div>
      </div>
    </>
  );
}

function MilestoneRow({ m, contractId, funded, who }: { m: Milestone; contractId: string; funded: boolean; who: 'client' | 'freelancer' }) {
  const s = !funded && m.status === 'open' ? { label: 'Waiting for funding', tone: '' } : STATUS[m.status];
  const v: Verdict | null = m.review ? JSON.parse(m.review) : null;
  const suggested = v ? Math.round(m.amount_usd * v.release_percent) / 100 : m.amount_usd;
  const canSubmit = who === 'freelancer' && funded && (m.status === 'open' || m.status === 'changes_requested');
  const settled = m.status === 'released' || m.status === 'cancelled';

  return (
    <article className="ms">
      <div className="row between" style={{ flexWrap: 'nowrap' }}>
        <div className="who">
          <span className="av" style={{ background: AV_COLORS[(m.position - 1) % AV_COLORS.length] }}>{m.position}</span>
          <span style={{ fontStyle: 'italic', fontSize: 17 }}>{m.title}<small style={{ display: 'block' }} className="dim">{criteriaList(m.criteria).length} criteria</small></span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontStyle: 'italic', fontSize: 17, fontWeight: 600 }}>{usd(m.amount_usd)}</div>
          <span className={`pill ${TONE[s.tone] ?? ''}`}>{s.label}</span>
        </div>
      </div>
      <ul className="criteria">{criteriaList(m.criteria).map((c, i) => <li key={i}>{c}</li>)}</ul>

      {m.status === 'released' && (
        <div className="note ok">
          {usd(m.paid_usd)} paid out via PayPal{m.paid_usd < m.amount_usd ? ` · ${usd(m.amount_usd - m.paid_usd)} not released` : ''}
          <div className="mono" style={{ marginTop: 4, opacity: .8 }}>capture {m.capture_id} · payout {m.payout_batch_id} · {(m.payout_status ?? '').toLowerCase()}</div>
        </div>
      )}

      {(m.submission_note || m.submission_url) && (
        <div className="verdict" style={{ padding: 14 }}>
          <div className="dim" style={{ fontStyle: 'italic' }}>Submitted {m.submitted_at ? ago(m.submitted_at) : ''}</div>
          {m.submission_note && <p style={{ marginTop: 6 }}>{m.submission_note}</p>}
          {m.submission_url && <a className="more mono" style={{ marginTop: 6, wordBreak: 'break-all' }} href={m.submission_url} target="_blank" rel="noreferrer noopener">{m.submission_url}</a>}
        </div>
      )}

      {v && !settled && (
        <div className="verdict">
          <div className="row between">
            <div className="row" style={{ gap: 10 }}>
              <b style={{ fontWeight: 600, fontStyle: 'italic' }}>✦ AI Referee</b>
              <span className={`pill ${REC[v.recommendation].tone}`}>{REC[v.recommendation].label} · {v.release_percent}%</span>
            </div>
            <span className="dim" style={{ fontStyle: 'italic' }}>{v.confidence} confidence{v.read_url ? ' · read the link' : m.submission_url ? ' · link unreadable' : ''}</span>
          </div>
          <p style={{ margin: '12px 0 6px' }}>{v.summary}</p>
          {v.checks.map((ch, i) => (
            <div className="check" key={i}>
              <span className={`mk ${ch.status}`}>{MARK[ch.status] ?? '?'}</span>
              <span>{ch.criterion}<br /><span className="dim">{ch.evidence}</span></span>
            </div>
          ))}
          {v.message_to_freelancer && <div className="check"><span className="mk unverifiable">✎</span><span><span className="dim">Note for the freelancer</span><br />{v.message_to_freelancer}</span></div>}
          <div className="dim" style={{ marginTop: 8 }}>{v.model === 'offline' ? 'Offline referee (no AI key)' : v.model}</div>
          {who === 'client' && m.status === 'submitted' && (
            <div className="stack" style={{ marginTop: 16, gap: 10 }}>
              <form action={releasePayment} className="row" style={{ alignItems: 'end' }}>
                <input type="hidden" name="contract" value={contractId} />
                <input type="hidden" name="milestone" value={m.id} />
                <label style={{ width: 160 }}>Release (USD)<input name="amount" inputMode="decimal" defaultValue={suggested.toFixed(2)} /></label>
                <Submit className="btn blue" pending="Paying via PayPal…">Release &amp; pay with PayPal</Submit>
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
        <form action={submitWork} className="submitbox">
          <input type="hidden" name="contract" value={contractId} />
          <input type="hidden" name="milestone" value={m.id} />
          <div style={{ fontStyle: 'italic', fontSize: 16 }}>{m.status === 'changes_requested' ? 'Changes requested — submit again when it’s fixed' : 'Submit your work — the AI referee checks every criterion'}</div>
          <input name="url" type="url" placeholder="Link to the work (page, repo, Figma, doc)" aria-label="Link to the work" />
          <textarea name="note" rows={3} placeholder="What you delivered, criterion by criterion" aria-label="What you delivered" />
          <div><Submit className="btn primary" pending="The referee is checking…">Submit for review</Submit></div>
        </form>
      )}
      {who === 'freelancer' && !funded && !settled && <p className="dim">You can submit once the client has funded the contract.</p>}
    </article>
  );
}
