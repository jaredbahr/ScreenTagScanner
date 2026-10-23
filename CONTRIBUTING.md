# Contributing

This repository is the single source of truth for the scanner. Two AI agents (Claude Code and Codex)
and Jared work on it; Kirsten and Paul use it. The rules below keep that safe.

## Triple-check every change: this runs a real business (Jared, 2026-10-23)
The scanner fills in the sheet a small business is paid from. A bug here costs real money and trust, so code
changes get more care than a hobby project. This is about **how we change the code**, not about changing what
the scanner does:

1. **Check 1: the author.** Re-read the whole diff before opening the PR, line by line, asking what could break.
   Run `npm run release:validate`. Add tests for the new behavior *and* for the existing behavior next to it, so a
   regression fails loudly. List every behavior change in the PR (what Kirsten will see differently).
2. **Check 2: an independent review.** Before merge, a reviewer with fresh eyes (a separate Claude review session,
   Codex, or Jared) reads the diff for bugs: edge cases, real Apps Script behavior (Date objects, empty ranges,
   numbers vs text), speed on full tabs, and anything that could fail a scan. Findings are fixed or answered in the PR.
3. **Check 3: real data.** When a change affects what gets written (amounts, rows, notes, flags), replay it read-only
   against the live workbook or the Scans log and report in the PR what it would have done differently. Nothing is
   ever written to the live sheet to test (standing rule).
4. **Keep changes small and scoped.** One purpose per PR; no drive-by refactors; don't change working behavior
   unless that is the point of the PR.
5. **Deploys are batched and reviewed.** Nothing deploys until checks 1–3 are done for everything in it; one deploy
   a day at most unless it fixes wrong money; deploy when nobody is scanning; Claude checks the first live scans
   afterwards.

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
