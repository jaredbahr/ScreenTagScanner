# October beta reset audit

Status as of 2026-10-19 08:53 UTC: **ready for beta scans**. The retained October workbook is clean and active, scan admission has resumed, and all temporary maintenance files have been removed from saved HEAD. The original scanner URL and immutable deployment version 8 remain unchanged.

## Verified release and reset

- Deployed version 8 runs `0.13.14-draft`, source commit `3add29e757129b04554b9de180341a768d399b97`. All 11 production project files, including the unchanged manifest, were checked byte-for-byte against that commit after helper removal at 08:53 UTC. The release's 257 offline tests passed before deployment.
- The existing October workbook was retained and named **October 2026**. No replacement production workbook was created. The four renamed city tabs and their colors remain intact.
- All eight stores' header-derived entry rectangles were restored from the clean template, including formulas, sequence fields and approved defaults. Test inputs and receipt notes were removed. The Scans body was cleared while preserving headers and sheet identity.
- Full verification passed for clean entries, Scans, formula audit, clean-template Totals equivalence, unchanged template, and protected non-entry state. Counters and footer/Totals formulas were retained. No OCR smoke scan was performed, so verification did not add a new job.
- The active pointer and current-month metadata now identify October 2026. Exact obsolete October/November test rollover receipts were reconciled and removed; no pending rollover or migration journal was discarded. Migration completion was aligned to the verified active workbook and template. Quota safeguards and credential/configuration properties were preserved.

## Recovery and maintenance safeguards

A named pre-reset Sheets revision was verified. One private forensic copy of that exact revision was justified when a protected-format fingerprint stopped the reset; it reproduced the original baseline exactly. No production workbook was restored or replaced during diagnosis.

The project-level Sheets REST API was disabled. Maintenance used the already-authorized native SpreadsheetApp service without enabling APIs or adding OAuth grants. Temporary owner-invoked helpers were kept outside the repository and never included in a deployed version.

Two guarded stops were resolved from exact before/after evidence:

1. Native getters changed content-derived automatic-alignment labels when input values were cleared. Only `general`, `general-left` and `general-right` were canonicalized; explicit alignments and other checks remained distinct. The transition proved equality against the forensic baseline and retained the original hashes.
2. Native range restoration changed 2,494 Manhattan input-cell font families. Only those exact font cells were restored from the forensic copy, with literal read-back and reproduction of the original protected-state hash. Subsequent range writes capture and restore original font families in a finally block. No broad baseline refresh was accepted.

Native verification covers values/formulas/notes, number formats/backgrounds, font properties, alignment/wrapping observations, validation, grid counts, frozen counts, merges and tab colors. It does not independently snapshot every pixel dimension, protection object or the distinction between overflow and clipped unwrapped text. Maintenance does not change those unmeasured properties.

## Final completion evidence

- The inactive November test workbook and original pilot TEST workbook were moved to normal, recoverable Drive Trash after identity, inactivity and unchanged modification-time checks. They were verified in Trash; nothing was permanently deleted or purged. The earlier synthetic validation folders and export scratch workbooks had also been moved to recoverable Trash, with local PDF evidence retained.
- A fresh monthly-folder inventory contained only the retained **October 2026** workbook, with no competing November workbook or October archive-PDF filename. Restricted sharing remained the owner plus the intended collaborator as Editor; no public/domain access or new grants were added.
- The reviewed resume stage reran clean-state, template and collision checks. At 08:37:12 UTC it logged **Clean October beta ready**, then Google reported a post-success `IllegalStateException` during finalization. The execution was not blindly rerun. An independent, narrowly scoped project-settings read at 08:49 UTC confirmed the persisted recovery stage was `complete`, all eight stores were recorded complete, the scan-pause property was absent, and the active/current-month metadata still pointed to October 2026. The generic server exception is recorded rather than hidden; its precise internal Google cause was not established.
- The temporary maintenance helper was removed from saved HEAD. All 11 remaining production files matched the pinned release exactly. A fresh request to the unchanged deployed health endpoint at 08:53 UTC returned **Version 0.13.14-draft**. The scanner and Settings interface had also loaded successfully in read-only checks.
- The named pre-reset revision and a private forensic recovery copy remain available. The forensic copy is outside the shared monthly folder and does not compete with scanner month/archive names.

These checks establish deployment, reset, access, cleanup and resumed admission readiness. They do **not** claim a paid OCR end-to-end test or a real production month rollover after the reset. Monthly PDF behavior was exercised separately with the previously documented synthetic and template-copy archive validations.

Private file IDs, raw receipts, customer/test rows, helper source, credentials and private recovery paths are intentionally excluded from the repository.
