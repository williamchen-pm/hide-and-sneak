# Hide & Sneak

**Let browser AI agents see only what they need.**

Hide & Sneak is a free, open-source Chrome extension for people who hand everyday tasks to a browser AI agent such as Claude in Chrome. While Agent Mode is on, it replaces sensitive text on the page (card numbers, SSNs, 2FA codes) with placeholders, locks form fields you want to fill yourself (salary, demographics, payment details), and blocks pages you mark as off-limits. When Agent Mode is off, it does nothing.

> **Status: early development (v0).** Not yet on the Chrome Web Store. See [`docs/SPEC.md`](docs/SPEC.md) for the plan and [`docs/DESIGN.md`](docs/DESIGN.md) for what's built.

## Demo

`demo/job-application.html` is a fictional job application running the real Hide & Sneak engine. An AI agent can fill in your contact details and experience, while salary, demographic questions, background-check consent, and your signature are locked for you to answer. A verification code in the page shows as `[2FA CODE]`. Toggle protection off to see the raw page. (Hosted on GitHub Pages once the repo is public.)

## What it is not

Hide & Sneak reduces what a browser agent sees and fills in *on the page*. It does not stop an agent that goes around the page to get the data. The full threat model is in [`docs/SPEC.md` §8](docs/SPEC.md).

## Install (developer mode)

See [`docs/INSTALL.md`](docs/INSTALL.md).

## License

MIT. See [`LICENSE`](LICENSE).
