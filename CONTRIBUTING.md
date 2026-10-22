# Contributing

This repository is the single source of truth for the scanner. Two AI agents (Claude Code and Codex)
and Jared work on it; Kirsten and Paul use it. The rules below keep that safe.

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
