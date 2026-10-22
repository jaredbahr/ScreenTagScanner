---
name: Deployment record
about: Codex opens one per Google deployment (or a requested Google-side change)
title: "Deploy <version> (<short sha>)"
labels: deployment
---

<!-- NO CUSTOMER DATA, NO IDs. No script, sheet, folder or deployment IDs, no tokens, no names. -->

- **Commit deployed:** <!-- full SHA from the default branch, with a green `tests` run -->
- **Version shown by `/exec?health=1`:**
- **Apps Script version number:**
- **Deployed by / when (Chicago time):**
- [ ] `npm run release:validate` and `npm run release:check -- --fetch` pass on that exact commit
- [ ] Saved Google source matched the last verified deployment in `release/manifest.json` before pasting
- [ ] All twelve files match that commit (Code, Extraction, Workbook, Layout, Routing, Month, Parts, Backup, ExtraLabor, MonthArchive, Upload as HTML, appsscript.json); backup trigger untouched
- [ ] Deploy → Manage deployments → Edit → **New version** (same URL)
- [ ] Health check shows the version above
- [ ] No edits made in the Apps Script editor beyond pasting
- [ ] `release/manifest.json` and `docs/STATUS.md` updated in a metadata commit
- [ ] Script Properties that Jared needs to set or change (names only, never values):

**Notes / anything unexpected:**
