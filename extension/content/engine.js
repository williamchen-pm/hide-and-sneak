/* Hide & Sneak: content engine.
 * Injected only while Agent Mode is on. It:
 *   1. hides the page until the first protection pass is done (no flash of originals)
 *   2. replaces sensitive text and attributes with placeholders (never CSS-hides them)
 *   3. locks sensitive form fields ("You fill this one") and clears anything written into them
 *   4. replaces protected pages with a placeholder
 *   5. reports what it did to the audit log (never the original values)
 * When Agent Mode is turned off, it unlocks fields in place (no reload, no lost work).
 */
(function () {
  'use strict';
  // Guard on the shared DOM, not window: the extension (isolated world) and the demo page
  // (main world) have separate window objects but see the same document.
  if (window.__hnsEngine || document.documentElement.hasAttribute('data-hns-engine')) return;
  window.__hnsEngine = true;
  document.documentElement.setAttribute('data-hns-engine', '');

  const D = globalThis.HNSDetect;
  const HNS_ATTR = 'data-hns';
  const HIDE_ID = 'hns-prerender-hide';
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'TEXTAREA', 'CANVAS', 'IFRAME', 'OBJECT']);
  const REDACT_ATTRS = ['title', 'aria-label', 'alt', 'placeholder', 'data-tooltip', 'aria-description'];
  const FIELD_SELECTOR = 'input, select, textarea';
  const LINK_PLACEHOLDER = '#hidden-by-hide-and-sneak';

  let settings = null, extraRules = [], observer = null, active = true, sessionId = null;
  const locked = new Map();        // element -> { kind, marker, info }
  const pending = [];              // log entries waiting to be sent
  const pageKey = location.origin + location.pathname;

  // ---------- 1. pre-render hide ----------
  function hidePage() {
    if (document.getElementById(HIDE_ID)) return;
    const st = document.createElement('style');
    st.id = HIDE_ID;
    st.textContent = 'html{visibility:hidden !important}';
    (document.head || document.documentElement).appendChild(st);
  }
  function revealPage() { const st = document.getElementById(HIDE_ID); if (st) st.remove(); }
  hidePage();
  // Fail closed: if protection throws, keep the content hidden and say why.
  function failClosed() { showBlockedPage('Hide & Sneak could not finish protecting this page. Turn off Agent Mode to view it.'); }

  // ---------- logging ----------
  function log(entry) {
    pending.push(Object.assign({ ts: Date.now(), url: pageKey }, entry));
    if (pending.length === 1) setTimeout(flush, 400);
  }
  function flush() {
    if (!pending.length) return;
    const entries = pending.splice(0);
    try { chrome.runtime.sendMessage({ type: 'hits', entries, sessionId }); } catch (_) { /* extension reloaded */ }
    updateBanner();
  }
  let totalProtected = 0;

  // ---------- 2. text + attribute redaction ----------
  function isOurs(el) { return el && el.closest && el.closest('[' + HNS_ATTR + ']'); }

  // Safety net: a text node should need at most one or two rewrites. If a rule ever keeps
  // matching its own output, stop rewriting that node instead of freezing the page.
  const rewrites = new WeakMap();
  function redactTextNode(node) {
    const t = node.nodeValue;
    if (!t || t.length < 3) return;
    if ((rewrites.get(node) || 0) >= 5) return;
    const parent = node.parentElement;
    if (!parent || SKIP_TAGS.has(parent.tagName) || isOurs(parent)) return;
    const r = D.redactText(t, settings.packs, extraRules);
    if (!r.hits.length) {
      // A bare value on its own (e.g. "826774" under "Or enter this code:"): check preceding text.
      const trimmed = t.trim();
      if (trimmed.length >= 4 && trimmed.length <= 24 && /\d/.test(trimmed)) {
        const c = D.contextMatch(trimmed, precedingText(node, 400), settings.packs);
        if (c) {
          node.nodeValue = t.replace(trimmed, c.token);
          totalProtected++; log({ effect: 'redact', ruleId: c.ruleId, pack: c.pack, token: c.token, where: 'text+context' });
        }
      }
      return;
    }
    rewrites.set(node, (rewrites.get(node) || 0) + 1);
    node.nodeValue = r.text;
    for (const h of r.hits) { totalProtected++; log({ effect: 'redact', ruleId: h.ruleId, pack: h.pack, token: h.token, where: 'text' }); }
  }

  // Collect up to `max` characters of visible-ish text that comes before `node` in document order.
  function precedingText(node, max) {
    const root = document.body || document.documentElement;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(n) { const p = n.parentElement; return p && !SKIP_TAGS.has(p.tagName) && !isOurs(p) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT; }
    });
    w.currentNode = node;
    let out = '';
    for (let i = 0; i < 80 && out.length < max; i++) {
      const prev = w.previousNode();
      if (!prev) break;
      const v = prev.nodeValue.trim();
      if (!v) continue;
      // Stop at the previous standalone value or at a placeholder we already inserted, so one
      // label ("Enter this code:") only ever vouches for the value right after it.
      // (Placeholders are kept in the text; contextMatch decides how to treat them.)
      if (/^[\d\s()+.-]{4,}$/.test(v)) break;
      out = v + ' ' + out;
    }
    return out.slice(-max);
  }

  function redactAttrs(el) {
    if (isOurs(el)) return;
    // Links: one-time login / reset links carry account access in the URL itself. Neutralize the
    // target (the visible text stays), so the agent can neither read nor follow it.
    if ((el.tagName === 'A' || el.tagName === 'AREA') && el.hasAttribute('href')) {
      const h = el.getAttribute('href');
      if (h && h !== LINK_PLACEHOLDER) {
        const r = D.redactText(h, settings.packs, extraRules);
        if (r.hits.length) {
          el.setAttribute('href', LINK_PLACEHOLDER);
          for (const hit of r.hits) { totalProtected++; log({ effect: 'redact', ruleId: hit.ruleId, pack: hit.pack, token: hit.token, where: 'attr:href' }); }
        }
      }
    }
    for (const a of REDACT_ATTRS) {
      const v = el.getAttribute && el.getAttribute(a);
      if (!v) continue;
      const r = D.redactText(v, settings.packs, extraRules);
      if (r.hits.length) {
        el.setAttribute(a, r.text);
        for (const h of r.hits) { totalProtected++; log({ effect: 'redact', ruleId: h.ruleId, pack: h.pack, token: h.token, where: 'attr:' + a }); }
      }
    }
  }

  function processTree(root) {
    if (!root) return;
    if (root.nodeType === Node.TEXT_NODE) { redactTextNode(root); return; }
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;
    if (root.nodeType === Node.ELEMENT_NODE) {
      if (SKIP_TAGS.has(root.tagName) && root.tagName !== 'TEXTAREA') return;
      if (isOurs(root)) return;
      redactAttrs(root);
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        if (n.nodeType === Node.ELEMENT_NODE) {
          if (n.hasAttribute(HNS_ATTR)) return NodeFilter.FILTER_REJECT;
          if (SKIP_TAGS.has(n.tagName) && n.tagName !== 'TEXTAREA') return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    let n = walker.currentNode;
    while (n) {
      if (n.nodeType === Node.TEXT_NODE) redactTextNode(n);
      else {
        redactAttrs(n);
        if (n.matches && n.matches(FIELD_SELECTOR)) considerField(n);
        if (n.shadowRoot) { observeShadow(n.shadowRoot); processTree(n.shadowRoot); }
      }
      n = walker.nextNode();
    }
  }

  // ---------- 3. field locks ----------
  function textOf(el) { return (el ? (el.innerText || el.textContent || '') : '').replace(/\s+/g, ' ').trim(); }

  function fieldContext(el) {
    const parts = [];
    if (el.labels) for (const l of el.labels) parts.push(textOf(l));
    const al = el.getAttribute('aria-label'); if (al) parts.push(al);
    const lb = el.getAttribute('aria-labelledby');
    if (lb) for (const id of lb.split(/\s+/)) parts.push(textOf(document.getElementById(id)));
    const fs = el.closest('fieldset'); if (fs) { const lg = fs.querySelector('legend'); if (lg) parts.push(textOf(lg)); }
    const grp = el.closest('[role=group],[role=radiogroup]');
    if (grp) { if (grp.getAttribute('aria-label')) parts.push(grp.getAttribute('aria-label')); const gl = grp.getAttribute('aria-labelledby'); if (gl) parts.push(textOf(document.getElementById(gl))); }
    const choice = el.type === 'radio' || el.type === 'checkbox';
    // Explicit labels are enough for ordinary fields. Radios and checkboxes also need the question text.
    if (!choice && parts.some(Boolean)) return parts.join(' | ').slice(0, 600);
    // Question text: climb ancestors while they contain no OTHER form fields (so we never read
    // a neighbouring question), then also take the label-like text just before that container.
    const own = (f) => f === el || (choice && f.type === el.type && f.name && f.name === el.name);
    let a = el.parentElement, top = null;
    for (let i = 0; a && i < 5; i++, a = a.parentElement) {
      const others = Array.from(a.querySelectorAll(FIELD_SELECTOR)).some(f => !own(f) && f.type !== 'hidden');
      if (others) break;
      top = a;
    }
    if (top) {
      const t = textOf(top); if (t && t.length <= 300) parts.push(t);
      let prev = top.previousElementSibling;
      for (let k = 0; prev && k < 2; k++, prev = prev.previousElementSibling) {
        if (prev.querySelector && prev.matches(FIELD_SELECTOR) || prev.querySelector(FIELD_SELECTOR)) break;
        const pt = textOf(prev); if (pt) { parts.push(pt.slice(0, 200)); break; }
      }
    }
    if (el.placeholder) parts.push(el.placeholder);
    return parts.join(' | ').slice(0, 600);
  }

  function considerField(el) {
    if (locked.has(el) || isOurs(el)) return;
    const meta = { type: el.type || el.tagName.toLowerCase(), autocomplete: el.getAttribute('autocomplete') || '',
                   name: el.name || '', id: el.id || '', labelText: fieldContext(el) };
    const c = D.classifyField(meta, settings.packs);
    if (c) { lockField(el, c); return; }
    // A4: an unlabeled field that already holds a sensitive value (e.g. a pre-filled SSN on a
    // profile page). Lock it too. Contact details are meant to be filled in, so they're ignored.
    const v = (el.tagName === 'SELECT' || el.type === 'checkbox' || el.type === 'radio') ? '' : (el.value || '');
    if (v && v.length >= 4) {
      const hit = D.redactText(v, settings.packs, extraRules).hits.find(h => h.pack !== 'contact');
      if (hit) lockField(el, { pack: hit.pack, label: 'field holding a ' + hit.token.replace(/[\[\]]/g, '').toLowerCase(), reason: 'value matches ' + hit.ruleId });
    }
  }

  // Clears the live value AND the HTML attributes that hold the original (value/checked/selected),
  // so the original can't be read back from the DOM.
  function clearField(el) {
    let had = false;
    if (el.type === 'checkbox' || el.type === 'radio') {
      had = el.checked || el.hasAttribute('checked');
      el.checked = false; el.removeAttribute('checked');
    } else if (el.tagName === 'SELECT') {
      had = el.selectedIndex > 0;
      for (const o of el.options) if (o.hasAttribute('selected')) { o.removeAttribute('selected'); had = true; }
      el.selectedIndex = 0;
    } else {
      had = !!el.value || !!el.getAttribute('value');
      el.value = ''; if (el.hasAttribute('value')) el.removeAttribute('value');
      if (el.tagName === 'TEXTAREA' && el.textContent) el.textContent = '';
    }
    return had;
  }

  function lockField(el, info) {
    const kind = (el.type === 'checkbox' || el.type === 'radio' || el.tagName === 'SELECT') ? 'disabled' : 'readonly';
    const state = { kind, info, prev: { readOnly: el.readOnly, disabled: el.disabled, tabIndex: el.getAttribute('tabindex'), ariaLabel: el.getAttribute('aria-label') } };
    if (clearField(el)) log({ effect: 'field-cleared', pack: info.pack, field: info.label });
    if (kind === 'readonly') el.readOnly = true; else el.disabled = true;
    el.setAttribute('tabindex', '-1');
    el.setAttribute('aria-label', 'Locked by Hide & Sneak: the user will fill in this ' + info.label + ' field.');
    state.cover = coverTarget(el);
    // Radio/checkbox groups share one marker that covers all their options.
    const gk = groupKey(el);
    if (gk && groupMarkers.has(gk)) state.marker = groupMarkers.get(gk);
    else { state.marker = makeMarker(el, info); if (gk) groupMarkers.set(gk, state.marker); }
    // Clear immediately on any write event, not just on the 400 ms sweep.
    state.onWrite = () => { if (active && clearField(el)) log({ effect: 'lock-bypass-cleared', pack: info.pack, field: info.label }); };
    ['input', 'change', 'paste', 'drop'].forEach(t => el.addEventListener(t, state.onWrite, true));
    locked.set(el, state);
    totalProtected++;
    log({ effect: 'field-locked', pack: info.pack, field: info.label, reason: info.reason });
  }

  // Custom widgets (e.g. Greenhouse's React-Select comboboxes) render a tiny <input> inside a
  // large clickable control. Cover the whole control, not just the input: climb ancestors that
  // contain no other form fields and stay control-sized.
  const groupMarkers = new Map();
  function groupMembers(el) {
    if (!(el.type === 'radio' || el.type === 'checkbox') || !el.name) return [el];
    const scope = el.form || document;
    return Array.from(scope.querySelectorAll('input')).filter(f => f.type === el.type && f.name === el.name);
  }
  function groupKey(el) { const m = groupMembers(el); return m.length > 1 ? el.type + ':' + el.name : null; }

  function coverTarget(el) {
    const members = groupMembers(el);
    if (members.length > 1) {
      // Lowest ancestor that contains every option in the group.
      let a = el.parentElement;
      while (a && !members.every(m => a.contains(m))) a = a.parentElement;
      return a || el;
    }
    const r0 = el.getBoundingClientRect();
    const custom = el.getAttribute('role') === 'combobox' || (r0.width > 0 && r0.width < 24 && el.type !== 'radio' && el.type !== 'checkbox');
    if (!custom) return el;
    let best = el, a = el.parentElement;
    for (let i = 0; a && i < 6; i++, a = a.parentElement) {
      const others = Array.from(a.querySelectorAll(FIELD_SELECTOR)).some(f => f !== el && f.type !== 'hidden');
      if (others) break;
      const r = a.getBoundingClientRect();
      if (r.height > 90) break;
      if (r.width >= best.getBoundingClientRect().width) best = a;
    }
    return best;
  }

  let layer = null;
  function ensureLayer() {
    if (layer && layer.isConnected) return layer;
    layer = document.createElement('div');
    layer.setAttribute(HNS_ATTR, 'layer');
    layer.style.cssText = 'position:absolute;top:0;left:0;width:0;height:0;z-index:2147483646;';
    document.documentElement.appendChild(layer);
    return layer;
  }
  function makeMarker(el, info) {
    const m = document.createElement('div');
    m.setAttribute(HNS_ATTR, 'lock');
    m.setAttribute('role', 'note');
    m.textContent = (el.type === 'radio' || el.type === 'checkbox') ? '🔒 You fill' : '🔒 You fill this one';
    m.title = 'Hide & Sneak locked this ' + info.label + ' field while Agent Mode is on.';
    m.style.cssText = 'position:absolute;display:flex;align-items:center;gap:6px;box-sizing:border-box;padding:0 10px;' +
      'font:600 12px/1.2 system-ui,sans-serif;color:#5a3d00;background:repeating-linear-gradient(135deg,#fff4d6,#fff4d6 8px,#ffeab0 8px,#ffeab0 16px);' +
      'border:1.5px solid #c98a00;border-radius:6px;cursor:not-allowed;overflow:hidden;white-space:nowrap;';
    const stop = (e) => { e.preventDefault(); e.stopPropagation(); };
    ['mousedown', 'click', 'dblclick', 'pointerdown', 'touchstart', 'focus'].forEach(t => m.addEventListener(t, stop, true));
    ensureLayer().appendChild(m);
    return m;
  }
  function positionMarkers() {
    for (const [el, st] of locked) {
      if (!el.isConnected) { st.marker.remove(); locked.delete(el); continue; }
      let r = (st.cover && st.cover.isConnected ? st.cover : el).getBoundingClientRect();
      const tiny = el.type === 'radio' || el.type === 'checkbox';
      if (tiny && st.cover === el) {
        // A lone checkbox/radio: cover the input plus its own label.
        const lab = el.closest('label') || (el.labels && el.labels[0]);
        if (lab) { const lr = lab.getBoundingClientRect(); r = { left: Math.min(r.left, lr.left), top: Math.min(r.top, lr.top), right: Math.max(r.right, lr.right), bottom: Math.max(r.bottom, lr.bottom) }; }
        r = { left: r.left, top: r.top, width: Math.max(r.right - r.left, 110), height: Math.max(r.bottom - r.top, 22) };
      }
      const txt = r.width >= 150 ? '🔒 You fill this one' : '🔒 You fill';
      if (st.marker.textContent !== txt) st.marker.textContent = txt;
      Object.assign(st.marker.style, {
        display: r.width || r.height ? 'flex' : 'none',
        left: (r.left + scrollX) + 'px', top: (r.top + scrollY) + 'px',
        width: r.width + 'px', height: r.height + 'px',
      });
    }
  }
  let posQueued = false;
  function queuePosition() { if (posQueued) return; posQueued = true; requestAnimationFrame(() => { posQueued = false; positionMarkers(); }); }

  // Anything that writes into a locked field (typing, scripts) gets cleared and logged.
  function enforceLocks() {
    for (const [el, st] of locked) {
      if (!el.isConnected) continue;
      if (clearField(el)) log({ effect: 'lock-bypass-cleared', pack: st.info.pack, field: st.info.label });
      if (st.kind === 'readonly' && !el.readOnly) el.readOnly = true;
      if (st.kind === 'disabled' && !el.disabled) el.disabled = true;
    }
  }

  function unlockAll() {
    for (const [el, st] of locked) {
      el.readOnly = st.prev.readOnly; el.disabled = st.prev.disabled;
      if (st.prev.tabIndex == null) el.removeAttribute('tabindex'); else el.setAttribute('tabindex', st.prev.tabIndex);
      if (st.prev.ariaLabel == null) el.removeAttribute('aria-label'); else el.setAttribute('aria-label', st.prev.ariaLabel);
      st.marker.remove();
      ['input', 'change', 'paste', 'drop'].forEach(t => el.removeEventListener(t, st.onWrite, true));
    }
    locked.clear();
  }

  // ---------- 4. protected pages ----------
  function pageProtected(url) { return (settings.pageRules || []).some(p => D.urlMatches(p, url)); }
  function showBlockedPage(message) {
    try { window.stop(); } catch (_) {}
    const html = '<head><meta charset="utf-8"><title>Protected page</title></head><body ' + HNS_ATTR + '="page" style="margin:0;font:16px/1.5 system-ui,sans-serif;background:#faf7f0;color:#222;display:flex;min-height:100vh;align-items:center;justify-content:center">' +
      '<div style="max-width:460px;padding:32px;text-align:center"><div style="font-size:40px">🔒</div><h1 style="font-size:22px;margin:8px 0">This page is protected</h1>' +
      '<p>' + message + '</p><p style="color:#666;font-size:14px">Hide &amp; Sneak</p></div></body>';
    document.documentElement.innerHTML = html;
    revealPage();
  }
  let lastUrl = location.href;
  function checkRoute() {
    if (location.href === lastUrl) return;
    lastUrl = location.href;
    if (pageProtected(lastUrl)) { log({ effect: 'page-blocked' }); totalProtected++; flush(); showBlockedPage('This page is off-limits to your AI agent while Agent Mode is on. Turn off Agent Mode to view it.'); }
  }

  // ---------- 5. banner ----------
  let banner = null;
  function updateBanner(offMessage) {
    if (window.top !== window) return;       // one banner per tab
    if (!document.body) return;
    if (!banner || !banner.isConnected) {
      banner = document.createElement('div');
      banner.setAttribute(HNS_ATTR, 'banner');
      banner.setAttribute('role', 'status');
      banner.style.cssText = 'position:fixed;left:50%;bottom:12px;transform:translateX(-50%);z-index:2147483647;' +
        'font:600 12px/1.3 system-ui,sans-serif;padding:6px 12px;border-radius:999px;box-shadow:0 2px 8px rgba(0,0,0,.2);pointer-events:none;';
      document.documentElement.appendChild(banner);
    }
    if (offMessage) { banner.style.background = '#e8f5e9'; banner.style.color = '#1b5e20'; banner.textContent = offMessage; setTimeout(() => banner && banner.remove(), 6000); return; }
    banner.style.background = '#c62828'; banner.style.color = '#fff';
    banner.textContent = '🛡 Hide & Sneak is on: sensitive info is hidden' + (totalProtected ? ` (${totalProtected} protected)` : '');
  }

  // ---------- observer ----------
  const queue = new Set();
  let scheduled = false;
  function schedule(n) {
    queue.add(n);
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      const items = Array.from(queue); queue.clear();
      for (const it of items) if (it.isConnected !== false) processTree(it);
      queuePosition();
    });
  }
  const OBSERVE_OPTS = { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: REDACT_ATTRS.concat(['href']) };
  const observedRoots = new WeakSet();
  // A3: the document observer can't see inside shadow roots, so watch each one we find.
  function observeShadow(root) {
    if (!observer || observedRoots.has(root)) return;
    observedRoots.add(root);
    observer.observe(root, OBSERVE_OPTS);
  }

  function startObserver() {
    observer = new MutationObserver((muts) => {
      if (!active) return;
      for (const m of muts) {
        if (m.type === 'childList') m.addedNodes.forEach(schedule);
        else if (m.type === 'characterData') schedule(m.target);
        else if (m.type === 'attributes' && m.target.nodeType === 1 && !isOurs(m.target)) redactAttrs(m.target);
      }
    });
    observer.observe(document.documentElement, OBSERVE_OPTS);
  }

  // ---------- lifecycle ----------
  function firstPass() {
    try {
      processTree(document.body || document.documentElement);
      // A1: the tab title (e.g. Gmail shows the open email's subject). Agents read tab titles.
      const t = document.querySelector('title');
      if (t) processTree(t);
    } catch (e) { failClosed(); return; }
    positionMarkers();
    revealPage();
    updateBanner();
    flush();
  }

  async function start() {
    const store = await chrome.storage.local.get('settings');
    settings = Object.assign({ agentMode: false, packs: {}, pageRules: [], keywords: [], siteOff: [] }, store.settings || {});
    sessionId = settings.sessionId || null;
    if (!settings.agentMode || (settings.siteOff || []).includes(location.hostname)) { revealPage(); active = false; return; }
    extraRules = D.keywordRules(settings.keywords);
    if (pageProtected(location.href)) {
      log({ effect: 'page-blocked' }); totalProtected++; flush();
      const block = () => showBlockedPage('This page is off-limits to your AI agent while Agent Mode is on. Turn off Agent Mode to view it.');
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', block, { once: true }); else block();
      return;
    }
    startObserver();
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', firstPass, { once: true });
    else firstPass();
    setInterval(() => { if (active) { enforceLocks(); checkRoute(); } }, 400);
    // Sweep locked fields right before any form submits, so a script write can't slip through.
    addEventListener('submit', () => { if (active) enforceLocks(); }, true);
    addEventListener('formdata', (e) => { if (!active) return; for (const [el] of locked) if (el.name && e.formData.has(el.name)) e.formData.delete(el.name); }, true);
    addEventListener('scroll', queuePosition, true);
    addEventListener('resize', queuePosition);
    setInterval(queuePosition, 1000);   // catch layout shifts
  }

  chrome.storage.onChanged.addListener((changes) => {
    if (!changes.settings) return;
    const next = changes.settings.newValue || {};
    if (active && !next.agentMode) {
      active = false;
      if (observer) observer.disconnect();
      unlockAll();
      revealPage();
      updateBanner('Agent Mode off: fields unlocked. Reload the page to see hidden text.');
    }
  });

  start().catch(failClosed);
})();
