// Audit regression check (docs/AUDIT.md): tab title, link targets, shadow DOM, pre-filled fields, Tier 1 patterns.
// Usage: serve the repo root on port 8766, then `node tests/e2e/audit.js`.
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const p = await b.newPage(); const errs=[]; p.on('pageerror', e=>errs.push(e.message));
  await p.goto('http://localhost:8766/tests/e2e/audit.html'); await p.waitForTimeout(300);
  console.log('title@load:', await p.title()); await p.waitForTimeout(700);
  console.log('title@later:', await p.title());
  for (const id of ['magic','reset','norm','yt']) console.log('href '+id+':', await p.getAttribute('#'+id,'href'));
  for (const id of ['key','pw','forgot','exp']) console.log(id+':', await p.textContent('#'+id));
  console.log('shadow:', await p.evaluate(() => document.getElementById('sc').shadowRoot.getElementById('s1').textContent));
  console.log('profile-ssn:', await p.$eval('#profile-ssn', e => [e.readOnly, JSON.stringify(e.value), e.getAttribute('value')]), '| profile-name:', await p.$eval('#profile-name', e => [e.readOnly, e.value]));
  console.log('errors:', errs.length?errs:'none'); await b.close(); })();
