# Security Policy

Hide & Sneak is a defense-in-depth tool. It reduces what a browser AI agent sees and fills in on a page. It does not stop an agent that goes around the page. See the threat model in [`docs/SPEC.md` §8](docs/SPEC.md).

## Reporting a way around the protection

If you find a way to get sensitive information past Hide & Sneak **on purpose**, for example a page layout, script, or agent action that reveals hidden values or fills a protected field, please report it **privately**:

1. Go to the repository's **Security** tab.
2. Click **Report a vulnerability**. This opens a private advisory that only the maintainer can see.

Please include the browser and extension version, a minimal page or steps that reproduce it, and what leaked. **Don't include real personal data.** Use fake values.

You'll get a reply within 7 days. Fixes for confirmed bypasses are released as soon as possible and credited in the changelog unless you'd rather stay anonymous.

## Ordinary misses

If something sensitive simply wasn't recognized (e.g. a new email layout), that's a normal bug. Open a **"Something slipped through"** issue instead.

## Supported versions

Only the latest release is supported during the beta.
