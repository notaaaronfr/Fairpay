import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.FAIRPAY_DB = ':memory:';
delete process.env.PAYPAL_CLIENT_ID; delete process.env.PAYPAL_CLIENT_SECRET;
delete process.env.ANTHROPIC_API_KEY;
delete process.env.FAIRPAY_AGENT_KEY;

const { POST, GET } = await import('../app/api/mcp/route.ts');

let id = 0;
async function rpc(method: string, params?: unknown, headers: Record<string, string> = {}) {
  const res = await POST(new Request('http://localhost:3000/api/mcp', {
    method: 'POST', headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }),
  }));
  return { status: res.status, body: res.status === 202 ? null : await res.json() };
}
const call = async (name: string, args: unknown) => (await rpc('tools/call', { name, arguments: args })).body.result;

async function fundedEscrow() {
  const r = await call('create_escrow', {
    title: 'Poster', client_name: 'Rosa', freelancer_name: 'Lina', freelancer_paypal_email: 'lina@example.com',
    milestones: [{ title: 'Poster copy', criteria: ['Lists the opening hours', 'Headline says fresh bread daily'], amount_usd: 200 }],
  });
  const { contract_id, fund_url } = r.structuredContent;
  // Simulated PayPal: the approval link is our own return URL with a SIM order.
  const { confirmFunding } = await import('../lib/escrow.ts');
  const { db } = await import('../lib/db.ts');
  await confirmFunding(db(), contract_id, new URL(fund_url).searchParams.get('token')!);
  return contract_id as string;
}

test('initialize and list tools, with annotations agents can act on', async () => {
  const init = await rpc('initialize', { protocolVersion: '2025-06-18' });
  assert.equal(init.body.result.serverInfo.name, 'fairpay');
  const tools = (await rpc('tools/list')).body.result.tools;
  assert.deepEqual(tools.map((t: any) => t.name), ['create_escrow', 'get_escrow', 'submit_work', 'release_payment', 'request_changes']);
  assert.equal(tools.find((t: any) => t.name === 'release_payment').annotations.destructiveHint, true, 'paying is destructive');
  assert.equal(tools.find((t: any) => t.name === 'get_escrow').annotations.readOnlyHint, true);
});

test('notifications get 202 and nothing else; GET is refused', async () => {
  const res = await POST(new Request('http://x/api/mcp', { method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) }));
  assert.equal(res.status, 202);
  assert.equal((await GET()).status, 405);
});

test('an agent cannot fund: create_escrow returns a link for a human', async () => {
  const r = await call('create_escrow', {
    title: 'T', client_name: 'A', freelancer_name: 'B', freelancer_paypal_email: 'b@x.co',
    milestones: [{ title: 'M', criteria: ['x is done'], amount_usd: 50 }],
  });
  assert.match(r.structuredContent.fund_url, /^http/);
  assert.equal(r.structuredContent.held_usd, 0, 'nothing is held until a person approves in PayPal');
});

test('an agent can never pay more than the referee recommended', async () => {
  const cid = await fundedEscrow();
  const ms = (await call('get_escrow', { contract_id: cid })).structuredContent.milestones[0];
  // Thin evidence: the offline referee recommends nothing.
  const v = (await call('submit_work', { milestone_id: ms.milestone_id, note: 'done' })).structuredContent.verdict;
  assert.equal(v.release_percent, 0);
  const refused = await call('release_payment', { milestone_id: ms.milestone_id });
  assert.equal(refused.isError, true);
  assert.match(refused.content[0].text, /has not recommended/);

  // Real evidence: the referee recommends the full amount; asking for more is refused.
  await call('submit_work', { milestone_id: ms.milestone_id, note: 'Headline: fresh bread daily. Opening hours listed: Mon-Sat 7-7.' });
  const over = await call('release_payment', { milestone_id: ms.milestone_id, amount_usd: 250 });
  assert.equal(over.isError, true);
  assert.match(over.content[0].text, /at most the referee/);

  const paid = await call('release_payment', { milestone_id: ms.milestone_id });
  assert.equal(paid.structuredContent.released_usd, 200);
  assert.equal(paid.structuredContent.status, 'closed');
});

test('a bearer key, when set, is required', async () => {
  process.env.FAIRPAY_AGENT_KEY = 'k';
  try {
    assert.equal((await rpc('tools/list')).status, 401);
    assert.equal((await rpc('tools/list', undefined, { authorization: 'Bearer k' })).status, 200);
  } finally { delete process.env.FAIRPAY_AGENT_KEY; }
});

test('unknown tools and methods are errors, not crashes', async () => {
  assert.equal((await rpc('tools/call', { name: 'wire_money', arguments: {} })).body.error.code, -32602);
  assert.equal((await rpc('resources/list')).body.error.code, -32601);
});
