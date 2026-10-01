// v0.9.3 with the real extension loaded: new detection (seed phrases incl. one-word-per-box grids,
// health/tax/intl IDs, field locks), unlock-for-sign-in, PDF blocking, undo for right-click hide.
// Usage: serve the repo root on port 8766, then `node tests/e2e/v093.js`.
const path = require('path');
const { chromium } = require('playwright');
const EXT = path.resolve(__dirname, '../../extension');
const BASE = 'http://localhost:8766/tests/e2e/';
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

(async () => {
  const ctx = await chromium.launchPersistentContext('', { headless: true, executablePath: process.env.CHROMIUM || undefined,
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--headless=new'] });
  const sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker');
  const extId = sw.url().split('/')[2];
  await sw.evaluate(() => setAgentMode(true));
  const errs = [];
  const open = async (file) => { const p = await ctx.newPage(); p.on('pageerror', e => errs.push(file + ': ' + e.message)); await p.goto(BASE + file); await p.waitForTimeout(900); return p; };
  const txt = (p, id) => p.evaluate((id) => document.getElementById(id).textContent.replace(/\s+/g, ' ').trim(), id);
  const locked = (p, id) => p.evaluate((id) => { const e = document.getElementById(id); return e.readOnly || e.disabled; }, id);
  const tabIdOf = (url) => sw.evaluate(async (url) => (await chrome.tabs.query({ url }))[0].id, url);
  // The popup, opened as a page (it's an extension page, so it may unlock and undo).
  const pop = await ctx.newPage(); await pop.goto(`chrome-extension://${extId}/popup/popup.html`);
  const popSend = (msg) => pop.evaluate((m) => chrome.runtime.sendMessage(m), msg);

  // ---- 1. Detection ----
  const seed = await open('seed.html');
  const grid = await txt(seed, 'grid');
  ok((grid.match(/\[SEED\]/g) || []).length === 12 && !/sausage|winner|useful/.test(grid), 'Seed phrase grid (12 boxes, one word each) hidden: ' + grid.slice(0, 40) + '…');
  ok((await txt(seed, 'menu')) === 'ArtMusicSportTravelGardenKitchenOfficeToyPetBookMovieGame', '12-item category menu left alone');
  ok((await txt(seed, 'inline')) === 'Backup: [RECOVERY PHRASE]', 'Inline seed phrase hidden');
  ok((await txt(seed, 'health')) === 'Medicare number: [HEALTH ID] · Member ID: [HEALTH ID] · Group #: 12', 'Health IDs hidden, short group number kept');
  ok((await txt(seed, 'ids')) === 'EIN: [TAX ID] · VIN [VIN] · Product key: [LICENSE KEY]', 'EIN, VIN, license key hidden');
  ok((await txt(seed, 'money')) === 'Available balance: $12,345.67', 'Balance visible by default (Balances pack is off)');
  ok(await locked(seed, 'sq') && await locked(seed, 'pin') && await locked(seed, 'mem') && await locked(seed, 'srp'), 'Security answer, PIN, member ID, and recovery phrase fields locked');
  ok(!(await locked(seed, 'nick')), 'Nickname field open');
  await sw.evaluate(async () => { const s = await HNSSettings.getSettings(); s.packs.balances = true; await HNSSettings.setSettings({ packs: s.packs }); });
  const seed2 = await open('seed.html');
  ok((await txt(seed2, 'money')) === 'Available balance: [BALANCE]', 'Balance hidden when the Balances pack is turned on');
  await seed2.close(); await seed.close();

  // ---- 2. Unlock this page for sign-in ----
  const si = await open('signin.html');
  const siId = await tabIdOf(BASE + 'signin.html');
  ok(await locked(si, 'pw') && await locked(si, 'otp') && (await si.getAttribute('#magic', 'href')) === '#hidden-by-hide-and-sneak', 'Sign-in page locked: password, code field, magic link');
  ok(await si.evaluate(() => typeof globalThis.__hnsPause === 'undefined'), "The page can't see or call the unlock function");
  const denied = await si.evaluate(() => { try { return typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage ? 'has-api' : 'no-api'; } catch (e) { return 'no-api'; } });
  ok(denied === 'no-api', "The page has no way to message the extension");
  const r = await popSend({ type: 'pause', tabId: siId, minutes: 2 }); await si.waitForTimeout(400);
  ok(r.ok && r.until > Date.now() + 100e3, 'Popup unlock accepted (2 minutes)');
  ok(!(await locked(si, 'pw')) && !(await locked(si, 'otp')), 'Unlocked: password and code fields usable');
  ok((await si.getAttribute('#magic', 'href')).startsWith('https://login.northwind.example/magic/'), 'Unlocked: magic link works again');
  ok(/unlocked for sign-in until/.test(await si.evaluate(() => (document.querySelector('[data-hns=banner]') || {}).textContent || '')), 'Banner says the page is unlocked');
  ok((await sw.evaluate((id) => chrome.action.getBadgeText({ tabId: id }), siId)) === 'OPEN', 'Badge shows OPEN for this tab');
  await si.click('#next'); await si.waitForTimeout(900);
  ok(!(await locked(si, 'otp2')), 'Sign-in step 2 in the same tab stays unlocked');
  const other = await open('signin2.html');
  ok(await locked(other, 'otp2'), 'Other tabs stay locked');
  await other.close();
  await popSend({ type: 'pause', tabId: siId, minutes: 0 }); await si.waitForTimeout(500);
  ok(await locked(si, 'otp2'), 'Lock now: locked again');
  await popSend({ type: 'pause', tabId: siId, minutes: 0.02 }); await si.waitForTimeout(300);
  ok(!(await locked(si, 'otp2')), 'Short unlock: open…');
  await si.waitForTimeout(1600);
  ok(await locked(si, 'otp2'), '…and locks itself again when time is up');
  await si.close();

  // ---- 3. PDFs ----
  const pdf = await ctx.newPage(); await pdf.goto(BASE + 'statement.pdf').catch(() => {}); await pdf.waitForTimeout(1500);
  const pdfTxt = await pdf.evaluate(() => document.body ? document.body.innerText : '').catch(() => '');
  ok(/This PDF is hidden from your AI agent/.test(pdfTxt) && !/4400123456/.test(pdfTxt), 'PDF blocked while Agent Mode is on');
  const pdfId = await tabIdOf(BASE + 'statement.pdf').catch(() => null);
  ok(pdfId && (await sw.evaluate((id) => chrome.action.getBadgeText({ tabId: id }), pdfId)) === 'PDF', 'Badge shows PDF');
  await sw.evaluate(() => HNSSettings.setSettings({ blockPdfs: false }));
  await pdf.reload().catch(() => {}); await pdf.waitForTimeout(1500);
  const warn = await pdf.evaluate(() => (document.querySelector('[data-hns=banner]') || {}).textContent || '').catch(() => '');
  ok(/can't protect PDFs/.test(warn), 'Block PDFs off: warning banner instead');
  await sw.evaluate(() => HNSSettings.setSettings({ blockPdfs: true }));
  await pdf.close();

  // ---- 4. Undo right-click hide (from the popup) ----
  const s1 = await open('seed.html'); const s1Id = await tabIdOf(BASE + 'seed.html');
  await sw.evaluate((id) => onMenuClick({ menuItemId: 'hns-hide', selectionText: 'Write these words down', frameId: 0 }, { id }), s1Id);
  ok((await sw.evaluate(async () => (await HNSSettings.getSettings()).keywords)).includes('Write these words down'), 'Right-click Hide this: saved');
  const toast = await s1.evaluate(() => (document.getElementById('hns-toast') || {}).textContent || '');
  ok(/Click the Hide & Sneak icon to undo/.test(toast) && !/Write these/.test(toast), 'Toast points to undo, without repeating the text');
  await s1.bringToFront(); await pop.evaluate(() => render()); await pop.waitForTimeout(300);
  const undoTxt = await pop.evaluate(() => document.getElementById('undoRow').hidden ? '' : document.getElementById('undoText').textContent);
  ok(/^Hidden with right-click: “Wr•+”\.$/.test(undoTxt), 'Popup offers undo, with the text masked: ' + undoTxt);
  await pop.evaluate(() => document.getElementById('undoBtn').click()); await pop.waitForTimeout(300);
  ok(!(await sw.evaluate(async () => (await HNSSettings.getSettings()).keywords)).includes('Write these words down'), 'Undo removes it');
  const s1Tab = await sw.evaluate(async (url) => (await chrome.tabs.query({ url }))[0].id, BASE + 'seed.html');
  const forged = await s1.evaluate(() => new Promise(res => { try { chrome.runtime.sendMessage({ type: 'undoHide' }, () => res('sent')); } catch (e) { res('blocked'); } }));
  ok(forged === 'blocked', 'A web page cannot trigger undo');
  const packs = await pop.evaluate(() => document.getElementById('packs').innerText);
  ok(/Health & insurance IDs/.test(packs) && /Account balances/.test(packs) && /Crypto wallet addresses/.test(packs), 'Popup lists the new packs');

  // ---- 5. No originals in the activity log ----
  const log = await sw.evaluate(async () => JSON.stringify((await chrome.storage.local.get('log')).log));
  ok(!/sausage|1EG4|XJH123|12-3456789|4400123456|Write these|aB3dE5fG/.test(log), 'Activity log never holds the values');
  ok(errs.length === 0, 'No page errors' + (errs.length ? ': ' + errs.join('; ') : ''));
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
  await ctx.close(); process.exit(fails ? 1 : 0);
})();
