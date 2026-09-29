const PACKS = [
  ['identity', 'Identity (SSN, date of birth, ID numbers)'],
  ['payments', 'Payments (cards, bank accounts)'],
  ['credentials', 'Passwords & 2FA codes'],
  ['job', 'Job applications (salary, demographics)'],
  ['contact', 'Contact info (phone, address)'],
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
  $('highlight').checked = s.highlight !== false;
  $('highlight').onchange = async () => { await HNSSettings.setSettings({ highlight: $('highlight').checked }); };
  $('siteoff').onchange = async () => {
    const cur = await HNSSettings.getSettings();
    const set = new Set(cur.siteOff);
    $('siteoff').checked ? set.add(host) : set.delete(host);
    await HNSSettings.setSettings({ siteOff: [...set] });
  };
}

$('agent').onchange = async () => {
  $('agent').disabled = true;
  await chrome.runtime.sendMessage({ type: 'setAgentMode', on: $('agent').checked });
  $('agent').disabled = false;
  render().then(() => requestAnimationFrame(() => document.body.classList.add('ready')));
};
$('opts').onclick = (e) => { e.preventDefault(); chrome.runtime.openOptionsPage(); };
render().then(() => requestAnimationFrame(() => document.body.classList.add('ready')));
