# Clean October beta reset (owner maintenance, not Start new month)

Requested outcome: reuse the existing October workbook, name it **October 2026**, keep it in the configured monthly folder with the existing named collaborators, and make it the scanner’s clean beta workbook. Known scanner test data and duplicate/test artifacts may be removed; unrelated files are outside scope. This document is a procedure, not an executed reset or permission to bypass an unresolved journal.

## 1. Freeze and identify

1. Confirm the user has stopped scanning. Set `TAG_SEQUENCE_SCAN_PAUSE=true` under ScriptLock, retaining its prior state in a private maintenance record. Do not start a monthly rollover or sequence migration.
2. Verify all executions of both old and new deployed versions are terminal. Old versions have no scan leases; an empty lease map is not enough. Keep admission paused through verification, cleanup, source deployment and active-workbook switch.
3. Identify the existing October, current November, clean TEMPLATE, monthly folder, and every proposed duplicate/scratch/PDF by verified file ID and lineage. Keep that inventory private, not in the repository. Confirm original October is distinct from TEMPLATE and November, with expected ownership, collaborators, sheet IDs, layouts and contents.
4. Read only the relevant nonsecret state keys below. Stop if `ROLLOVER_PENDING`, `TAG_SEQUENCE_MIGRATION_ACTIVE` or `TAG_SEQUENCE_JOURNAL` is present until that operation is reconciled; do not delete these markers to force progress.
5. Create a named pre-reset Sheets version and record the recovery timestamp. Capture the exact nonsecret keys being changed and a private before-state inventory. Verify revision-history access. No extra workbook copy is needed unless native recovery cannot be verified; do not empty Drive Trash.

## 2. Clear only test data while retaining the October file

- Validate the clean TEMPLATE with `monthlyTemplateCheck_`, including both sequence-column layouts, blank inputs and formula audit. Match each store to October through the unique old/city alias resolver. Require equal row capacities and header geometry; stop on ambiguity or drift.
- Derive editable data rectangles from `storeLayout_`, never from guessed column letters: screens from row 2 through `screenBlockEnd_`, `DATE_IN` through `EARNING`; windows from row 2 through `WINDOW_LAST_ROW`, `DATE_IN` through `OTHER_EARN`. Sequence cells are inside these rectangles. Do not clear counter columns, row 1, Totals, totals/footer rows or unrelated cells.
- Remove confirmed test input values and their notes in those rectangles, including parts and additional-labor receipt markers. Preserve all approved formulas, including screen Spline/Spl Earn and the special Joliet formula; restore any damaged approved baseline cell from the matching clean template rather than blanking it. Restore clean S/W defaults and remove scan-generated flags/backgrounds by restoring only their matching template baseline formatting. Keep approved currency formats, validations, protections, row/column sizes and tab colors.
- If a range no longer matches the template’s expected formula structure, inspect it before writing. A reset must not perpetuate an overwritten formula or erase a legitimate template formula. Do not use whole-sheet `clear()` or unreviewed text replacement. Any cross-workbook transfer must preserve formula literals and cell types; ordinary Range.copyTo is not a general cross-workbook transfer.
- Clear the Scans body from row 2 onward, including contents and notes/receipt copies; retain validated headers and sheet identity. Clearing Scans alone or receipt notes alone is insufficient for a clean beta state.
- Verify store input cells match the clean baseline, receipt markers are absent in all cleared data/log ranges, source formulas/counts and structure remain correct, and Totals recalculates to the expected clean baseline without errors. Preserve the TEMPLATE unchanged.

## 3. Reconcile state under one owner-maintenance lock

No blanket property deletion. Keep the gate closed until every verification succeeds.

| Key | Required handling |
| --- | --- |
| `SHEET_ID` | Set to the verified existing October file ID only after cleanup verification. |
| `CURRENT_WORKBOOK_MONTH` | Set to `2026-10`. |
| `CURRENT_WORKBOOK_MONTH_ID` | Set to that same October file ID. |
| `MONTH_SCAN_LEASES` | Set to `{}` only after externally confirmed drain; never discard a live writer. |
| `MONTH_ROLLOVER_2026_11` | Snapshot and remove the obsolete confirmed-test receipt after its copy/archive lineage is reconciled. Otherwise the later real November start is blocked as a previous workbook. |
| `MONTH_ROLLOVER_2026_10` | Snapshot and reconcile any receipt against the reused October ID. Remove obsolete test-era receipt/archive references; do not fabricate a completed archive receipt. Current-month metadata supplies the clean baseline. |
| Other `MONTH_ROLLOVER_*` | Preserve unless individually verified as obsolete test lineage covered by cleanup. No wildcard deletion. |
| `ROLLOVER_PENDING` | Must be absent after separate reconciliation; never blindly clear it. |
| `ROLLOVER_NO_COPY_CONFIRMED` | Remove only an obsolete attestation after there is no pending operation. |
| `TAG_SEQUENCE_MIGRATION_ACTIVE`, `TAG_SEQUENCE_JOURNAL` | Must be absent after separate reconciliation; preserve unresolved recovery information. |
| `TAG_SEQUENCE_MIGRATION_DONE` | After independently verifying both complete layouts, set the ordered JSON ID list `[October ID, TEMPLATE ID]`; this is a validated target receipt, not a request to rerun migration. |
| `TAG_SEQUENCE_APPROVED_PLAN`, `TAG_SEQUENCE_DRAIN_CONFIRMED` | Remove stale approval/drain attestations once there is no active migration/journal. |
| `TAG_SEQUENCE_SCAN_PAUSE` | Keep `true` through final verification. Restore the prior nonpaused state only when safe; do not undo an unrelated pre-existing pause. |
| `SCAN_LIMIT_STATE`, `MONTH_COPY_LIMIT_STATE` and all quota limits | Preserve billing safeguards; beta cleanup does not authorize resetting usage allowances. |
| Credentials, provider/model settings, folder/template/editor configuration and all other properties | Preserve unchanged; never dump credentials into logs or the repo. |

Flush spreadsheet changes before releasing the lock. Record read-back verification of all changed nonsecret keys. An interrupted reset stays paused and is recovered from the maintenance record; do not resume based only on a partially changed `SHEET_ID`. Do not call `startMonth` to move backward from November to October, `startNewMonth_`, or `applyTagSequenceMigration_` merely to unpause.

## 4. Recoverable duplicate cleanup and final checks

1. Rename the retained October file to **October 2026** without changing its ID/access. Confirm it is in the configured monthly folder; use the already authorized named access only.
2. After the active switch is verified, move only individually identified obsolete November/duplicate workbooks, TEST validation folders/sources/PDFs and private scratch files to normal Drive Trash. Reconcile any old final-name PDF collision, especially a test October archive, before allowing the future real November rollover. Never trash the retained October, TEMPLATE, monthly folder or unrelated files. Do not permanently delete or empty Trash.
3. Preserve a private receipt of what moved to Trash and how to restore it. The repository should record completion facts and verification counts only, not private IDs, customer rows or raw evidence.
4. Verify deployed source/version, unchanged URL/scopes, active October in Settings, correct collaborators, all eight stores, colors, formulas, clean totals, no stale pending/migration state, and no competing file using the target month name in the monthly folder.
5. Remove temporary maintenance helpers before deployment/public access, then reopen admission only after all checks pass. A smoke scan creates data: do not contaminate the clean beta workbook unless explicitly requested, and reconcile any authorized test record afterward.

## Risks and boundaries

Drive/Sheets and Script Properties are not one transaction. Keep the persistent scan pause until all stages and their read-backs succeed. ScriptLock does not block human edits or old executions already outside the lock. Revision history/normal Trash are recovery mechanisms, not justification for guessing which file or row is a duplicate. No live reset has been performed by publishing this checklist.
