/* Hide & Sneak: service worker.
 * - Registers the content scripts only while Agent Mode is on, so when it's off
 *   the extension injects nothing into any page.
 * - Injects into already-open tabs when turned on (no reload, so no lost work).
 * - Keeps the audit log and per-tab counts for the toolbar badge.
 */
importScripts('lib/settings.js');

const SCRIPT_ID = 'hns-engine';
const CONTENT_JS = ['lib/detect.js', 'content/engine.js'];
const LOG_CAP = 5000;
const tabCounts = new Map();   // tabId -> { protected, misses }

async function syncRegistration(on) {
  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [SCRIPT_ID] });
  if (on && !existing.length) {
    await chrome.scripting.registerContentScripts([{
      id: SCRIPT_ID, matches: ['<all_urls>'], js: CONTENT_JS,
      runAt: 'document_start', allFrames: true, matchOriginAsFallback: true, persistAcrossSessions: true,
    }]);
  } else if (!on && existing.length) {
    await chrome.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] });
  }
}

async function injectIntoOpenTabs() {
  const tabs = await chrome.tabs.query({});
  await Promise.all(tabs.filter(t => /^https?:/.test(t.url || '')).map(t =>
    chrome.scripting.executeScript({ target: { tabId: t.id, allFrames: true }, files: CONTENT_JS }).catch(() => {})
  ));
}

async function setBadge(tabId) {
  const s = await HNSSettings.getSettings();
  const opts = tabId != null ? { tabId } : {};
  if (!s.agentMode) {
    await chrome.action.setBadgeText({ ...opts, text: '' });
    await chrome.action.setTitle({ ...opts, title: 'Hide & Sneak: Agent Mode off' });
    return;
  }
  const c = (tabId != null && tabCounts.get(tabId)) || { protected: 0, misses: 0 };
  await chrome.action.setBadgeBackgroundColor({ ...opts, color: c.misses ? '#C98A00' : '#C62828' });
  await chrome.action.setBadgeText({ ...opts, text: c.protected ? String(Math.min(c.protected, 999)) : 'ON' });
  await chrome.action.setTitle({ ...opts, title: `Hide & Sneak: Agent Mode ON. ${c.protected} protected on this tab${c.misses ? `, ${c.misses} rule misses` : ''}.` });
}

async function appendLog(entries) {
  const { log = [] } = await chrome.storage.local.get('log');
  const next = log.concat(entries);
  await chrome.storage.local.set({ log: next.length > LOG_CAP ? next.slice(next.length - LOG_CAP) : next });
}

const AUTO_OFF = 'hns-auto-off';

async function setAgentMode(on, reason) {
  const s = await HNSSettings.getSettings();
  const sessionId = on ? `s-${Date.now()}` : s.sessionId;
  await HNSSettings.setSettings({ agentMode: on, sessionId });
  await appendLog([{ ts: Date.now(), effect: on ? 'session-start' : (reason === 'auto' ? 'auto-off' : 'session-end'), sessionId }]);
  await syncRegistration(on);
  await chrome.alarms.clear(AUTO_OFF);
  if (on && s.autoOffMinutes > 0) await chrome.alarms.create(AUTO_OFF, { delayInMinutes: s.autoOffMinutes });
  if (on) { tabCounts.clear(); await injectIntoOpenTabs(); }
  const tabs = await chrome.tabs.query({});
  await setBadge(); for (const t of tabs) await setBadge(t.id);
  return on;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (msg.type === 'hits' && sender.tab) {
      const c = tabCounts.get(sender.tab.id) || { protected: 0, misses: 0 };
      for (const e of msg.entries) { if (e.effect === 'miss') c.misses++; else c.protected++; }
      tabCounts.set(sender.tab.id, c);
      await appendLog(msg.entries.map(e => ({ ...e, sessionId: msg.sessionId })));
      await setBadge(sender.tab.id);
      sendResponse({ ok: true });
    } else if (msg.type === 'setAgentMode') {
      sendResponse({ ok: true, on: await setAgentMode(!!msg.on) });
    } else if (msg.type === 'getTabStats') {
      sendResponse(tabCounts.get(msg.tabId) || { protected: 0, misses: 0 });
    } else if (msg.type === 'getAutoOff') {
      const a = await chrome.alarms.get(AUTO_OFF);
      sendResponse({ at: a ? a.scheduledTime : null });
    }
  })();
  return true;
});

// Keyboard shortcut (Alt+Shift+H by default; changeable at chrome://extensions/shortcuts).
chrome.commands.onCommand.addListener(async (cmd) => {
  if (cmd !== 'toggle-agent-mode') return;
  const s = await HNSSettings.getSettings();
  await setAgentMode(!s.agentMode);
});

// Optional auto-off timer. Off by default: turning protection off in the middle of an agent's
// task would unlock fields the agent can then fill, so the user has to choose it.
async function onAlarm(a) {
  if (a.name !== AUTO_OFF) return;
  const s = await HNSSettings.getSettings();
  if (s.agentMode) await setAgentMode(false, 'auto');
}
chrome.alarms.onAlarm.addListener(onAlarm);

// ---------- right-click menu ----------
const REPO = 'https://github.com/williamchen-pm/hide-and-sneak';
function createMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: 'hns-hide', title: 'Hide this from AI agents', contexts: ['selection'] });
    chrome.contextMenus.create({ id: 'hns-report', title: 'Report something Hide && Sneak missed', contexts: ['page', 'selection'] });
  });
}
// Small confirmation on the page. It never repeats the selected text, so it can't leak it to a
// screenshot. Marked data-hns so the engine ignores it.
function showToast(message) {
  const old = document.getElementById('hns-toast'); if (old) old.remove();
  const t = document.createElement('div');
  t.id = 'hns-toast'; t.setAttribute('data-hns', 'toast'); t.setAttribute('role', 'status');
  t.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647;max-width:340px;font:500 13px/1.4 system-ui,sans-serif;' +
    'padding:10px 14px;border-radius:10px;background:#1d1d1b;color:#fff;box-shadow:0 4px 16px rgba(0,0,0,.3);';
  t.textContent = message;
  document.documentElement.appendChild(t);
  setTimeout(() => t.remove(), 4500);
}
async function toast(tab, frameId, message) {
  if (!tab || tab.id == null) return;
  await chrome.scripting.executeScript({ target: { tabId: tab.id, frameIds: [frameId || 0] }, func: showToast, args: [message] }).catch(() => {});
}
async function onMenuClick(info, tab) {
  if (info.menuItemId === 'hns-hide') {
    const text = (info.selectionText || '').replace(/\s+/g, ' ').trim();
    if (text.length < 2 || text.length > 200 || /^\[[A-Z0-9 #]+\]$/.test(text)) {
      await toast(tab, info.frameId, text.length > 200 ? 'Hide & Sneak: select a shorter piece of text (under 200 characters).' : 'Hide & Sneak: select the text you want hidden, then try again.');
      return;
    }
    const s = await HNSSettings.getSettings();
    const exists = s.keywords.some(k => k.toLowerCase() === text.toLowerCase());
    if (!exists) await HNSSettings.setSettings({ keywords: s.keywords.concat(text) });
    await appendLog([{ ts: Date.now(), effect: 'word-added', sessionId: s.sessionId }]);
    await toast(tab, info.frameId, s.agentMode
      ? '🔒 Hidden. Hide & Sneak will hide this on every page while Agent Mode is on.'
      : '🔒 Saved. Hide & Sneak will hide this on every page whenever Agent Mode is on.');
  } else if (info.menuItemId === 'hns-report') {
    // Only the version and the site's domain, never the page URL or the selected text.
    let host = '';
    try { host = new URL(info.pageUrl || '').hostname; } catch (_) {}
    const v = chrome.runtime.getManifest().version_name || chrome.runtime.getManifest().version;
    const q = new URLSearchParams({ template: '1-leak.yml', version: v });
    if (host) q.set('site', host);
    chrome.tabs.create({ url: REPO + '/issues/new?' + q.toString() });
  }
}
chrome.contextMenus.onClicked.addListener(onMenuClick);

// Changing the auto-off setting while Agent Mode is on reschedules the timer from now.
chrome.storage.onChanged.addListener(async (changes) => {
  if (!changes.settings) return;
  const o = changes.settings.oldValue || {}, n = changes.settings.newValue || {};
  if (!n.agentMode || o.autoOffMinutes === n.autoOffMinutes || o.agentMode !== n.agentMode) return;
  await chrome.alarms.clear(AUTO_OFF);
  if (n.autoOffMinutes > 0) await chrome.alarms.create(AUTO_OFF, { delayInMinutes: n.autoOffMinutes });
});

chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status === 'loading' && info.url) { tabCounts.delete(tabId); setBadge(tabId); }
});
chrome.tabs.onRemoved.addListener((tabId) => tabCounts.delete(tabId));

async function init() {
  createMenus();
  const s = await HNSSettings.getSettings();
  await syncRegistration(s.agentMode);
  await setBadge();
}
chrome.runtime.onStartup.addListener(init);
chrome.runtime.onInstalled.addListener(async (details) => {
  await init();
  if (details.reason === 'install') chrome.runtime.openOptionsPage();
});
