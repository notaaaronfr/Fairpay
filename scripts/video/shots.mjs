import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://localhost:3200';
const OUT = '/Users/charles/fairpay/docs/screens';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();

async function shoot(theme, list) {
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 1 });
  await ctx.addCookies([{ name: 'fp_theme', value: theme, url: BASE }, { name: 'fp_role', value: 'client', url: BASE }]);
  await ctx.addInitScript(() => addEventListener('DOMContentLoaded', () => {
    const s = document.createElement('style');
    s.textContent = 'nextjs-portal{display:none!important}';
    document.head.appendChild(s);
  }));
  const page = await ctx.newPage();
  for (const [name, url, prep] of list) {
    await page.goto(BASE + url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2600);
    if (prep) await prep(page);
    await page.screenshot({ path: `${OUT}/${name}.png` });
    console.log(name);
  }
  await ctx.close();
}

await shoot('dark', [
  ['01-dashboard', '/'],
  ['02-escrow-settled', '/c/ctr_99cb6f6e1d0c'],
  ['03-referee-report', '/c/ctr_99cb6f6e1d0c', async p => {
    await p.locator('details.referee-report').first().locator('summary').click();
    await p.locator('details.referee-report').first().scrollIntoViewIfNeeded();
    await p.evaluate(() => scrollBy(0, 160));
    await p.waitForTimeout(900);
  }],
  ['04-new-escrow', '/new', async p => {
    await p.locator('textarea[name=brief]').fill('Menu design for a food truck, 2 milestones, $250, pay sam@design.example');
    await p.waitForTimeout(400);
  }],
  ['05-builder', '/new', async p => { await p.evaluate(() => scrollTo(0, 560)); await p.waitForTimeout(900); }],
  ['06-activity', '/activity'],
  ['07-agents-mcp', '/agents'],
]);
await shoot('light', [
  ['08-dashboard-light', '/'],
  ['09-escrow-light', '/c/ctr_99cb6f6e1d0c'],
]);
await browser.close();
