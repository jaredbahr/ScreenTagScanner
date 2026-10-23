# Release and development source

The default branch is `main` (renamed from `ccr-33fb9a05-rmui7r` on 2026-10-22). Since 0.13.19 (2026-10-22) it contains the deployed twelve-file runtime and all default-branch work, so develop from a freshly pulled default branch, not from the old `integrate/*`, `reconcile/*` or `proposal/*` branches. The reviewed baseline and runtime inventory are in `release/manifest.json`. Current state and standing rules: [docs/STATUS.md](docs/STATUS.md). A draft PR does not update the default branch or Google.

- **Triple-check every change: this runs a real business.** Author self-review + tests, an independent review
  before merge, and a read-only replay on real data when writes change; batched, reviewed deploys. See CONTRIBUTING.md.
- Fetch the canonical default branch before beginning or handing off a release. Preserve ancestry from both the last verified deployment and current upstream. Do not replace the twelve-file runtime with an older nine-file tree.
- Run `npm test` (no install or dependencies required): every offline suite; the free `tests` GitHub Action runs the same on each push. Before a deployment handoff, commit the candidate and run `npm run release:validate`: the release gate plus every suite sequentially, with minimum case counts. Never use the paid extraction harness as a substitute. Keep CPU use modest.
- Before deployment handoff run `npm run release:check -- --fetch`. It performs a read-only Git fetch and rejects new upstream work missing from the candidate. Offline checks cannot certify remote freshness or Google's current saved source.
- Use the exact tested SHA. Verify Google's saved source against the recorded deployed pin, read back the complete runtime, preserve URL/access/settings/properties/triggers, and record the new immutable deployment receipt afterward. No backup reinstall, migrations, old-row rewrite, real month switch or paid scan is implied by a code update.
- Preserve merge ancestry when reconciling the default branch. A squash/rebase that discards the deployed baseline can correctly fail the ancestry gate; do not weaken the gate to publish it. Do not merge PRs, force-push, delete branches, change the default branch, or alter GitHub security/branch protections without applicable authority.
- The scripts are local safeguards, not server-enforced protection. Keep `release/manifest.json` current only from verified deployment receipts. Never include private project/workbook/trigger IDs, credentials, customer records, photographs or raw evidence.
# Contributor and agent guidance

## GitHub usage: no additional fees

Jared's policy is to avoid additional GitHub charges. Prefer local validation.
Before an operation that could consume metered GitHub services, verify that it
uses free service or fits the account's remaining included allowance. If new
fees are possible or the remaining allowance is unknown, stop and ask Jared
with the proposed operation, expected usage and uncertainty. Do not treat
routine publication approval as permission to incur fees. These instructions
are not an account-level spending cap.

- Inspect the actual head and target workflows and triggers before a push or
  PR, including reusable workflows, PR events, Pages builds and release hooks.
  A docs-only change or draft PR can still start jobs. Preserve a local patch
  for review when publication cannot be verified safe; do not add skip directives
  or disable checks to publish it.
- Run targeted local checks first, then the repository's required validation.
  Record the exact tested SHA, commands, results and limitations; distinguish
  later documentation commits from tested code. Keep required tests, security
  checks and release gates intact. A local pass never substitutes for a required
  hosted check; report a cost blocker instead of bypassing it.
- Batch coherent changes after local review. Reuse valid evidence for the same
  SHA, check for in-flight runs before requesting work, and avoid duplicate CI,
  gratuitous pushes, manual dispatches and reruns. Retry only a failed job with
  a diagnosed cause and justified retry; the fee/allowance check still applies.
- Report gross usage separately from included/free usage and net billed cost,
  with the billing period and source. Unknown cost is not zero. Standard hosted
  runner compute in public repos is generally free; this does not make every
  GitHub product free. Check larger runners, artifact/cache storage, Packages,
  LFS, Codespaces and paid review/AI usage separately against current terms.
  See [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions).
- Do not change budgets, spending limits, branch protection, required checks,
  workflow definitions, runner configuration or credentials to save cost without
  separate authorization. Do not merge just to deliver this documentation.

Read `README.md` and the setup/security documents relevant to the task. Start with the documented offline command `node tests/offline.test.cjs`; inspect the other tests for affected behavior. `tools/extract-test/run.mjs` calls a paid external model API and is not an offline substitute. Preserve customer-data exclusions and existing API request limits.
