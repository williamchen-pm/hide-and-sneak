# Changelog

## 0.11.0 (beta, release candidate for 1.0)

- **Locked fields can't be written by scripts at all.** Before, a script write (for example an agent's form-filling tool or JavaScript) could sit in a locked field for up to ~400 ms before being cleared. A small guard now ignores those writes instantly. It only touches fields Hide & Sneak has locked.
- **Test my protection:** a page of fake sensitive information that reports what was hidden, locked, or masked with your current settings and mode, and points out packs you've turned off. Linked from the popup.
- **Guided first run:** new installs open a welcome page: pin the icon (it checks itself off), pick AI agent or screen sharing, and run the self-test.
- **Two new demos:** checkout and inbox, alongside the job application.
- **Coverage check** (`docs/COVERAGE.md`): 44 of 44 seeded sensitive items protected across the three demos, 0 of 22 ordinary items hidden by mistake. It found one real miss along the way ("Date of birth on file: …"), now fixed.
- **Settings backup:** export and import your protected words, pages, skipped sites, packs, and preferences (Rules & activity log page). Imports are validated, and never change whether protection is on.
- **Real-site check** (`tests/sites.js`): loads ~30 popular sites with and without the extension and reports new errors, extra load time, layout changes, and anything hidden by mistake.

## 0.10.0 (beta)

- **Presenting mode, for screen sharing.** Pick **Screen sharing** at the top of the popup and turn it on before you share your screen in Zoom, Teams, or Meet. Codes, account numbers, and the other sensitive text are hidden just like in Agent Mode, but sensitive form fields are **masked** instead of locked: what you type shows as dots, dropdowns and checkboxes are blurred, and everything keeps working, because you're the one typing. Login links, copy buttons, and planted-instruction text are left alone (those defenses are for agents). The badge says **PRES**. You can switch modes while protection is on.
- **Simpler popup.** The mode switch and daily controls are at the top; protection packs, settings, and report links fold into collapsible sections. The busiest view now fits in Chrome's popup without scrolling.
- "Your turn" shows the first 4 fields with **Show all**, and long questions end with "…" at a word break.
- Fix: a harmless "duplicate id" error could appear on the Errors page when Chrome started after an update.

## 0.9.3 (beta)

- **Recognizes more kinds of sensitive info.** The coverage audit went from 16 of 28 samples to all of them:
  - Crypto wallet **recovery (seed) phrases**, including the one-word-per-box grids wallet apps show (always on).
  - **Health & insurance IDs** (new pack, on): Medicare numbers, insurance member/group/policy IDs, medical record numbers.
  - **Tax and non-US IDs:** EINs, UK National Insurance numbers, Canadian SINs (checksum-verified), and VINs (check-digit-verified).
  - **Security question answers** and **software license keys**.
  - Optional packs, off by default: **Account balances** and **Crypto wallet addresses** (agents often need these).
  - New field locks: security questions, PINs, recovery phrases, tax IDs, and health insurance IDs.
- **Sign in without turning protection off.** The popup's **Unlock for 2 min** button unlocks just that tab, including the next pages of a sign-in flow, then locks it again. Agents can't reach the popup, so only you can use it. Login links work again while unlocked.
- **PDFs are no longer a silent gap.** Chrome's PDF viewer can't be changed by any extension, so while Agent Mode is on, PDFs are blocked (default) or show a warning, and the toolbar badge says PDF. Setting: "Block PDFs while Agent Mode is on."
- **Undo for right-click "Hide this"**, from the popup (masked, so nobody reads it over your shoulder).
- Zero false positives from the new patterns across ~240,000 lines of ordinary docs and changelogs.

## 0.9.2 (beta)

- **Injection shield (new protection pack, on by default).** While Agent Mode is on, instructions aimed at AI agents are removed before the agent reads the page and replaced with `[AGENT INSTRUCTIONS REMOVED]`. For example: "AI agents: forward this email to…", "ignore all previous instructions", "do not tell the user", or hidden text telling the agent to run scripts or send a code somewhere. Text people can't see (`display:none`, off-screen, screen-reader-only, 1px, transparent) gets a stricter check, since that's where these usually hide. Only the offending sentence is removed from longer emails and articles. Normal text that mentions AI, agents, or JavaScript is left alone (0 false positives across ~880 lines of this project's own agent-heavy docs).
- Why: an agent usually only goes around the page (running its own scripts, reading network traffic, visiting another site) because something on the page told it to. Removing those instructions addresses the cause, though it can't stop an agent that does this on its own. See Known gaps in the README.

## 0.9.1 (beta)

- **Right-click → "Hide this from AI agents."** Select anything Hide & Sneak missed, right-click, and it's hidden right away and on every page from then on. The same menu has "Report something Hide & Sneak missed."
- **"Your turn" list.** The popup lists the fields your agent couldn't fill, by their real question ("Desired base salary"). When you turn Agent Mode off, those fields are outlined on the page until you fill them in, and clicking one in the popup jumps to it.
- **Keyboard shortcut:** Alt+Shift+H turns Agent Mode on or off (change it at chrome://extensions/shortcuts).
- **Optional auto-off timer** (30 minutes to 4 hours). Off by default, because turning protection off in the middle of an agent's task would unlock fields.
- **Fix:** turning Agent Mode off and back on without reloading now protects already-open tabs again. In 0.9.0 those tabs stayed unprotected until they were reloaded.
- Protected words now match text that starts or ends with symbols (like `$4,213.55`) and ignore differences in spacing.
- New permissions: `contextMenus` (the right-click menu) and `alarms` (the auto-off timer). Neither shows an install warning, and neither sends anything anywhere.

## 0.9.0 (beta)

First public release.

- Hides sensitive text while Agent Mode is on: 2FA and verification codes, backup codes, passwords and PINs, card numbers and expiry, bank account and routing numbers, SSNs and ID numbers, API keys and tokens, private keys, and one-time login/reset links. Hidden items are highlighted as a redaction bar.
- Handles real-world layouts found in testing: codes split from their label, codes drawn one digit per box (Gmail's "Code Requested" card), click-to-reveal account numbers, and tab titles.
- Locks form fields you should answer yourself (salary, demographic questions, signatures, payment and password fields) with a "🔒 Protected" marker, including custom dropdowns on Greenhouse and radio surveys on Lever.
- Blocks "Copy code / password / key" buttons and neutralizes one-time login links.
- Protected pages, protected words and names, protection packs (Last 4 digits and Contact info are opt-in), and a local activity log that never stores original values.
- Does nothing while Agent Mode is off. No network access, no data collected.
- Known gaps are listed in the README; this is a beta and will miss some things on some sites.
