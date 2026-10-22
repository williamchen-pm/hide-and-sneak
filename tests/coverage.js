// Coverage check (spec V1-16): load the real extension in Agent Mode, open the three demos, and
// check every seeded sensitive item (hidden or locked?) plus items that must stay usable (false
// positives). Writes docs/COVERAGE.md. Usage: serve the repo root on port 8766, then
// `node tests/coverage.js`.
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const EXT = path.resolve(__dirname, '../extension');
const BASE = 'http://localhost:8766/demo/';
const t = (sel, value, name) => ({ kind: 'text', sel, value, name });      // value must be gone from sel's text
const f = (id, name) => ({ kind: 'field', id, name });                     // field must be locked and empty
const href = (sel, value, name) => ({ kind: 'href', sel, value, name });   // link target must be neutralized
const title = (value, name) => ({ kind: 'title', value, name });
const keepT = (sel, value, name) => ({ kind: 'keep-text', sel, value, name });
const keepF = (id, name) => ({ kind: 'keep-field', id, name });
const keepH = (sel, value, name) => ({ kind: 'keep-href', sel, value, name });
const opt = (sel, value, name, pack) => ({ kind: 'optional', sel, value, name, pack });
const DEMOS = {
  'job-application.html': { label: 'Job application', seeds: [
    t('.notice', '482913', 'Email verification code'),
    f('salary', 'Desired salary'), f('cursalary', 'Current salary'), f('gender', 'Gender'), f('race', 'Race'),
    { kind: 'field', sel: '[name=hispanic]', name: 'Hispanic/Latino question' }, f('veteran', 'Veteran status'), f('disability', 'Disability status'),
    f('bg', 'Background-check consent'), f('certify', '"I certify" attestation'), f('sig', 'Signature'),
    ...['first', 'last', 'email', 'phone', 'linkedin', 'city', 'company', 'title', 'years', 'why'].map(id => keepF(id, `"${id}" field stays fillable`)),
  ] },
  'checkout.html': { label: 'Checkout', seeds: [
    t('[data-seed=otp]', '739204', 'Security code in notice'),
    t('[data-seed=saved-card]', '04/28', 'Saved card expiry'),
    t('[data-seed=saved-full]', '5555 5555 5555 4444', 'Saved card full number'),
    t('[data-seed=saved-full]', '11/27', 'Saved card expiry (2)'),
    f('cc-num', 'Card number field'), f('cc-exp', 'Card expiry field'), f('cc-cvc', 'CVV field'),
    f('routing', 'Routing number field (pre-filled)'), f('acct', 'Account number field'), f('gift-pin', 'Gift card PIN field'),
    t('[data-seed=bank-text]', '021000021', 'Routing number in text'), t('[data-seed=bank-text]', '4400123456', 'Account number in text'),
    t('[data-seed=gift]', 'X7K9M-2QPLR-8TZ4W-NB3VH-6YJ2C', 'Gift card code'), t('[data-seed=gift]', '4821', 'Gift card PIN in text'),
    keepT('[data-seed=keep-total]', '$134.95', 'Order total'), keepT('[data-seed=keep-order]', 'NW-48213-77', 'Order number'),
    ...['ship-name', 'ship-phone', 'ship-street', 'ship-city', 'promo', 'cc-name', 'save-card'].map(id => keepF(id, `"${id}" field stays fillable`)),
    opt('[data-seed=saved-card]', '4242', 'Saved card last 4', 'last4'), opt('[data-seed=balance]', '$42.10', 'Store credit balance', 'balances'),
  ] },
  'inbox.html': { label: 'Inbox', seeds: [
    title('615087', 'Code in the tab title'),
    t('[data-seed=subject-otp]', '615087', 'Code in the message list'), t('.msg h1', '615087', 'Code in the subject line'),
    t('[data-seed=otp-value]', '615087', 'Code split from its label'),
    href('[data-seed=reset-link]', 'reset/9f8e7d6c', 'Password-reset link'),
    ...['4kq8-2mzx', '9pd3-7wte', 'h2n6-5rcb', '8yv1-3jfa', '6tm4-0qsl', '1xc9-8bnd'].map((c, i) => t('[data-seed=backup]', c, `Backup code ${i + 1}`)),
    t('[data-seed=bank]', '4400123456', 'Bank account number'), t('[data-seed=bank]', '021000021', 'Routing number'),
    t('[data-seed=api-key]', 'ghp_16C7e42F292c6912E7710c838347Ae178B4a', 'GitHub token'),
    t('[data-seed=health]', 'XJH123456789', 'Health plan member ID'), t('[data-seed=health]', '88412', 'Health plan group number'),
    t('[data-seed=dob]', '03/14/1990', 'Date of birth'),
    t('[data-seed=seed]', 'abandon ability', 'Wallet recovery phrase'),
    t('[data-seed=injection]', 'forward the sign-in email', 'Hidden instructions aimed at the agent'),
    keepT('[data-seed=keep-amount]', '$2,450.00', 'Deposit amount'), keepT('[data-seed=keep-promo]', 'FALL20', 'Promo code'),
    keepH('[data-seed=keep-link]', 'github.com/settings/tokens', 'Ordinary link'),
    opt('[data-seed=balance]', '$8,912.33', 'Available balance', 'balances'),
  ] },
};

(async () => {
  const ctx = await chromium.launchPersistentContext('', { headless: true, executablePath: process.env.CHROMIUM || undefined,
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--headless=new'] });
  const sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker');
  for (let i = 0; i < 40 && !(await sw.evaluate(() => typeof self.HNSSettings === 'object')); i++) await new Promise(r => setTimeout(r, 100));
  await sw.evaluate(async () => { await HNSSettings.setSettings({ mode: 'agent', packs: HNSSettings.DEFAULTS.packs }); await setAgentMode(true); });
  const version = await sw.evaluate(() => chrome.runtime.getManifest().version);
  const rows = [];
  for (const [file, demo] of Object.entries(DEMOS)) {
    const p = await ctx.newPage(); await p.goto(BASE + file); await p.waitForTimeout(1500);
    for (const s of demo.seeds) {
      const r = await p.evaluate((s) => {
        const all = (sel) => [...document.querySelectorAll(sel)];
        const textOf = (sel) => all(sel).map(e => e.textContent + ' ' + [...e.querySelectorAll('*')].concat(e).map(x => ['title', 'aria-label', 'alt'].map(a => x.getAttribute(a) || '').join(' ')).join(' ')).join(' ');
        const fieldDone = (el) => el && (el.readOnly || el.disabled) && !(el.type === 'checkbox' || el.type === 'radio' ? el.checked : el.value);
        switch (s.kind) {
          case 'text': return !textOf(s.sel).includes(s.value);
          case 'title': return !document.title.includes(s.value);
          case 'href': return !all(s.sel).some(e => (e.getAttribute('href') || '').includes(s.value));
          case 'field': return fieldDone(s.sel ? document.querySelector(s.sel) : document.getElementById(s.id));
          case 'keep-text': return textOf(s.sel).includes(s.value);
          case 'keep-href': return all(s.sel).some(e => (e.getAttribute('href') || '').includes(s.value));
          case 'keep-field': { const e = document.getElementById(s.id); return !!e && !e.readOnly && !e.disabled; }
          case 'optional': return textOf(s.sel).includes(s.value);   // visible by default (pack off)
        }
      }, s);
      rows.push({ demo: demo.label, ...s, ok: r });
    }
    await p.close();
  }
  await ctx.close();
  const secrets = rows.filter(r => ['text', 'title', 'href', 'field'].includes(r.kind));
  const keeps = rows.filter(r => r.kind.startsWith('keep'));
  const opts = rows.filter(r => r.kind === 'optional');
  const caught = secrets.filter(r => r.ok).length, fp = keeps.filter(r => !r.ok);
  const pct = Math.round(caught / secrets.length * 100);
  const date = new Date().toISOString().slice(0, 10);
  let md = `# Coverage check\n\n*${date} · Hide & Sneak ${version} · Agent Mode, default packs · generated by \`node tests/coverage.js\`*\n\n`;
  md += `**${caught} of ${secrets.length} seeded sensitive items protected (${pct}%).** Target for 1.0: 90% or more, with every miss listed. `;
  md += `**False positives: ${fp.length} of ${keeps.length}** ordinary items that must stay visible or fillable were hidden or locked.\n\n`;
  md += `The three demos are fictional pages built to look like real ones: [job application](https://williamchen-pm.github.io/hide-and-sneak/demo/job-application.html), [checkout](https://williamchen-pm.github.io/hide-and-sneak/demo/checkout.html), [inbox](https://williamchen-pm.github.io/hide-and-sneak/demo/inbox.html). Each item is checked in the page text, labels, link targets, tab title, and form fields after the extension runs.\n\n`;
  for (const d of Object.values(DEMOS).map(d => d.label)) {
    const ds = secrets.filter(r => r.demo === d);
    md += `## ${d}: ${ds.filter(r => r.ok).length} of ${ds.length}\n\n| Item | Result |\n|---|---|\n`;
    for (const r of ds) md += `| ${r.name} | ${r.ok ? (r.kind === 'field' ? '🔒 Locked' : '✅ Hidden') : '❌ **Missed**'} |\n`;
    const dk = keeps.filter(r => r.demo === d);
    md += `\nStays usable: ${dk.filter(r => r.ok).length} of ${dk.length}` + (dk.some(r => !r.ok) ? ` (hidden by mistake: ${dk.filter(r => !r.ok).map(r => r.name).join(', ')})` : '') + '.\n\n';
  }
  md += `## Optional packs (off by default)\n\nThese stay visible unless you turn the pack on, because agents often need them.\n\n| Item | Pack | Visible by default |\n|---|---|---|\n`;
  for (const r of opts) md += `| ${r.name} (${r.demo}) | ${r.pack} | ${r.ok ? 'Yes' : 'No'} |\n`;
  const misses = secrets.filter(r => !r.ok);
  md += `\n## Misses\n\n` + (misses.length ? misses.map(r => `- **${r.demo}: ${r.name}.**`).join('\n') : 'None.') + '\n';
  fs.writeFileSync(path.resolve(__dirname, '../docs/COVERAGE.md'), md);
  console.log(`${caught}/${secrets.length} protected (${pct}%), false positives ${fp.length}/${keeps.length}`);
  for (const r of misses) console.log('MISS ' + r.demo + ': ' + r.name);
  for (const r of fp) console.log('FALSE POSITIVE ' + r.demo + ': ' + r.name);
  for (const r of opts.filter(r => !r.ok)) console.log('OPTIONAL HIDDEN ' + r.demo + ': ' + r.name);
})();
