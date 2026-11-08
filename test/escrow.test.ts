import { test } from 'node:test';
import assert from 'node:assert/strict';
import { open, contract, milestones, events } from '../lib/db.ts';
import { createContract, startFunding, confirmFunding, submit, release, requestChanges, close, heldUsd } from '../lib/escrow.ts';
import { offline, publicUrl, readDeliverable } from '../lib/referee.ts';
import * as paypal from '../lib/paypal.ts';

delete process.env.PAYPAL_CLIENT_ID; delete process.env.PAYPAL_CLIENT_SECRET;
delete process.env.ANTHROPIC_API_KEY;

const noFetch = (async () => { throw new Error('no network in tests'); }) as any;

function draft(d = open()) {
  const id = createContract(d, {
    title: 'Landing page', clientName: 'Acme', freelancerName: 'Lina', freelancerEmail: 'lina@example.com',
    milestones: [
      { title: 'Design', criteria: 'Mobile layout\nDesktop layout\nBrand colours used', amountUsd: 400 },
      { title: 'Build', criteria: 'Deployed to a public URL\nContact form sends email', amountUsd: 600 },
    ],
  });
  return { d, id };
}

async function funded() {
  const { d, id } = draft();
  const url = await startFunding(d, id, 'http://localhost:3000');
  await confirmFunding(d, id, new URL(url).searchParams.get('token')!);
  return { d, id, ms: milestones(d, id) };
}

test('a contract needs criteria, amounts and a payable freelancer', () => {
  const d = open();
  const base = { title: 'T', clientName: 'A', freelancerName: 'B', freelancerEmail: 'b@x.co' };
  assert.throws(() => createContract(d, { ...base, freelancerEmail: 'nope', milestones: [{ title: 'M', criteria: 'x', amountUsd: 1 }] }), /PayPal email/);
  assert.throws(() => createContract(d, { ...base, milestones: [{ title: 'M', criteria: '', amountUsd: 1 }] }), /criterion/);
  assert.throws(() => createContract(d, { ...base, milestones: [{ title: 'M', criteria: 'x', amountUsd: 0 }] }), /above zero/);
});

test('funding holds the whole total, and nothing is taken', async () => {
  const { d, id, ms } = await funded();
  const c = contract(d, id)!;
  assert.equal(c.status, 'funded');
  assert.equal(c.total_usd, 1000);
  assert.equal(heldUsd(c, ms), 1000);
});

test('work cannot be submitted before the money is held', async () => {
  const { d, id } = draft();
  await assert.rejects(submit(d, milestones(d, id)[0].id, { note: 'done' }, noFetch), /funded/);
});

test('the referee checks every criterion and the release follows it', async () => {
  const { d, id, ms } = await funded();
  const v = await submit(d, ms[0].id, { note: 'Mobile layout and desktop layout done, brand colours used throughout.' }, noFetch);
  assert.equal(v.checks.length, 3);
  assert.equal(v.recommendation, 'release');
  const r = await release(d, ms[0].id);
  assert.equal(r.amount, 400);
  assert.equal(heldUsd(contract(d, id)!, milestones(d, id)), 600);
  await assert.rejects(release(d, ms[0].id), /already settled/, 'never paid twice');
});

test('thin evidence gets a partial or a send-back, and the client can override the amount', async () => {
  const { d, ms } = await funded();
  const v = await submit(d, ms[1].id, { note: 'Deployed it.' }, noFetch);
  assert.notEqual(v.recommendation, 'release');
  requestChanges(d, ms[1].id, v.message_to_freelancer);
  assert.equal(milestones(d, ms[1].contract_id)[1].status, 'changes_requested');
  await submit(d, ms[1].id, { note: 'Deployed to a public URL; the contact form sends email to the client.' }, noFetch);
  await assert.rejects(release(d, ms[1].id, 700), /at most/);
  assert.equal((await release(d, ms[1].id, 550)).amount, 550);
});

test('closing returns exactly what was never released', async () => {
  const { d, id, ms } = await funded();
  await submit(d, ms[0].id, { note: 'Mobile layout, desktop layout, brand colours.' }, noFetch);
  await release(d, ms[0].id);
  assert.equal(await close(d, id), 600);
  const c = contract(d, id)!;
  assert.equal(c.status, 'closed');
  assert.equal(heldUsd(c, milestones(d, id)), 0);
  assert.ok(events(d, id).some(e => e.kind === 'contract.closed'));
});

test('releasing the last milestone settles the contract on its own', async () => {
  const { d, id, ms } = await funded();
  await submit(d, ms[0].id, { note: 'Mobile layout, desktop layout, brand colours.' }, noFetch);
  await release(d, ms[0].id, 300);
  await submit(d, ms[1].id, { note: 'Deployed to a public URL, contact form sends email.' }, noFetch);
  await release(d, ms[1].id);
  const c = contract(d, id)!;
  assert.equal(c.status, 'closed');
  assert.equal(c.refunded_usd, 100, 'the $100 not released on Design goes back');
});

test('the offline referee is honest when there is no evidence', () => {
  const v = offline(['Has tests'], '', null, false);
  assert.equal(v.checks[0].status, 'unverifiable');
  assert.equal(v.recommendation, 'request_changes');
  assert.equal(v.release_percent, 0);
});

test('the referee will not fetch private or local addresses', async () => {
  for (const u of ['http://localhost:3000', 'http://127.0.0.1/x', 'http://10.0.0.5', 'http://192.168.1.1', 'file:///etc/passwd', 'http://[::1]/'])
    assert.equal(publicUrl(u), null, u);
  assert.ok(publicUrl('https://example.com/page'));
  const seen: string[] = [];
  const f = (async (u: string) => { seen.push(u); return new Response('# Readme', { headers: { 'content-type': 'text/plain' } }); }) as any;
  assert.equal(await readDeliverable('https://github.com/acme/site', f), '# Readme');
  assert.equal(seen[0], 'https://raw.githubusercontent.com/acme/site/HEAD/README.md', 'a repo is read as its README');
});

test('sandbox: the requests PayPal receives', async () => {
  const seen: { url: string; body: any; headers: any }[] = [];
  paypal.useFetch((async (url: any, init: any) => {
    seen.push({ url: String(url), body: init?.body ? JSON.parse(init.body === 'grant_type=client_credentials' ? '{}' : init.body) : null, headers: init?.headers });
    const u = String(url);
    const j = (o: unknown) => new Response(JSON.stringify(o), { status: 201 });
    if (u.endsWith('/token')) return j({ access_token: 'T', expires_in: 3600 });
    if (u.endsWith('/v2/checkout/orders')) return j({ id: 'O1', links: [{ rel: 'payer-action', href: 'https://sandbox/approve' }] });
    if (u.endsWith('/authorize')) return j({ purchase_units: [{ payments: { authorizations: [{ id: 'A1', status: 'CREATED', amount: { value: '1000.00' } }] } }] });
    if (u.includes('/capture')) return j({ id: 'C1', status: 'COMPLETED' });
    if (u.endsWith('/payouts')) return j({ batch_header: { payout_batch_id: 'B1', batch_status: 'PENDING' } });
    if (u.endsWith('/void')) return new Response(null, { status: 204 });
    return new Response('{}', { status: 404 });
  }) as any);
  process.env.PAYPAL_CLIENT_ID = 'id'; process.env.PAYPAL_CLIENT_SECRET = 'secret';
  try {
    const { d, id } = draft();
    assert.equal(await startFunding(d, id, 'http://x'), 'https://sandbox/approve');
    assert.equal(seen.find(s => s.url.endsWith('/orders'))!.body.intent, 'AUTHORIZE');
    await confirmFunding(d, id, 'O1');
    const ms = milestones(d, id);
    await submit(d, ms[0].id, { note: 'Mobile layout, desktop layout, brand colours.' }, noFetch);
    await release(d, ms[0].id);
    const cap = seen.find(s => s.url.includes('/capture'))!;
    assert.equal(cap.body.amount.value, '400.00');
    assert.equal(cap.body.final_capture, false, 'the rest stays held');
    assert.equal(seen.find(s => s.url.endsWith('/payouts'))!.body.items[0].receiver, 'lina@example.com');
    await close(d, id);
    assert.ok(seen.some(s => s.url.endsWith('/authorizations/A1/void')));
  } finally {
    delete process.env.PAYPAL_CLIENT_ID; delete process.env.PAYPAL_CLIENT_SECRET;
    paypal.useFetch(fetch);
  }
});
