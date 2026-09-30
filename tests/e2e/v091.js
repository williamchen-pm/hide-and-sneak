// v0.9.1 features, with the real extension loaded: re-enabling protects open tabs again,
// right-click "Hide this", the "Your turn" list and outlines, the popup, the shortcut, auto-off.
// Usage: serve the repo root on port 8766, then `node tests/e2e/v091.js`.
const path = require('path');
const { chromium } = require('playwright');
const EXT = path.resolve(__dirname, '../../extension');
const URL_ = 'http://localhost:8766/tests/e2e/turn.html';
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) fails++; };

(async () => {
  const ctx = await chromium.launchPersistentContext('', { headless: true, executablePath: process.env.CHROMIUM || undefined,
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--headless=new'] });
  const sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker');
  const extId = sw.url().split('/')[2];
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto(URL_);
  const mode = (on) => sw.evaluate((on) => setAgentMode(on), on);
  const state = () => page.evaluate(() => ({
    text: document.body.innerText, ssnLocked: document.getElementById('ssn').readOnly,
    radioLocked: document.querySelector('[name=veteran]').disabled,
    outlined: [...document.querySelectorAll('[data-hns-todo]')].map(e => e.id || e.tagName),
  }));
  const turn = () => sw.evaluate(async (url) => {
    const [t] = await chrome.tabs.query({ url });
    const r = await chrome.scripting.executeScript({ target: { tabId: t.id }, func: () => globalThis.__hnsTurn && globalThis.__hnsTurn() });
    return r[0].result;
  }, URL_);

  // 1. On, off, on again in the same tab (no reload).
  await mode(true); await page.waitForTimeout(700);
  let s = await state();
  ok(s.ssnLocked && s.text.includes('[2FA CODE]'), 'Agent Mode on: SSN locked, code hidden');
  const t1 = await turn();
  ok(t1.mode === 'locked' && t1.items.map(i => i.label).join('|') === 'Desired base salary|Social Security number|Are you a protected veteran?',
     'Your turn (on): lists the questions by their real labels: ' + t1.items.map(i => i.label).join(' | '));
  await mode(false); await page.waitForTimeout(700);
  s = await state();
  ok(!s.ssnLocked && !s.radioLocked, 'Agent Mode off: fields unlocked');
  ok(s.outlined.join(',') === 'salary,ssn,rel', 'Off: fields left for the user are outlined: ' + s.outlined.join(','));
  const banner = await page.evaluate(() => (document.querySelector('[data-hns=banner]') || {}).textContent || '');
  ok(/3 fields are waiting for you/.test(banner), 'Off banner counts the waiting fields: "' + banner + '"');

  // 2. Filling a field checks it off.
  await page.fill('#salary', '150000'); await page.check('[name=veteran][value=n]');
  s = await state(); const t2 = await turn();
  ok(s.outlined.join(',') === 'ssn', 'Filled fields lose their outline; left: ' + s.outlined.join(','));
  ok(t2.mode === 'todo' && t2.items.filter(i => !i.done).length === 1, 'Your turn (off): 1 field still to fill');

  // 3. Popup renders the list (make the test page the active tab, then re-render the popup).
  const pop = await ctx.newPage(); await pop.goto(`chrome-extension://${extId}/popup/popup.html`);
  await page.bringToFront(); await pop.evaluate(() => render()); await pop.waitForTimeout(400);
  const popTxt = await pop.evaluate(() => ({ turn: document.getElementById('turn').hidden ? '' : document.getElementById('turn').innerText, sc: document.getElementById('shortcut').innerText }));
  ok(/Your turn: 1 field to fill/.test(popTxt.turn) && /Social Security number/.test(popTxt.turn), 'Popup shows "Your turn" list');
  ok(/Alt.*Shift.*H/.test(popTxt.sc), 'Popup shows the shortcut: ' + popTxt.sc.replace(/\s+/g, ' '));
  await pop.close();

  // 4. On again, same tab, no reload: protection comes back (this was broken in 0.9.0).
  await page.fill('#ssn', '123-45-6789');
  await mode(true); await page.waitForTimeout(700);
  s = await state();
  ok(s.ssnLocked && s.outlined.length === 0, 'On again without reload: SSN locked again, outlines cleared');
  ok(await page.inputValue('#ssn') === '', 'On again: the SSN typed while off is cleared from the field');

  // 5. Right-click "Hide this" while on: hidden right away, no value echoed in the toast.
  const tabId = await sw.evaluate(async (url) => (await chrome.tabs.query({ url }))[0].id, URL_);
  await sw.evaluate(({ tabId }) => onMenuClick({ menuItemId: 'hns-hide', selectionText: '  Bluefinch\n Seven ', frameId: 0 }, { id: tabId }), { tabId });
  await sw.evaluate(({ tabId }) => onMenuClick({ menuItemId: 'hns-hide', selectionText: '$4,213.55', frameId: 0 }, { id: tabId }), { tabId });
  await page.waitForTimeout(600);
  s = await state();
  ok(!s.text.includes('Bluefinch') && !s.text.includes('4,213.55') && (s.text.match(/\[PROTECTED\]/g) || []).length === 2, 'Right-click Hide this: both selections hidden immediately');
  const toast = await page.evaluate(() => (document.getElementById('hns-toast') || {}).textContent || '');
  ok(/Hidden/.test(toast) && !/Bluefinch|4,213/.test(toast), 'Toast confirms without repeating the text: "' + toast + '"');
  const kw = await sw.evaluate(async () => (await HNSSettings.getSettings()).keywords);
  ok(JSON.stringify(kw) === JSON.stringify(['Bluefinch Seven', '$4,213.55']), 'Saved to protected words: ' + JSON.stringify(kw));
  await sw.evaluate(({ tabId }) => onMenuClick({ menuItemId: 'hns-hide', selectionText: 'bluefinch seven', frameId: 0 }, { id: tabId }), { tabId });
  ok((await sw.evaluate(async () => (await HNSSettings.getSettings()).keywords)).length === 2, 'Same phrase again: no duplicate');
  const log = await sw.evaluate(async () => JSON.stringify((await chrome.storage.local.get('log')).log));
  ok(!/Bluefinch|4,213|123-45/.test(log), 'Activity log never contains the selected text or typed values');

  // 6. Report menu opens a GitHub issue with only version + domain.
  const newTab = ctx.waitForEvent('page');
  await sw.evaluate(() => onMenuClick({ menuItemId: 'hns-report', pageUrl: 'https://bank.example.com/acct?id=998877&token=abc' }, { id: 1 }));
  const rep = await newTab; const repUrl = decodeURIComponent(rep.url()); // logged out, GitHub wraps it in a sign-in redirect
  ok(/template=1-leak\.yml/.test(repUrl) && /site=bank\.example\.com/.test(repUrl) && !/998877|token/.test(repUrl), 'Report link has domain only: ' + repUrl.slice(repUrl.indexOf('template=')));
  await rep.close();

  // 7. Shortcut is registered; auto-off is off by default and schedules when chosen.
  const cmds = await sw.evaluate(() => chrome.commands.getAll());
  ok(cmds.some(c => c.name === 'toggle-agent-mode'), 'Keyboard command registered');
  ok(!(await sw.evaluate(() => chrome.alarms.get('hns-auto-off'))), 'Auto-off: no timer by default');
  await sw.evaluate(() => HNSSettings.setSettings({ autoOffMinutes: 60 })); await page.waitForTimeout(300);
  const al = await sw.evaluate(() => chrome.alarms.get('hns-auto-off'));
  ok(al && Math.abs(al.scheduledTime - Date.now() - 3600e3) < 10e3, 'Auto-off: choosing 1 hour while on schedules the timer');
  await sw.evaluate(() => onAlarm({ name: 'hns-auto-off' })); await page.waitForTimeout(600);
  ok(!(await sw.evaluate(async () => (await HNSSettings.getSettings()).agentMode)) && !(await state()).ssnLocked, 'Auto-off fires: Agent Mode off, fields unlocked');
  ok(/auto-off/.test(await sw.evaluate(async () => JSON.stringify((await chrome.storage.local.get('log')).log))), 'Auto-off is recorded in the activity log');

  ok(errs.length === 0, 'No page errors' + (errs.length ? ': ' + errs.join('; ') : ''));
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
  await ctx.close(); process.exit(fails ? 1 : 0);
})();
