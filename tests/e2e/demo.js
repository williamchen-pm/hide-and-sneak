// Demo + ATS fixture check (no extension needed: pages load the engine through demo/demo-shim.js).
// Usage: serve the repo root on port 8766 (e.g. `npx http-server -p 8766` or spike/serve.ps1 with the port changed), then `node tests/e2e/demo.js`.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const errors = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage(); p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
  await p.goto('http://localhost:8766/demo/job-application.html'); await p.waitForTimeout(700);
  console.log('notice:', await p.textContent('.notice'));
  const ids = ['first','last','email','phone','linkedin','city','company','title','years','why','salary','cursalary','gender','race','veteran','disability','bg','certify','sig'];
  const st = await p.evaluate((ids) => ids.map(i => { const e = document.getElementById(i); return i + (e.readOnly||e.disabled ? ' LOCKED' : ' open'); }), ids);
  console.log(st.join(' | '));
  console.log('radios:', await p.evaluate(() => Array.from(document.querySelectorAll('input[type=radio]')).map(r => r.name+':'+r.value+(r.disabled?' LOCKED':' open')).join(' | ')));
  console.log('markers:', await p.$$eval('[data-hns=lock]', m => m.length), '| feed items:', await p.$$eval('#feed li', l => l.length));
  // Agent-like filling
  for (const [id, v] of [['first','Jordan'],['last','Rivera'],['email','j@example.com'],['phone','(919) 555-0142'],['why','Robots']]) await p.fill('#'+id, v);
  await p.selectOption('#years', '6–10'); await p.check('input[name=relocate][value=yes]');
  const tries = [];
  tries.push(await p.fill('#salary','165000',{timeout:1000}).then(()=> 'filled').catch(()=> 'blocked'));
  tries.push(await p.selectOption('#gender','Man',{timeout:1000}).then(()=> 'selected').catch(()=> 'blocked'));
  tries.push(await p.check('#certify',{timeout:1000}).then(()=> 'checked').catch(()=> 'blocked'));
  tries.push(await p.check('input[name=hispanic][value=no]',{timeout:1000}).then(()=> 'checked').catch(()=> 'blocked'));
  console.log('locked-field attempts (salary, gender, certify, hispanic):', tries.join(', '));
  await p.evaluate(() => { document.getElementById('sig').value = 'Jordan Rivera'; document.getElementById('cursalary').value = '140000'; });
  await p.click('#submit'); await p.waitForTimeout(200);
  console.log('submitted preview:', (await p.textContent('#out')).replace(/\s+/g,' '));
    // Off
  const q = await ctx.newPage(); await q.goto('http://localhost:8766/demo/job-application.html?protect=off'); await q.waitForTimeout(500);
  console.log('\nOFF notice:', await q.textContent('.notice'), '| markers:', await q.$$eval('[data-hns=lock]', m => m.length), '| salary readOnly:', await q.$eval('#salary', e=>e.readOnly));
  // ATS fixtures
  const a = await ctx.newPage(); a.on('pageerror', e => errors.push('ats:'+e.message));
  await a.goto('http://localhost:8766/tests/e2e/ats.html'); await a.waitForTimeout(600);
  const r = await a.evaluate(() => {
    const out = {};
    for (const id of ['first_name','gender','question_1']) { const e = document.getElementById(id); out[id] = e.readOnly ? 'LOCKED' : 'open'; }
    const c = document.getElementById('gender-control').getBoundingClientRect();
    const hit = document.elementFromPoint(c.left + 300, c.top + c.height/2);
    out.genderControlClickHits = hit.getAttribute('data-hns') ? 'lock marker' : hit.className || hit.tagName;
    const c2 = document.getElementById('reloc-control').getBoundingClientRect();
    const hit2 = document.elementFromPoint(c2.left + 300, c2.top + c2.height/2);
    out.relocControlClickHits = hit2.getAttribute('data-hns') ? 'lock marker' : (hit2.className || hit2.tagName);
    out.lever = Array.from(document.querySelectorAll('input[type=radio]')).map(r => r.value + (r.disabled ? ' LOCKED' : ' open')).join(' | ');
    return out;
  });
  console.log('\nATS fixtures:', JSON.stringify(r, null, 1));
    console.log('\nerrors:', errors.length ? errors : 'none');
  await b.close();
})();
