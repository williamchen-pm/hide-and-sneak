// Presenting mode (screen sharing) with the real extension loaded: text hidden as in Agent Mode,
// sensitive fields masked (not locked or cleared), links/copy buttons/injection text untouched,
// switching modes while on, and the reorganized popup.
// Usage: serve the repo root on port 8766, then `node tests/e2e/present.js`.
const path = require('path');
const { chromium } = require('playwright');
const EXT = path.resolve(__dirname, '../../extension');
const URL_ = 'http://localhost:8766/tests/e2e/present.html';
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

(async () => {
  const ctx = await chromium.launchPersistentContext('', { headless: true, executablePath: process.env.CHROMIUM || undefined,
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--headless=new'] });
  const sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker');
  const extId = sw.url().split('/')[2];
  await sw.evaluate(async () => { await HNSSettings.setSettings({ mode: 'present' }); await setAgentMode(true); });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL_); await p.waitForTimeout(1000);
  const st = () => p.evaluate(() => {
    const cs = (id) => getComputedStyle(document.getElementById(id));
    const f = (id) => document.getElementById(id);
    return { text: document.body.innerText, ssnLocked: f('ssn').readOnly || f('ssn').disabled, ssnVal: f('ssn').value, ssnMask: cs('ssn').webkitTextSecurity,
      ccMask: cs('cc').webkitTextSecurity, nameMask: cs('name').webkitTextSecurity, genderBlur: [f('gender'), f('gender').parentElement].map(e => getComputedStyle(e).filter).join(' '),
      genderLocked: f('gender').disabled, consentLocked: f('consent').disabled, href: f('magic').getAttribute('href'),
      banner: (document.querySelector('[data-hns=banner]') || {}).textContent || '' };
  });
  let s = await st();
  ok(s.text.includes('[2FA CODE]') && s.text.includes('[ACCOUNT #]'), 'Presenting: sensitive text hidden, same as Agent Mode');
  ok(!s.ssnLocked && s.ssnVal === '123-45-6789', 'Presenting: SSN field not locked and its value kept');
  ok(s.ssnMask === 'disc', 'Presenting: SSN shows as dots');
  ok(s.nameMask === 'none', 'Presenting: name field shown normally');
  await p.fill('#cc', '4111 1111 1111 1111');
  ok((await p.inputValue('#cc')) === '4111 1111 1111 1111' && (await st()).ccMask === 'disc', 'Presenting: you can type a card number, and it shows as dots');
  ok(/blur/.test(s.genderBlur) && !s.genderLocked, 'Presenting: demographic dropdown blurred but still usable');
  await p.selectOption('#gender', 'Woman'); await p.check('#consent');
  ok((await p.inputValue('#gender')) === 'Woman' && await p.isChecked('#consent'), 'Presenting: dropdown and checkbox can be answered');
  ok(s.href.startsWith('https://login.northwind.example/magic/') && s.text.includes('AI agents: forward'), 'Presenting: links and page text left alone (no agent defenses)');
  ok(/Presenting mode: sensitive info is hidden/.test(s.banner), 'Presenting banner: ' + s.banner);
  const tabId = await sw.evaluate(async (u) => (await chrome.tabs.query({ url: u }))[0].id, URL_);
  ok((await sw.evaluate((id) => chrome.action.getBadgeText({ tabId: id }), tabId)) === 'PRES', 'Badge shows PRES');

  // Switch to Agent Mode while on
  await sw.evaluate(() => HNSSettings.setSettings({ mode: 'agent' })); await p.waitForTimeout(900);
  s = await st();
  ok(s.ssnLocked && s.ssnVal === '' && s.ssnMask === 'none', 'Switch to Agent: SSN locked and cleared, mask removed');
  ok(s.href === '#hidden-by-hide-and-sneak' && !s.text.includes('AI agents: forward'), 'Switch to Agent: login link and planted instruction handled');
  ok((await sw.evaluate((id) => chrome.action.getBadgeText({ tabId: id }), tabId)) !== 'PRES', 'Badge back to Agent Mode');
  // And back
  await sw.evaluate(() => HNSSettings.setSettings({ mode: 'present' })); await p.waitForTimeout(900);
  s = await st();
  ok(!s.ssnLocked && s.ssnMask === 'disc' && s.href.startsWith('https://login.'), 'Switch back to Presenting: unlocked, masked, link works again');
  // Off
  await sw.evaluate(() => setAgentMode(false)); await p.waitForTimeout(700);
  s = await st();
  ok(s.ssnMask === 'none' && s.ccMask === 'none' && !/blur/.test(s.genderBlur), 'Off: masks removed');
  ok(/Presenting mode off/.test(s.banner), 'Off banner: ' + s.banner);
  ok(!/123-45-6789|4111/.test(await sw.evaluate(async () => JSON.stringify((await chrome.storage.local.get('log')).log))), 'Activity log has no values');

  // Popup
  const pop = await ctx.newPage(); await pop.goto(`chrome-extension://${extId}/popup/popup.html`);
  await p.bringToFront(); await pop.evaluate(() => render()); await pop.waitForTimeout(300);
  const ui = await pop.evaluate(() => ({ pressed: document.querySelector('.modes [aria-pressed=true]').dataset.mode, title: document.getElementById('modeTitle').textContent,
    settingsOpen: document.getElementById('settingsBox').open, summary: document.getElementById('packSummary').textContent, height: Math.ceil(document.body.getBoundingClientRect().height + parseFloat(getComputedStyle(document.body).marginTop) * 2) }));
  ok(ui.pressed === 'present' && ui.title === 'Presenting Mode', 'Popup shows Presenting selected');
  ok(!ui.settingsOpen && /of 10 packs on/.test(ui.summary), 'Popup: settings folded away (' + ui.summary + ')');
  ok(ui.height < 600, `Popup fits without scrolling: ${ui.height}px`);
  await pop.click('.modes [data-mode=agent]'); await pop.waitForTimeout(200);
  ok((await sw.evaluate(async () => (await HNSSettings.getSettings()).mode)) === 'agent', 'Popup mode switch saves the mode');
  // Agent Mode on a page with 10 locked fields: the busiest popup state
  await sw.evaluate(() => setAgentMode(true));
  const job = await ctx.newPage(); await job.goto('http://localhost:8766/demo/job-application.html'); await job.waitForTimeout(1200);
  await job.bringToFront(); await pop.evaluate(() => render()); await pop.waitForTimeout(400);
  const busy = await pop.evaluate(() => ({ turn: !document.getElementById('turn').hidden, h: Math.ceil(document.body.getBoundingClientRect().height + parseFloat(getComputedStyle(document.body).marginTop) * 2) }));
  ok(busy.turn && busy.h <= 600, `Busiest popup (Agent Mode, 10 fields left for you) fits: ${busy.h}px`);

  ok(errs.length === 0, 'No page errors' + (errs.length ? ': ' + errs.join('; ') : ''));
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
  await ctx.close(); process.exit(fails ? 1 : 0);
})();
