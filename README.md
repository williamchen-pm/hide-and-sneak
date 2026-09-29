# Hide & Sneak ![Beta](https://img.shields.io/badge/status-beta-orange)

**Let browser AI agents see only what they need.**

Hide & Sneak is a free, open-source Chrome extension for people who hand everyday tasks to a browser AI agent such as Claude in Chrome. While Agent Mode is on, it replaces sensitive text on the page (card numbers, SSNs, 2FA codes) with placeholders, locks form fields you want to fill yourself (salary, demographics, payment details), and blocks pages you mark as off-limits. When Agent Mode is off, it does nothing.

> **Beta (v0.9.0).** Hide & Sneak catches the most common sensitive info (codes, card and account numbers, passwords, keys), but it won't catch everything yet. Found a miss? [Report it](#feedback). What's covered and what isn't: [`docs/AUDIT.md`](docs/AUDIT.md).

## Demo

`demo/job-application.html` is a fictional job application running the real Hide & Sneak engine. An AI agent can fill in your contact details and experience, while salary, demographic questions, background-check consent, and your signature are locked for you to answer. A verification code in the page shows as `[2FA CODE]`. Toggle protection off to see the raw page. (Hosted on GitHub Pages once the repo is public.)

## What it is not

Hide & Sneak reduces what a browser agent sees and fills in *on the page*. It does not stop an agent that goes around the page to get the data. The full threat model is in [`docs/SPEC.md` §8](docs/SPEC.md).

## Known gaps (beta)

- **Text inside images, canvases, and PDFs** opened in Chrome's viewer can't be hidden. Close PDFs before handing a task to an agent.
- **Balances, health insurance IDs, crypto seed phrases, and international ID formats** aren't recognized yet (see the audit).
- **Signing in while Agent Mode is on** is blocked on purpose (code fields are locked and login links are neutralized). Turn Agent Mode off to sign in.
- **An agent that goes around the page** (reading network traffic or site data directly) isn't stopped. Hide & Sneak controls what's on the page.

## Feedback

Hide & Sneak collects no data, so reports from users are how it gets better.

- **In the extension:** open the popup and use **Report a problem on this site**. It opens a GitHub form with the extension version and the site's domain filled in.
- **On GitHub:** [open an issue](https://github.com/williamchen-pm/hide-and-sneak/issues/new/choose) and pick *Something slipped through*, *Hidden by mistake*, *Site broke or got slow*, or *Idea*.
- **Found a way around the protection?** Please report it privately. See [`SECURITY.md`](SECURITY.md).

**Never paste real codes, numbers, or passwords** into a report, and black them out in screenshots.

## Install (developer mode)

See [`docs/INSTALL.md`](docs/INSTALL.md).

## License

MIT. See [`LICENSE`](LICENSE).
