# Project status and handoff

Living notes so any session (Claude Code or Codex) can pick up where the last one stopped. Update this
file whenever the state below changes. No customer data, emails, Google IDs or secrets here.

_Last updated: 2026-10-23 (version 14 receipt verified at 01:33 UTC)._

## Where things stand
| | |
|---|---|
| Live in Google | Immutable version 14 / **0.13.22-draft**, source `5ee59dc93d29b2805771ad3800a93a1fcd096d73`. Deployed and final checks completed 2026-10-23 01:33 UTC (minute precision). All twelve persisted files matched the pin. UI checks used a normal cloud viewport; physical-phone and phone-sized rendering were not tested. |
| Ready to deploy | This pin is already deployed. PR #8 is merged. Future runtime changes require a new reviewed `main` pin and release validation; see issue #9 for this deployment receipt. |
| Who deploys | Codex, per [DEPLOYMENT.md](DEPLOYMENT.md) and the release gate, recorded as a `deployment` issue |
| Lesson (2026-10-22) | Google ran Codex's unmerged PR line for a week while the default branch moved on separately. Rule now: deploy only from the default branch; the release gate fails a candidate that lacks the deployed source's history |
| Workbook in use | "October 2026" in the shared monthly folder; tabs named by store ("Downers Grove", …); a "Tag x of N" column after Name in both blocks |
| Testing phase | Kirsten scans and checks every row; Paul isn't ready to scan alone. Jared watches unplaced scans during testing |

## Standing rules from Jared
0. **Be conservative: this is used for real business** (2026-10-23). See CONTRIBUTING.md, "Be conservative".
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
