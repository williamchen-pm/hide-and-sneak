// Marker alignment and wording in a fixed pop-up (tests/e2e/modal.html).
// Usage: serve the repo root on port 8766, then `node tests/e2e/modal.js`.
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 900, height: 700 } }); const errs=[]; p.on('pageerror', e=>errs.push(e.message));
  await p.goto('http://localhost:8766/tests/e2e/modal.html'); await p.waitForTimeout(800);
  const check = async (label) => {
    const r = await p.evaluate(() => {
      const ms = [...document.querySelectorAll('[data-hns=lock]')];
      return ['expm','expy','cc','cvv','name'].map(id => {
        const el = document.getElementById(id), er = el.getBoundingClientRect();
        const m = ms.find(m => { const mr = m.getBoundingClientRect(); return Math.abs(mr.left - er.left) < 3 && Math.abs(mr.top - er.top) < 3; });
        const hitsMarker = document.elementFromPoint(er.left + er.width/2, er.top + er.height/2);
        return id + ': ' + (el.disabled || el.readOnly ? 'locked' : 'open') + (m ? ' | marker aligned, text="' + m.textContent + '"' : ' | no aligned marker') + ' | center click hits ' + (hitsMarker && hitsMarker.getAttribute('data-hns') ? 'marker' : (hitsMarker ? hitsMarker.tagName : 'nothing'));
      });
    });
    console.log(label + ':\n  ' + r.join('\n  '));
  };
  await check('initial');
  await p.mouse.wheel(0, 900); await p.waitForTimeout(500); await check('after scrolling the page behind the pop-up');
  await p.evaluate(() => { document.getElementById('body').scrollTop = 400; }); await p.waitForTimeout(500);
  console.log('after scrolling inside the pop-up, visible marker count:', await p.$$eval('[data-hns=lock]', ms => ms.filter(m => m.style.display !== 'none').length), '| cvv marker:', await p.evaluate(() => { const el=document.getElementById('cvv').getBoundingClientRect(); const m=[...document.querySelectorAll('[data-hns=lock]')].find(m=>{const r=m.getBoundingClientRect(); return Math.abs(r.left-el.left)<3 && m.style.display!=='none'}); return m ? 'aligned: ' + m.textContent : 'none'; }));
  console.log('errors:', errs.length?errs:'none'); await b.close(); })();
