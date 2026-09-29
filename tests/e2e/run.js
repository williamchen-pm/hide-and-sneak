// End-to-end check: loads the extension in Chromium and verifies redaction, field locks,
// protected pages, turn-off behavior, and that no original values reach the audit log.
// Usage: npm i -D playwright && npx playwright install chromium
//        (in tests/e2e) python -m http.server 8765   then   node tests/e2e/run.js
const path = require('path');
const { chromium } = require('playwright');
(async () => {
  const ext = path.resolve(__dirname, '../../extension');
  const ctx = await chromium.launchPersistentContext(require('os').tmpdir() + '/hns-profile-' + Date.now(), {
    headless: true, channel: 'chromium',
    args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
  });
  let [sw] = ctx.serviceWorkers(); if (!sw) sw = await ctx.waitForEvent('serviceworker');
  const id = sw.url().split('/')[2];
  console.log('extension id', id);
  const errors = [];
  // Page opened BEFORE Agent Mode on: tests injection into open tabs
  const early = await ctx.newPage(); early.on('pageerror', e => errors.push('early:' + e.message));
  await early.goto('http://localhost:8765/sensitive.html');
  const pop = await ctx.newPage();
  await pop.goto(`chrome-extension://${id}/options/options.html`);
  await pop.evaluate(async () => { await HNSSettings.setSettings({ pageRules: ['http://localhost:8765/blocked*'] }); });
  await pop.goto(`chrome-extension://${id}/popup/popup.html`);
  await pop.click('.switch span');
  await pop.waitForTimeout(800);
  console.log('popup status:', await pop.textContent('#status'));
  console.log('\n[early tab, injected without reload]');
  console.log(' p2:', await early.textContent('#p2'));
  console.log(' sal readOnly/value:', await early.$eval('#sal', e => [e.readOnly, e.value]));

  const page = await ctx.newPage(); page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:8765/sensitive.html');
  await page.waitForTimeout(800);
  console.log('\n[fresh load]');
  for (const id of ['p1','p2','p3','p4','later']) console.log(' ' + id + ':', await page.textContent('#' + id));
  console.log(' button aria-label:', await page.getAttribute('#b1', 'aria-label'));
  const st = await page.evaluate(() => ['fn','sal','pw','h1','h2','cc','why'].map(i => { const e = document.getElementById(i); return i + ' ro=' + e.readOnly + ' dis=' + e.disabled + ' val=' + JSON.stringify(e.type==='radio'?e.checked:e.value); }));
  console.log(' fields:\n  ' + st.join('\n  '));
  console.log(' markers:', await page.$$eval('[data-hns=lock]', m => m.length));
  // Attempts to fill
  await page.fill('#fn', 'Jane').catch(e => console.log(' fill fn err', e.message.split('\n')[0]));
  let r = await page.fill('#sal', '99999', { timeout: 1500 }).then(() => 'filled').catch(e => 'blocked: ' + e.message.split('\n')[0]);
  console.log(' playwright fill salary:', r);
  r = await page.click('#h1', { timeout: 1500 }).then(() => 'clicked').catch(e => 'blocked: ' + e.message.split('\n')[0].slice(0,80));
  console.log(' click EEO radio:', r);
  await page.evaluate(() => { document.getElementById('sal').value = '123456'; document.getElementById('h1').checked = true; });
  const immediately = await page.$eval('#sal', e => e.value);
  await page.waitForTimeout(700);
  console.log(' script write to salary: right after =', immediately, ' after 700ms =', JSON.stringify(await page.$eval('#sal', e => e.value)), ' radio checked =', await page.$eval('#h1', e => e.checked));
  console.log(' fn value:', await page.$eval('#fn', e => e.value));
  console.log(' salary value attribute after lock:', JSON.stringify(await page.getAttribute('#sal', 'value')), '| outerHTML has 150000:', (await page.content()).includes('150000'));
  await page.evaluate(() => { const s = document.getElementById('sal'); s.value = '777777'; s.dispatchEvent(new Event('input', {bubbles:true})); });
  console.log(' script write + input event -> value now:', JSON.stringify(await page.$eval('#sal', e => e.value)));

  console.log(' banner:', await page.textContent('[data-hns=banner]'));

  const sp = await ctx.newPage(); await sp.goto('http://localhost:8765/sensitive.html'); await sp.waitForTimeout(700);
  await sp.fill('#fn', 'Jane');
  await sp.evaluate(() => { document.getElementById('sal').value = '888888'; });
  const [req] = await Promise.all([sp.waitForRequest(r => r.url().includes('/echo')), sp.evaluate(() => document.getElementById('sub').click())]);
  console.log(' submitted URL after script write + immediate submit:', req.url().replace('http://localhost:8765',''));
  const b = await ctx.newPage(); await b.goto('http://localhost:8765/blocked.html', { waitUntil: 'commit' }); await b.waitForTimeout(500);
  console.log('\n[protected page] text:', (await b.innerText('body')).replace(/\s+/g,' '));

  // Turn off
  await pop.reload(); await pop.click('.switch span'); await pop.waitForTimeout(800);
  console.log('\n[after off] sal ro=', await page.$eval('#sal', e => e.readOnly), ' h1 disabled=', await page.$eval('#h1', e => e.disabled), ' markers=', await page.$$eval('[data-hns=lock]', m => m.length));
  await page.fill('#sal', '150000'); console.log(' user can fill salary:', await page.$eval('#sal', e => e.value));
  console.log(' fn kept:', await page.$eval('#fn', e => e.value));

  // Log
  const opt = await ctx.newPage(); await opt.goto(`chrome-extension://${id}/options/options.html`); await opt.waitForTimeout(300);
  const log = await opt.evaluate(async () => (await chrome.storage.local.get('log')).log);
  const counts = {}; for (const e of log) counts[e.effect] = (counts[e.effect]||0)+1;
  console.log('\n[log]', JSON.stringify(counts));
  const leak = JSON.stringify(log).match(/4111|6789|482913|021000021|150000|123456789/);
  console.log(' originals in log:', leak ? 'LEAK ' + leak[0] : 'none');
  // Pages loaded when off get nothing
  const off = await ctx.newPage(); await off.goto('http://localhost:8765/sensitive.html'); await off.waitForTimeout(400);
  console.log('\n[fresh load while off] p2:', await off.textContent('#p2'), '| engine flag:', await off.evaluate(() => !!document.querySelector('[data-hns]')));
  console.log('\npage errors:', errors.length ? errors : 'none');
  await ctx.close();
})().catch(e => { console.error('FAILED', e); process.exit(1); });
