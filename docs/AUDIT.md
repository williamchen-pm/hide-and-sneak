# Coverage Audit

*2026-09-30 · Method: 28 realistic samples run through `detect.js` (`node tests/audit-corpus.js`) plus a review of what the engine scans. Result before this audit: **0 of 28 caught.***

## A. Places the engine doesn't look (highest priority)

These leak regardless of how good the patterns are.

| # | Gap | Why it matters | Effort |
|---|---|---|---|
| A1 | **Tab titles** (`document.title`). The engine only scans `<body>`. | Gmail puts the open email's subject in the tab title (e.g., "Your login code is 826774 - …"). Claude in Chrome's tab list reports titles, so the code leaks even though the page body is clean. | Small |
| A2 | **Link targets** (`href`). Only visible text and a few attributes are scanned. | "Log me in" and "Reset password" buttons carry one-time login tokens in the URL. An agent that reads or clicks the link gets into the account. | Small |
| A3 | **Late changes inside shadow DOM.** Shadow roots are scanned once, but the observer doesn't watch inside them. | Modern web components (some banking and email UIs) render sensitive values there after load. | Small–medium |
| A4 | **Values in unlocked form fields.** Only locked fields are cleared. | A profile page with a pre-filled SSN or card number in an unlabeled field shows the value to the agent. | Medium |

## B. Patterns missing today

| Tier | Item | Pack | Notes |
|---|---|---|---|
| **1** | Passwords and PINs in text ("Your temporary password is…", "PIN: 4821") | Credentials | Keyword context, like 2FA codes |
| **1** | API keys and tokens with known prefixes: `ghp_`/`github_pat_`, `sk-`/`sk-proj-`/`sk-ant-`, `AKIA…`, `sk_live_`/`rk_live_`, `AIza…`, `xox[baprs]-`, JWTs (`eyJ…`) | Credentials | Prefixes make false positives rare |
| **1** | Private key blocks (`-----BEGIN … PRIVATE KEY-----`) | Credentials | Exact match |
| **1** | Magic-link / reset URLs shown as text (`?token=`, `code=`, `key=`, `/reset`, `/magic`) | Credentials | Pairs with A2 |
| **1** | Email addresses | Contact (off by default) | Agents usually need emails, so off by default |
| **1** | Card expiry near "exp" / "expires" | Payments | Keyword context |
| 2 | Account balances ("Available balance: $12,345.67") | New optional *Balances* pack, off by default | Useful on bank pages; noisy elsewhere |
| 2 | EIN / tax IDs (`12-3456789` near "EIN" / "Tax ID") | Identity | Keyword context |
| 2 | Gift card codes + PINs, software license keys (`XXXXX-XXXXX-XXXXX-XXXXX-XXXXX`) | Credentials | License-key shape is distinctive |
| 2 | Health IDs: insurance member ID, group number, MRN, Medicare MBI | New *Health & insurance* pack | Keyword context; MBI has a fixed format |
| 2 | Security question answers | Credentials | Keyword context |
| 2 | Field locks for security questions, PINs, tax IDs, health member IDs | Field rules | Extends the field classifier |
| 3 | Crypto seed phrases (12/24 words from the BIP39 list) and wallet addresses | New *Crypto* pack | Needs the 2,048-word list; wallets are public but link to identity |
| 3 | International IDs: UK National Insurance, Canada SIN (checksum), others | Identity | Per-country formats |
| 3 | Vehicle VIN (checksum) | Identity | Low priority |

## C. Out of reach (document in the threat model)

- **Text inside images, canvases, and video.** Only visible through screenshots; the page can't be rewritten.
- **PDFs opened in Chrome's built-in viewer.** Extensions can't run inside the viewer, so a bank statement PDF is fully readable by the agent. The README should tell users to close PDFs before delegating.
- **Chrome's own UI** (address bar, history, bookmarks). See the screen-sharing checklist.

## Recommendation

Build **section A plus Tier 1** before the GitHub release. The four engine gaps and the Tier 1 patterns are all small, high-value, and low on false positives. Tab titles and login links in particular are the kinds of leaks a reviewer would find in minutes. Tier 2 goes into v1.1, and Tier 3 into the backlog.
