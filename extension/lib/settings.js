/* Shared settings helpers (popup, options, background, content). */
(function (root) {
  'use strict';
  const DEFAULTS = {
    agentMode: false,
    packs: { identity: true, payments: true, credentials: true, contact: false, job: true, last4: false },
    pageRules: [],      // URL patterns, e.g. "https://www.amazon.com/cpe/yourpayments/*"
    keywords: [],       // phrases to redact
    siteOff: [],        // hostnames where protection is skipped
    highlight: true,    // paint hidden items as a redaction bar
  };
  async function getSettings() {
    const { settings } = await chrome.storage.local.get('settings');
    const s = Object.assign({}, DEFAULTS, settings || {});
    s.packs = Object.assign({}, DEFAULTS.packs, (settings && settings.packs) || {});
    return s;
  }
  async function setSettings(patch) {
    const s = await getSettings();
    const next = Object.assign(s, patch);
    await chrome.storage.local.set({ settings: next });
    return next;
  }
  root.HNSSettings = { DEFAULTS, getSettings, setSettings };
})(typeof globalThis !== 'undefined' ? globalThis : this);
