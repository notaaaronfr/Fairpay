import Link from 'next/link';
import { headers } from 'next/headers';
import { Bot } from '../../components/Icons.tsx';

export const dynamic = 'force-dynamic';

const TOOLS = [
  ['create_escrow', 'Open a contract with milestones, criteria and amounts. Returns the PayPal link a human opens to fund it.'],
  ['get_escrow', 'Money held, paid and returned; every milestone and the referee’s latest verdict.'],
  ['submit_work', 'Deliver a milestone (note + link). The AI referee checks it and returns its verdict.'],
  ['release_payment', 'Capture from the hold and pay out — at most what the referee recommended. Marked destructive.'],
  ['request_changes', 'Send a milestone back with the referee’s notes.'],
];

export default async function Agents() {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const url = process.env.FAIRPAY_BASE_URL
    ? `${process.env.FAIRPAY_BASE_URL.replace(/\/$/, '')}/api/mcp`
    : `${/^(localhost|127\.)/.test(host) ? 'http' : 'https'}://${host}/api/mcp`;
  return (
    <div className="page">
      <div className="col">
        <div className="panel stack" style={{ gap: 14 }}>
          <div className="hero">
            <div className="label">Fairpay for AI agents · MCP</div>
            <div className="big" style={{ fontSize: 16, wordBreak: 'break-all', fontFamily: 'var(--font-mono), monospace' }}><span>{url}</span></div>
            <div className="divider" />
            <div className="foot"><Bot /> Streamable HTTP · 5 tools · bearer key optional</div>
          </div>
          <details className="ovd" open>
            <summary>Guardrails, enforced by the server</summary>
            <div className="ov">
              <div className="k"><span>Funding</span><span>Always a human, in PayPal</span></div>
              <div className="k"><span>Most an agent can release</span><span>The referee&rsquo;s recommendation</span></div>
              <div className="k"><span>release_payment</span><span>destructiveHint: true</span></div>
              <div className="k"><span>Record</span><span>Every call on the contract</span></div>
            </div>
          </details>
          <a href="https://github.com/whatstask/Cairn" className="inset promo">
            <span className="art"><Bot /></span>
            <div><div>A governed buyer agent, built on Cairn</div><span className="link">github.com/whatstask/Cairn</span></div>
          </a>
          <Link href="/new" className="btn primary block">Try it as a person first</Link>
        </div>
      </div>
      <div className="col">
        <h1>Hire with an Agent</h1>
        <p className="muted">
          AI agents are starting to buy services for people. Fairpay lets them do it safely: an agent can hire and pay on proof,
          but it can&rsquo;t fund anything without a human, and it can&rsquo;t pay more than the evidence supports.
        </p>
        <div className="panel">
          <h2 style={{ marginBottom: 6 }}>Tools</h2>
          {TOOLS.map(([name, text]) => (
            <div className="tx" key={name} style={{ gridTemplateColumns: '32px 1fr' }}>
              <span className="av ai">✦</span>
              <span><span className="name mono" style={{ fontSize: 14 }}>{name}</span><br /><span className="sub">{text}</span></span>
            </div>
          ))}
        </div>
        <div className="panel stack">
          <h2>Run the Cairn buyer</h2>
          <p className="muted">Its model spend is capped by a budget, every step is journaled to <span className="mono">runs/</span>, and it stops for your y/N before every payment.</p>
          <pre className="inset mono" style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: 12.5 }}>{`cd agents/cairn-buyer
cargo run -- hire "A logo for my bakery, two milestones, $300, freelancer lina@example.com"
cargo run -- settle <contract_id>`}</pre>
          <pre className="inset mono" style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: 12.5 }}>{`curl -s ${url} -H 'content-type: application/json' \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`}</pre>
        </div>
      </div>
    </div>
  );
}
