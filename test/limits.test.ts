import { test } from 'node:test';
import assert from 'node:assert/strict';
import { open } from '../lib/db.ts';
import { allowAI, clientIp, LIMITED } from '../lib/limits.ts';

test('per-visitor and daily caps on paid AI calls', () => {
  process.env.ANTHROPIC_API_KEY = 'test'; // pretend a paid model is configured
  process.env.FAIRPAY_AI_PER_IP_HOUR = '2';
  process.env.FAIRPAY_AI_PER_DAY = '3';
  try {
    const d = open();
    assert.equal(allowAI(d, '1.1.1.1', 'referee').ok, true);
    assert.equal(allowAI(d, '1.1.1.1', 'sharpen').ok, true);
    const third = allowAI(d, '1.1.1.1', 'referee');
    assert.equal(third.ok, false, 'two an hour for this visitor');
    assert.match(third.why!, new RegExp(LIMITED));
    assert.equal(allowAI(d, '2.2.2.2', 'agent').ok, true, 'another visitor still can');
    const day = allowAI(d, '3.3.3.3', 'agent');
    assert.equal(day.ok, false, 'three a day for everyone');
    assert.match(day.why!, /daily cap/);
  } finally {
    delete process.env.ANTHROPIC_API_KEY; delete process.env.FAIRPAY_AI_PER_IP_HOUR; delete process.env.FAIRPAY_AI_PER_DAY;
  }
});

test('with no paid model configured, referee calls are free and never counted', () => {
  delete process.env.ANTHROPIC_API_KEY; delete process.env.K2_API_KEY;
  process.env.FAIRPAY_AI_PER_IP_HOUR = '0';
  try { assert.equal(allowAI(open(), 'x', 'referee').ok, true); }
  finally { delete process.env.FAIRPAY_AI_PER_IP_HOUR; }
});

test('client IP comes from the proxy header', () => {
  const h = new Headers({ 'x-forwarded-for': '9.9.9.9, 10.0.0.1' });
  assert.equal(clientIp(h), '9.9.9.9');
  assert.equal(clientIp(new Headers()), 'unknown');
});
