import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db, contract, milestones, events, type Milestone } from '../../../lib/db.ts';
import { heldUsd } from '../../../lib/escrow.ts';
import { criteriaList, type Verdict } from '../../../lib/referee.ts';
import { role, usd, ago, STATUS, modes } from '../../../lib/ui.ts';
import { fund, submitWork, releasePayment, requestChanges, closeContract, rereview } from '../../../lib/actions.ts';
import { Submit } from '../../../components/Submit.tsx';
import { EscrowCard, Activity } from '../../../components/Escrow.tsx';
import { Lock, Return, Upload, Send } from '../../../components/Icons.tsx';

export const dynamic = 'force-dynamic';

const MARK: Record<string, string> = { met: '✓', partial: '½', missing: '✕', unverifiable: '?' };
const REC: Record<string, { label: string; tone: string }> = {
  release: { label: 'Release', tone: 'pos' }, partial: { label: 'Partial release', tone: 'amb' },
  request_changes: { label: 'Request changes', tone: 'neg' },
};

export default async function ContractPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; done?: string }>;
}) {
  const { id } = await params;
  const { error, done } = await searchParams;
  const d = db();
  const c = contract(d, id);
  if (!c) notFound();
  const ms = milestones(d, id);
  const who = await role();
  const m = modes();

  const paid = ms.reduce((s, x) => s + x.paid_usd, 0);
  const held = heldUsd(c, ms);
  const funded = c.status === 'funded';
  const anySubmitted = ms.some(x => x.submitted_at);
  const anyPaid = ms.some(x => x.status === 'released');
  const stage = c.status === 'closed' ? 5 : anyPaid ? 4 : anySubmitted ? 3 : c.authorization_id ? 2 : 1;
  const STEPS = ['Agree', 'Fund', 'Prove', 'Pay', 'Settle'];

  return (
    <div className="split">
      {/* ── left: the money ── */}
      <section className="stack" style={{ alignContent: 'start', gap: 22 }}>
        <Link href="/" className="back">Back</Link>
        <div className="stack" style={{ gap: 8 }}>
          <h1>{c.title}</h1>
          <div className="muted">{c.client_name} hired {c.freelancer_name}</div>
        </div>

        <EscrowCard c={c} held={held} paid={paid} />

        <div className="steps" aria-label="Progress">
          {STEPS.map((s, i) => (
            <span key={s} style={{ display: 'contents' }}>
              {i > 0 && <span className="gap">···</span>}
              <span className={`s ${i + 1 < stage || stage === 5 ? 'done' : i + 1 === stage ? 'now' : ''}`}><span className="c">{i + 1}</span>{s}</span>
            </span>
          ))}
        </div>

        {done && <div className="note ok" role="status">{done}</div>}
        {error && <div className="note err" role="alert">{error}</div>}

        <div className="tiles">
          {who === 'client' ? (
            <>
              <form action={fund} style={{ display: 'contents' }}>
                <input type="hidden" name="contract" value={c.id} />
                <Submit className="tile violet" pending="Opening PayPal…" disabled={!!c.authorization_id || c.status === 'closed'}>
                  <span className="ic"><Lock /></span>{c.authorization_id ? 'Funded' : `Fund ${usd(c.total_usd)}`}
                </Submit>
              </form>
              <form action={closeContract} style={{ display: 'contents' }}>
                <input type="hidden" name="contract" value={c.id} />
                <Submit className="tile blue" pending="Returning…" disabled={!(funded && held > 0)}>
                  <span className="ic"><Return /></span>{funded && held > 0 ? `Return ${usd(held)}` : 'Close & Return'}
                </Submit>
              </form>
            </>
          ) : (
            <>
              <a href="#milestones" className="tile indigo"><span className="ic"><Upload /></span>Submit Work</a>
              <div className="tile ghost"><span className="ic"><Send /></span>{usd(paid)} received</div>
            </>
          )}
        </div>

        <div className="row" style={{ gap: 28 }}>
          <div><div className="dim">Paid to freelancer</div><div style={{ fontSize: 22 }} className="pos">{usd(paid)}</div></div>
          <div><div className="dim">Held in PayPal</div><div style={{ fontSize: 22 }}>{usd(held)}</div></div>
          <div><div className="dim">{c.refunded_usd ? 'Returned' : 'Total'}</div><div style={{ fontSize: 22 }}>{usd(c.refunded_usd || c.total_usd)}</div></div>
        </div>
        <p className="dim">
          {c.authorization_id
            ? <>Authorized by {c.payer ?? 'the client'}{c.hold_expires ? `, valid until ${c.hold_expires.slice(0, 10)}` : ''} · <span className="mono">{c.authorization_id}</span></>
            : who === 'freelancer' ? 'Not funded yet — wait for the money to be held before you start. That is your guarantee.'
            : 'Nothing is held yet. Fund it so the freelancer can start knowing they will be paid.'}
          {m.paypal === 'simulated' && ' PayPal is simulated (no keys): ids start with SIM- and no money moves.'}
        </p>

        <div>
          <h2 style={{ marginTop: 10 }}>Record</h2>
          <Activity rows={events(d, id)} />
        </div>
      </section>

      {/* ── right: the work ── */}
      <section className="stack" style={{ alignContent: 'start' }} id="milestones">
        <div className="row between" style={{ paddingTop: 34 }}>
          <h2>Milestones</h2>
          <span className={`pill ${c.status === 'funded' ? 'ink' : ''}`}>{STATUS[c.status].label}</span>
        </div>
        {c.scope && <p className="muted">{c.scope}</p>}
        {ms.map(x => <MilestoneCard key={x.id} m={x} contractId={c.id} funded={funded} who={who} />)}
      </section>
    </div>
  );
}

function MilestoneCard({ m, contractId, funded, who }: { m: Milestone; contractId: string; funded: boolean; who: 'client' | 'freelancer' }) {
  const s = !funded && m.status === 'open' ? { label: 'Waiting for funding', tone: '' } : STATUS[m.status];
  const tone = ({ green: 'pos', red: 'neg', amber: 'amb', blue: '' } as Record<string, string>)[s.tone] ?? '';
  const v: Verdict | null = m.review ? JSON.parse(m.review) : null;
  const suggested = v ? Math.round(m.amount_usd * v.release_percent) / 100 : m.amount_usd;
  const canSubmit = who === 'freelancer' && funded && (m.status === 'open' || m.status === 'changes_requested');
  const settled = m.status === 'released' || m.status === 'cancelled';

  return (
    <article className="ms">
      <div className="ms-head">
        <div className="row" style={{ flexWrap: 'nowrap', gap: 12 }}>
          <span className="n">{m.position}</span>
          <h3>{m.title}</h3>
        </div>
        <span className="price">{usd(m.amount_usd)}</span>
      </div>
      <div className="row between" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
        <ul className="criteria" style={{ margin: 0 }}>{criteriaList(m.criteria).map((c, i) => <li key={i}>{c}</li>)}</ul>
        <span className={`pill ${tone}`} style={{ flex: 'none' }}>{s.label}</span>
      </div>

      {m.status === 'released' && (
        <div className="note ok">
          {usd(m.paid_usd)} paid out via PayPal{m.paid_usd < m.amount_usd ? ` · ${usd(m.amount_usd - m.paid_usd)} not released` : ''}
          <div className="mono" style={{ marginTop: 4, opacity: .8 }}>capture {m.capture_id} · payout {m.payout_batch_id} · {(m.payout_status ?? '').toLowerCase()}</div>
        </div>
      )}

      {(m.submission_note || m.submission_url) && (
        <div className="panel" style={{ padding: 16 }}>
          <div className="dim">Submitted {m.submitted_at ? ago(m.submitted_at) : ''}</div>
          {m.submission_note && <p style={{ marginTop: 6 }}>{m.submission_note}</p>}
          {m.submission_url && <a className="mono" style={{ display: 'block', marginTop: 6, textDecoration: 'underline' }} href={m.submission_url} target="_blank" rel="noreferrer noopener">{m.submission_url}</a>}
        </div>
      )}

      {v && !settled && (
        <div className="panel" style={{ padding: 18 }}>
          <div className="row between">
            <div className="row" style={{ gap: 8 }}>
              <span className="tx" style={{ display: 'contents' }}><span className="av ai" style={{ width: 26, height: 26, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg,#7c6be0,#5b84d6)', color: '#fff', fontSize: 12 }}>✦</span></span>
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
                <label style={{ width: 150 }}>Release (USD)<input name="amount" inputMode="decimal" defaultValue={suggested.toFixed(2)} /></label>
                <Submit className="btn solid" pending="Paying via PayPal…">Release &amp; pay</Submit>
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
        <form action={submitWork} className="stack" style={{ gap: 12, borderTop: '1px solid var(--line)', paddingTop: 16 }}>
          <input type="hidden" name="contract" value={contractId} />
          <input type="hidden" name="milestone" value={m.id} />
          {m.status === 'changes_requested' && <div className="note">The client asked for changes. Submit again when it&rsquo;s fixed.</div>}
          <label>Link to the work <span className="dim">— a page, repo, Figma or doc; the referee reads it</span>
            <input name="url" type="url" placeholder="https://" />
          </label>
          <label>What you delivered<textarea name="note" rows={3} placeholder="Walk the client through it, criterion by criterion." /></label>
          <div><Submit className="btn solid" pending="The referee is checking…">Submit for review</Submit></div>
        </form>
      )}
      {who === 'freelancer' && !funded && !settled && <p className="dim">You can submit once the client has funded the contract.</p>}
    </article>
  );
}
