const $ = (id) => document.getElementById(id);
const lines = (t) => t.split('\n').map(s => s.trim()).filter(Boolean);
const EFFECT = {
  'redact': 'Text hidden', 'field-locked': 'Field protected', 'field-cleared': 'Field cleared on lock',
  'lock-bypass-cleared': 'Blocked a write to a locked field', 'lock-write-blocked': 'Blocked a script write to a locked field', 'page-blocked': 'Page blocked', 'miss': 'Rule missed its target',
  'session-start': 'Agent Mode on', 'session-end': 'Agent Mode off',
  'auto-off': 'Agent Mode turned off automatically', 'word-added': 'Protected word added (right-click)',
  'word-removed': 'Protected word removed (undo)', 'page-unlocked': 'Page unlocked for sign-in', 'page-relocked': 'Page locked again', 'pdf-blocked': 'PDF blocked', 'pdf-seen': 'PDF opened (not protected)',
};
let sortKey = 'ts', sortDir = -1;

async function load() {
  const s = await HNSSettings.getSettings();
  $('pageRules').value = s.pageRules.join('\n');
  $('keywords').value = s.keywords.join('\n');
  renderLog();
}
function flash(id) { $(id).textContent = 'Saved'; setTimeout(() => $(id).textContent = '', 1500); }
$('savePages').onclick = async () => { await HNSSettings.setSettings({ pageRules: lines($('pageRules').value) }); flash('pagesSaved'); };
$('saveKeywords').onclick = async () => { await HNSSettings.setSettings({ keywords: lines($('keywords').value) }); flash('keywordsSaved'); };

function detail(e) {
  if (e.token) return `${e.token} (${e.pack}${e.where && e.where !== 'text' ? ', ' + e.where : ''})`;
  if (e.field) return `${e.field} (${e.pack})`;
  return '';
}
async function renderLog() {
  const { log = [] } = await chrome.storage.local.get('log');
  const rows = log.map(e => ({ ...e, detail: detail(e) }));
  rows.sort((a, b) => (a[sortKey] > b[sortKey] ? 1 : a[sortKey] < b[sortKey] ? -1 : 0) * sortDir);
  $('logCount').textContent = `${log.length} entr${log.length === 1 ? 'y' : 'ies'}`;
  const tb = $('rows'); tb.innerHTML = '';
  for (const r of rows.slice(0, 1000)) {
    const tr = document.createElement('tr');
    for (const v of [new Date(r.ts).toLocaleString(), EFFECT[r.effect] || r.effect, r.detail, r.url || '']) {
      const td = document.createElement('td'); td.textContent = v; tr.appendChild(td);
    }
    tb.appendChild(tr);
  }
}
document.querySelectorAll('th').forEach(th => th.onclick = () => {
  const k = th.dataset.k; sortDir = sortKey === k ? -sortDir : 1; sortKey = k; renderLog();
});
$('refresh').onclick = renderLog;
$('clear').onclick = async () => { await chrome.storage.local.set({ log: [] }); renderLog(); };
$('export').onclick = async () => {
  const { log = [] } = await chrome.storage.local.get('log');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(log, null, 2)], { type: 'application/json' }));
  a.download = `hide-and-sneak-log-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
};
// ---------- settings backup ----------
const PORTABLE = ['mode', 'packs', 'pageRules', 'keywords', 'siteOff', 'highlight', 'blockPdfs', 'autoOffMinutes'];
$('exportSettings').onclick = async () => {
  const s = await HNSSettings.getSettings();
  const out = { app: 'hide-and-sneak', version: chrome.runtime.getManifest().version, exportedAt: new Date().toISOString(), settings: {} };
  for (const k of PORTABLE) out.settings[k] = s[k];
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' }));
  a.download = `hide-and-sneak-settings-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
};
$('importSettings').onclick = () => $('importFile').click();
$('importFile').onchange = async () => {
  const f = $('importFile').files[0]; $('importFile').value = '';
  if (!f) return;
  try { $('importMsg').textContent = await importSettings(await f.text()); $('importMsg').style.color = ''; }
  catch (e) { $('importMsg').textContent = 'Could not import: ' + e.message; $('importMsg').style.color = '#c62828'; }
};
// Validates every field, so a hand-edited or unrelated file can't put bad values into settings.
async function importSettings(text) {
  let data; try { data = JSON.parse(text); } catch (_) { throw new Error('that file isn\'t valid JSON.'); }
  if (!data || data.app !== 'hide-and-sneak' || typeof data.settings !== 'object') throw new Error('that isn\'t a Hide & Sneak settings file.');
  const s = data.settings, patch = {};
  const strList = (v) => Array.isArray(v) && v.every(x => typeof x === 'string') ? v.map(x => x.trim()).filter(Boolean).slice(0, 500) : null;
  if (s.mode === 'agent' || s.mode === 'present') patch.mode = s.mode;
  if (s.packs && typeof s.packs === 'object') {
    const cur = (await HNSSettings.getSettings()).packs; patch.packs = { ...cur };
    for (const k of Object.keys(cur)) if (typeof s.packs[k] === 'boolean') patch.packs[k] = s.packs[k];
  }
  for (const k of ['pageRules', 'keywords', 'siteOff']) { const v = strList(s[k]); if (v) patch[k] = v; }
  for (const k of ['highlight', 'blockPdfs']) if (typeof s[k] === 'boolean') patch[k] = s[k];
  if ([0, 30, 60, 120, 240].includes(s.autoOffMinutes)) patch.autoOffMinutes = s.autoOffMinutes;
  if (!Object.keys(patch).length) throw new Error('nothing in that file could be used.');
  await HNSSettings.setSettings(patch);
  await load();
  return `Imported: ${(patch.keywords || []).length} words, ${(patch.pageRules || []).length} pages, ${(patch.siteOff || []).length} skipped sites, and your preferences.`;
}
globalThis.__importSettings = importSettings;   // for the automated test

load();
// Words added with right-click "Hide this" show up here without a reload.
chrome.storage.onChanged.addListener((c) => { if (c.settings && document.activeElement !== $('keywords')) $('keywords').value = (c.settings.newValue.keywords || []).join('\n'); });
