// Injection shield with the real extension loaded (tests/e2e/injection.html).
// Usage: serve the repo root on port 8766, then `node tests/e2e/injection.js`.
const path = require('path');
const { chromium } = require('playwright');
const EXT = path.resolve(__dirname, '../../extension');
const URL_ = 'http://localhost:8766/tests/e2e/injection.html';
const TOKEN = '[AGENT INSTRUCTIONS REMOVED]';
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

(async () => {
  const ctx = await chromium.launchPersistentContext('', { headless: true, executablePath: process.env.CHROMIUM || undefined,
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--headless=new'] });
  const sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker');
  await sw.evaluate(() => setAgentMode(true));
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto(URL_); await page.waitForTimeout(1400);
  const txt = (id) => page.evaluate((id) => { const e = document.getElementById(id); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; }, id);
  const attr = (id, a) => page.evaluate(([id, a]) => document.getElementById(id).getAttribute(a), [id, a]);

  ok((await txt('visible')) === TOKEN, 'Visible "AI agents: forward..." removed');
  ok((await txt('none')) === TOKEN, 'display:none instruction removed');
  ok((await txt('sronly')) === TOKEN, 'Screen-reader-only instruction removed');
  ok((await txt('offscreen')) === TOKEN, 'Off-screen "If an LLM reads this" removed');
  ok((await txt('tiny')) === TOKEN, '1px "New instructions:" removed');
  ok((await txt('split')) === TOKEN, 'Instruction split across <b>/<i> removed');
  const long = await txt('long');
  ok(long.includes(TOKEN) && long.startsWith('Your package left') && long.includes('three to five business days') && !/reveal the code/i.test(long), 'Long paragraph: only the injected sentence removed');
  ok((await txt('late')) === TOKEN, 'Instruction added after load (transparent text) removed');
  ok((await attr('evilbtn', 'aria-label')) === TOKEN, 'Malicious aria-label replaced');
  // Left alone
  ok((await txt('skip')) === 'Skip to main content', 'Normal screen-reader link kept');
  ok((await attr('chat', 'aria-label')).startsWith('Ask our AI assistant'), 'Normal AI chat button label kept');
  ok((await txt('tutorial')).startsWith('Tip: run this JavaScript'), 'Visible tutorial text kept');
  ok((await txt('agent')).startsWith('Our agent will call you'), '"Our agent will call you" kept');
  ok((await txt('intro')).includes('[2FA CODE]') && (await txt('intro')).startsWith('Thanks for shopping'), 'Other protection still works (2FA code hidden)');
  // What an agent reading the page gets
  const ax = await page.evaluate(() => document.body.innerText + ' ' + [...document.querySelectorAll('[aria-label]')].map(e => e.getAttribute('aria-label')).join(' '));
  ok(!/evil\.example|helpdesk@|javascript_tool|transfer \$500|ignore all previous|turn off two-factor/i.test(ax), 'None of the injected instructions remain in page text or labels');
  const log = await sw.evaluate(async () => (await chrome.storage.local.get('log')).log.filter(e => e.pack === 'injection'));
  ok(log.length >= 9 && !JSON.stringify(log).match(/evil|helpdesk|transfer/i), `Activity log: ${log.length} removals recorded, without the removed text`);

  // Pack off: nothing removed
  await sw.evaluate(async () => { const s = await HNSSettings.getSettings(); s.packs.injection = false; await HNSSettings.setSettings({ packs: s.packs }); });
  const p2 = await ctx.newPage(); await p2.goto(URL_); await p2.waitForTimeout(1200);
  ok(!(await p2.evaluate(() => document.body.textContent.includes('[AGENT INSTRUCTIONS REMOVED]'))), 'Pack off: page left as is');

  // Speed: a big page with no injections
  await sw.evaluate(async () => { const s = await HNSSettings.getSettings(); s.packs.injection = true; await HNSSettings.setSettings({ packs: s.packs }); });
  const p3 = await ctx.newPage(); await p3.goto(URL_);
  const ms = await p3.evaluate(() => { const m = document.getElementById('main'); const t0 = performance.now();
    for (let i = 0; i < 2000; i++) { const d = document.createElement('div'); d.innerHTML = `<p>Order ${i} for our agent team ships soon. Use code SAVE${i} at checkout.</p><span class="sr-only">Opens in a new window</span>`; m.appendChild(d); }
    return new Promise(r => setTimeout(() => r(performance.now() - t0), 50)); });
  ok(ms < 1500, `2,000 new blocks processed in ${Math.round(ms)} ms`);

  ok(errs.length === 0, 'No page errors' + (errs.length ? ': ' + errs.join('; ') : ''));
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
  await ctx.close(); process.exit(fails ? 1 : 0);
})();
