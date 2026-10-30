# Screen Tag Scanner

[![tests](https://github.com/jaredbahr/ScreenTagScanner/actions/workflows/tests.yml/badge.svg)](https://github.com/jaredbahr/ScreenTagScanner/actions/workflows/tests.yml)

> History before 2026-10-22 lives in a private archive repository. Commit SHAs and PR numbers mentioned in older
> docs (CHANGELOG, RELEASE_PROCESS, SOURCE_RECONCILIATION, AUDIT_LEDGER) refer to that archive.

A two-person home screen-repair shop does work for eight Ace Hardware stores. Every job arrives with a
handwritten paper tag, and every tag used to be typed into a monthly Excel workbook by hand.

Now the shop takes a photo on a phone and taps **Scan tag**. Claude reads the tag, and the job lands in
the right store's tab of a Google Sheet, with prices and earnings filled in. Anything uncertain is
marked for a person to glance at instead of being guessed.

```
Phone page (Apps Script HTML) ──photo──▶ Apps Script web app ──▶ Claude API (structured output)
        "Scan tag"                         │  checks password, quota
                                           ▼
                     rules: store match, inches, rates, earnings, dates, review levels
                                           ▼
             store tab (next empty row) + Scans log ──▶ the workbook's existing Totals
```

## Design highlights
- **Structured extraction.** Claude Sonnet returns a fixed JSON schema (35 fields), kept within
  Anthropic's 16 nullable-field limit by a test. Photos are resized to 2000 px; at low effort that
  measured best for accuracy per dollar (~$0.015 per tag, ~$25 in the busiest month).
- **Never guess silently.** A misread size or QTY never bills by itself; the tag's own dollar totals
  or consistent QTY rows can settle it, otherwise billing stays blank. A ticket that doesn't fit the
  store's sequential ticket book gets a "likely 8339725" note. The value is never auto-changed.
- **Review levels tuned on real data.** On the first month of real scans, 72% of rows were flagged
  yellow but only 14% had a money or placement problem. Flags now come in three levels (whole row,
  one cell, log only). Every ticket the owner corrected is still marked.
- **Safe writes.** Every value passes a formula-injection guard. Dates are written as serial numbers
  so a sheet time-zone setting can't shift them. Each scan is journaled before the store write, so
  an interrupted save never duplicates a row. Concurrent phones are serialized with a script lock.
- **Backups and month-end archive.** A full copy of the workbook every night and before each new month,
  in an owner-only folder; the month's Totals saved as a one-page PDF before the switch.
- **Earnings credited once.** Parts earnings use an approved rate list and are recorded with a
  receipt, so group tags, rescans and retries never double-pay. A hand correction is respected.
- **Privacy.** No customer data in the repo, issues or CI (CI fails if a photo or spreadsheet is
  tracked). Troubleshooting photos stay in a private Drive folder for 30 days, with no names in the
  file names. Secrets live only in Script Properties.

## Process
Two AI agents (Claude Code for development, Codex for Google deployments) plus the owner work through
this repository only. See [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
Each push runs every offline test suite in GitHub Actions; a local release gate checks a candidate against
the deployed source before Codex deploys it; deployments are recorded as issues;
changes are listed in [CHANGELOG.md](CHANGELOG.md) and, in plain language, on the phone page's
**What's new**.

```
npm test        # all suites, offline: no network, no Google, no API calls, synthetic data
```

## Repo layout
| Path | What |
|---|---|
| [`apps-script/Code.gs`](apps-script/Code.gs) | Web endpoints, password + quota admission, Claude call, journaled save, Scans log |
| [`apps-script/Extraction.gs`](apps-script/Extraction.gs) | Prompt, JSON schema, review reasons, inch settling |
| [`apps-script/Workbook.gs`](apps-script/Workbook.gs) | Stores, rates, store-tab writer, dates, review levels, ticket-book hints |
| [`apps-script/Parts.gs`](apps-script/Parts.gs) | Approved parts earnings and receipts |
| [`apps-script/Routing.gs`](apps-script/Routing.gs) | Screen vs window/glass routing, group extras |
| [`apps-script/Layout.gs`](apps-script/Layout.gs) | Header-driven column layout; Tag x of N migration |
| [`apps-script/Month.gs`](apps-script/Month.gs) | Start new month: verified copy into the shared folder |
| [`apps-script/MonthArchive.gs`](apps-script/MonthArchive.gs) | Totals PDF before a month switch; scan leases during the switch |
| [`apps-script/Backup.gs`](apps-script/Backup.gs) | Nightly and pre-switch full-workbook backups |
| [`apps-script/ExtraLabor.gs`](apps-script/ExtraLabor.gs) | Standalone additional labor charges, credited once |
| [`apps-script/Upload.html`](apps-script/Upload.html) | One-screen phone page, Settings, What's new |
| [`tests/`](tests) | Eighteen offline suites; `run-all.cjs` runs them |
| [`release/manifest.json`](release/manifest.json), [`tools/`](tools) | Release gate: deployed-source ancestry, file inventory, public functions, scopes, minimum test counts |
| [`tools/extract-test/`](tools/extract-test) | Accuracy and cost runs against real tag photos (kept private) |
| [`docs/STATUS.md`](docs/STATUS.md) | **Current state, open questions, standing rules, handoff notes** |
| [`docs/SPREADSHEET.md`](docs/SPREADSHEET.md) | Workbook layout and every business rule, with dates |
| [`docs/SETUP.md`](docs/SETUP.md) | Accounts, deployment, Script Properties |
| [`docs/PLAN.md`](docs/PLAN.md) | Original plan, decisions log, risks |

## Data handling
Tag photos and the spreadsheet contain customer names and phone numbers. **They are never committed.**
`.gitignore` blocks images, spreadsheets and the `private/` folder, and CI double-checks.
