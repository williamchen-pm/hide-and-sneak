// Bank-page layouts check (tests/e2e/bank.html), default packs and with ?last4=1.
// Usage: serve the repo root on port 8766, then `node tests/e2e/bank.js`.
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const errs=[];
  for (const q of ['', '?last4=1']) { const p = await b.newPage(); p.on('pageerror', e=>errs.push(e.message));
    await p.goto('http://localhost:8766/tests/e2e/bank.html' + q); await p.waitForTimeout(800);
    const ids = ['hdr','bal','acctA','rtA1','rtA2','opened','acctB','rtB','pts','acctC','rtC','since','acctD','phone'];
    const out = await p.evaluate(ids => ids.map(i => i + '=' + document.getElementById(i).textContent.trim()), ids);
    console.log((q || 'default') + ':\n  ' + out.join('\n  ')); await p.close(); }
  console.log('errors:', errs.length?errs:'none'); await b.close(); })();
