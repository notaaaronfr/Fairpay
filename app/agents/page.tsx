import Link from 'next/link';
import { headers } from 'next/headers';
import { Spark as Bot } from '../../components/Icons.tsx';

export const dynamic = 'force-dynamic';

const TOOLS = [
  ['create_escrow', 'Open + PayPal link'],
  ['get_escrow', 'Status + verdicts'],
  ['submit_work', 'Deliver, get checked'],
  ['release_payment', 'Pay ≤ referee'],
  ['request_changes', 'Send back'],
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
          <div className="welcome"><span className="chip">MCP · 5 tools</span></div>
          <div className="big-money" style={{ fontSize: 'clamp(44px, 6vw, 84px)' }}>Hire on proof<span className="c">.</span></div>
        </div>
        <div className="actions"><Link href="/new" className="act"><Bot />Try it</Link></div>
      </section>
      <div className="grid">
        <div className="col">
          <div className="track" style={{ cursor: 'default' }}>
            <div className="title">MCP endpoint <span className="live">Streamable HTTP</span></div>
            <div className="body" style={{ gridTemplateColumns: '1fr' }}>
              <div style={{ fontSize: 'clamp(18px, 2.4vw, 26px)', wordBreak: 'break-all' }}>{url}</div>
            </div>
            <div className="foot"><span>Human funds</span><span>Agent pays ≤ referee</span></div>
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
            <div className="panel-head" style={{ marginBottom: 0 }}><h2>Cairn buyer</h2><a className="more" href="https://github.com/whatstask/Cairn">Cairn ›</a></div>
            <p className="muted">Budgeted. Journaled. Asks before paying.</p>
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
