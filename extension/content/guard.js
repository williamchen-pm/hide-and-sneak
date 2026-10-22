/* Hide & Sneak: write guard (runs in the page's own JavaScript world).
 * Locked fields are read-only, and the main engine clears anything written into them within
 * ~400 ms. That still left a short window where a script write (e.g. an agent's form_input or
 * javascript_tool, which run as page scripts) could sit in the field. This closes it: while a
 * field carries data-hns-locked, setting its value / checked / selected does nothing.
 * It only affects fields Hide & Sneak has locked; every other field works normally.
 */
(function () {
  'use strict';
  if (window.__hnsGuard) return;
  Object.defineProperty(window, '__hnsGuard', { value: true });
  const ATTR = 'data-hns-locked';
  const lockedTarget = (el) => {
    if (!el || !el.hasAttribute) return false;
    if (el.hasAttribute(ATTR)) return true;
    // <option selected> belongs to its <select>
    const sel = el.tagName === 'OPTION' && el.closest && el.closest('select');
    return !!(sel && sel.hasAttribute(ATTR));
  };
  const blocked = (el) => { try { el.dispatchEvent(new CustomEvent('hns-blocked-write')); } catch (_) {} };
  function hook(proto, prop) {
    const d = proto && Object.getOwnPropertyDescriptor(proto, prop);
    if (!d || !d.set || !d.configurable) return;
    Object.defineProperty(proto, prop, {
      configurable: true, enumerable: d.enumerable, get: d.get,
      set(v) { if (lockedTarget(this)) { blocked(this); return; } return d.set.call(this, v); },
    });
  }
  hook(HTMLInputElement.prototype, 'value');
  hook(HTMLInputElement.prototype, 'checked');
  hook(HTMLInputElement.prototype, 'valueAsNumber');
  hook(HTMLInputElement.prototype, 'valueAsDate');
  hook(HTMLTextAreaElement.prototype, 'value');
  hook(HTMLSelectElement.prototype, 'value');
  hook(HTMLSelectElement.prototype, 'selectedIndex');
  hook(HTMLOptionElement.prototype, 'selected');
  // setAttribute('value' | 'checked' | 'selected') on a locked field
  const setAttr = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (name, value) {
    if (/^(?:value|checked|selected)$/i.test(String(name)) && lockedTarget(this)) { blocked(this); return; }
    return setAttr.call(this, name, value);
  };
  // setRangeText writes text without going through the value setter
  for (const P of [HTMLInputElement.prototype, HTMLTextAreaElement.prototype]) {
    const orig = P.setRangeText;
    if (typeof orig === 'function') P.setRangeText = function () { if (lockedTarget(this)) { blocked(this); return; } return orig.apply(this, arguments); };
  }
})();
