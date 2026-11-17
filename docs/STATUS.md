# Project status and handoff

Living notes so any session (Claude Code or Codex) can pick up where the last one stopped. Update this
file whenever the state below changes. No customer data, emails, Google IDs or secrets here.

_Last updated: 2026-11-17 (version 26 / 0.13.46 deployed and verified; MODEL remains unset)._

## Where things stand
| | |
|---|---|
| Live in Google | Immutable version 26 / **0.13.46-draft**, source `fb42d6f3627d6fc6ee62b681f7c49a111fe8ad8b`, per issue #71. Deployed November 17, 2026, **4:22 PM America/Chicago** (confirmation observed `2026-11-17T22:22:46.575Z`). Jared confirmed Kirsten had finished scanning. Both clean-pin release gates passed: 624 tests across 45 suites; fresh main equaled the pin; exact-source hosted CI was green. All twelve saved files matched version 25 / `c61e690` before changes. Only `Code.gs`, `Extraction.gs`, `Upload.html` and `Workbook.gs` were clipboard-pasted and visibly saved. Readback caught an incomplete Workbook save; it was repeated before a fresh reload and successful all-twelve comparison at `2026-11-17T22:21:44.131Z`. Only the unchanged manifest missing final LF was excepted. Same URL, identity and access. Health confirmed 0.13.46-draft; What's new showed 0.13.46 · Nov 17, then 0.13.45 · Nov 17, then 0.13.44 · Nov 14; verification completed `2026-11-17T22:23:27.274Z`. No new Google permissions, property changes, scans or row changes. Actual-phone rendering remains unverified. |
| Deployment record | Issue #71 deployment is complete. This metadata-only version-26 record needs independent review and merge by Claude. It supersedes PR #69 as the latest live-deployment record while retaining the historical end of the Opus trial below. Production source is `fb42d6f`; no further deployment is requested. |
| Who deploys | Codex, per [DEPLOYMENT.md](DEPLOYMENT.md) and the release gate, recorded as a `deployment` issue |
| Lesson (2026-10-22) | Google ran Codex's unmerged PR line for a week while the default branch moved on separately. Rule now: deploy only from the default branch; the release gate fails a candidate that lacks the deployed source's history |
| Workbook in use | "October 2026" in the shared monthly folder; tabs named by store ("Downers Grove", …); a "Tag x of N" column after Name in both blocks |
| Testing phase | Kirsten scans and checks every row; Paul isn't ready to scan alone. Jared watches unplaced scans during testing |

## Version-26 deployment caveats

The Part 1 Executions report is on issue #71. The run at 5:00:29 PM Chicago on November 16
timed out after 360.785 seconds; Google did not expose its console lines in this view.

The read-only deploy-time check of visible notes across eight active-workbook store tabs and
723 Scans entries found **no confirmed open group with additional labor and an old tag year**.
Hidden developer metadata was unavailable, so this is **not a definitive zero**. No rows were
changed to test or repair the possible cross-deploy group-labor receipt-key risk.

## Opus trial ended (2026-11-14, Chicago time)

Jared started the Opus trial on the night of November 6 and confirmed the save on November 7.
The exact starting save time was not recorded or independently verified.

Jared explicitly approved ending the trial on November 14 in issue #67 and confirmed Kirsten had
finished scanning. Codex deleted **`MODEL` only** in Project Settings and saved at **1:30 PM
America/Chicago** (`2026-11-14T19:30:18.708Z`). After reload, `MODEL` was absent at
`2026-11-14T19:30:34.420Z`; the other nineteen property names remained unchanged. No property
values were disclosed and no other property was edited.

The version-25 `Code.gs` used `MODEL` when set, otherwise `DEFAULT_MODEL`, for the JPEG image
extraction request. With the override absent, that code default was **`claude-sonnet-5-5`**.
This is source/configuration verification; no paid image scan or prompt evaluation was run.
The property change required no new version: immutable version **25**, source `c61e690`, and its
existing URL remained unchanged at that time. All twelve saved source files, live health and What's new were
rechecked unchanged. No new Google permission prompt, or sharing, scopes, access, trigger, row,
formatting, migration or month-setting changes.

Version 26 did not change any Script Property; `MODEL` remains unset.

## One-time prompt evaluation (2026-11-04)

One editor run; done equals of, so no repeat. Final counts-only summary:

```json
{"done":60,"of":60,"errors":0,"corrected":{"ticket":{"total":49,"current":10,"variant":12},"seq":{"total":49,"current":44,"variant":46}},"control":{"ticket":{"total":11,"current":11,"variant":11},"seq":{"total":11,"current":11,"variant":11}}}
```

The test automatically removed `PROMPT_EVAL_APPROVED`, `PROMPT_EVAL_CURSOR`, `PROMPT_EVAL_CASES` and `PROMPT_EVAL_RUNNING`; absence was checked through property names only. The result file was not opened. Actual paid-test billing was not independently measured.

## Standing rules from Jared
0. **Triple-check every change: this runs a real business** (2026-10-23). See CONTRIBUTING.md.
1. Work through GitHub only. Codex handles Google deployments. Anything else Google-side (Script
   Properties, sharing, data fixes) starts as a GitHub issue.
2. **Never change the live sheets without Jared's direct approval.** Reading them to find patterns is fine.
3. No customer data in the repo, issues, PRs or chat summaries; real files only in git-ignored `private/`.
4. The repo is **public** and will be used as a portfolio piece: keep process clean (tests, changelog,
   What's new, issues for deploys and decisions).
5. Ask before a paid test scan against the Anthropic API.
6. Business rules are Jared's or Kirsten's call; record each with its date in the doc that owns it.

## Script Properties for Jared to check after the next deploy
- `MONTH_FOLDER_ID`: the shared monthly folder (the part of its URL after `/folders/`). Version 11 already
  uses it for monthly PDFs, so it may be set; check it is the folder shared with Kirsten.
- `MONTH_EDITORS`: Kirsten's email (backstop; the folder's sharing already covers her).
- `SAVE_IMAGES` = `true` for the testing period (private photo folder, 30-day cleanup).
- `MAX_SCANS_PER_DAY` no longer needed (default is 300 in code).

## Kirsten's answers (2026-10-22), built in 0.13.18
1. Windows $18.50 per pane; most are one pane, some several → SPREADSHEET.md rule 20.
2. Thermopane $27 confirmed.
3. Pins $2.00 each to the customer, $0.50 to the shop → rule 21.
4. Tickets should be all 7 digits; when the tag isn't readable she types the 4 handwritten digits. She likes
   the 7-digit suggestion notes and asked whether they stay: yes, until someone clears them → rule 22.

## Waiting on Kirsten
- Sheet fix (hers): one Homer ticket read with a leading 9 instead of 8 (the ticket-book note on it shows the fix).
  New Lenox double scan: resolved by Kirsten (checked read-only 2026-10-22).
- Group rows (0.13.21): is a grey row + column-A note clear enough, or does she want "waiting for 2 of 6" text?
- Group check (0.13.22) on existing rows, read-only 2026-10-23: names disagree within 6 groups (Homer 3, Joliet,
  Willowbrook, Homer 2-of-2), 3 group tickets look misread (Homer row 44, Joliet row 17, Downers Grove row 22) and
  New Lenox has "4 of 12" twice (rows 20, 24). Sent to Jared for Kirsten.

## Repository (2026-10-22)
- This public repo, `jaredbahr/ScreenTagScanner`, is the single source from 2026-10-22. It starts with a clean
  history: (1) the deployed version-11 runtime, (2) the full project at 0.13.19, so the release gate's ancestry
  check works. The earlier history (with personal details) is kept in a private archive repository that is
  never made public; SHAs and PR numbers in older docs refer to it.
- **`main` is protected (2026-10-22):** changes only through PRs with a green `offline-tests` check; no force
  pushes or deletion; 0 required approvals (Codex and Claude both act through Jared's account), with Claude's
  review recorded on each PR. Claude reviews and merges; turn on "Automatically delete head branches" so
  merged branches clean up (Claude cannot delete them).
- Codex: clone this repo (or `git remote set-url origin` to it) and push work here as PRs. Deploy issue: see
  the open `deployment` issue.

## Waiting on Jared
- Tag each deployed release in the GitHub UI (Releases → Draft a new release; e.g. `v0.13.20` on `c3c32f9`).
  Claude prepares the tag name and commit; its git connection cannot push tags or delete branches.

## Decided and built (details in the linked docs)
- Date in = written tag date, missing year = scan's current year (no prior-year rollover, per Jared);
  Date out = scan date. [DATE_RULES.md](DATE_RULES.md)
- Review levels: row yellow only for money/placement; one-value doubts tint one cell; phone doubts log
  only. Measured on October: 56/78 yellow → 11/78. [SPREADSHEET.md](SPREADSHEET.md) rule 18
- Size/QTY disagreements settled from $ totals or a majority of QTY rows; otherwise billing blank. Rule 11
- Parts earnings from the approved rate list, credited once; a hand-edited earning only affects its own
  ticket; slip parts count; quantity required (no guessing). [PARTS_EARNINGS.md](PARTS_EARNINGS.md)
- Ticket-book hints, 7-digit check, possible-duplicate flag; never auto-change a value.
- Start new month: verified copy into `MONTH_FOLDER_ID`, shared to `MONTH_EDITORS`. [MANUAL_MONTH_ROLLOVER.md](MANUAL_MONTH_ROLLOVER.md)
- Failure emails off; unplaced scans orange in Scans and counted on each phone reply.
- Phone wording stays "⚠️ Flagged for a double check" (Jared: fine for now).
- Cost: ~$0.015/tag, busiest month ~$25; Console spend limit $40/month; daily cap 300.

## Ideas parked (not approved)
- For group tags, reuse a name Kirsten already corrected on a sibling row.
- Use saved photos to measure misreads per store once `SAVE_IMAGES` has run for a while.

## How to analyze the live workbook (read-only)
- The Google Drive connector (owner's account) can export the workbook as .xlsx. Save it under
  `private/` (git-ignored), never commit it, delete the raw tool output afterwards.
- Useful comparisons: the Scans log keeps what was read; the store tab holds what Kirsten corrected
  it to. Compare ticket/name/inches per row; tally Review Reasons; replay reasons through
  `reviewTier_` and tickets through `ticketBookHint_` with the test harness (`tests/offline.test.cjs`
  exports `load()`).

## Working notes for agents
- `npm test` runs all 18 suites offline (~2–3 min). CI runs the same on every push. A new test file must be
  added to `minimumTestCounts` in `release/manifest.json` or the release gate fails.
- Pull before working; Codex also pushes to this repo.
- The schema is at 16 nullable fields: add new fields as plain strings.
- Store tabs may be named by number or store; always use `storeSheet_()`.
- Apps Script functions ending in `_` are private: not callable from the page, and possibly hidden from the
  editor's Run menu (unverified). Prefer code paths that don't need editor runs or triggers.
