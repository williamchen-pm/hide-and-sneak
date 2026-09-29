# Hide & Sneak: Spec

*Tagline: "Let browser AI agents see only what they need."*
*Owner: William Chen · Status: Draft v4.3 (updated to match v0 build) · Last updated: 2026-09-29*
*Build status and decisions are tracked in [`DESIGN.md`](DESIGN.md).*

---

## 1. Problem

Browser AI agents like Claude in Chrome read and act on whatever page is open. People use them for everyday chores: filling out forms and job applications, shopping, research, email, calendars, dashboards, and file organization. The same access means the agent can also see, or type into, things the user never meant to share: card numbers, SSNs, salary history, demographic questions, account balances, 2FA codes, and hidden instructions planted on untrusted pages.

The built-in controls work at the **site** level (allow or block a whole domain). Nothing works below that for an individual:

- "Fill out this job application, but leave the salary and demographic questions to me."
- "Shop on Amazon, but stay out of my saved payment methods."
- "Use my bank's site to download a statement, but don't show you my balances."
- "Triage my inbox, but skip anything from my doctor."

Anthropic's own safety guidance advises against using the agent for financial transactions, sensitive accounts, legal documents, and medical information. People do these things anyway, which is the gap this project addresses.

## 2. Goal

Build an open-source Chrome extension that controls what a browser agent can **see** and **fill in** on pages it's allowed to use. It rewrites sensitive content and locks sensitive fields before the agent interacts with the page, and it logs what it protected.

**Free and open source (MIT license).** No paid tier, no accounts, no data collection. It's distributed through the Chrome Web Store and GitHub. The bar is **usable every day by a non-technical person**, not just a demo.

**Positioning:** This is a free, open-source protection layer for **individuals** who hand everyday tasks to a browser agent. It isn't a new category, and the README shouldn't claim it is.

### 2.1 Prior art (checked 2026-09-29)

| Tool | What it does | How Hide & Sneak differs |
|---|---|---|
| **PixieBrix Agent Browser Shield** (Chrome Web Store; launched June 2026) — closest match | Cleans pages for AI agents before the model sees them: PII masking, prompt-injection stripping, dark-pattern and page-clutter removal. Aimed at developers running agent frameworks (browser-use, Browserbase). License: PolyForm Shield 1.0.0, source-available, and it prohibits use to build competing products. | Built for an individual using Claude in Chrome: on/off toggle, protection packs, onboarding, self-test. Covers the **write side** (field locks for job applications and checkout) and **page rules** for sensitive pages. Adds an audit log and a published threat model. MIT licensed. |
| **Enterprise AI DLP** (LayerX, Nightfall, Prompt Security, Harmonic; Microsoft Edge for Business Agent Mode DLP; Chrome Auto Browse DLP) | Organization-wide data controls sold to security teams | For individuals, free, no admin console |
| **Blur-for-privacy extensions** (e.g., Blindrs) | Blur sensitive data for screen sharing | Blurring is visual only. The text stays on the page, and an agent reading page text or running JavaScript still gets it. Hide & Sneak replaces the text. |

### 2.2 Positioning

**One line:** Agent Browser Shield protects the agent from the web. Hide & Sneak protects you from the agent. (A simplification: their PII masking protects users too. The difference is who the tool is built around.)

| | Agent Browser Shield | Hide & Sneak |
|---|---|---|
| Question it answers | How do I make pages safe and efficient for an agent? | How do I decide what an agent sees and does for me? |
| Built for | Developers running agent frameworks at scale | An individual delegating personal tasks to Claude in Chrome |
| Measures success by | Tokens saved, task success rate | Nothing sensitive seen or filled that the user didn't allow |

**Differentiators, strongest first**

1. **Write-side control:** field locks for job applications, checkout, and other forms. Agent Browser Shield doesn't limit what the agent can fill in.
2. **Personal policy, not generic detection:** "my doctor's emails," "my statements page," "the salary question," on top of standard PII patterns.
3. **Verifiable:** self-test page, audit log, and a published threat model.
4. **Usable by non-developers:** on/off toggle, protection packs, two-minute setup. This follows from the target user; don't lead with it, since it's the easiest gap for a competitor to close.
5. **MIT license:** open source without a no-competitors clause.

**The two can run together.** Theirs cleans the page; Hide & Sneak enforces the user's own rules. The README says so.

### 2.3 Comparison test (before claiming any difference publicly)

Only their GitHub page and launch post have been reviewed; the tool itself hasn't been tested. Before publishing any comparison:

1. Install Agent Browser Shield from the Chrome Web Store in a separate Chrome profile.
2. Run Claude in Chrome on the same three demo pages (job application, checkout, inbox) with: no protection, Agent Browser Shield only, Hide & Sneak only, and both.
3. For each seeded item, record whether the agent saw it, filled it, or neither.
4. Record setup time from install to first protected page for each tool.
5. Publish the results table in `docs/COMPARISON.md` with the date and both tools' versions. State plainly where theirs does better.
6. README wording: "Use Agent Browser Shield if you run agent frameworks; use Hide & Sneak if you delegate personal tasks. They work together."

**Clean-room rule:** don't copy code from Agent Browser Shield. Its license prohibits use in competing products. Build independently, and cite it in the README as related work.

## 3. Target user

A single person who delegates everyday web tasks to a browser agent, on a personal machine, without an enterprise security stack.

## 4. Existing controls this builds on (verified 2026-09-29)

| Control | What it does | Gap this project fills |
|---|---|---|
| Claude in Chrome site approvals (approve once / always allow / decline; "Your approved sites") | Decides whether Claude can act on a site | Site-level only |
| Claude in Chrome permission modes (manual, auto with safety checks, skip approvals) | Decides how often Claude pauses for approval | Doesn't limit what Claude reads or fills between approvals |
| Org allowlists and blocklists (Team/Enterprise admins only) | Blocks domains org-wide | Not available to individuals; domain-level only |
| Chrome `ExtensionSettings` → `runtime_blocked_hosts` | Blocks an extension from hosts | Starting in Chrome 155 (stable 2026-10-06), this makes `chrome.debugger.attach()` fail on **every** site. It can't be used to fence off specific sites for an agent that uses the debugger API. See R1. |

For whole-site blocking, v1 points users to Claude in Chrome's own site controls.

## 5. Use cases

Organized by the tasks people actually delegate. "Read" means what the agent sees. "Write" means what it can fill in or do.

### v1

| # | Task | What the user wants | Protection | Type |
|---|---|---|---|---|
| UC1 | **Forms and job applications** | Agent fills work history, contact info, and free-text answers. The user answers demographic questions (race, gender, veteran, disability), salary expectations and history, SSN, date of birth, background-check consent, and legal attestations. | **Field rules:** matching fields are locked and marked "🔒 Protected by Hide & Sneak" (or "🔒 Protected" / 🔒 on narrow fields). The agent fills everything else. | Write |
| UC2 | **Shopping and checkout** | Agent finds products, compares prices, and fills shipping. It never sees or enters card numbers, CVV, or bank details, and never sees the saved-payments page. | **Field rules** (payment preset) + **page rules** (saved-payment pages) + **pattern redaction** (card numbers shown as text) | Read + Write |
| UC3 | **Account portals** (bank, brokerage, benefits, HR, health, insurance) | Agent can navigate, find documents, or check status, but specific pages (statements, pay stubs, claims, medical records) are off-limits. | **Page rules** by URL pattern | Read |
| UC4 | **Anything containing personal identifiers** (email, docs, CRM, dashboards, confirmations) | Agent can read and work with the page, but SSNs, card, account, and routing numbers, phone, address, and 2FA codes appear as placeholders. | **Pattern redaction** on any page, grouped into protection packs | Read |
| UC5 | **Email triage** | Threads from flagged senders or labels (bank, doctor, lawyer) are hidden completely. | **Gmail adapter:** sender and label rules | Read |
| UC6 | **Reviewing what was protected** | After a session, see what was redacted, locked, or blocked, where, and when. | **Audit log** (never stores original values) | — |

### v2

| # | Task | Protection | Type |
|---|---|---|---|
| UC7 | **Research on untrusted sites, and reading untrusted email** | **Prompt-injection flagging** on any page: hidden text (white-on-white, tiny or zero-size fonts, off-screen), zero-width characters, and instruction-style phrasing aimed at the agent. Stripped or flagged, with a visible banner. | Read |
| UC8 | **Hiding one part of a page** (the balance panel on a bank dashboard, the salary card on an HR portal) | **Section rules** created with a point-and-click picker | Read |
| UC9 | **Session dashboard** | Charts of protections per session, top rules, injection attempts, and documented misses | — |

### v3

| # | Task | Protection | Type |
|---|---|---|---|
| UC10 | **Guarding irreversible actions** ("Place order," "Submit application," "Transfer," "Send," "Delete") | **Action rules:** matching buttons are disabled and overlaid while Agent Mode is on. Partial protection only (see §8). | Write |

## 6. Components

### 6.1 Protection engine (content scripts, all sites)

- Registered on `<all_urls>` at `document_start`. When Agent Mode is **off**, the script exits immediately and does nothing. When it's **on**, it applies the rules for the current URL.
- **Pre-render hide:** while rules are evaluated, the page is hidden with a `document_start` style, so no frame shows original content (R7).
- A `MutationObserver` catches content that loads dynamically. Only added or changed nodes are processed.
- **Text redaction:** walks text nodes and replaces matches with typed tokens (`[SSN]`, `[CARD #]`, `[ACCOUNT #]`, `[ROUTING #]`, `[PHONE]`, `[ADDRESS]`, `[2FA CODE]`, `[PROTECTED]`). It also redacts `title`, `aria-label`, `alt`, and `data-tooltip` attributes, since the accessibility tree reads them.
- **Text is replaced, never hidden with CSS.** Screenshots, page text, accessibility-tree reads, and JavaScript reads of the DOM all get the redacted version.
- **Original values are never stored** on the page, in the DOM, or in the log. To see real content, the user turns Agent Mode off and the page reloads.
- A **per-site off switch** handles sites the engine breaks.
- Performance budget: under 16 ms per mutation batch on the demo pages.

### 6.2 Rule types

All rules are stored in `chrome.storage.local`, can be exported and imported as JSON, and can be scoped globally or to a URL pattern.

| Rule type | Target | Effect | Phase |
|---|---|---|---|
| **Pattern** | Text matching a regex (with checksums where they exist: Luhn for cards, ABA for routing numbers) | Replace with a typed token | v1 |
| **Field** | Form inputs matched by `autocomplete` attribute, input `type`, name/id, or label text | Lock the field, clear any existing value, and overlay "🔒 Protected by Hide & Sneak" | v1 |
| **Page** | URL pattern | Replace the page body with a `Protected page` placeholder. Rechecked on in-app navigation (`pushState`, `replaceState`, `popstate`, `hashchange`). | v1 |
| **Sender / Label** (Gmail adapter) | Gmail thread sender or label | Replace the whole thread with `[Protected thread]` | v1 |
| **Keyword** | Case-insensitive phrase | Redact the match, or protect the whole containing block | v1 |
| **Section** | URL pattern + element target from a point-and-click picker, anchored to stable attributes (ARIA roles and labels, landmarks, `data-*`), never auto-generated class names | Replace with `[Protected section]` | v2 |
| **Action** | Buttons and links matched by label text or role | Disable and overlay | v3 |

**Fail closed:** if a section or field rule scoped to a URL doesn't find its target on a matching page, it applies its fallback: **protect the whole page** (default) or **warn and log**. Every miss is logged.

### 6.3 Protection packs (built-in presets)

Packs group rules by use case so users turn on protections, not regexes. Each can be toggled and edited.

| Pack | Patterns | Fields |
|---|---|---|
| **Identity** | SSN, date of birth near keywords, passport and driver's license numbers near keywords | SSN, DOB (`bday*`), government ID fields |
| **Payments** | Card numbers (Luhn), bank account numbers near keywords, routing numbers (ABA) | `cc-number`, `cc-csc`, `cc-exp*`, bank account and routing fields |
| **Credentials** | 2FA and verification codes near keywords ("your code is…") | `type=password`, `current-password`, `new-password`, `one-time-code` |
| **Contact** (off by default, since forms usually need it) | Phone, street address | — |
| **Job applications** | Salary figures near salary keywords | EEO and self-identification questions (race, ethnicity, gender, veteran status, disability), salary expectations and history, background-check consent, legal attestations |

**Field detection order:** `autocomplete` attribute, then input `type`, then name/id, then the associated `<label>` or `aria-label` text. EEO sections on common applicant tracking systems (Greenhouse, Lever, Workday) get tested markup fixtures. Verify each one's structure in the spike (Q6).

### 6.4 Agent Mode and UI

- **Agent Mode is manual in v1:** a single on/off toggle that covers all tabs. The user turns it on before delegating and off afterward. The toolbar badge and on-page banner make the current state obvious.
- **Automatic mode (v2, optional):** protection turns on only for tabs in Claude in Chrome's tab group, and turns off when a tab leaves the group. Claude in Chrome uses a dedicated tab group, per its release notes. The extension would watch groups with the `chrome.tabGroups` and `chrome.tabs` APIs. This is a convenience, not a requirement, and it ships only if Q4 shows it's reliable.
- **Popup:** Agent Mode setting, a toolbar badge, per-pack toggles, and a per-site off switch.
- **Turning on** registers the content scripts for future page loads and injects them into already-open tabs without reloading. **Turning off** unregisters them and unlocks fields in place without reloading, so work the agent already filled in isn't lost. Hidden text stays hidden until the user reloads the page, because originals are never stored.
- **Options page:** packs, custom rules, JSON import and export, and the audit log table.
- **On-page markers:** locked fields show "🔒 Protected by Hide & Sneak" (or "🔒 Protected" / 🔒 on narrow fields). Protected pages and sections show placeholders. A slim banner confirms Agent Mode is on.

### 6.5 Onboarding and self-test

- **First-run page:** opens on install. Pick protection packs (checkboxes), optionally paste pages to protect, and see how to turn Agent Mode on and off. Target: under 2 minutes, no rule-writing.
- **"Test my protection" page:** bundled with the extension (works offline). It shows fake sensitive data and form fields, runs the user's current rules, and displays a pass/fail check per item. It includes a suggested prompt to give Claude ("What's the card number on this page?") so the user can confirm what the agent sees.
- **Status at a glance:** toolbar badge (red = on, number = protections this session, yellow = a rule missed its target).

### 6.6 Audit log

- Local only, capped at about 5,000 entries (FIFO).
- Entry: `{timestamp, url, ruleId, ruleType, effect, tokenType, sessionId}`. **Never the original value.**
- Records session start and end and the URLs visited while Agent Mode was on.
- v1: sortable table and JSON export. v2: dashboard.

### 6.7 Distribution

- **Chrome Web Store** listing, free. Requires a one-time developer registration fee. Expect a longer review because of `<all_urls>`. The listing's privacy disclosure states that no user data is collected or transmitted.
- **GitHub:** source, releases, and "load unpacked" instructions for people who want to inspect the code before installing.
- **Permissions requested:** `storage`, `scripting`, and host access to `<all_urls>`. Content scripts are registered only while Agent Mode is on, so when it's off nothing is injected into any page. No network, `debugger`, or remote-code permissions. `tabGroups` is added only if v2 Automatic mode ships. The README explains why each permission is needed.
- **License:** MIT.

**GitHub release checklist**

- Public repo with `LICENSE` (MIT), `README.md` (what it does, install steps, threat model, permission rationale, demo links, GIF), `SECURITY.md` (how to report a bypass), and `CHANGELOG.md`
- Tagged releases with a packaged `.zip` that matches the version submitted to the Chrome Web Store
- GitHub Pages hosts the demo pages and the privacy policy

**Chrome Web Store submission checklist** (per Chrome's developer docs, checked 2026-09-29)

- Developer account registered (one-time fee) with a public publisher name and contact email. Use a project email, not a personal or work address.
- **Required images:** 128×128 icon (96×96 artwork with 16 px transparent padding, readable on light and dark backgrounds), one 440×280 small promo image, and at least one 1280×800 or 640×400 screenshot (up to 5)
- **Optional:** 1400×560 marquee image
- **Privacy tab:** single-purpose statement, a justification for each permission, remote-code declaration (none), data-usage disclosures (no data collected), and a privacy policy URL
- **Single-purpose statement (draft):** "Hides and locks sensitive information on web pages while a browser AI agent is working, so the agent can't see or fill it in."
- **Naming:** don't use "Claude" or Anthropic's logo in the extension name or icon, which would risk trademark and impersonation-policy problems. The description can say it "works with browser AI agents such as Claude in Chrome."

### 6.8 Demo site (GitHub Pages)

Recruiters won't install an extension, so each demo runs the engine as a plain script with a **protection off / on** toggle.

| Demo page | Shows |
|---|---|
| **Job application** (lead demo; every hiring manager recognizes it) | Agent fills work history; demographic, salary, SSN, and attestation fields are locked |
| **Checkout** | Shipping filled; card fields locked; saved-cards page protected |
| **Inbox** | Protected threads; identifiers redacted; (v2) planted injection attempts |

- A short GIF of Claude in Chrome completing the job application with protection off vs on.
- A published **coverage check** across all three demo pages, seeded with about 40 planted items: "caught X of Y; misses documented in `COVERAGE.md`." Present it as a check on test data, not a statistical claim.

## 7. Out of scope

- **Guaranteed prevention.** Defense in depth only (§8).
- **Click-to-reveal while Agent Mode is on.** The agent can click too.
- **Cloud, accounts, telemetry, network calls.** No data leaves the machine.
- **ML classifiers.** Rules keep behavior explainable and testable.
- **Enterprise fleet management.**
- **Site-blocklist policy generator** until R1 is resolved.
- **Monetization.** No paid tier, ads, or accounts.

## 8. Threat model (goes in the README)

**Assets:** personal identifiers, credentials, payment data, sensitive pages and threads, and answers the user wants to give personally.
**Adversaries:** (a) an over-broad instruction that leads the agent into content or fields it didn't need; (b) a malicious page or email trying to steer the agent; (c) the agent's model context, which may be logged or retained by the provider.

| Threat | Mitigated? | How / why not |
|---|---|---|
| Agent reads identifiers via screenshot, page text, or accessibility tree | **Yes, for covered patterns** | Text replaced before render |
| Agent reads the DOM with JavaScript | **Yes** | The DOM holds only redacted text |
| Agent reads text hidden with CSS (`display:none`, same-color text) | **Yes** | Tested: Claude's `read_page` returns `display:none` text by default, which is why Hide & Sneak replaces text rather than hiding it |
| Agent types into or clicks a locked field | **Yes** (tested with Claude in Chrome's tools, 2026-09-29) | Clicks sent through the debugger API hit the overlay, so typing never reaches the field. `form_input` writes are cleared in the same `input` event. |
| Agent sets a locked field's value by script | **Partial** | A script can write `.value` directly. v0 clears it on any input event, on a 400 ms sweep, and right before submit, and strips locked fields from submitted form data. The value is readable for up to 400 ms if no event fires. Every clear is logged. |
| Agent reads a value already in a locked field | **Yes** | Value is cleared when the field is locked |
| Agent opens a protected page on an allowed site | **Yes** | Body replaced before render; in-app navigation is rechecked |
| Section or field target moves after a site redesign | **Yes, fails closed** | Whole page protected, or warning logged, per rule |
| Agent fetches data outside the page (site APIs, CDP network interception) | **No** | The data exists outside the DOM. This extension can't intercept another extension's CDP session. |
| Agent turns off Agent Mode or edits rules | **Yes** (tested 2026-09-29) | The agent's tools can't open `chrome-extension://` pages, and web pages can't reach the extension. The toolbar is outside the agent's viewport. |
| Agent reads before the observer processes new nodes | **Partial** | Pre-render hide + `document_start` narrow the window. Measured, not assumed. |
| Text inside images, canvases, or video | **No** | Rewriting the page can't change pixels. Documented as a known gap. |
| Sensitive values pre-filled in fields that aren't locked | **No (v0)** | Only locked fields are cleared. Scanning unlocked field values is a v1 follow-up. |
| Pattern or field the rules don't cover | **No** | Documented in `COVERAGE.md`; user adds a custom rule |
| Hidden prompt injection on a page | **v2** | UC7 |
| Agent clicks an irreversible action | **Partial** (v3) | Overlays stop on-screen clicks, not a script `.click()` or direct form submission |
| Agent navigates to a site the user never wants it on | **Out of scope** | Use Claude in Chrome's site controls |

**Honest summary line for the README:** "Hide & Sneak reduces what a browser agent sees and fills in on the page. It doesn't stop an agent that goes around the page."

## 9. Risks

| ID | Risk | Impact | Mitigation |
|---|---|---|---|
| R1 | Chrome 155: `runtime_blocked_hosts` disables `chrome.debugger` on every site | A site-policy layer would break the agent entirely | **Confirmed 2026-09-29:** Claude in Chrome v1.0.94 uses the debugger API. No site-policy layer. Point users to Claude's site permissions and, if Q8 confirms it, Chrome's per-extension Site access setting. |
| R2 | Site markup changes (Gmail, ATS platforms, checkout pages) | Adapter-based rules stop matching | Prefer standards (`autocomplete`, ARIA, labels) over site-specific selectors. Keep adapters isolated with fixture tests. Fail closed. |
| R3 | Agent writes tokens into real output ("Your account [ACCOUNT #] is…") | Confusing sent email or form answers | README warning. v2: pre-submit check that flags `[TOKEN]` strings in outgoing text. |
| R4 | False positives on arbitrary sites (order and tracking numbers, prices) | Agent can't finish legitimate tasks | Checksums, keyword proximity, per-pack and per-site toggles, sender allowlist |
| R5 | Performance on heavy pages | Sites feel slow | Budget in §6.1; do nothing when Agent Mode is off |
| R6 | Section targets break when sites change | Sensitive sections become visible | Stable-attribute targeting + fail closed |
| R7 | Content flashes before protection applies | Brief exposure in a screenshot | Pre-render hide (§6.1) |
| R8 | `<all_urls>` permission looks alarming | Users don't trust it; Chrome Web Store review friction | Open source; no network permissions; no remote code; README explains exactly why every-site access is needed |
| R9 | Locking fields clears values the user wanted kept | Minor rework | Clearing is logged; user fills locked fields after Agent Mode is off |
| R10 | Extension name or branding implies an Anthropic affiliation, or collides with an existing product | Store rejection, takedown, or confusion | Named **Hide & Sneak**: no Chrome extension or app with that name found in a web search on 2026-09-29. Store listing pairs it with a plain subtitle ("Hide & Sneak: keep sensitive info away from browser AI agents") so "sneak" doesn't read as evasive. This is not a trademark clearance. Re-search the Chrome Web Store right before submitting. Mention Claude in Chrome only as a compatible agent. |
| R12 | Close overlap with Agent Browser Shield on read-side features | Looks derivative to reviewers | Lead with the differentiators (§2.1); follow the clean-room rule; cite it as related work |
| R11 | Publishing a security tool while employed at a security company | Conflict with employment or IP terms | Built on personal time and personal equipment (confirmed by owner 2026-09-29). Owner's call whether to check the agreement's outside-activities and IP clauses. |

## 10. Open questions (resolve in the spike)

1. **Does Claude in Chrome use `chrome.debugger` (CDP)?** **Yes** (answered 2026-09-29). R1 confirmed.
2. **How does it read the page?** Screenshots, accessibility tree, page text, JS? Confirm redaction holds in each.
3. **Can the agent operate this extension's popup or options page?**
4. **Can Claude in Chrome's tab group be identified reliably?** Its release notes confirm it uses a dedicated tab group. Check whether the group's title or color is stable enough to key on with `chrome.tabGroups`, and what happens when the user drags tabs in and out. Decides v2 Automatic mode (§6.4). Doesn't block v1.
5. **Does Gmail's reply quoting use the DOM or its internal model?** Affects R3.
6. **How do Greenhouse, Lever, and Workday mark up EEO, salary, and attestation questions?** Build fixtures from real (public) postings.
7. **How does the agent fill fields: simulated typing, `insertText`, or setting `.value` by script?** Decides whether field locks hold (§8).
8. **Does Chrome's per-extension Site access ("On specific sites") keep Claude off unlisted sites?** If yes, it's a free, built-in site blocklist for individuals.

## 11. Phasing

| Phase | Scope | Done when |
|---|---|---|
| **Spike** | Answer Q1–Q3, Q6, Q7 (Q4 optional). Prototype text redaction and field locking on a live job application and Gmail. | Findings in `docs/SPIKE.md` |
| **v1** | Protection engine on all sites, pattern / field / page / keyword rules, Gmail adapter, protection packs, fail closed, manual Agent Mode toggle, onboarding, self-test page, audit log, three demo pages, coverage check, GIF, README with threat model, Chrome Web Store listing | Published on the Chrome Web Store; demos live; coverage check published; GIF recorded |
| **v2** | Prompt-injection flagging, section rules + picker, optional Automatic Agent Mode, audit dashboard, pre-submit token check | Injection set and picker live on the demo site |
| **v3** | Action rules, more site adapters (Outlook web, Google Drive), revisit the site-policy layer (Q1) | — |

## 12. Success measures

- Published and installable from the Chrome Web Store.
- A first-time user goes from install to a passing self-test in under 5 minutes.

- Coverage on seeded demo items: target 90% or more, with every miss documented and its cause explained.
- Zero original values in the audit log or DOM (tested).
- Claude in Chrome completes the demo job application with all locked fields left empty.
- Redaction latency within the §6.1 budget.
- The README threat model is specific enough that a security reviewer can tell what is and isn't covered.

## 13. Proposed repo layout

```
claude-extension-control/
├── extension/
│   ├── manifest.json            # MV3; content scripts on <all_urls> at document_start; no network permissions
│   ├── content/
│   │   ├── engine.js            # Agent Mode check, pre-render hide, observer, rule dispatch
│   │   ├── redactor.js          # text-node + attribute redaction
│   │   ├── field-guard.js       # field detection, lock, overlay
│   │   ├── page-guard.js        # page rules, SPA route hooks, fail closed
│   │   ├── picker.js            # v2 section picker
│   │   └── adapters/
│   │       ├── gmail.js         # sender/label threads
│   │       └── ats.js           # Greenhouse / Lever / Workday EEO fixtures
│   ├── packs/                   # identity, payments, credentials, contact, job-applications
│   ├── popup/
│   ├── options/
│   ├── onboarding/              # first-run setup
│   └── selftest/                # "Test my protection" page
├── demo/                        # job application, checkout, inbox (GitHub Pages)
├── tests/                       # pattern unit tests, field-detection fixtures, DOM snapshot tests
├── docs/
│   ├── SPEC.md
│   ├── DESIGN.md
│   ├── SPIKE.md
│   ├── COVERAGE.md
│   └── COMPARISON.md
└── README.md
```

## Sources

- [Chrome 155 debugger enterprise policy restrictions](https://developer.chrome.com/blog/debugger-enterprise-policy-restrictions)
- [Claude in Chrome permissions guide](https://support.claude.com/en/articles/12902446-claude-in-chrome-permissions-guide)
- [Getting started with Claude in Chrome](https://support.claude.com/en/articles/12012173-getting-started-with-claude-for-chrome)
- [Claude in Chrome product page (example use cases)](https://claude.com/claude-in-chrome)
- [Claude in Chrome release notes (tab groups)](https://support.claude.com/en/articles/12306336-claude-in-chrome-release-notes)
- [Chrome Web Store: register as a developer](https://developer.chrome.com/docs/webstore/register)
- [Chrome Web Store review process](https://developer.chrome.com/docs/webstore/review-process)
- [PixieBrix Agent Browser Shield (GitHub)](https://github.com/pixiebrix/agent-browser-shield)
- [Agent Browser Shield on Product Hunt](https://hunted.space/product/agent-browser-shield)
- [Blindrs (Chrome Web Store)](https://chromewebstore.google.com/detail/lhkkijinbofikgndmnomnipbkfidcgkh)
