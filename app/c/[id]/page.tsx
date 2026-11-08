import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db, contract, milestones, events, agentRuns, type Milestone } from '../../../lib/db.ts';
import { agentReady } from '../../../lib/agent.ts';
import { heldUsd } from '../../../lib/escrow.ts';
import { criteriaList, type Verdict } from '../../../lib/referee.ts';
import { role, usd, ago, STATUS, modes } from '../../../lib/ui.ts';
import { fund, submitWork, releasePayment, requestChanges, closeContract, rereview, settleWithAgent, decideAgent } from '../../../lib/actions.ts';
import { Submit } from '../../../components/Submit.tsx';
import { BigMoney, Tracker, HoldCard, Activity, AV_COLORS } from '../../../components/Escrow.tsx';
import { BlurText, Rise, Spotlight } from '../../../components/Motion.tsx';
import { Lock, Back, Down, Spark } from '../../../components/Icons.tsx';

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
            <BlurText text={`${c.client_name} → ${c.freelancer_name}`} />
            <span className={`chip ${paid ? 'pos' : ''}`}>{paid ? `▲ ${usd(paid)} paid` : STATUS[c.status].label}</span>
          </div>
          <BigMoney value={c.status === 'closed' ? paid : held || c.total_usd} />
        </div>
        <div className="actions">
          <Link href="/" className="act"><Back />Back</Link>
          {who === 'client' && !c.authorization_id && c.status !== 'closed' && (
            <form action={fund}>
              <input type="hidden" name="contract" value={c.id} />
              <Submit className="act" pending="Opening PayPal…"><Lock />Fund</Submit>
            </form>
          )}
          {who === 'client' && funded && held > 0 && (
            <form action={closeContract}>
              <input type="hidden" name="contract" value={c.id} />
              <Submit className="act" pending="Returning…"><Down />Return {usd(held)}</Submit>
            </form>
          )}
        </div>
      </section>

      {(done || error) && <div className={`note ${done ? 'ok' : 'err'}`} role={done ? 'status' : 'alert'} style={{ marginBottom: 20 }}>{done ?? error}</div>}

      <div className="grid">
        <div className="col">
          <Tracker c={c} ms={ms} log={log} />
          <Rise i={1}><Spotlight className="panel">
            <div className="panel-head"><h2>Milestones</h2><span className="dim">{ms.filter(x => x.status === 'released').length}/{ms.length} paid</span></div>
            {ms.map((x, i) => <Rise key={x.id} i={i}><MilestoneRow m={x} contractId={c.id} funded={funded} who={who} /></Rise>)}
          </Spotlight></Rise>
        </div>

        <div className="col">
          <HoldCard c={c} held={held} paid={paid}>
            <div className="stack" style={{ gap: 6, marginTop: 10, fontSize: 13.5 }}>
              <div className="row between"><span className="dim">To</span><span className="mono">{c.freelancer_email}</span></div>
              {c.refunded_usd > 0 && <div className="row between"><span className="dim">Returned</span><span>{usd(c.refunded_usd)}</span></div>}
            </div>
          </HoldCard>
          {who === 'freelancer' && !c.authorization_id && <div className="note">Not funded yet.</div>}
          {m.paypal === 'simulated' && <div className="note">PayPal simulated.</div>}
          {who === 'client' && <Rise i={2}><AgentPanel contractId={c.id} runs={agentRuns(d, id)} canSettle={funded && ms.some(x => x.status === 'submitted')} /></Rise>}
          <Rise i={2}><Spotlight className="panel">
            <div className="panel-head"><h2>Record</h2></div>
            <Activity rows={log} />
          </Spotlight></Rise>
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
          <span style={{ fontSize: 17 }}>{m.title}</span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 17, fontWeight: 600 }}>{usd(m.amount_usd)}</div>
          <span className={`pill ${TONE[s.tone] ?? ''}`}>{s.label}</span>
        </div>
      </div>
      <details className="crit">
        <summary>{criteriaList(m.criteria).length} criteria</summary>
        <ul className="criteria">{criteriaList(m.criteria).map((c, i) => <li key={i}>{c}</li>)}</ul>
      </details>

      {m.status === 'released' && (
        <div className="note ok">
          Paid {usd(m.paid_usd)}
          <div className="mono" style={{ marginTop: 4, opacity: .8 }}>capture {m.capture_id} · payout {m.payout_batch_id} · {(m.payout_status ?? '').toLowerCase()}</div>
        </div>
      )}

      {(m.submission_note || m.submission_url) && (
        <div className="verdict" style={{ padding: 14 }}>
          <div className="dim">{m.submitted_at ? ago(m.submitted_at) : ''}</div>
          {m.submission_note && <p style={{ marginTop: 6 }}>{m.submission_note}</p>}
          {m.submission_url && <a className="more mono" style={{ marginTop: 6, wordBreak: 'break-all' }} href={m.submission_url} target="_blank" rel="noreferrer noopener">{m.submission_url}</a>}
        </div>
      )}

      {v && !settled && (
        <div className="verdict">
          <div className="row between">
            <div className="row" style={{ gap: 10 }}>
              <b style={{ fontWeight: 600 }}>✦ Referee</b>
              <span className={`pill ${REC[v.recommendation].tone}`}>{REC[v.recommendation].label} · {v.release_percent}%</span>
            </div>
            <span className="dim">{v.confidence}</span>
          </div>
          <p style={{ margin: '12px 0 6px' }}>{v.summary}</p>
          {v.checks.map((ch, i) => (
            <Rise key={i} i={i} className="check">
              <span className={`mk ${ch.status}`}>{MARK[ch.status] ?? '?'}</span>
              <span>{ch.criterion}<br /><span className="dim">{ch.evidence}</span></span>
            </Rise>
          ))}
          {v.message_to_freelancer && <div className="check"><span className="mk unverifiable">✎</span><span>{v.message_to_freelancer}</span></div>}
          
          {who === 'client' && m.status === 'submitted' && (
            <div className="stack" style={{ marginTop: 16, gap: 10 }}>
              <form action={releasePayment} className="row" style={{ alignItems: 'end' }}>
                <input type="hidden" name="contract" value={contractId} />
                <input type="hidden" name="milestone" value={m.id} />
                <label style={{ width: 140 }}>USD<input name="amount" inputMode="decimal" defaultValue={suggested.toFixed(2)} /></label>
                <Submit className="btn blue" pending="Paying…">Release</Submit>
              </form>
              <form action={requestChanges}>
                <input type="hidden" name="contract" value={contractId} />
                <input type="hidden" name="milestone" value={m.id} />
                <input type="hidden" name="message" value={v.message_to_freelancer} />
                <Submit className="btn small" pending="Sending…">Ask for changes</Submit>
              </form>
            </div>
          )}
          
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
          <div style={{ fontSize: 16, fontWeight: 500 }}>{m.status === 'changes_requested' ? 'Resubmit' : 'Submit'}</div>
          <input name="url" type="url" placeholder="Link" aria-label="Link to the work" />
          <textarea name="note" rows={3} placeholder="Note" aria-label="What you delivered" />
          <div><Submit className="btn primary" pending="Checking…">Submit</Submit></div>
        </form>
      )}
      
    </article>
  );
}

function AgentPanel({ contractId, runs, canSettle }: { contractId: string; runs: ReturnType<typeof agentRuns>; canSettle: boolean }) {
  const ready = agentReady();
  const last = runs[0];
  const waiting: { id: string; name: string; input: any }[] = last && last.status === 'awaiting_approval' ? JSON.parse(last.awaiting) : [];
  return (
    <Spotlight className="panel agent-card">
      <div className="panel-head">
        <h2>Agent</h2>
        <span className="pill blue">Cairn{last ? ` · $${last.cost_usd.toFixed(3)}` : ''}</span>
      </div>
      {waiting.length > 0 ? (
        <div className="stack" style={{ gap: 10 }}>
          {waiting.map(w => (
            <div key={w.id} className="approve">
              <div className="row between">
                <b style={{ fontWeight: 600 }}>{w.name === 'release_payment' ? 'Pay' : w.name.replace('_', ' ')}</b>
                <span className="dim">{w.input?.amount_usd ? `$${Number(w.input.amount_usd).toFixed(2)}` : 'referee amount'}</span>
              </div>
              <div className="row" style={{ gap: 8 }}>
                {(['yes', 'no'] as const).map(ans => (
                  <form key={ans} action={decideAgent}>
                    <input type="hidden" name="contract" value={contractId} />
                    <input type="hidden" name="run" value={last.id} />
                    <input type="hidden" name="call" value={w.id} />
                    <input type="hidden" name="answer" value={ans} />
                    <Submit className={`btn small ${ans === 'yes' ? 'blue' : ''}`} pending={ans === 'yes' ? 'Paying…' : '…'}>{ans === 'yes' ? 'Approve' : 'Deny'}</Submit>
                  </form>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <form action={settleWithAgent}>
          <input type="hidden" name="contract" value={contractId} />
          <Submit className="btn primary block" pending="Agent working…" disabled={!ready.ok || !canSettle}><Spark />Settle with agent</Submit>
          {!ready.ok && <div className="dim" style={{ marginTop: 8 }}>{ready.why}</div>}
        </form>
      )}
      {last?.output && <p className="muted" style={{ marginTop: 12, fontSize: 14 }}>{short(last.output)}</p>}
    </Spotlight>
  );
}

/** The agent's reply, cut to its first sentence, without links or ids. */
function short(text: string): string {
  const clean = text.replace(/CONTRACT:\s*ctr_[a-z0-9]+/g, '').replace(/https?:\/\/\S+/g, '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
  const first = clean.match(/^.*?[.!?](\s|$)/)?.[0] ?? clean;
  return first.length > 160 ? first.slice(0, 157) + '…' : first.trim();
}
