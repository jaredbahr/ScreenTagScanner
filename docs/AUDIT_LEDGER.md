> **Archived 2026-10-22.** This ledger covers Versions 1–6. From now on, changes are listed in
> [CHANGELOG.md](../CHANGELOG.md) and each Google deployment is a GitHub issue labelled `deployment`
> (see [DEPLOYMENT.md](DEPLOYMENT.md)). Kept unchanged below as history.

# Screen Tag Scanner — audit ledger

Updated **2026-10-13 13:32:20 UTC**. All times below are UTC unless explicitly marked America/Chicago. This is a project record of requested behavior, implementation and verification; it contains no credentials, workbook IDs or customer records.

## Requirements and status

| User direction | Repository implementation / evidence | Google status | Limits / pending work |
| --- | --- | --- | --- |
| Keep code in this repo; Google-hosted phone page at the same deployment URL | Upload.html, Code.gs; PHONE_UPLOAD.md | **V6, c92d440 / 0.13.7-draft; published 13:28 UTC** | Existing /exec endpoint retained; V6 cloud receipt below establishes live state |
| Pixel camera-first, secondary existing-photo choice, explicit Scan tag; keep ~2000px detail | Upload.html capture input and fitPhoto; upload-ui.test.cjs | V6 camera/photo controls verified | Actual Pixel capture/fit not run for V6; capture varies by browser |
| Simple normal one-screen phone flow; essential warnings visible with expandable details | Compact preview, result summary, Needs review, reconciliation summary, native Details | V6 deployed UI inspected | Actual Pixel fit and universal device-fit certification remain untested |
| Remember-phone behavior accepted; save only after positive server authentication; reachable Forget | scanTag authentication signal; Upload.html storage checks and Forget tests | V6 password / Remember controls verified | Synthetic persistence/error cases tested; live persistence not certified |
| Separate Tag x of N immediately after Name in both store sections across TEST and TEMPLATE, preserving existing data/formulas | aa81b9a; Layout.gs adaptive writer/journal; sequence-migration.test.cjs | Migrated 03:27:03, resumed 03:30:46 | 32 columns across 16 tabs; 14 backfills and one review blank. Only unambiguous matches filled; no Scans/Totals restructuring |
| Glass/plexiglass: exact 74 material and four labor SKUs for classification only; ignore glass-reference prices | Routing.gs and GLASS_ROUTING.md; 11 routing cases | V6 | Filled-job evidence required; fiberglass is not glass, tempered is not thermopane, unknown items are NOT PLACED; no new glass pricing math; live V6 OCR untested |
| 2024 parts reference is current; PK means earnings; keep literal part numbers/quantities, count group work once | Parts.gs, structured extraction, validated receipts and rescan review; 23 synthetic tests | V6; live PK processing untested | Spring pins are each: 35 earns $17.50 once. Explicit SKU/quantity required; incompatible units, changed group quantities, customer conflicts and build-base overlaps need review. Each sibling gets total/reference notes |
| Date in = written tag date; missing year = current scan Chicago calendar year; explicit year retained; Date out = scan date | User reaffirmed current year; c92d440, DATE_RULES.md; 14 date cases | V6; live date write untested | Never infer a previous year from a later month/day. Raw date retained; invalid dates blank with review; later dates retained with review |
| All entries are TEST; clear them all while preserving template, sequence columns and formulas | Cloud-only authorized reset; no desktop deletion | Cleared 03:46:58; verified/resumed 03:52:03 | Supersedes historical misroute/ticket correction. No customer identifiers are reproduced here |
| Automatic failure emails off, including unplaced failure notices; phone errors remain truthful | Approved **03:41 UTC**; a52d7cf removes all MailApp calls, false notices and send-mail scope | No-mail source/manifest retained in V6 | Minimal diagnostic records only; unrelated email/history untouched; no new permission grant |
| Start new month under Settings; same scanner password freshly re-entered for every change | Month.gs and Settings; 16 month and 31 UI cases | V6 Settings/Back screenshot and accessibility checks passed; real month copy not run | Fresh migrated blank template copy, verify before atomic active-ID switch, preserve old files; no automatic trigger/email/sharing; in-flight scans keep admitted workbook; live rollover untested |
| No remembered token automatically submitted for month change; confirmation input not stored/logged | Separate masked confirmation field, explicit Review/Start; UI regressions pass | V6 safe Settings/Back navigation verified | No real month copy or property change; authentication/change behavior tested synthetically |
| Interrupted saves require reconciliation before any manual row is added | PENDING journal/save guard, orange PENDING/INTERRUPTED, controlled RESCAN, best-effort advisory count; 50 server cases | V6; actual interrupted Google save not invoked | Check existing/partial store rows first; add only after confirming missing. Legacy logs imported later need reconciliation |
| Record directions and show audit evidence to Claude | This ledger plus linked source/tests/runbooks | Repository-only document | Pending features remain pending until their commits and cloud deployment receipts are recorded |

## Verified implementation history

| Revision | Version/deployment | Evidence |
| --- | --- | --- |
| 409e0d8 | 0.10.1 | Cloud receipt: 21 offline tests plus live conflict/date/billing test passed |
| 5c718a2 | 0.10.2 | 23 offline tests plus 42 real-Sheet literal-write cases passed; this does not certify every possible input |
| 262666ebaeca36f2516fd4bc7a939662499acd3d | V1 / 0.11.0 | 37 server + 7 inert UI tests; phone page and shared admission limits |
| e5599df8c12dbf6962b441bf01f4675143af9977 | V2 / 0.11.1 | 37 server + 11 inert UI tests; camera-first and safe retakes |
| 05b6fb5ed37926c132fb8ac674fb5dba6d29a83b | V3 / 0.11.3 | 43 server + 22 inert UI tests; explicit authentication for persistence, visible review summary and reconciled cashier-slip rules |
| b813786e8183024f9fd892de56a962721cf98a74 | 0.11.4, included in V4 | Compact saved-password controls and removal of how-to text preserved from Claude |
| aa81b9add1dd3116490a06a9535540d5bb600171 | 0.12.0, included in V4 | 43 server + 23 UI + 19 migration tests; legacy/partial/new layouts, interruption recovery, fresh identity-safe backfill |
| ad0fb3ba95e01d218a8ac8a2ad8423af849f43e8 | V4 / 0.12.1, previous Google revision | 95 synthetic tests: 43 server, 23 UI, 19 migration, 10 glass-routing. Seven runtime files synced/verified by cloud worker |
| c24edacddbc563be02ca2af79af9a43bdb73b6ac | 0.13.0, repository only | 117 synthetic tests: 43 server, 29 UI, 19 migration, 10 glass-routing, 16 month-rollover |
| a52d7cf54da1278533994bd17605ae3a4f830c05 | 0.13.1, repository only | 119 synthetic tests including 45 server; parent independent reviewer reproduced all 119 |
| 587cd4f1928e7904a2fc49d62476e3ab01700957 | 0.13.2, repository only | 10 date-rule tests in addition to the preceding suites |
| de91422e090d0677c6b6a526377e618975ba9bc1 | 0.13.3, repository only | **140 synthetic tests pass: 45 server, 29 UI, 19 migration, 10 routing, 16 monthly rollover, 10 date, 11 parts earnings** |
| c9655fd376c987a848874580bec936494f5fdfb1 (final source/audit bundle abdfdec2e9e5fcb94ede17d00a24a6aa08129fdb) | V5 / 0.13.5-draft, previous Google revision; 06:06 UTC | Independent reviewer passed all 152 synthetic tests plus 18 additional counterexample/control checks. Nine saved runtime files reload-verified, with qualified exceptions and UI-only live checks below |
| c92d44099348516c1be6eeef81beb9bef37f69d2 (reviewed bundle e4dd2a07f24df2f4854ccbba93094160f5b9da3e) | **V6 / 0.13.7-draft, current Google revision; 13:28 UTC / 08:28 Chicago** | Independent reviewer passed 164 repository tests, 18 PK checks, 12 save-fault tests and advisory reproductions. Nine files reload-match with the documented fixture/whitespace exceptions; safe live UI checks below |

## Cloud receipts and preservation

- Column migration completed **03:27:03** and scan admission resumed **03:30:46**. Both workbooks retained **11,514 formulas each**, with full preservation checks. Backfill used fresh destination/log identities; uncertain cells were left for review.
- Failure email stopped immediately by clearing only the nonsecret recipient setting at **03:43:09**; source cleanup at a52d7cf was subsequently saved with V5.
- Authorized TEST reset at **03:46:58** cleared 14 screen records, one window record, 20 Scans records and 14 synthetic QA rows: 700 approved input/log/QA cells and 15 test notes. All 11,514 formulas remained, calculated Totals were zero, TEMPLATE was unchanged, and headers, counters, W markers and template formatting were preserved.
- Full cleanup validation/resume completed **03:52:03**. Temporary helpers were removed; seven production files were saved at ad0fb3b plus the already-configured editor photo placeholder. Google remained V4. No real image/paid API call was made in this update batch.

## Verification boundaries and review entrypoints

Offline suites use synthetic data, a fake provider/Drive/workbook, and inert DOM/canvas/RPC objects. They test deterministic behavior, including authentication, quotas, duplicate prevention, literal writes, routing and simulated native formula shifts. They do **not** prove live OCR accuracy, every possible spreadsheet input, actual native formula calculation, every phone's capture behavior, or live browser-storage persistence.

Real-Google receipts come from the cloud worker's controlled inspections/verification and are separate from synthetic test counts. The V5 receipt below establishes deployment and limited live UI verification; it does not establish live OCR/date/PK behavior or a real monthly copy.

Source anchors: [Code.gs](../apps-script/Code.gs) (`processScan_`, `admitScan_`, `saveScan_`), [Workbook.gs](../apps-script/Workbook.gs) (`storeDates_`, store writers), [Layout.gs](../apps-script/Layout.gs) (adaptive layout and migration), [Routing.gs](../apps-script/Routing.gs) (classification), [Month.gs](../apps-script/Month.gs) (authenticated monthly copies), [Parts.gs](../apps-script/Parts.gs) (approved earnings, reservation receipts), [Upload.html](../apps-script/Upload.html) (scanner and Settings).

Tests: [offline.test.cjs](../tests/offline.test.cjs), [upload-ui.test.cjs](../tests/upload-ui.test.cjs), [sequence-migration.test.cjs](../tests/sequence-migration.test.cjs), [glass-routing.test.cjs](../tests/glass-routing.test.cjs). Runbooks: [PHONE_UPLOAD.md](PHONE_UPLOAD.md), [TAG_SEQUENCE_MIGRATION.md](TAG_SEQUENCE_MIGRATION.md), [GLASS_ROUTING.md](GLASS_ROUTING.md).

Additional tests/runbooks: [month-rollover.test.cjs](../tests/month-rollover.test.cjs), [date-rules.test.cjs](../tests/date-rules.test.cjs), [parts-earnings.test.cjs](../tests/parts-earnings.test.cjs), [MANUAL_MONTH_ROLLOVER.md](MANUAL_MONTH_ROLLOVER.md), [DATE_RULES.md](DATE_RULES.md), [PARTS_EARNINGS.md](PARTS_EARNINGS.md). Current package has nine runtime files, listed in PHONE_UPLOAD.md. No credentials, new OAuth grant, deployment, month creation or paid-image test was performed by this desktop source task.

Sharing: the designated owner retains files; TEST's approved workbook Editor access does not automatically authorize recurring sharing of new months. The script stays private. No purchases, credentials, new OAuth grants or broadened sharing are part of this ledger or desktop implementation.

Final desktop verification completed **05:06 UTC**, using the suites above and `git diff --check`. One initial invocation used the nonexistent filename `migration.test.cjs`; it was corrected to `sequence-migration.test.cjs`, whose 19 cases all passed. No implementation failure remained. Date commit was verified equal to the remote before the parts commit. Root/cloud must independently review and sync the nine runtime files at the final pinned revision, then record real-Google preservation/validation and deployment receipts. Until that receipt, the live revision remains V4/ad0fb3b.

## Predeployment independent review: 0.13.4 correction

This and the following 0.13.5 development section preserve the predeployment snapshots. Their V4/held/pending statements were true at the recorded times; the later V5 cloud receipt below supersedes their deployment status.

The parent independent reviewer found the following gaps at eb46eb0/de91422 **before deployment**. The earlier 140 passing synthetic cases did not cover them; that receipt is historical evidence, not a clean deployment verdict. Google remains V4/ad0fb3b. Corrections are committed and remote-verified at **01fe810436d6f2ce695f0a4f5ab7a3109207e296 / 0.13.4** and await a fresh independent review.

| Finding | Source correction / new evidence |
| --- | --- |
| Raw provider schema carried unsupported numeric/array constraints; UrlFetchApp has no SDK schema transformation | Removed maxItems/minimum/maximum from sent schema; retained prompt/local bounds. Regression captures serialized raw fetch payload and tests rejected local quantities/line count. [Official provider guidance](https://platform.claude.com/docs/en/build-with-claude/structured-outputs#json-schema-limitations) |
| Literal extras with empty parts array returned no review warning; enriched exact rescan stayed clean while earnings remained blank | Missing structured evidence now marks review; rescan preserves original review and requires original-row reconciliation. Fresh populated-parts control still earns $17.50 |
| Whole-group text contradicted per-tag flag, crediting each sibling | Conflicting evidence is held for manual allocation; consistent-group control earns once; unrelated explicit per-tag SKU control remains eligible |
| Group receipt scope suppressed another customer silently | Receipt captures normalized full/last name and phone identity; conflicts require review and do not claim that customer's total was paid |
| Raw OCR notes could forge authoritative payment receipts; malformed shapes disappeared silently | Scans Notes are audit-only, OCR markers escaped, receipt schema/actual store row/identity/value validated; malformed/changed receipts fail closed for review |
| Structured SKU/quantity could disagree with explicit literal evidence | Contradictions held; missing structured literal SKUs remain visible for review; matching positive controls still calculate |

Regressions cover both legacy and migrated store headers; new production assertions resolve Earning from headers. Fixture/test corrections during development are not live workbook changes. All provider/Google objects are inert synthetic fakes; there was no paid request, Google sync, deployment, OAuth grant, sharing or credential action.

Separate known issue: the reviewer reproduced duplicate **ordinary build/labor rows after a Scans-log append interruption at 587cd4f**, predating the PK commit. The new PK receipt prevents repeat pins credit in that scenario, but does not claim to fix base-row idempotency. That issue remains for separate source review; do not attribute it to the PK change or treat this correction as live certification.

Final correction receipt **2026-10-13 05:47:51 UTC**: **150 synthetic cases passed** (45 server, 29 inert UI, 19 sequence migration, 10 routing, 16 monthly rollover, 10 date, 21 parts earnings), plus `git diff --check`. Source pin 01fe810 was pushed and verified equal to the remote branch. The 21 earnings cases include exact phone-RPC reproductions, legacy/migrated header layouts, raw serialized provider payload, preserved local bounds, malformed/changed receipts and paid/pending negative controls. No production integration or paid API acceptance probe is claimed. Subsequent audit-only commits leave the nine runtime files identical to this source pin.

## Clean-rescan follow-up: 0.13.5

The independent reviewer reproduced all 150 previous cases and verified the original four PK corrections, then found an adjacent underbilling warning gap: an initially clean tag with no parts could later recognize 35 pins on an exact rescan, or a credited pins tag could later add two latches. The duplicate guard preserved the original earnings but returned no review signal.

Source **c9655fd376c987a848874580bec936494f5fdfb1 / 0.13.5** makes any exact rescan with `_parts_plan.items.length > 0` require review and records the unposted-earnings reason in Scans. It does not credit/rewrite the existing store row. Both reported variants are tested on legacy and migrated headers, with ordinary-rescan and fully-credited-parts controls that remain clean.

Targeted receipt **2026-10-13 05:56:51 UTC**: **23 earnings cases and 45 server cases passed**, plus `git diff --check`. The prior other 84 suite cases were unchanged and independently verified in the preceding 150-case review; this narrow correction does not claim a new full-suite run. Google remains V4/ad0fb3b, with deployment held and no paid requests or Google writes. The separately documented preexisting ordinary build/labor log-interruption issue remains open. A fresh independent review of c9655fd is next; no new decision was needed to implement this guard.

## Version 5 cloud deployment receipt — 2026-10-13 06:06 UTC

The parent/cloud worker reports publishing **Version 5 at 06:06 UTC on October 13** at the unchanged existing `/exec` endpoint, **Execute as Me / Anyone**. The reviewed final bundle was **abdfdec2e9e5fcb94ede17d00a24a6aa08129fdb**, whose runtime is identical to **c9655fd376c987a848874580bec936494f5fdfb1 / 0.13.5-draft**. This is a supplied cloud receipt, not a desktop deployment.

All nine saved files were reloaded and matched the pinned source: Code.gs, Extraction.gs, Workbook.gs, Layout.gs, Routing.gs, Month.gs, Parts.gs, Upload.html and appsscript.json. The only reported exceptions were the existing private test-photo-ID substitution and harmless manifest trailing whitespace. No Google script/sheet/photo IDs or substitution values are reproduced here. Raw provider schema retained 16 anyOf unions and no unsupported bounds; default admission limits remained 10/minute and 100/Chicago day.

The independent reviewer passed **152 synthetic suite cases** (45 server, 29 UI, 19 migration, 10 routing, 16 month, 10 date, 23 parts) **plus 18 additional original counterexample/control checks**. Those checks used synthetic data and do not certify real OCR or native end-to-end spreadsheet processing.

On a fresh deployed page, the cloud reviewer verified that Take photo, Choose existing photo, Settings, password and Remember controls were visible. Safe **Settings/Back navigation passed**; the masked fresh-password confirmation field and private-copy warning were visible. **No token was entered, Scan or Start month invoked, paid scan performed, or actual month copy made.** No workbook-data, script-property or sharing edits, credential entry or new permission/OAuth grants were part of these deployment/UI checks.

Qualified remaining limits: actual Pixel fit/camera behavior, live OCR/date/PK processing and a real monthly copy are **untested** for V5. The preexisting **ordinary build/labor duplication after a Scans-log append interruption remains open**: inspect a failed save in the workbook before retrying. PK receipt protection does not certify base-row idempotency. This deployment receipt does not broaden sharing, install triggers or authorize new production/test operations.

## Newest-build review and approved recovery/date correction: 0.13.7

This section is the 13:16 UTC predeployment snapshot. Its pending/V5 statements were true then; the V6 receipt below supersedes that deployment status.

The user requested syncing the newest Screenrepo build to Google. The parent reviewer inspected **57adef3ceca108928b40bbd7a97bf57cab32b4e2 / 0.13.6**, passing 159 synthetic cases, 18 independent checks and 12 save-guard fault controls across legacy/migrated layouts, including partial two-frame builds. That candidate introduced a durable PENDING journal before store writes, so exact retries of interrupted saves add no store rows. Those source checks do not establish a new live Google deployment; the latest supplied live verification still identifies V5.

The reviewer found three bounded recovery/advisory gaps, corrected in **c92d44099348516c1be6eeef81beb9bef37f69d2 / 0.13.7-draft**:

| Finding | Correction and regression evidence |
| --- | --- |
| A store row could exist after interruption, but the next reply said an earlier scan still needed placing; interrupted rows lacked orange fill | Pending rows are marked orange before the store attempt; INTERRUPTED rows remain orange. API messages, phone summaries and runbooks require reconciliation against existing/partial store rows, with a new row only after confirming it is missing. Completed clean rows clear their temporary orange fill. Store-write/Scans-completion fault cases on both layouts retain one store row and preserve formulas |
| Optional earlier-scan count read could fail after both durable writes, returning an unconfirmed-save error | Only this advisory read is caught. Completed saves retain success and show unavailable-review-status guidance. Actual store/journal-completion failures still return an error; no save verification is weakened |
| OCR correction text containing “already scanned” could remove a genuinely NOT PLACED row from the count | New exact retries use controlled **RESCAN** state. Count logic uses controlled placement state and Needs Review YES, never a review-reason substring. Legacy unresolved rows remain counted until reconciled; no existing records are automatically rewritten |

The candidate also inferred a previous year for a yearless month/day later than the scan day. The parent supplied the user's explicit decision: **“no it assumes this current year”**. The correction always uses the admitted Chicago scan-calendar year when no year is written, including numeric/named New Year cases and a current-year leap date. Explicit written years remain unchanged; invalid dates remain blank with review, and later dates are retained with review rather than moved to another year. The written-month-name parser and other concurrent candidate changes are preserved. DATE_RULES.md and SPREADSHEET.md reflect the reaffirmed policy.

Verification recorded **2026-10-13 13:16:51 UTC**: **164 synthetic suite cases passed** (50 server, 31 inert UI, 19 migration, 11 routing, 16 month, 14 date, 23 parts), plus `git diff --check`. Date/server cases were rerun after the user's decision; server tests were rerun after strengthening both-layout interruption controls. No real provider request, paid image, Google write, deployment, credential or new grant occurred in this desktop correction. A transient workspace transport failure recovered before committing, with changes checked intact. Source branch drift was checked against 57adef3; the correction preserves concurrent work.

The newest candidate is ready for fresh independent review and the parent-controlled Google sync. The supplied V5 receipt and its live-test limitations remain in force until a new deployment receipt is recorded. The older V5 ordinary-save interruption risk is still a live limitation; the new source guard/recovery controls are not claimed deployed by this ledger entry.

## Version 6 cloud deployment receipt — 2026-10-13 13:28 UTC

The parent/cloud worker reports publishing **Version 6 / 0.13.7-draft at 13:28 UTC (08:28 America/Chicago) on October 13**, at the same existing endpoint and **Execute as Me / Anyone**. The reviewed bundle is **e4dd2a07f24df2f4854ccbba93094160f5b9da3e**, with runtime **c92d44099348516c1be6eeef81beb9bef37f69d2**. This is a supplied cloud deployment receipt, not a desktop deployment.

All nine saved files reloaded and matched that pin, except the preserved existing private photo fixture and harmless manifest whitespace. Only five changed source files needed editing relative to V5: **Code.gs, Extraction.gs, Workbook.gs, Routing.gs and Upload.html**. Layout.gs, Month.gs, Parts.gs and appsscript.json remained consistent with the reviewed bundle. No private script/sheet/photo IDs, fixture values, secrets or endpoint IDs are recorded here. Defaults remained **10/minute and 100/Chicago day**.

Independent verification passed **164 repository cases** (50 server, 31 UI, 19 migration, 11 routing, 16 month, 14 date, 23 parts), **18 PK checks**, **12 save-fault controls**, and the bounded advisory reproductions. These are synthetic/fault-injection checks, not paid live extraction. The user-directed date rule is deployed: a missing written year uses the current admitted scan's Chicago calendar year; explicit written years are retained. Later month/day values never infer a previous year.

Live cloud verification covered the camera/photo, password, Remember and Settings controls. Final **Settings/Back screenshot and accessibility-tree checks passed**. Actual Pixel capture/fit, live paid extraction/OCR/date/PK processing and a real month copy were **not run**. The receipt reports no paid scan, month copy, script-property/workbook-data edit or new permission change. No desktop runtime edits or new Google actions are part of this audit-only receipt.

The cloud reviewer found current **TEST `Scans!T2:V1000` empty**. Within that inspected range there are no legacy V5 rescan-state/review records requiring migration; this is a scoped inspection, not a broader data audit. Importing older logs later requires reconciliation against existing/partial store rows before any new row is added. The deployed source now includes the pending journal/save guard and advisory fixes, but no actual Google interrupted-save fault was invoked. No remaining deployment blocker was reported; live-test limitations remain qualified as above.
