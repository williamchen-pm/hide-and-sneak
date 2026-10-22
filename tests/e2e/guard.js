// Write guard: script writes to locked fields are ignored instantly (no ~400 ms window), other
// fields are unaffected, and everything works normally once Agent Mode is off.
// Usage: serve the repo root on port 8766, then `node tests/e2e/guard.js`.
const path = require('path');
const { chromium } = require('playwright');
const EXT = path.resolve(__dirname, '../../extension');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const ctx = await chromium.launchPersistentContext('', { headless: true, executablePath: process.env.CHROMIUM || undefined,
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--headless=new'] });
  const sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker');
  for (let i = 0; i < 40 && !(await sw.evaluate(() => typeof self.HNSSettings === 'object')); i++) await new Promise(r => setTimeout(r, 100));
  await sw.evaluate(async () => { await HNSSettings.setSettings({ mode: 'agent' }); await setAgentMode(true); });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8766/tests/e2e/present.html'); await p.waitForTimeout(900);
  // Everything below runs as page script, the way form_input / javascript_tool writes arrive.
  const r = await p.evaluate(() => {
    const $ = (id) => document.getElementById(id);
    const out = {};
    $('ssn').value = '123-45-6789'; out.ssnSameTick = $('ssn').value;
    $('cc').setAttribute('value', '4111111111111111'); out.ccAttr = $('cc').getAttribute('value') || '';
    $('cc').setRangeText('4111'); out.ccRange = $('cc').value;
    $('gender').value = 'Woman'; out.genderSameTick = $('gender').value;
    $('gender').selectedIndex = 2; out.genderIdx = $('gender').selectedIndex;
    $('gender').options[1].selected = true; out.genderOpt = $('gender').value;
    $('consent').checked = true; out.consentSameTick = $('consent').checked;
    const nativeSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    nativeSet.call($('ssn'), '999-99-9999'); out.ssnNativeSetter = $('ssn').value;
    $('name').value = 'Alex Kim'; out.nameWorks = $('name').value;
    return out;
  });
  ok(r.ssnSameTick === '', 'Script write to locked SSN field reads back empty immediately');
  ok(r.ssnNativeSetter === '', 'Same via the "native" value setter (how form_input-style tools write)');
  ok(r.ccAttr === '' && r.ccRange === '', 'setAttribute("value") and setRangeText blocked on locked card field');
  ok(r.genderSameTick === '' && r.genderIdx === 0 && r.genderOpt === '', 'Locked dropdown: value, selectedIndex, and option.selected writes blocked');
  ok(r.consentSameTick === false, 'Locked checkbox: checked = true blocked');
  ok(r.nameWorks === 'Alex Kim', 'Unlocked field (name) still writable by scripts');
  await p.waitForTimeout(700);   // activity log entries are batched every 400 ms
  const log = await sw.evaluate(async () => (await chrome.storage.local.get('log')).log.filter(e => e.effect === 'lock-write-blocked').length);
  ok(log >= 4, `Blocked writes are recorded in the activity log (${log})`);
  // Off: guard steps aside
  await sw.evaluate(() => setAgentMode(false)); await p.waitForTimeout(600);
  const r2 = await p.evaluate(() => { const $ = (id) => document.getElementById(id); $('ssn').value = '123-45-6789'; $('consent').checked = true; $('gender').value = 'Man';
    return { ssn: $('ssn').value, consent: $('consent').checked, gender: $('gender').value, attr: $('ssn').hasAttribute('data-hns-locked') }; });
  ok(r2.ssn === '123-45-6789' && r2.consent && r2.gender === 'Man' && !r2.attr, 'Agent Mode off: all fields writable again');
  // Turned on for an already-open tab: guard is injected too
  const p2 = await ctx.newPage(); await p2.goto('http://localhost:8766/tests/e2e/present.html'); await p2.waitForTimeout(400);
  await sw.evaluate(() => setAgentMode(true)); await p2.waitForTimeout(900);
  ok(await p2.evaluate(() => { const e = document.getElementById('ssn'); e.value = '123-45-6789'; return e.value === ''; }), 'Turning on for an already-open tab also guards it');
  ok(await p2.evaluate(() => typeof window.__hnsGuard) === 'boolean', 'Guard present once (no double hooking)');
  ok(errs.length === 0, 'No page errors' + (errs.length ? ': ' + errs.join('; ') : ''));
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
  await ctx.close(); process.exit(fails ? 1 : 0);
})();
