# Size/QTY evidence integration — 2026-10-21

## Baseline and provenance

The release watch recorded the official repository at 05:17:39 UTC with no
`main` branch, tags or GitHub releases. Its default branch remained at
`07afdacca6649bac3a066d712331ae133cb0c1ce`; draft PR #4 held the newer source
already deployed to Google. The coordinating browser worker freshly verified
**0.13.16-draft**, immutable deployment **version 10**, source
`5ed9a8a97717afd9580555e23cb43ea4b813bbe6`, and confirmed backups were installed.
That is the deployment baseline, regardless of default-branch or draft status.

The default branch then published
`c7e7fdb9672515a6ea302c46ea9109baaed7c009` at 05:21:25 UTC. It reports
0.13.12-draft and descends from the older `07afdac` line. Its nine-file runtime
omits `Backup.gs`, `ExtraLabor.gs` and `MonthArchive.gs`; adopting the whole tree
would also lose newer city-tab lookup, rescan, lease and other controls. The
original candidate passed its 176 tests across seven suites, which cannot
certify the deployed features absent from that tree.

Branch `integrate/qty-evidence-20261021` starts from the exact deployed `5ed9a8a`
source, manually integrates only the intended extraction/billing evidence
change, and uses forward version **0.13.17-draft**. No old branch is merged,
rewritten or substituted. The original source commit claims prior tag-based
approval; this task did not independently inspect those original photographs.
All new fixtures use invented identifiers and synthetic post-extraction data.

## Intended rule and conservative guards

The new plain-string fields `qty_rows` and `line_totals` preserve literal row
readings. When numeric billed inches disagree with rounded dimensions:

- All written totals must imply the same whole inches at the existing material,
  spline and labor rates, agree exactly to the cent, and be corroborated by the
  rounded size or a clear QTY-row majority.
- With no totals, a strict majority of at least two QTY readings may settle.
  A written but unreadable/contradictory total blocks this fallback.
- Explicit size/slip conflicts and actual correction/refund flags remain
  manual during disagreement resolution. Multi-screen repair forms retain
  their existing blank-billing hold. Existing multi-frame build bases remain.
- Automatic settlement uses the existing dimension review envelope (each side
  6–120 inches; whole inches 12–240), known materials and at most three rows.
  Zero, negative, fractional, oversized/nonfinite, malformed or ambiguous
  evidence cannot create new automatic amounts. Missing internal total rows
  retain `?` placeholders rather than shifting later totals to another rate.

These guards close reproducible upstream gaps: synthetic QTY majorities of
zero or an implausibly large number filled billing in the original candidate,
although flagged; this integration keeps those amounts blank. The upstream
one-cent tolerance is tightened to literal cent agreement. These are
conservative automatic-review guards, not new rates or a changed price table.

Every successful settlement remains flagged. Original dimensions and billed
QTY remain unchanged in Scans; the store note records the chosen basis and
literal row evidence. Unsettled disagreements also retain row evidence in
their review note. Ticket uncertainty remains literal, with the seven-digit
warning performed by the script; the model no longer judges ticket length.
An exact rescan with newly available row evidence still cannot rewrite a
previously held store row. Historical reconciliation remains a separate manual
decision; the new source only governs eligible future writes.

## Preserved production and rollout boundary

Only `Extraction.gs` and `Workbook.gs` change in the twelve-file runtime.
The other ten production files, including `Backup.gs`, `ExtraLabor.gs`,
`MonthArchive.gs`, `Code.gs` and the OAuth manifest, match deployed `5ed9a8a`
exactly. PK-versus-retail rules, uncertain-parts holds, ordinal/group receipts,
canonical-store duplicate checks, city-named tabs, additional labor, monthly
PDFs, admission leases, quotas, backup configuration and backup triggers remain.

No migration, old-row correction, customer-tag rescan, paid OCR test, workbook
replacement or live configuration/access change is part of this integration.
No workbook columns, Script Properties, OAuth scopes, model/token limits,
failure-email behavior or trigger installation logic are changed. The extra
structured evidence can affect ordinary response size, but no additional API
call or automatic retry is added. Literal source evidence still requires human
review; synthetic tests do not prove photographic OCR accuracy.

The coordinating parent/browser worker must authorize the exact tested pin,
verify saved Google source against deployed `5ed9a8a`, and sync/read back the
complete twelve-file source with only the two intended edits. Update the
existing deployment to a new immutable version while preserving its identity,
URL, access and settings. Verify health/version and read-only source equality.
Do not reinstall backups, change properties/triggers/permissions, rewrite old
rows, execute a month change or rescan customer tags as a test. Stop if Google
asks for any new OAuth/security permission. Record deployment evidence
separately; this document does not assert that 0.13.17 is already live.

## Offline validation

Run `node tests/offline.test.cjs` first, then all other `tests/*.test.cjs`
sequentially. `qty-evidence.test.cjs` covers settlement, holds, row alignment,
malformed/implausible evidence, original-reading preservation, both layouts,
multi-frame behavior, alias rescans and group/uncertain parts. Existing suites
cover the preserved backups, rollover/PDFs, standalone labor, dates, routing,
schema/admission and UI behavior. No hosted Actions or paid extraction harness
is needed. Report the exact tested SHA and full results with the draft PR.
