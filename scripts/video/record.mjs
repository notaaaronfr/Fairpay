// Records the Fairpay demo against the running app. Writes raw.webm + marks.json.
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:3200';
const CONTRACT = process.env.CONTRACT ?? 'ctr_99cb6f6e1d0c';
const W = 1600, H = 900;
const THUMB = fs.readFileSync('/Users/charles/fairpay/docs/thumbnail.png').toString('base64');

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: W, height: H }, deviceScaleFactor: 1,
  recordVideo: { dir: 'rec', size: { width: W, height: H } },
});
await ctx.addCookies([
  { name: 'fp_theme', value: 'dark', url: BASE },
  { name: 'fp_role', value: 'client', url: BASE },
]);
// A visible cursor, since headless recordings have none.
await ctx.addInitScript(() => {
  addEventListener('DOMContentLoaded', () => {
    const c = document.createElement('div');
    c.id = '__cursor';
    c.style.cssText = 'position:fixed;left:0;top:0;width:22px;height:22px;border-radius:50%;background:rgba(255,196,57,.9);border:2px solid #14110a;box-shadow:0 0 0 6px rgba(255,196,57,.25);z-index:2147483647;pointer-events:none;transform:translate(800px,450px);transition:transform .7s cubic-bezier(.22,1,.36,1)';
    document.body.appendChild(c);
    const last = sessionStorage.getItem('__cur');
    if (last) c.style.transform = last;
  });
});

const page = await ctx.newPage();
const t0 = Date.now();
const marks = {};
const mark = id => { marks[id] = (Date.now() - t0) / 1000; console.log(id, marks[id].toFixed(1)); };
const wait = ms => page.waitForTimeout(ms);

async function moveTo(loc) {
  await loc.scrollIntoViewIfNeeded();
  const b = await loc.boundingBox();
  if (!b) return;
  const t = `translate(${b.x + b.width / 2 - 11}px, ${b.y + b.height / 2 - 11}px)`;
  await page.evaluate(t => { const c = document.getElementById('__cursor'); if (c) c.style.transform = t; sessionStorage.setItem('__cur', t); }, t);
  await wait(800);
}
async function click(loc) {
  await moveTo(loc);
  await page.evaluate(() => { const c = document.getElementById('__cursor'); if (c) { c.animate([{ boxShadow: '0 0 0 6px rgba(255,196,57,.25)' }, { boxShadow: '0 0 0 18px rgba(255,196,57,0)' }], 450); } });
  await loc.click();
}
async function glide(y, ms = 1200) {
  await page.evaluate(({ y, ms }) => new Promise(r => {
    const s = scrollY, d = y - s, t = performance.now();
    const f = n => { const k = Math.min(1, (n - t) / ms); scrollTo(0, s + d * (1 - Math.pow(1 - k, 3))); k < 1 ? requestAnimationFrame(f) : r(); };
    requestAnimationFrame(f);
  }), { y, ms });
}
const go = async url => { await page.goto(BASE + url, { waitUntil: 'networkidle' }); await wait(1800); };

// ── s01 title ──
await page.setContent(`<html><body style="margin:0;background:#07080b;display:grid;place-items:center;height:100vh"><img src="data:image/png;base64,${THUMB}" style="height:96vh;border-radius:24px"></body></html>`);
await wait(500); mark('s01_title'); await wait(10500);

// ── s02 home ──
await go('/'); mark('s02_home');
await moveTo(page.locator('.track').first()); await wait(2500);
await moveTo(page.locator('.plastic').first()); await wait(2500);
await glide(500); await wait(2500); await glide(0); await wait(2500);

// ── s03 agent ──
await go('/new'); mark('s03_agent');
const brief = page.locator('textarea[name=brief]');
await click(brief);
await page.keyboard.type('Menu design for a food truck, 2 milestones, $250, pay sam@design.example', { delay: 28 });
await click(page.getByRole('button', { name: 'Build escrow' }));
await page.waitForURL(/\/c\/ctr_/, { timeout: 180_000 });
await wait(2500);
await moveTo(page.locator('.track').first()); await wait(2500);

// ── s04 builder ──
await go('/new'); mark('s04_builder');
await glide(560, 1500); await wait(1200);
await moveTo(page.locator('.money-in').first()); await wait(1500);
await moveTo(page.locator('.crit-row').first()); await wait(1500);
await moveTo(page.getByRole('button', { name: /Sharpen/ }).first()); await wait(1500);
await moveTo(page.locator('.summary .total')); await wait(2500);

// ── s05 funded contract ──
await go(`/c/${CONTRACT}`); mark('s05_funded');
await moveTo(page.locator('.big-money')); await wait(2500);
await moveTo(page.locator('.track .line')); await wait(3000);
await moveTo(page.locator('.plastic').first()); await wait(3500);

// ── s06 freelancer submits milestone 2 ──
mark('s06_submit');
await click(page.getByRole('button', { name: /Viewing as client/ }));
await page.waitForLoadState('networkidle'); await wait(1500);
const box = page.locator('form.submitbox').first();
await click(box.locator('input[name=url]'));
await page.keyboard.type('https://raw.githubusercontent.com/notaaaronfr/Fairpay/main/docs/demo/final/final-files.md', { delay: 8 });
await click(box.locator('textarea[name=note]'));
await page.keyboard.type('Final wheat logo with your feedback applied: SVG in colour, black and white; transparent PNGs at 512 and 1024; HEX colours and fonts documented.', { delay: 10 });
await click(box.getByRole('button', { name: 'Submit' }));
await page.waitForURL(/done=/, { timeout: 180_000 });
await wait(2000);
const verdict = page.locator('.verdict').filter({ hasText: 'Referee' }).last();
await moveTo(verdict); await wait(4000);

// ── s07 the first milestone's verdict ──
mark('s07_verdict');
const report = page.locator('details.referee-report').first();
await click(report.locator('summary'));
await wait(1500);
await moveTo(report.locator('.check').nth(1)); await wait(3500);

// ── s08 client settles with the agent ──
mark('s08_settle');
await click(page.getByRole('button', { name: /Viewing as freelancer/ }));
await page.waitForLoadState('networkidle'); await wait(1200);
await click(page.getByRole('button', { name: /Settle with agent/ }));
const approve = page.getByRole('button', { name: 'Approve' });
try {
  await approve.waitFor({ timeout: 180_000 });
  await wait(1500);
  await click(approve);
  await page.waitForURL(u => !String(u).includes('#'), { timeout: 5_000 }).catch(() => {});
  await page.locator('.note.ok').first().waitFor({ timeout: 180_000 }).catch(() => {});
} catch { console.log('no approval card appeared'); }
await page.waitForLoadState('networkidle'); await wait(1500);
await glide(0); await wait(3000);

// ── s09 record + agents ──
await go('/activity'); mark('s09_record');
await wait(4000);
await go('/agents'); await wait(2000);
await moveTo(page.locator('.track').first()); await wait(4500);

// ── s10 close ──
await go(`/c/${CONTRACT}`); mark('s10_close');
await moveTo(page.locator('.big-money')); await wait(6500);

mark('end');
const video = page.video();
await ctx.close(); await browser.close();
fs.copyFileSync(await video.path(), 'raw.webm');
fs.writeFileSync('marks.json', JSON.stringify(marks, null, 2));
console.log('done');
