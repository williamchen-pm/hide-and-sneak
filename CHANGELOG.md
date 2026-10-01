# Changelog

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
