// 0.11 release-candidate features: self-test page (Agent, Presenting, off), welcome page,
// settings export/import round trip. Usage: serve the repo root on port 8766, then
// `node tests/e2e/rc.js`.
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright');
const EXT = path.resolve(__dirname, '../../extension');
const ST = 'http://localhost:8766/selftest.html';
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const ctx = await chromium.launchPersistentContext('', { headless: true, executablePath: process.env.CHROMIUM || undefined,
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--headless=new'] });
  const sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker');
  for (let i = 0; i < 40 && !(await sw.evaluate(() => typeof self.HNSSettings === 'object')); i++) await new Promise(r => setTimeout(r, 100));
  const extId = sw.url().split('/')[2];
  const errs = [];
  const score = async (p) => { await p.waitForTimeout(2200); return p.evaluate(() => ({ score: document.getElementById('score').textContent, mode: document.getElementById('mode').textContent,
    status: document.getElementById('status').hidden ? '' : document.getElementById('status').textContent, rows: [...document.querySelectorAll('#results tr')].map(r => r.innerText.replace(/\s+/g, ' ')) })); };

  // Self-test, off
  let p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); await p.goto(ST);
  let s = await score(p);
  ok(s.score === 'Not protected' && /isn't running|protection is off/.test(s.status), 'Self-test with protection off says so: ' + s.status.slice(0, 60));
  // Turn on while the page is open, then it re-checks itself
  await sw.evaluate(async () => { await HNSSettings.setSettings({ mode: 'agent' }); await setAgentMode(true); });
  s = await score(p);
  ok(s.score === '17 of 17 protected' && /Agent Mode/.test(s.mode), `Self-test, Agent Mode: ${s.score} (${s.mode})`);
  ok(s.rows.some(r => /Ordinary field \(name\) still fillable ✅ Yes/.test(r)), 'Self-test: name field still fillable');
  ok(s.rows.some(r => /Phone number.*Visible \(pack off, the default\)/.test(r)), 'Self-test: optional packs shown as visible by default');
  // Presenting
  await sw.evaluate(() => HNSSettings.setSettings({ mode: 'present' }));
  s = await score(p);
  ok(s.score === '15 of 15 protected' && /Presenting/.test(s.mode), `Self-test, Presenting: ${s.score} (${s.mode})`);
  ok(s.rows.some(r => /Hidden instructions.*Agent Mode only/.test(r)) && s.rows.some(r => /Password-reset link.*Agent Mode only/.test(r)), 'Self-test: injection shield and link blocking marked Agent Mode only in Presenting');
  // A pack turned off shows up as such
  await sw.evaluate(async () => { const st = await HNSSettings.getSettings(); st.packs.health = false; await HNSSettings.setSettings({ mode: 'agent', packs: st.packs }); });
  const p2 = await ctx.newPage(); await p2.goto(ST); s = await score(p2);
  ok(s.rows.some(r => /Health insurance member ID ⚠️ Visible \(Health & insurance pack off\?\)/.test(r)), 'Self-test: a pack you turned off is called out');
  await p2.close();

  // Welcome page
  const w = await ctx.newPage(); await w.goto(`chrome-extension://${extId}/welcome/welcome.html`); await w.waitForTimeout(300);
  await sw.evaluate(() => setAgentMode(false));
  await w.click('.mode[data-mode=present]'); await w.waitForTimeout(200);
  ok((await sw.evaluate(async () => (await HNSSettings.getSettings()).mode)) === 'present', 'Welcome: picking Screen sharing sets the mode');
  const newTab = ctx.waitForEvent('page'); await w.click('#runTest'); const t = await newTab; await w.waitForTimeout(300);
  // The test browser can't reach GitHub Pages, so check the tab Chrome was asked to open.
  ok(await sw.evaluate(async () => (await chrome.tabs.query({})).some(x => /williamchen-pm\.github\.io\/hide-and-sneak\/selftest\.html/.test(x.pendingUrl || x.url || ''))), 'Welcome: Run the self-test opens the self-test page');
  ok(await sw.evaluate(async () => (await HNSSettings.getSettings()).agentMode), 'Welcome: Run the self-test turns protection on');
  await t.close();

  // Export / import
  const o = await ctx.newPage(); await o.goto(`chrome-extension://${extId}/options/options.html`); await o.waitForTimeout(300);
  await sw.evaluate(() => HNSSettings.setSettings({ keywords: ['Project Falcon', 'Bluefinch'], pageRules: ['https://bank.example/statements*'], siteOff: ['news.example'], autoOffMinutes: 60 }));
  const dl = o.waitForEvent('download'); await o.click('#exportSettings'); const file = await (await dl).path();
  const exported = JSON.parse(fs.readFileSync(file, 'utf8'));
  ok(exported.app === 'hide-and-sneak' && exported.settings.keywords.length === 2 && !('agentMode' in exported.settings) && !('log' in exported), 'Export: words/pages/prefs included; on/off state and log excluded');
  await sw.evaluate(() => HNSSettings.setSettings({ keywords: [], pageRules: [], siteOff: [], autoOffMinutes: 0 }));
  const msg = await o.evaluate((txt) => globalThis.__importSettings(txt), JSON.stringify(exported));
  const after = await sw.evaluate(() => HNSSettings.getSettings());
  ok(after.keywords.join('|') === 'Project Falcon|Bluefinch' && after.pageRules.length === 1 && after.autoOffMinutes === 60, 'Import restores them: ' + msg);
  const bad = await o.evaluate(async () => { try { await globalThis.__importSettings('{"app":"other"}'); return 'accepted'; } catch (e) { return e.message; } });
  ok(/isn't a Hide & Sneak settings file/.test(bad), 'Import rejects an unrelated file');
  const evil = await o.evaluate(async () => { await globalThis.__importSettings(JSON.stringify({ app: 'hide-and-sneak', settings: { keywords: [1, 2], autoOffMinutes: 5, agentMode: true, mode: 'x' } })).catch(e => e.message); });
  const after2 = await sw.evaluate(() => HNSSettings.getSettings());
  ok(after2.keywords.length === 2 && after2.autoOffMinutes === 60 && after2.mode !== 'x', 'Import ignores invalid values and never sets the on/off state');

  ok(errs.length === 0, 'No page errors' + (errs.length ? ': ' + errs.join('; ') : ''));
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
  await ctx.close(); process.exit(fails ? 1 : 0);
})();
