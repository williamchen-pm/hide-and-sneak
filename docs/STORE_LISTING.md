# Chrome Web Store submission kit (v0.9.0 beta)

Copy each block into the matching field in the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).

## Package

Upload **`dist/hide-and-sneak-0.9.0.zip`** (built from the `extension/` folder, with `manifest.json` at the zip's root).

## Store listing tab

**Name** (from the manifest): `Hide & Sneak`

**Summary** (max 132 characters, 129 used):
```
Beta. Hides 2FA codes, card and account numbers, and passwords from browser AI agents, and locks fields you should fill yourself.
```

**Description:**
```
BETA: Hide & Sneak catches the most common sensitive information, but it will miss some things on some sites. Treat it as an extra layer of protection, not a guarantee. Found a miss? Use "Report a problem" in the popup.

Let browser AI agents see only what they need.

If you hand everyday tasks to a browser AI agent, such as triaging email, filling out job applications, shopping, or paying bills, the agent can read everything on the page. Hide & Sneak gives you a switch. Turn on Agent Mode before you delegate, and while it's on:

- Sensitive text is replaced with placeholders like [2FA CODE], [CARD #], [ACCOUNT #], and [PASSWORD], including in tab titles. The agent can't read the originals through screenshots, page text, or the page's accessibility data.
- Fields you should answer yourself are locked and marked "Protected": salary, demographic questions, consent checkboxes, signatures, card numbers, passwords, and one-time-code fields. Your agent fills in the rest.
- "Copy code" buttons and one-time login links are disabled.
- Pages you choose (for example, your bank's statements page) can be blocked entirely.

What it recognizes: verification and backup codes, passwords and PINs, card numbers, expiry dates and CVVs, bank account and routing numbers, SSNs and ID numbers, API keys and private keys, and one-time login links. Optional packs cover contact info and the last 4 digits of cards and accounts.

When the agent is done, turn Agent Mode off. Protected fields unlock right away, and nothing the agent filled in is lost.

PRIVACY
- No network requests, no analytics, no accounts.
- Does nothing while Agent Mode is off.
- Original values are never saved. The local activity log records only what kind of item was hidden, where, and when.
- Free and open source (MIT): https://github.com/williamchen-pm/hide-and-sneak

KNOWN GAPS (BETA)
- Text inside images and PDFs can't be hidden.
- Account balances, health insurance IDs, crypto seed phrases, and non-US ID formats aren't recognized yet.
- Signing in is blocked while Agent Mode is on (code fields are locked), so turn it off to sign in.
- An agent that goes around the page (for example, reading a site's data directly) isn't stopped.

Works with browser AI agents such as Claude in Chrome. Not affiliated with Anthropic or any AI provider.
```

**Category:** Privacy & Security (if offered; otherwise Tools)

**Language:** English (United States)

**Graphic assets** (all in `docs/store/`):
- Store icon (128×128): `extension/icons/icon128.png`
- Small promo tile (440×280): `docs/store/promo-tile-440x280.png`
- Screenshots (1280×800): `docs/store/screenshot-1-1280x800.png`, `screenshot-2-…`, `screenshot-3-…`

**Official URL / Homepage:** `https://github.com/williamchen-pm/hide-and-sneak`

**Support URL:** `https://github.com/williamchen-pm/hide-and-sneak/issues`

## Privacy practices tab

**Single purpose:**
```
Hide & Sneak hides sensitive information on web pages and locks sensitive form fields while the user's browser AI agent is working (Agent Mode), so the agent can't read or fill them in.
```

**Permission justifications:**

`storage`:
```
Saves the user's settings (Agent Mode on/off, protection packs, protected pages and words) and a local activity log of what kind of item was hidden, where, and when. Original values are never stored. Nothing is synced or transmitted.
```

`scripting`:
```
Registers the page script only while Agent Mode is on, and injects it into already-open tabs when the user turns Agent Mode on, so pages don't need to reload and the extension runs nothing while Agent Mode is off.
```

Host permission (`<all_urls>`):
```
A browser AI agent can work on any website the user sends it to, so protection has to be available on any page. The extension only reads a page to replace sensitive text with placeholders and lock sensitive form fields, entirely on the user's device, and only while Agent Mode is on.
```

**Are you using remote code?** No, I am not using remote code.

**Data usage:** check **none** of the data types (the extension does not collect or transmit user data). Then check all three certifications:
- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL** (after GitHub Pages is on): `https://williamchen-pm.github.io/hide-and-sneak/privacy.html`

## Distribution tab

- **Visibility:** Public
- **Regions:** All regions
- **Pricing:** Free

## Before you submit

- [ ] Repo is public and GitHub Pages is on (the privacy policy URL must load)
- [ ] Private vulnerability reporting is enabled (linked from SECURITY.md)
- [ ] Trader declaration: Non-trader
