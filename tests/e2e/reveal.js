// Click-to-reveal account numbers (tests/e2e/bank-reveal.html): every variant must end up hidden.
// Usage: serve the repo root on port 8766, then `node tests/e2e/reveal.js`.
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const p = await b.newPage(); const errs=[]; p.on('pageerror', e=>errs.push(e.message));
  await p.goto('http://localhost:8766/tests/e2e/bank-reveal.html'); await p.waitForTimeout(700);
  for (const i of [1,2,3,4,5,6]) await p.evaluate(i => document.getElementById('b'+i).click(), i);
  await p.waitForTimeout(700);
  const out = await p.evaluate(() => {
    const t = id => { const e = document.getElementById(id); return e ? (e.tagName === 'INPUT' ? 'input.value=' + JSON.stringify(e.value) + (e.readOnly ? ' (locked? ' + !!e.getAttribute('aria-label') + ')' : '') : e.textContent.trim()) : 'missing'; };
    return ['r1','r2','r3','r4','r5','r6'].map(id => id + ': ' + t(id));
  });
  console.log(out.join('\n')); console.log('errors:', errs.length?errs:'none'); await b.close(); })();
