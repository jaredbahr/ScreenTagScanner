# Screen Tag Scanner: notes for Claude Code

Read [docs/STATUS.md](docs/STATUS.md) first (current state, standing rules, open questions), then
[CONTRIBUTING.md](CONTRIBUTING.md), [AGENTS.md](AGENTS.md) and [docs/RELEASE_PROCESS.md](docs/RELEASE_PROCESS.md).

- The default branch `main` (renamed from `ccr-33fb9a05-rmui7r` on 2026-10-22) is the single source. Since 0.13.19 it contains the
  deployed twelve-file runtime (backups, monthly PDFs, additional labor, leases) plus all default-branch work.
  Pull before starting; Codex also pushes here.
- `npm test` runs every offline suite (CI runs the same). Before a deployment handoff, on a clean
  committed checkout: `npm run release:validate` and `npm run release:check -- --fetch`.
- If the release gate reports missing deployed or upstream ancestry, reconcile with a merge; never weaken the gate.
- **Triple-check every change: this runs a real business.** Author self-review + tests, an independent review
  before merge, and a read-only replay on real data when writes change; batched, reviewed deploys. See CONTRIBUTING.md.
- Never change the live sheets without Jared's approval. No customer data, Google IDs or secrets in GitHub.
  Ask before any paid scan. Codex does Google deployments.
