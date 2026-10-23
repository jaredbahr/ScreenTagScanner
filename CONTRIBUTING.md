# Contributing

This repository is the single source of truth for the scanner. Two AI agents (Claude Code and Codex)
and Jared work on it; Kirsten and Paul use it. The rules below keep that safe.

## Be conservative: this runs a real business (Jared, 2026-10-23)
The scanner fills in the sheet a small business is paid from. Unlike a demo, a wrong number costs real money and
trust. When a change makes the scanner do more on its own, it must be cautious:

1. **When in doubt, leave it blank and flag it.** A blank cell costs Kirsten a minute; a wrong amount costs money.
   Never guess a value to make a row look complete.
2. **Never touch what a person entered.** No overwriting values Kirsten typed, no deleting or moving rows, no
   writes to a live sheet outside a scan (rule 3 below).
3. **Money changes need extra proof.** Anything that changes inches, prices, earnings, parts or what gets billed:
   - starts from a business rule stated by Jared or Kirsten, recorded with its date in the doc that owns it;
   - is replayed read-only against the real workbook before merge, and the PR reports what it would have changed;
   - turns the row yellow every time it decides an amount on its own, at least for the first two weeks live;
   - has tests both for what it fills in and for the cases that must stay held.
4. **Placement changes fail safe.** Logic that chooses a row or a group must fall back to the old behavior (next
   empty row) when unsure, and add a note rather than guess.
5. **Prompt changes are code changes.** Same tests and review; never loosen a "never guess" instruction.
6. **Small, spaced releases.** One deploy per day at most, unless a fix stops wrong money. Batch the rest. Deploy
   when nobody is scanning. Rollback is Codex redeploying the previous version, recorded in the deployment issue.
7. **Watch the first live scans.** After each deploy, Claude checks the first real scans read-only and reports.

## Ground rules
1. **GitHub only.** Every code or doc change is a commit here. Nobody edits code in the Apps Script
   editor. A change that can't be made through GitHub (Script Properties, sharing, triggers, data
   fixes) starts as a **GitHub issue** (Change request template) for Jared to approve.
2. **Deployments are Codex's job**, from a commit on the default branch with a green `tests` run,
   following [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md), and recorded as a `deployment` issue.
3. **Never change the live spreadsheets** (data, layout, sharing) without Jared's direct approval.
   Reading them for troubleshooting is fine.
4. **No customer data in the repo, issues or PRs**: no names, phone numbers, full ticket numbers,
   photos or spreadsheet exports. Real files live in the git-ignored `private/` folder only. Refer
   to a scan by its Scan ID or store + row. CI fails if a photo or spreadsheet is tracked.
5. **Secrets never leave Script Properties.** No API keys, tokens or Google IDs in code, docs or chat.

## Making a change
1. Pull first (`git pull`) and build on the latest commit; never overwrite someone else's work.
   Read [docs/STATUS.md](docs/STATUS.md) for the current state and open questions; update it when they change.
2. Keep the change focused. Add or update a test for any behavior change; reproduce a real failure
   with synthetic data (the October fixtures in the tests show the pattern).
3. Run `npm test` (all suites, offline, about 2–3 minutes). Everything must pass. Release handoffs also
   run `npm run release:validate` ([docs/RELEASE_PROCESS.md](docs/RELEASE_PROCESS.md)). A new test file
   must be added to `minimumTestCounts` in `release/manifest.json`.
4. Behavior change: bump `EXTRACTION_VERSION`, add a line to [CHANGELOG.md](CHANGELOG.md) and to
   **What's new** in `apps-script/Upload.html` (plain language, no customer data).
5. Prompt or schema change: the schema test enforces Anthropic's 16 nullable-field limit; add new
   fields as plain strings where possible.
6. Commit with a message that says what changed and why. Open a pull request using the template
   when working on a branch.

## Decisions
Business rules (rates, what gets flagged, how dates and earnings work) are Jared's and Kirsten's
calls. Record each decision in the relevant doc (`docs/SPREADSHEET.md` rules, `docs/DATE_RULES.md`,
`docs/PARTS_EARNINGS.md`) with the date, in the same commit that implements it.
