# Canonical source and release checks

> **2026-10-22:** the two lines below were joined on the default branch as **0.13.19** (merge of PR #6 into
> the default branch, renamed `main` the same day). Develop from the default branch. `npm test` runs every suite (also in the free
> `tests` GitHub Action, which the manifest now allows); `npm run release:validate` runs the release gate
> plus every suite. For the next deployment, the files changed against deployed `ac44e4e` (version 11) are
> `Code.gs`, `Extraction.gs`, `Parts.gs`, `Routing.gs`, `Upload.html` and `Workbook.gs`; the other six are identical.
> The history below is kept as written.

## Why the branches diverged

Google was deployed from the newer source preserved in draft PRs #2–#5. Those
drafts were not merged into the default branch, `ccr-33fb9a05-rmui7r`. Later
default-branch development therefore continued from an older nine-file source
line. A Google deployment and a GitHub branch/PR publication do not update the
default branch automatically. There is no `main` branch and no GitHub Release
event establishes the current production pin.

The last verified baseline is source
`ac44e4e53704378887a47645c4a3ca44e1546be9`, **0.13.17-draft**, immutable Google
**version 11**, confirmed by the coordinating browser worker at **2026-10-21
19:42 UTC**. Backups are already installed. The new upstream commit
`e1c4b68b992d366d42386d791b9979da2798eeab` adds review tiers on the older line
and still reports 0.13.13-draft. Its entire tree must not replace production.

## Prepared reconciliation and remaining decision

`integrate/review-tiers-20261021` combines the live history and the new upstream
history for a PR **into the existing default branch**, with forward source
version **0.13.18-draft**. The intended review-tier changes are integrated while
retaining the stronger deployed store aliases, duplicate-tab rejection,
canonical historical receipts/journals, QTY/dollar evidence guards, labor,
monthly archives, admission leases and full-workbook backups.

The related histories are reconciled locally in a merge commit after explicit
file review; no GitHub PR is merged by this task. **The default branch remains
behind until the owner merges the reconciliation PR.** Use a normal merge
commit or an authorized fast-forward that retains both histories. Squashing
or rebasing away the recorded live ancestor will fail the release gate.
Existing PRs are retained; deciding how to close/supersede old stacked drafts
is separate from preparing this PR. No branch is deleted or force-pushed,
and no default-branch/security/merge-setting changes are made.

After reconciliation is merged, all new development should start from a freshly
fetched default branch. Until then, start from this reviewed integration branch.
The canonical branch name, minimum upstream ancestry, last verified deployment,
twelve-file inventory, baseline blob IDs, feature entrypoints, regression suite
inventory and minimum test counts are recorded in `release/manifest.json`.
Root `AGENTS.md` and `CLAUDE.md` direct both development tools to this process;
these files become available on the default branch only after reconciliation.

## Local automated gates

No dependencies or paid model call is needed:

```text
npm test                          # every suite (same as CI)
npm run release:validate          # release gate + every suite, on a clean committed checkout
npm run release:check -- --fetch  # structural gate against the freshly fetched default branch
```

`npm run release:validate` requires a clean committed checkout, checks deployment and upstream
ancestry, production/module inventory, feature contracts, manifest/access/scopes,
public RPC functions and forward versioning, then runs every approved suite
**sequentially**, starting with the server suite. Missing suites or fewer
executed cases than the reviewed minimum fail validation. The process stops on
failure and does not dispatch or rerun hosted jobs. Tests use synthetic fixtures.

The first command is offline. The second explicitly fetches only the canonical
default branch from the configured origin and verifies that its freshly fetched
tip is an ancestor of the proposed release. If someone has published another
update, reconcile/review/test it rather than deploying a stale candidate.
The `--ref SHA` option on the structural checker can inspect a different commit;
full regression validation requires that exact commit checked out at HEAD.

These are local gates and contributor instructions, not GitHub-enforced branch
protection. Someone can bypass local scripts; preventing that at the server
requires separate policy/authority and potentially a reviewed CI cost decision.
No protection or budget settings are changed here.

## Google deployment handoff

1. Record the exact tested SHA and run the fresh-fetch structural check. Inspect
   current workflow/Pages/hooks and fee-sensitive checks before publication.
2. Verify Google's saved twelve-file source against the manifest's last verified
   source. A version label/health response alone is insufficient; stop on an
   unexplained mismatch or another worker's changes.
3. For 0.13.18, only `Code.gs`, `Workbook.gs` and the version in `Extraction.gs`
   change relative to deployed `ac44e4e`. Read back all twelve files against the
   proposed pin. Preserve deployment identity, URL, access/settings, properties
   and installed backup triggers. Do not reinstall backups or run a migration.
4. Update the existing deployment to a new immutable version. Verify health,
   version and saved source read-only. Do not rescan a customer tag, rewrite
   historical rows, run a real month switch or change permissions to test it.
5. Record a sanitized receipt containing source SHA, immutable version and
   verification time. Update the manifest's last verified deployment and its
   baseline blob IDs in a documentation/metadata commit; retain the exact tested
   production pin. Never put private target IDs or raw evidence in GitHub.

The review tiers apply only to eligible future scan writes. Money/placement and
unknown reasons remain row-yellow/phone warnings/Scans YES. Ticket/date/sequence/
name hints tint their individual cell; phone and nonfinancial dimensional notes
remain in Scans. On legacy layouts without a sequence column, that hint uses
the Name note rather than overwriting Date out. Monetary language outranks
metadata hints; pending/interrupted/unplaced states always require reconciliation.
Existing historical review flags are not cleared or repainted, including on
exact rescans. QTY/dollar settlement and all existing monetary holds are retained.

The classifier is heuristic. Unknown wording defaults to row review; tests do
not certify every future OCR phrase, photographic accuracy or device rendering.
No customer photographs or historical review counts were independently audited
for this release. Any unexpected OAuth/security prompt requires action-time
approval; this source introduces no new scopes or public endpoints.
