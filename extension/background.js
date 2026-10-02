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
const pdfTabs = new Set();     // tabs showing a PDF while Agent Mode is on

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
  if (tabId != null) {
    const pauses = await getPauses();
    if (pauses[tabId]) {
      await chrome.action.setBadgeBackgroundColor({ tabId, color: '#8a6d00' });
      await chrome.action.setBadgeText({ tabId, text: 'OPEN' });
      await chrome.action.setTitle({ tabId, title: 'Hide & Sneak: this tab is unlocked for sign-in.' });
      return;
    }
    if (pdfTabs.has(tabId)) {
      await chrome.action.setBadgeBackgroundColor({ tabId, color: '#C98A00' });
      await chrome.action.setBadgeText({ tabId, text: 'PDF' });
      await chrome.action.setTitle({ tabId, title: s.blockPdfs === false ? 'Hide & Sneak: PDFs can\'t be protected. Your agent can read this one.' : 'Hide & Sneak: this PDF is blocked while Agent Mode is on.' });
      return;
    }
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

// ---------- per-tab "unlocked for sign-in" ----------
// Kept in session storage (memory only, cleared when Chrome closes) so it survives the service
// worker sleeping. Content scripts can't read session storage; they ask with a message.
async function getPauses() {
  const { pauses = {} } = await chrome.storage.session.get('pauses');
  const now = Date.now(); let changed = false;
  for (const k of Object.keys(pauses)) if (pauses[k] <= now) { delete pauses[k]; changed = true; }
  if (changed) await chrome.storage.session.set({ pauses });
  return pauses;
}
async function setPause(tabId, until) {
  const pauses = await getPauses();
  if (until) pauses[tabId] = until; else delete pauses[tabId];
  await chrome.storage.session.set({ pauses });
}
// The extension's own pages (popup, settings). Content scripts report the web page's URL here, and
// web pages can't message the extension at all, so neither can unlock a page or undo a hide.
const fromOurPage = (sender) => sender.id === chrome.runtime.id && (sender.url || '').startsWith(chrome.runtime.getURL(''));

async function setAgentMode(on, reason) {
  const s = await HNSSettings.getSettings();
  const sessionId = on ? `s-${Date.now()}` : s.sessionId;
  await HNSSettings.setSettings({ agentMode: on, sessionId });
  await appendLog([{ ts: Date.now(), effect: on ? 'session-start' : (reason === 'auto' ? 'auto-off' : 'session-end'), sessionId }]);
  await syncRegistration(on);
  await chrome.storage.session.set({ pauses: {} });
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
    } else if (msg.type === 'pauseState' && sender.tab) {
      const pauses = await getPauses();
      sendResponse({ until: pauses[sender.tab.id] || 0 });
    } else if (msg.type === 'pause' && fromOurPage(sender)) {
      // Only the popup can unlock a page. Agents can't reach it, and pages can't send this.
      const until = msg.minutes > 0 ? Date.now() + Math.min(msg.minutes, 15) * 60e3 : 0;
      await setPause(msg.tabId, until);
      await chrome.scripting.executeScript({ target: { tabId: msg.tabId, allFrames: true },
        func: (u) => (u ? globalThis.__hnsPause && globalThis.__hnsPause(u) : globalThis.__hnsResume && globalThis.__hnsResume()), args: [until] }).catch(() => {});
      await appendLog([{ ts: Date.now(), effect: until ? 'page-unlocked' : 'page-relocked' }]);
      await setBadge(msg.tabId);
      sendResponse({ ok: true, until });
    } else if (msg.type === 'pdf' && sender.tab) {
      pdfTabs.add(sender.tab.id); await setBadge(sender.tab.id); sendResponse({ ok: true });
    } else if (msg.type === 'tabInfo') {
      const pauses = await getPauses();
      sendResponse({ pausedUntil: pauses[msg.tabId] || 0, pdf: pdfTabs.has(msg.tabId) });
    } else if (msg.type === 'undoHide' && fromOurPage(sender)) {
      const { lastHidden } = await chrome.storage.session.get('lastHidden');
      if (lastHidden) {
        const s = await HNSSettings.getSettings();
        await HNSSettings.setSettings({ keywords: s.keywords.filter(k => k !== lastHidden) });
        await chrome.storage.session.remove('lastHidden');
        await appendLog([{ ts: Date.now(), effect: 'word-removed' }]);
      }
      sendResponse({ ok: !!lastHidden });
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
// onInstalled and onStartup can both fire when Chrome starts after an update, so two rebuilds
// could interleave and the second "create" would hit a duplicate id. Run rebuilds one at a time,
// and treat "already exists" as fine.
let menuQueue = Promise.resolve();
function createMenus() {
  menuQueue = menuQueue.then(async () => {
    await chrome.contextMenus.removeAll();
    const ok = () => void chrome.runtime.lastError;
    chrome.contextMenus.create({ id: 'hns-hide', title: 'Hide this from AI agents', contexts: ['selection'] }, ok);
    chrome.contextMenus.create({ id: 'hns-report', title: 'Report something Hide && Sneak missed', contexts: ['page', 'selection'] }, ok);
  }).catch(() => {});
  return menuQueue;
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
    if (!exists) { await HNSSettings.setSettings({ keywords: s.keywords.concat(text) }); await chrome.storage.session.set({ lastHidden: text }); }
    await appendLog([{ ts: Date.now(), effect: 'word-added', sessionId: s.sessionId }]);
    await toast(tab, info.frameId, s.agentMode
      ? '🔒 Hidden. Hide & Sneak will hide this on every page while Agent Mode is on. Mistake? Click the Hide & Sneak icon to undo.'
      : '🔒 Saved. Hide & Sneak will hide this on every page whenever Agent Mode is on. Mistake? Click the Hide & Sneak icon to undo.');
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
  if (info.status === 'loading' && info.url) { tabCounts.delete(tabId); pdfTabs.delete(tabId); setBadge(tabId); }
});
chrome.tabs.onRemoved.addListener((tabId) => { tabCounts.delete(tabId); pdfTabs.delete(tabId); setPause(tabId, 0); });

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
