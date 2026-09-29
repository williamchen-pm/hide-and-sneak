# Changelog

## 0.9.0 (beta)

First public release.

- Hides sensitive text while Agent Mode is on: 2FA and verification codes, backup codes, passwords and PINs, card numbers and expiry, bank account and routing numbers, SSNs and ID numbers, API keys and tokens, private keys, and one-time login/reset links. Hidden items are highlighted as a redaction bar.
- Handles real-world layouts found in testing: codes split from their label, codes drawn one digit per box (Gmail's "Code Requested" card), click-to-reveal account numbers, and tab titles.
- Locks form fields you should answer yourself (salary, demographic questions, signatures, payment and password fields) with a "🔒 Protected" marker, including custom dropdowns on Greenhouse and radio surveys on Lever.
- Blocks "Copy code / password / key" buttons and neutralizes one-time login links.
- Protected pages, protected words and names, protection packs (Last 4 digits and Contact info are opt-in), and a local activity log that never stores original values.
- Does nothing while Agent Mode is off. No network access, no data collected.
- Known gaps are listed in the README; this is a beta and will miss some things on some sites.
