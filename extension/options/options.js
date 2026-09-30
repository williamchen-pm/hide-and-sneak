const $ = (id) => document.getElementById(id);
const lines = (t) => t.split('\n').map(s => s.trim()).filter(Boolean);
const EFFECT = {
  'redact': 'Text hidden', 'field-locked': 'Field protected', 'field-cleared': 'Field cleared on lock',
  'lock-bypass-cleared': 'Blocked a write to a locked field', 'page-blocked': 'Page blocked', 'miss': 'Rule missed its target',
  'session-start': 'Agent Mode on', 'session-end': 'Agent Mode off',
  'auto-off': 'Agent Mode turned off automatically', 'word-added': 'Protected word added (right-click)',
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
load();
// Words added with right-click "Hide this" show up here without a reload.
chrome.storage.onChanged.addListener((c) => { if (c.settings && document.activeElement !== $('keywords')) $('keywords').value = (c.settings.newValue.keywords || []).join('\n'); });
