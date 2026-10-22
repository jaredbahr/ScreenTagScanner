# Monthly Totals PDF candidate

Built separately against `bf00d0a3b61cb45c7fbf6ec8e091593b3e4b6d85`. Not deployed or published. Deploy only after the separate pinned deployment repair has finished and this candidate has been reviewed.

## Result

Start new month copies and verifies the normal blank template, then archives the **previous active workbook's Totals sheet only** before switching the active workbook. The PDF goes into the operation's pinned `MONTH_FOLDER_ID`, alongside the new workbook, named with the full month and year (for example, `November 2026`). Internal operation keys remain `2026-11`. Filename: `P & K Window & Screen Repair September 2026 Totals.pdf`. The PDF heading is exactly `P & K Window & Screen Repair September 2026` for an archived `2026-09` workbook, even if the new workbook is November or January. It never derives the archived month by subtracting one from the selected new month.

The current month comes from the existing ID-bound `CURRENT_WORKBOOK_MONTH` / `CURRENT_WORKBOOK_MONTH_ID` properties, or an exact full-month/year name such as `October 2026`. Legacy `Screens YYYY-MM` names remain recognized. New-workbook collision checks cover both name formats, while existing operation receipts and staging recovery retain their original IDs and internal YYYY-MM keys. An unknown label, missing Totals, unset folder, or non-forward target stops the operation before copying. Label the current workbook explicitly rather than guessing from today's date. Existing completed receipts remain idempotent; this feature does not backfill older months.

## Preservation and layout

- Source workbook, original Totals formulas, and the template are never modified or deleted.
- A private scratch spreadsheet copies only Totals formatting, then replaces formulas with evaluated source values. This prevents cross-workbook `#REF!` errors. Numeric formatting is retained; literal strings beginning with `=` are escaped. Existing formula errors block archival.
- The scratch heading replaces a recognizable P & K title row; otherwise a new title row is inserted. The supplied September photo was inspected as the heading reference.
- Google Sheets export selects only the snapshot sheet's `gid`, its populated range, portrait Letter paper, quarter-inch margins, and `scale=4` (fit to one page). Only a successful PDF response with one ordinary PDF page object is accepted. An unfamiliar PDF encoding or multiple pages stops activation for review.
- Temporary scratch files are recoverably trashed after completion. Cleanup failure does not invalidate a completed PDF; the completion receipt retains the temporary ID and an already-completed retry attempts cleanup again. No source file is trashed.
- The PDF inherits the folder's named people. It does **not** copy the workbook's additional `MONTH_EDITORS` grants; put intended archive readers on the folder. Link-shared folders remain refused.

## Immediate rollover and in-flight scans

Every admitted scan now records a small lease under the existing ScriptLock. A `finally` block surrounds admission and all processing, so it releases only that scan's allocated ID even if a property write succeeds but its response throws. It also covers invalid images and provider errors. Rollover checks live leases under that same lock and refuses while a scan is in flight; normally the user waits only for that scan's result and presses Start again.

Leases expire after ten minutes, so a killed execution or failed cleanup does not permanently block rollover or exhaust admission capacity. Safety does not depend on Google terminating executions within that interval: before any worksheet access or write, `saveScan_` checks the exact lease ID, original workbook binding, and deadline under the same ScriptLock as rollover. An expired scan can never write late to the archived workbook even if its execution resumes. Store/log changes are flushed before releasing the lock. An expired scan reports that no worksheet data was saved and asks the user to review the active month before retrying. Orphan leases are filtered before the 40-live-lease capacity check. Normal scans keep their paid-call limits and original workbook pinning; leases add no paid API call. Corrupt lease state or future timestamps still fail closed for owner review, but ordinary interruptions recover without manual property edits.

For first deployment of this feature, stop new scans and let all executions of the old version finish before enabling the new version. Old executions did not register leases. Do not edit source Totals, template, properties, or permissions manually while a rollover is pending; human edits do not honor ScriptLock.

## Failure/retry contract

Archive failure prevents the active-workbook switch. The existing pending journal blocks new scans and keeps the already-created new workbook for retry. Retry the **same** target month from Settings.

Scratch and PDF creation each save intent before the external create call, use unique operation-specific staging names, and save returned IDs before rename. If a call throws after creating the file, retry locates that exact staging file. If the earlier result cannot be found, retry does not create another file: owner reconciliation is required. A similarly named human-created final PDF is never silently adopted. Final-name collisions, non-private access, missing/trashed PDFs, and unexpected locations block the switch.

After the PDF exists, failed activation/bookkeeping retries reuse it and the new workbook. A post-switch retry preserves any new-month manual data. Completion receipts record PDF ID and archived month. Previous-version pending rollovers require owner reconciliation rather than silently upgrading midway.

## Validation and release gate

Run each `tests/*.test.cjs` with Node. Existing month-rollover tests isolate the original workbook transaction with a stub archive; `month-archive.test.cjs` explicitly enables the real archive helpers and tests creation uncertainty, failures, duplicate prevention, prior-month headings, in-flight gates, evaluated snapshots, single-page response validation, and post-switch retries.

All tests are synthetic, offline, and make no real Google changes or paid extraction calls. Fake service success is not live Drive/Sheets proof. Before release, use a separately authorized disposable workbook/folder to visually inspect a PDF at actual Totals dimensions, verify one page and readable heading/totals, actual Drive ACL inheritance, merged cells/formatting, and recovery. The PDF page-object check deliberately fails closed if Google's encoding changes; it is not a general-purpose PDF parser. Confirm archived month metadata and no old-version in-flight runs before a production rollover. Include the new `MonthArchive.gs` file when eventually deploying; existing OAuth scopes suffice.

Lock flushing reference: https://developers.google.com/apps-script/reference/lock/lock#releaseLock()

Reference export pattern: https://developers.google.com/apps-script/samples/automations/generate-pdfs

On 2026-10-19, disposable synthetic and original-template-copy tests executed the actual archive helper in Google using existing scopes. Both produced one Letter page with the complete heading and all eight stores. The template-copy PDF matched all 73 expected numeric amounts, including a synthetic $9,083.16 grand total. Source formulas/values and the original template were unchanged; journal retry reused one PDF and inherited named-folder access was verified. Template geometry yields compact approximately 7.9-point body text with a 14.2-point heading, visually checked as readable. These checks did not execute live `startMonth`, use customer data, or prove a later formatting revision. Raw private evidence and validation helpers are intentionally excluded from the repository.
