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
      const s = await HNSSettings.getSettings();
      const on = !!msg.on;
      const sessionId = on ? `s-${Date.now()}` : s.sessionId;
      await HNSSettings.setSettings({ agentMode: on, sessionId });
      await appendLog([{ ts: Date.now(), effect: on ? 'session-start' : 'session-end', sessionId }]);
      await syncRegistration(on);
      if (on) { tabCounts.clear(); await injectIntoOpenTabs(); }
      const tabs = await chrome.tabs.query({});
      await setBadge(); for (const t of tabs) await setBadge(t.id);
      sendResponse({ ok: true, on });
    } else if (msg.type === 'getTabStats') {
      sendResponse(tabCounts.get(msg.tabId) || { protected: 0, misses: 0 });
    }
  })();
  return true;
});

chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status === 'loading' && info.url) { tabCounts.delete(tabId); setBadge(tabId); }
});
chrome.tabs.onRemoved.addListener((tabId) => tabCounts.delete(tabId));

async function init() {
  const s = await HNSSettings.getSettings();
  await syncRegistration(s.agentMode);
  await setBadge();
}
chrome.runtime.onStartup.addListener(init);
chrome.runtime.onInstalled.addListener(async (details) => {
  await init();
  if (details.reason === 'install') chrome.runtime.openOptionsPage();
});
