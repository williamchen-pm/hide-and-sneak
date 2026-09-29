/* Hide & Sneak demo shim.
 * Lets the real extension engine (extension/content/engine.js) run on a normal web page
 * by providing the few chrome.* APIs it uses. Protection is ON unless the URL has ?protect=off.
 * Nothing is sent anywhere; the "activity" is shown in the page's side panel.
 */
(function () {
  const on = new URLSearchParams(location.search).get('protect') !== 'off';
  window.HNS_DEMO = { on, events: [] };
  const settings = {
    agentMode: on, sessionId: 'demo',
    packs: { identity: true, payments: true, credentials: true, contact: false, job: true, last4: new URLSearchParams(location.search).get('last4') === '1' },
    pageRules: [], keywords: [], siteOff: [],
  };
  window.chrome = {
    storage: {
      local: { get: async () => ({ settings }), set: async () => {} },
      onChanged: { addListener() {} },
    },
    runtime: {
      sendMessage(msg) {
        if (msg && msg.type === 'hits') {
          window.HNS_DEMO.events.push(...msg.entries);
          document.dispatchEvent(new CustomEvent('hns-demo-hits', { detail: msg.entries }));
        }
        return Promise.resolve({ ok: true });
      },
    },
  };
})();
