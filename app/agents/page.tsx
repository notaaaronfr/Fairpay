import Link from 'next/link';
import { headers } from 'next/headers';
import { Spark as Bot } from '../../components/Icons.tsx';

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
    <>
      <section className="balance-row">
        <div>
          <div className="welcome">Fairpay for AI agents · Model Context Protocol <span className="chip">5 tools</span></div>
          <div className="big-money" style={{ fontSize: 'clamp(44px, 6vw, 84px)' }}>Hire on proof<span className="c">.</span></div>
        </div>
        <div className="actions"><Link href="/new" className="act"><Bot />Try it as a person</Link></div>
      </section>
      <div className="grid">
        <div className="col">
          <div className="track" style={{ cursor: 'default' }}>
            <div className="title">MCP endpoint <span className="live">Streamable HTTP</span></div>
            <div className="body" style={{ gridTemplateColumns: '1fr' }}>
              <div style={{ fontSize: 'clamp(18px, 2.4vw, 26px)', fontStyle: 'italic', wordBreak: 'break-all' }}>{url}</div>
            </div>
            <div className="foot"><span>A human funds · agents release at most the referee&rsquo;s recommendation</span><span>release_payment <b>destructive</b></span></div>
          </div>
          <div className="panel">
            <div className="panel-head"><h2>Tools</h2></div>
            {TOOLS.map(([name, text]) => (
              <div className="act-row" key={name}>
                <span className="ic"><Bot /></span>
                <span><div className="ttl mono" style={{ fontSize: 14 }}>{name}</div><div className="sub">{text}</div></span>
                <span />
              </div>
            ))}
          </div>
        </div>
        <div className="col">
          <div className="panel stack">
            <div className="panel-head" style={{ marginBottom: 0 }}><h2>A governed buyer, on Cairn</h2><a className="more" href="https://github.com/whatstask/Cairn">Cairn ›</a></div>
            <p className="muted" style={{ fontStyle: 'italic' }}>An agent built on Cairn that hires through this endpoint. Its spend is capped by a budget, every step is journaled, and it stops for your y/N before every payment.</p>
            <pre className="verdict mono" style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: 12.5 }}>{`cd agents/cairn-buyer
cargo run -- hire "A logo for my bakery, two milestones, $300, freelancer lina@example.com"
cargo run -- settle <contract_id>`}</pre>
            <pre className="verdict mono" style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: 12.5 }}>{`curl -s ${url} -H 'content-type: application/json' \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`}</pre>
          </div>
        </div>
      </div>
    </>
  );
}
