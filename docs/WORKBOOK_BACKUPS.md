# Full workbook backups

## Approved behavior

Jared approved nightly backups around **2 a.m. America/Chicago**, plus a full
copy before every month switch. Keep all dated copies in a separate owner-only
Drive folder; no automatic deletion, retention purge or restore. These backups
are additional to the existing Totals PDF and retained historical workbooks.

The coordinating parent/browser worker confirmed **0.13.16-draft**, immutable
deployment version 10 / `5ed9a8a97717afd9580555e23cb43ea4b813bbe6`, and completed
backup setup after the original handoff. Its 2026-10-21 05:17 UTC check freshly
confirmed the live version. The initial setup instructions below are retained
as a runbook; updates must preserve the existing folder, properties and nightly
trigger and must not reinstall them merely to update code. Later release
candidates require their own deployment receipts.

## Implementation and boundaries

`Backup.gs` uses native Drive `makeCopy(name, folder)` on the active Google
spreadsheet, retaining all tabs, formulas, formatting, notes and values as a
full workbook copy. It never replaces `SHEET_ID` or `TEMPLATE_ID`, writes cells,
changes source permissions, runs migrations, rescans tags or calls the OCR API.
The existing manifest already requests Drive and ScriptApp access; no scope is
added. Stop for action-time approval if Google requests any new permission.

The destination folder and every copy must be owned by the executing account,
have private link access, no other editors/viewers, and not be in Trash. A copy
must have the expected native spreadsheet type, filename, sole parent and tab
structure. Unexpected sharing stops the operation; code does not silently
remove people, widen access, delete files or change permissions to repair it.

The shared ScriptLock serializes backups with scans and month rollover. An
admitted scan, migration pause or pending rollover blocks the daily copy. The
rollover path calls `backupBeforeMonthSwitch_` after PDF archival and before
the first active-pointer change. Backup failure keeps the old workbook active
and leaves the existing rollover recoverable. A retry after an interrupted
pointer switch reuses the original completed backup receipt.

Daily copies are idempotent per active workbook and Chicago calendar day;
pre-rollover copies are idempotent per rollover operation. Before creation,
private metadata pins the source, destination, generated filename and expected
tab structure. An uncertain result is recovered only from that exact copy.
Multiple matches, a missing uncertain copy, or a different pending operation
require owner reconciliation rather than another blind copy. Folder and
trigger setup use the same intent-before-create pattern.

Only the latest daily and latest rollover receipts plus one pending journal
are retained in Script Properties, keeping bookkeeping bounded. Replacing
those metadata receipts never deletes older Drive copies. The files themselves
are all retained. Backup/file/folder/trigger IDs remain private properties and
must not be copied into GitHub.

## Setup and cloud deployment handoff

1. Verify saved Google source still matches the version 9 pin before editing.
   Sync the tested twelve-file `apps-script/` tree, including the new `Backup.gs`,
   and read it back against the tested commit. Update the existing deployment
   to a new immutable version, preserving its identity, URL and settings.
2. From the owner editor, run `installWorkbookBackups_()` once. It creates a
   separate owner-only folder if none is configured and one trigger for
   `nightlyWorkbookBackup_`: `.atHour(2).nearMinute(0).everyDays(1)` with explicit
   `.inTimezone('America/Chicago')`. Repeating setup reuses the same verified
   folder/recorded trigger and leaves unrelated triggers alone. Existing
   unrecorded/conflicting triggers require review; none are deleted.
3. Google clock triggers are approximate. The builder's `nearMinute(0)` is a
   +/-15-minute target, not an exact-time guarantee. Verify the installed
   trigger, time zone and private folder, retaining their identifiers privately.
4. Run `backupActiveWorkbook_()` once for an initial full backup. This makes a
   copy of live data but does not write to the source. Verify copy identity,
   restricted access and all tabs, and read values/formulas/notes/formatting
   from the copy and source as needed without altering either. Record a
   sanitized success receipt. Do not run a real month change as a test.
5. Read the unchanged `/exec?health=1` endpoint and Settings backup status.
   Record source SHA, immutable deployment version, initial-copy result and
   trigger verification separately. A healthy website alone does not prove
   an installed backup trigger or successful snapshot.

Settings shows schedule presence and last completion/review status without
private IDs. The owner can also run `getWorkbookBackupStatus_()` or inspect
Executions. The nightly wrapper records/logs expected failures and returns
review status, avoiding deliberate throws into trigger-failure emails; it
adds no MailApp calls. Platform termination/quota failures can still prevent
the wrapper from recording a result, so periodically inspect the folder and
last completion date. No new failure-email workflow is installed.

## Recovery and limits

Restore a deleted backup through normal Drive Trash recovery. For an uncertain
operation, inspect its exact private journal and folder first; do not clear
pending metadata or create another copy until the outcome is established.
The code never restores, replaces or reactivates a backup automatically.

Offline tests use invented identifiers and fake native-copy behavior, including
populated old-month integration and failure-before-switch cases. They validate
control flow and preservation contracts, not live Google copy fidelity,
customer data, trigger delivery or future storage availability. Structural
read-back checks cover tab names, dimensions and frozen counts; they are not
an independent cell-by-cell backup checksum. Google copies do not constitute
a guaranteed backup of revision history or external linked resources. Keep
enough Drive capacity; there is no automatic storage purchase or purge.

Run `node tests/offline.test.cjs`, `node tests/workbook-backup.test.cjs`, and
`node tests/upload-ui.test.cjs` first, then the remaining offline suites
sequentially. No hosted Actions or paid extraction harness is needed.

API references: [Drive File](https://developers.google.com/apps-script/reference/drive/file),
[Drive Folder](https://developers.google.com/apps-script/reference/drive/folder),
[ClockTriggerBuilder](https://developers.google.com/apps-script/reference/script/clock-trigger-builder).
