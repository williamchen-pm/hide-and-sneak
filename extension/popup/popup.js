const PACKS = [
  ['injection', 'Hidden instructions aimed at AI agents'],
  ['identity', 'Identity (SSN, date of birth, ID numbers)'],
  ['payments', 'Payments (cards, bank accounts)'],
  ['credentials', 'Passwords & 2FA codes'],
  ['job', 'Job applications (salary, demographics)'],
  ['contact', 'Contact info (phone, address)'],
  ['last4', 'Last 4 digits of cards & accounts'],
];
const $ = (id) => document.getElementById(id);

async function render() {
  const s = await HNSSettings.getSettings();
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let host = '';
  try { host = new URL(tab.url).hostname; } catch (_) {}
  $('agent').checked = s.agentMode;
  $('host').textContent = host || 'this site';
  $('siteoff').checked = !!host && s.siteOff.includes(host);
  $('siteoff').disabled = !host;
  const st = $('status');
  if (s.agentMode) {
    const stats = await chrome.runtime.sendMessage({ type: 'getTabStats', tabId: tab.id });
    st.className = 'status on';
    st.textContent = `On. ${stats.protected} item${stats.protected === 1 ? '' : 's'} protected on this tab` +
      (stats.misses ? `, ${stats.misses} rule miss${stats.misses === 1 ? '' : 'es'}.` : '.');
    const { at } = await chrome.runtime.sendMessage({ type: 'getAutoOff' });
    if (at) st.textContent += ` Turns off at ${new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`;
  } else {
    st.className = 'status';
    st.textContent = "Off. The extension isn't touching any page.";
  }
  $('packs').innerHTML = '';
  for (const [key, label] of PACKS) {
    const l = document.createElement('label');
    l.innerHTML = `<span></span><input type="checkbox">`;
    l.querySelector('span').textContent = label;
    const cb = l.querySelector('input');
    cb.checked = !!s.packs[key];
    cb.onchange = async () => { const cur = await HNSSettings.getSettings(); cur.packs[key] = cb.checked; await HNSSettings.setSettings({ packs: cur.packs }); };
    $('packs').appendChild(l);
  }
  $('autooff').value = String(s.autoOffMinutes || 0);
  $('autooff').onchange = async () => { await HNSSettings.setSettings({ autoOffMinutes: Number($('autooff').value) }); render(); };
  await renderTurn(tab);
  $('highlight').checked = s.highlight !== false;
  $('highlight').onchange = async () => { await HNSSettings.setSettings({ highlight: $('highlight').checked }); };
  $('siteoff').onchange = async () => {
    const cur = await HNSSettings.getSettings();
    const set = new Set(cur.siteOff);
    $('siteoff').checked ? set.add(host) : set.delete(host);
    await HNSSettings.setSettings({ siteOff: [...set] });
  };
}

// "Your turn": the fields Hide & Sneak kept from the agent, so the user knows what's left to fill in.
async function renderTurn(tab) {
  const box = $('turn');
  box.hidden = true;
  if (!tab || !/^https?:|^file:/.test(tab.url || '')) return;
  let results = [];
  try {
    results = await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true },
      func: () => (globalThis.__hnsTurn ? globalThis.__hnsTurn() : null) });
  } catch (_) { return; }
  const items = [];
  let mode = null;
  for (const r of results) {
    if (!r.result || !r.result.items.length) continue;
    mode = r.result.mode;
    r.result.items.forEach((it, i) => items.push({ ...it, frameId: r.frameId, index: i }));
  }
  if (!items.length) return;
  const left = items.filter(i => !i.done).length;
  if (mode === 'locked') {
    $('turnHead').textContent = `🔒 ${items.length} field${items.length === 1 ? '' : 's'} left for you`;
    $('turnNote').textContent = 'Your agent can\'t fill these. Turn Agent Mode off when it\'s done, then fill them in.';
  } else {
    $('turnHead').textContent = left ? `✏️ Your turn: ${left} field${left === 1 ? '' : 's'} to fill` : '✅ All done';
    $('turnNote').textContent = left ? 'Click one to jump to it. They\'re outlined on the page.' : 'You filled in everything your agent left for you.';
  }
  const ul = $('turnList'); ul.innerHTML = '';
  for (const it of items) {
    const li = document.createElement('li'); if (it.done) li.className = 'done';
    const b = document.createElement('button');
    b.innerHTML = '<span></span><span></span>';
    b.firstChild.textContent = it.label;
    b.lastChild.textContent = it.done ? 'done' : (mode === 'locked' ? 'show' : 'go ›');
    b.onclick = async () => {
      await chrome.scripting.executeScript({ target: { tabId: tab.id, frameIds: [it.frameId] },
        func: (i) => globalThis.__hnsJump && globalThis.__hnsJump(i), args: [it.index] }).catch(() => {});
      if (mode !== 'locked') window.close();
    };
    li.appendChild(b); ul.appendChild(li);
  }
  box.hidden = false;
}

// Show the keyboard shortcut (the user can change it at chrome://extensions/shortcuts).
chrome.commands.getAll().then(cmds => {
  const c = cmds.find(x => x.name === 'toggle-agent-mode');
  const el = $('shortcut');
  if (c && c.shortcut) { el.innerHTML = 'Shortcut: '; for (const k of c.shortcut.split('+')) { const kb = document.createElement('kbd'); kb.textContent = k; el.appendChild(kb); el.append(' '); } }
  else { el.innerHTML = '<a href="#">Set a keyboard shortcut</a>'; }
  const a = document.createElement('a'); a.href = '#'; a.textContent = c && c.shortcut ? 'change' : '';
  if (c && c.shortcut) { el.append(' '); el.appendChild(a); }
  el.querySelectorAll('a').forEach(x => x.onclick = (e) => { e.preventDefault(); chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }); });
});

$('agent').onchange = async () => {
  $('agent').disabled = true;
  await chrome.runtime.sendMessage({ type: 'setAgentMode', on: $('agent').checked });
  $('agent').disabled = false;
  render().then(() => requestAnimationFrame(() => document.body.classList.add('ready')));
};
$('opts').onclick = (e) => { e.preventDefault(); chrome.runtime.openOptionsPage(); };

// Feedback: open a prefilled GitHub issue form. Only the extension version and the site's domain
// are included (never the full URL, which can contain private tokens), and only when the user clicks.
const REPO = 'https://github.com/williamchen-pm/hide-and-sneak';
const VERSION = chrome.runtime.getManifest().version_name || chrome.runtime.getManifest().version;
$('ver').textContent = 'BETA · v' + chrome.runtime.getManifest().version;
document.querySelectorAll('.report a').forEach(a => a.onclick = async (e) => {
  e.preventDefault();
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let host = '';
  try { host = new URL(tab.url).hostname; } catch (_) {}
  const q = new URLSearchParams({ template: a.dataset.template, version: VERSION });
  if (host && a.dataset.template !== '4-idea.yml') q.set('site', host);
  chrome.tabs.create({ url: REPO + '/issues/new?' + q.toString() });
});
render().then(() => requestAnimationFrame(() => document.body.classList.add('ready')));
