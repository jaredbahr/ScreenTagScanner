# Source reconciliation — 2026-10-20

## Provenance and review shape

The source lines share ancestor `bf00d0a3b61cb45c7fbf6ec8e091593b3e4b6d85`.
The default branch is `ccr-33fb9a05-rmui7r`, at
`07afdacca6649bac3a066d712331ae133cb0c1ce` (0.13.11-draft).
The newer implementation is preserved in draft PR #2,
`feature/monthly-totals-pdf-0.13.11`, at
`c619d857a73dc8a0757ecf6b3da8cbc510d2353d`. Its production source is
`3add29e757129b04554b9de180341a768d399b97` (0.13.14-draft), followed by
the October audit documentation. Earlier editor-sharing, Scans-last-tab and
shared-month-folder changes are already ancestors of the shared base.

Branch `reconcile/scan-safeguards-20261020` starts at that newer tip. Its narrow
draft PR targets PR #2's branch so the two existing PRs and both source lines
remain in GitHub without a second competing full-release PR. No history is
rewritten. The cost guidance from PR #1 was inspected and followed.

## Reconciled scope

Only the missing safeguards from `07afdac` are ported: highlighted handwritten
parts below printed SKU lists must appear in both literal extras and structured
parts; obscured leading ticket digits require uncertainty; numeric tickets of
length other than seven receive a warning while retaining their exact digits.
The combined source version is 0.13.15-draft. There is no new pricing rule.

Existing PK-versus-retail rates, uncertain-parts holds, ordinal/group scope,
rescan and receipt controls, standalone additional labor, monthly PDF archives,
and all eleven production files are retained. A prompt instruction and synthetic
post-extraction fixtures cannot establish photographic OCR accuracy. A reported
successful corners scan is consistent with keeping the existing pricing logic
and uncertainty hold; it does not justify a global pricing change.

## Deployment and data boundary

The pre-reconciliation live pin was immutable Apps Script version 8,
source `3add29e757129b04554b9de180341a768d399b97`, with all eleven files matched
as recorded in [the October audit](OCTOBER_BETA_AUDIT.md). This Git reconciliation
does not change that historical receipt. Older V6
statements in the historical ledger are superseded by that later audit.

The user subsequently authorized deploying the tested combined source to the
existing deployment, preserving its URL and settings. October workbook data is
live: no cell writes, row clearing,
reset, workbook replacement, migrations, cleanup or tag rescans are authorized.
No private identifiers, photos, credentials or raw customer evidence are included.

### Version 9 deployment receipt — 2026-10-20 00:30 UTC

The coordinating cloud browser worker reported successful deployment and
verification of immutable **version 9**, description pinned to
`593ff44d689dea93f7f23950795828994e6e65f2`. Before editing, all eleven saved
production files matched `3add29e757129b04554b9de180341a768d399b97`. Only
`Extraction.gs` was updated to the tested reconciliation source and verified
after reloading. The original deployment identity, `/exec` URL and settings
were retained; the health response showed **0.13.15-draft**.

The worker reported no spreadsheet, property, trigger, permission, migration,
rescan or paid-call actions. This is the cloud worker's receipt, separate from
this checkout's offline checks and earlier read-only health check. No private
project identifiers or raw browser evidence are reproduced here. Version 8
remains the historical prior pin; backup implementation and trigger activation
are separate work and are not included in version 9.

## Offline validation

Run `node tests/offline.test.cjs` first, then each other `tests/*.test.cjs` file
sequentially. The new `reconciled-safeguards.test.cjs` uses invented ticket
identifiers and inert post-extraction fixtures. It checks literal tickets,
review warnings, leading zeroes, uncertain readings, handwritten corners at the
existing PK rate, missing/uncertain structured evidence, rescans and group credit.
The existing suites cover monthly archives, additional labor and other retained
controls. No paid extraction harness or GitHub Actions run is requested.

All **265 tests across 14 suites passed** for source
`593ff44d689dea93f7f23950795828994e6e65f2` (257 retained tests plus eight new
safeguards). `git diff --check` passed. A later documentation-only commit records
the version 9 receipt without changing that tested/deployed production source.
