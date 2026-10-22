const $ = (id) => document.getElementById(id);
const SELFTEST = 'https://williamchen-pm.github.io/hide-and-sneak/selftest.html';

// Step 1: check off once the icon is pinned (Chrome reports this to the extension itself).
async function checkPinned() {
  try {
    const s = await chrome.action.getUserSettings();
    if (s && s.isOnToolbar) { $('stepPin').classList.add('done'); $('pinText').textContent = 'Pinned. You\'ll find the Hide & Sneak shield next to the address bar.'; return; }
  } catch (_) {}
  setTimeout(checkPinned, 1000);
}
checkPinned();

// Step 2: pick a mode
async function renderMode() {
  const s = await HNSSettings.getSettings();
  document.querySelectorAll('.mode').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === (s.mode || 'agent'))));
}
document.querySelectorAll('.mode').forEach(b => b.onclick = async () => {
  await HNSSettings.setSettings({ mode: b.dataset.mode });
  $('stepMode').classList.add('done');
  renderMode();
});
renderMode();

// Step 3: turn on and open the self-test
$('runTest').onclick = async () => {
  await chrome.runtime.sendMessage({ type: 'setAgentMode', on: true });
  $('stepTest').classList.add('done');
  chrome.tabs.create({ url: SELFTEST });
};
