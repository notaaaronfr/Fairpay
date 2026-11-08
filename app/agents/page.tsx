import Link from 'next/link';
import { headers } from 'next/headers';

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
    <div className="split">
      <section className="stack" style={{ alignContent: 'start', gap: 22 }}>
        <Link href="/" className="back">Back</Link>
        <h1>Hire with an Agent</h1>
        <p className="muted">
          AI agents are starting to buy services for people. Fairpay lets them do it safely: an agent can hire and
          pay on proof, but it can&rsquo;t fund anything without a human, and it can&rsquo;t pay more than the evidence supports.
        </p>
        <div className="panel big">
          <span className="dim">MCP endpoint · streamable HTTP</span>
          <b style={{ fontSize: 17, wordBreak: 'break-all', fontFamily: 'var(--mono)' }}>{url}</b>
        </div>
        <div className="tiles">
          <div className="tile violet" style={{ cursor: 'default' }}><span className="ic">1</span>A human funds</div>
          <div className="tile blue" style={{ cursor: 'default' }}><span className="ic">2</span>Pay only on proof</div>
          <div className="tile indigo" style={{ cursor: 'default' }}><span className="ic">3</span>Release needs approval</div>
          <div className="tile plum" style={{ cursor: 'default' }}><span className="ic">4</span>Every step on record</div>
        </div>
      </section>
      <section className="stack" style={{ alignContent: 'start' }}>
        <h2 style={{ paddingTop: 34 }}>Tools</h2>
        <div>
          {TOOLS.map(([name, text]) => (
            <div className="tx" key={name} style={{ gridTemplateColumns: '30px 1fr' }}>
              <span className="av ai">✦</span>
              <span><span className="name mono" style={{ fontSize: 14 }}>{name}</span><br /><span className="sub">{text}</span></span>
            </div>
          ))}
        </div>
        <h2 style={{ marginTop: 18 }}>A governed buyer, on Cairn</h2>
        <p className="muted">
          <code className="mono">agents/cairn-buyer</code> is an agent built on{' '}
          <a href="https://github.com/whatstask/Cairn" style={{ textDecoration: 'underline' }}>Cairn</a> that hires through this endpoint.
          Its spend is capped by a budget, every step is journaled, and it stops for your y/N before every payment.
        </p>
        <pre className="panel mono" style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: 12.5 }}>{`cd agents/cairn-buyer
cargo run -- hire "A logo for my bakery, two milestones, $300, freelancer lina@example.com"
cargo run -- settle <contract_id>`}</pre>
        <pre className="panel mono" style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: 12.5 }}>{`curl -s ${url} -H 'content-type: application/json' \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`}</pre>
      </section>
    </div>
  );
}
