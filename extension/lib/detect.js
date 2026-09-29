/*
 * Hide & Sneak: detection core.
 * Pure functions, no DOM access. Loaded as a classic script in the extension
 * (exposes globalThis.HNSDetect) and via require() in Node tests.
 */
(function (root) {
  'use strict';

  // ---------- checksums ----------
  function luhnValid(digits) {
    let sum = 0, dbl = false;
    for (let i = digits.length - 1; i >= 0; i--) {
      let d = digits.charCodeAt(i) - 48;
      if (dbl) { d *= 2; if (d > 9) d -= 9; }
      sum += d; dbl = !dbl;
    }
    return digits.length > 0 && sum % 10 === 0;
  }

  function abaValid(d) {
    if (!/^\d{9}$/.test(d)) return false;
    const n = d.split('').map(Number);
    const s = 3 * (n[0] + n[3] + n[6]) + 7 * (n[1] + n[4] + n[7]) + (n[2] + n[5] + n[8]);
    return s % 10 === 0 && s > 0;
  }

  const onlyDigits = (s) => s.replace(/\D/g, '');

  // ---------- pattern rules ----------
  // Each rule: { id, pack, token, re (global, with `d` flag), group (capture group to redact; 0 = whole), check(value) }
  const RULES = [
    // Identity
    { id: 'ssn-formatted', pack: 'identity', token: '[SSN]', group: 1,
      re: /(?<![\d-])((?!000|666|9\d\d)\d{3}[- ](?!00)\d{2}[- ](?!0000)\d{4})(?![\d-])/dg },
    { id: 'ssn-keyword', pack: 'identity', token: '[SSN]', group: 1,
      re: /(?:\bSSN\b|social\s+security(?:\s+(?:number|no\.?|#))?|\bTIN\b|\bITIN\b)[\s:#.\-]{0,12}((?!000|666|9\d\d)\d{3}-?\d{2}-?\d{4})(?!\d)/dgi },
    { id: 'dob-keyword', pack: 'identity', token: '[DATE OF BIRTH]', group: 1,
      re: /(?:date\s+of\s+birth|\bDOB\b|\bborn(?:\s+on)?\b|birth\s*date|birthday)[\s:.\-]{0,12}((?:\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4})|(?:\d{4}-\d{2}-\d{2})|(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}))/dgi },
    { id: 'passport-keyword', pack: 'identity', token: '[ID NUMBER]', group: 1,
      re: /(?:passport|driver'?s?\s+licen[cs]e|\bDL\b)(?:\s+(?:number|no\.?|#))?[\s:#.\-]{0,12}([A-Z0-9]{6,12})\b/dgi,
      check: (v) => /\d/.test(v) },

    // Payments
    { id: 'card', pack: 'payments', token: '[CARD #]', group: 1,
      re: /(?<![\d-])([2-6]\d{3}(?:[ -]?\d{3,4}){2,4}(?:[ -]?\d{1,3})?)(?![\d-])/dg,
      check: (v) => { const d = onlyDigits(v); return d.length >= 13 && d.length <= 19 && luhnValid(d); } },
    { id: 'card-amex', pack: 'payments', token: '[CARD #]', group: 1,
      re: /(?<![\d-])(3[47]\d{2}[ -]?\d{6}[ -]?\d{5})(?![\d-])/dg,
      check: (v) => luhnValid(onlyDigits(v)) },
    { id: 'cvv-keyword', pack: 'payments', token: '[CVV]', group: 1,
      re: /(?:\bCVV2?\b|\bCVC2?\b|\bCID\b|security\s+code)[\s:#.\-]{0,8}(\d{3,4})(?!\d)/dgi },
    { id: 'routing-keyword', pack: 'payments', token: '[ROUTING #]', group: 1,
      re: /(?:routing(?:\s+(?:number|no\.?|#))?|\bABA\b|\bRTN\b)[\s:#.\-]{0,12}(\d{9})(?!\d)/dgi,
      check: abaValid },
    { id: 'account-keyword', pack: 'payments', token: '[ACCOUNT #]', group: 1,
      re: /(?:\baccount|\bacct)\.?(?:\s+(?:number|no\.?|#))?[\s:#.\-]{0,12}((?:\d[ -]?){5,16}\d)(?![\d])/dgi },
    { id: 'iban', pack: 'payments', token: '[ACCOUNT #]', group: 1,
      re: /\b([A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){3,7}(?: ?[A-Z0-9]{1,3})?)\b/dg },

    // Credentials
    { id: 'otp-before', pack: 'credentials', token: '[2FA CODE]', group: 1,
      re: /(?:(?:verification|security|login|log[- ]in|sign[- ]?in|one[- ]time|confirmation|access|auth(?:entication)?|2FA|MFA)\s+(?:code|passcode|PIN)|\bOTP\b|\bpasscode\b|\byour\s+code)(?:\s+is)?[\s:#]{0,6}(\d{4,8}|\d{3}[ -]\d{3})(?!\d)/dgi },
    { id: 'otp-after', pack: 'credentials', token: '[2FA CODE]', group: 1,
      re: /(?<!\d)(\d{4,8}|\d{3}[ -]\d{3})\s+is\s+your\s+(?:[\w-]+\s+){0,3}(?:code|passcode|OTP|PIN)\b/dgi },

    // Contact (off by default)
    { id: 'phone-us', pack: 'contact', token: '[PHONE]', group: 1,
      re: /(?<![\d-])((?:\+?1[ .-]?)?(?:\(\d{3}\)\s?|\d{3}[ .-])\d{3}[ .-]\d{4})(?![\d-])/dg },
    { id: 'street-address', pack: 'contact', token: '[ADDRESS]', group: 1,
      re: /\b(\d{1,6}\s+(?:[NSEW]\.?\s+)?(?:[A-Z][a-zA-Z]+\s+){1,4}(?:St|Street|Ave|Avenue|Rd|Road|Dr|Drive|Blvd|Boulevard|Ln|Lane|Way|Ct|Court|Pl|Place|Ter|Terrace|Cir|Circle|Pkwy|Parkway|Hwy|Highway)\.?(?:,?\s+(?:Apt|Unit|Suite|Ste|#)\.?\s*[A-Za-z0-9-]+)?)\b/dg },

    // Job applications
    { id: 'salary-keyword', pack: 'job', token: '[SALARY]', group: 1,
      re: /(?:salary|compensation|base\s+pay|pay\s+(?:rate|expectation)s?|desired\s+pay|wage|annual\s+pay)[^.\n]{0,40}?(\$\s?\d[\d,]*(?:\.\d{2})?\s*(?:k|K)?(?:\s*(?:-|to|–)\s*\$?\s?\d[\d,]*(?:\.\d{2})?\s*(?:k|K)?)?)/dgi },
  ];

  const DEFAULT_PACKS = { identity: true, payments: true, credentials: true, contact: false, job: true };

  function enabledRules(packs, extraRules) {
    const p = Object.assign({}, DEFAULT_PACKS, packs || {});
    return RULES.filter(r => p[r.pack]).concat(extraRules || []);
  }

  /** Find non-overlapping matches. Returns [{start, end, token, ruleId, pack}] sorted by start. */
  function findMatches(text, packs, extraRules) {
    if (!text || text.length < 3 || !/\d/.test(text) && !(extraRules && extraRules.length)) return [];
    const hits = [];
    for (const r of enabledRules(packs, extraRules)) {
      r.re.lastIndex = 0;
      let m;
      while ((m = r.re.exec(text)) !== null) {
        if (m[0].length === 0) { r.re.lastIndex++; continue; }
        const g = r.group || 0;
        const value = m[g];
        if (value == null) continue;
        if (r.check && !r.check(value)) continue;
        const [start, end] = m.indices[g];
        hits.push({ start, end, token: r.token, ruleId: r.id, pack: r.pack });
      }
    }
    hits.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
    const out = [];
    let lastEnd = -1;
    for (const h of hits) { if (h.start >= lastEnd) { out.push(h); lastEnd = h.end; } }
    return out;
  }

  /** Replace matches with tokens. Returns { text, hits }. */
  function redactText(text, packs, extraRules) {
    const hits = findMatches(text, packs, extraRules);
    if (!hits.length) return { text, hits };
    let out = '', i = 0;
    for (const h of hits) { out += text.slice(i, h.start) + h.token; i = h.end; }
    return { text: out + text.slice(i), hits };
  }

  /** Build keyword rules from user phrases (case-insensitive, whole-phrase). */
  function keywordRules(phrases) {
    return (phrases || []).filter(Boolean).map((p, i) => ({
      id: 'keyword-' + i, pack: 'keyword', token: '[PROTECTED]', group: 0,
      re: new RegExp('\\b' + p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'dgi'),
    }));
  }

  // ---------- context-aware matching (value and its label live in different elements) ----------
  // Real emails often split "Enter this code:" and "826774" into separate blocks, so the
  // single-text-node patterns above never see both. These rules look at a standalone value
  // plus the text that precedes it on the page.
  const CONTEXT_RULES = [
    // Backup / recovery codes: usually a list (table or bullets) of mixed letters and digits under
    // a "Backup codes" heading. `list: true` lets earlier codes we've already hidden stay part of
    // the context, so every code in the list gets matched, not just the first.
    { id: 'backup-codes', pack: 'credentials', token: '[BACKUP CODE]', list: true,
      value: /^(?=[^\s]*\d)[A-Za-z0-9]{4,}(?:[- ][A-Za-z0-9]{3,}){0,3}$/,
      context: /\b(?:backup|recovery|scratch|emergency|one[- ]time)\s+(?:codes?|keys?)\b/i },
    { id: 'otp-context', pack: 'credentials', token: '[2FA CODE]',
      value: /^(?:\d{4,8}|\d{3}[ -]\d{3})$/,
      context: /\b(?:code|passcode|OTP|PIN|verification|verify|one[- ]time|log[- ]?in|sign[- ]?in|2FA|MFA|authenticat\w*)\b[^.]{0,120}$/i },
    { id: 'ssn-context', pack: 'identity', token: '[SSN]',
      value: /^(?!000|666|9\d\d)\d{3}-?\d{2}-?\d{4}$/,
      context: /(?:\bSSN\b|social\s+security(?:\s+(?:number|no\.?|#))?|\bTIN\b)[\s:#.\-]{0,20}$/i },
    { id: 'routing-context', pack: 'payments', token: '[ROUTING #]', check: (v) => abaValid(v),
      value: /^\d{9}$/,
      context: /(?:routing(?:\s+(?:number|no\.?|#))?|\bABA\b|\bRTN\b)[\s:#.\-]{0,20}$/i },
    { id: 'account-context', pack: 'payments', token: '[ACCOUNT #]',
      value: /^(?:\d[ -]?){5,16}\d$/,
      context: /(?:\baccount|\bacct)\.?(?:\s+(?:number|no\.?|#))?[\s:#.\-]{0,20}$/i },
  ];

  /**
   * value: the full (trimmed) text of a standalone text node.
   * precedingText: up to ~200 chars of page text just before it.
   * Returns { token, ruleId, pack } or null.
   */
  function contextMatch(value, precedingText, packs) {
    const p = Object.assign({}, DEFAULT_PACKS, packs || {});
    const v = (value || '').trim();
    if (!v || v.length > 24) return null;
    const raw = (precedingText || '').replace(/\s+/g, ' ');
    // Normally only the text after the last placeholder we inserted counts as context for this value.
    const ctxSingle = raw.split(/\[[A-Z0-9 #]+\]/).pop().trim().slice(-200);
    for (const r of CONTEXT_RULES) {
      if (!p[r.pack] || v.length < 6 && r.list || !r.value.test(v)) continue;
      // List rules look past earlier items of the same list (already replaced with this rule's token).
      const ctx = r.list ? raw.split(r.token).join(' ').split(/\[[A-Z0-9 #]+\]/).pop().replace(/\s+/g, ' ').trim().slice(-200) : ctxSingle;
      if (r.check && !r.check(v.replace(/\D/g, ''))) continue;
      if (r.context.test(ctx)) return { token: r.token, ruleId: r.id, pack: r.pack };
    }
    return null;
  }

  // ---------- form field classification ----------
  const FIELD_AUTOCOMPLETE = {
    'cc-number': 'payments', 'cc-csc': 'payments', 'cc-exp': 'payments', 'cc-exp-month': 'payments', 'cc-exp-year': 'payments',
    'current-password': 'credentials', 'new-password': 'credentials', 'one-time-code': 'credentials',
    'bday': 'identity', 'bday-day': 'identity', 'bday-month': 'identity', 'bday-year': 'identity',
  };
  const FIELD_TEXT_RULES = [
    { pack: 'credentials', label: 'password or code', re: /\bpass(?:word|code|phrase)\b|\bOTP\b|one[- ]time\s+(?:code|password)|verification\s+code|2fa|two[- ]factor|\bmfa\b/i },
    { pack: 'payments', label: 'payment card', re: /card\s*(?:number|no\b|#)|credit\s*card|debit\s*card|\bcvv2?\b|\bcvc\b|security\s+code|expir(?:y|ation)\s+date/i },
    { pack: 'payments', label: 'bank account', re: /routing\s*(?:number|no\b|#)?|bank\s+account|account\s*(?:number|no\b|#)|\biban\b|\bswift\b|\bbic\b/i },
    { pack: 'identity', label: 'SSN or tax ID', re: /social\s+security|\bssn\b|\btin\b|\bitin\b|tax(?:payer)?\s+id/i },
    { pack: 'identity', label: 'date of birth', re: /date\s+of\s+birth|\bdob\b|birth\s*date|birthday/i },
    { pack: 'identity', label: 'government ID', re: /passport|driver'?s?\s+licen[cs]e|national\s+id|government[- ]issued\s+id/i },
    { pack: 'job', label: 'demographic question', re: /\bgender\b|\bsex\b|\brace\b|ethnicit|hispanic|latin[oax]|veteran|disabilit|sexual\s+orientation|transgender|self[- ]identif|\beeo\b|equal\s+employment/i },
    { pack: 'job', label: 'salary question', re: /salary|compensation|pay\s+(?:expectation|requirement|rate)|desired\s+pay|expected\s+pay|current\s+pay|\bwage/i },
    { pack: 'job', label: 'background check consent', re: /background\s+check|criminal\s+(?:history|record|background)|\bconvicted\b|consumer\s+report/i },
    { pack: 'job', label: 'legal attestation', re: /\bi\s+(?:hereby\s+)?(?:certify|attest|acknowledge|affirm|agree)|electronic\s+signature|e-?signature|type\s+your\s+(?:full\s+)?name\s+to\s+sign|arbitrat/i },
  ];

  /**
   * Classify a form field from its metadata.
   * meta: { type, autocomplete, name, id, labelText }
   * Returns { pack, label, reason } or null.
   */
  function classifyField(meta, packs) {
    const p = Object.assign({}, DEFAULT_PACKS, packs || {});
    const type = (meta.type || '').toLowerCase();
    if (type === 'hidden' || type === 'submit' || type === 'button' || type === 'image' || type === 'reset') return null;
    if (type === 'password' && p.credentials) return { pack: 'credentials', label: 'password', reason: 'type=password' };
    const ac = (meta.autocomplete || '').toLowerCase().split(/\s+/).pop();
    if (ac && FIELD_AUTOCOMPLETE[ac] && p[FIELD_AUTOCOMPLETE[ac]]) {
      return { pack: FIELD_AUTOCOMPLETE[ac], label: ac, reason: 'autocomplete=' + ac };
    }
    const nameish = [meta.name, meta.id].filter(Boolean).join(' ').replace(/[_\-.\[\]]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
    for (const src of [['label', meta.labelText || ''], ['name/id', nameish]]) {
      for (const r of FIELD_TEXT_RULES) {
        if (p[r.pack] && r.re.test(src[1])) return { pack: r.pack, label: r.label, reason: src[0] + ' matches "' + r.label + '"' };
      }
    }
    return null;
  }

  // ---------- URL pattern matching for page rules ----------
  /** Match a URL against a pattern like "https://www.amazon.com/cpe/yourpayments/*" or "*://bank.com/statements*". */
  function urlMatches(pattern, url) {
    if (!pattern) return false;
    const esc = pattern.trim().replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    return new RegExp('^' + esc + '$', 'i').test(url);
  }

  const api = { luhnValid, abaValid, findMatches, redactText, contextMatch, keywordRules, classifyField, urlMatches, RULES, DEFAULT_PACKS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.HNSDetect = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
