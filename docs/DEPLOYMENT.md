# Deploying to Google

Owner: **Codex** (cloud worker). Jared approves; Codex never edits code in the Apps Script editor.

## Before
- Pick the commit: the latest on the default branch whose **tests** GitHub Action is green. On that exact
  checkout run `npm run release:validate` and `npm run release:check -- --fetch` (see
  [RELEASE_PROCESS.md](RELEASE_PROCESS.md)); both must pass.
- Read its CHANGELOG entry for Google-side steps (new Script Properties, etc.). Those go to Jared;
  Codex doesn't set or read secret properties.

## Steps
1. First confirm the saved Google source matches the manifest's last verified deployment (stop on any
   unexplained difference). Then replace the contents of all twelve files with that commit's versions:
   `Code.gs`, `Extraction.gs`, `Workbook.gs`, `Layout.gs`, `Routing.gs`, `Month.gs`, `Parts.gs`,
   `Backup.gs`, `ExtraLabor.gs`, `MonthArchive.gs`, `Upload.html` (HTML file named **Upload**),
   `appsscript.json` (Project Settings → show manifest). Paste only; no edits. Keep the installed backup trigger.
2. **Deploy → Manage deployments → Edit (pencil) → Version: New version → Deploy.** Same URL; never
   create a new deployment (that changes the URL on the phones).
3. Open `/exec?health=1` and confirm it shows the commit's `EXTRACTION_VERSION`.
4. Open `/exec` on a phone-sized window: the scanner page loads; **What's new** shows the new entry.
   Don't scan a real tag as a test unless Jared asks (it costs money and writes to the live sheet).
5. Update `release/manifest.json` (last verified deployment + baseline blob IDs) in a metadata commit.
6. Open a GitHub issue with the **Deployment record** template: commit SHA, version, Apps Script
   version number, time, and any Script Properties Jared needs to set (names only).

## If something is wrong
- Redeploy the previous version from **Manage deployments** (Apps Script keeps every version), then
  open a Scanner problem issue. Don't hot-fix in the editor.
- A scan that fails mid-save is journaled in the Scans tab (PENDING / INTERRUPTED); check the store
  tab before rescanning.

## Script Properties (Jared only)
`ANTHROPIC_API_KEY`, `SHARED_TOKEN`, `SHEET_ID`, `TEMPLATE_ID` are required. Optional:
`MONTH_FOLDER_ID`, `MONTH_EDITORS`, `SAVE_IMAGES`, `RETENTION_DAYS`, `MAX_SCANS_PER_DAY` (default
300), `MAX_SCANS_PER_MINUTE` (default 10), `MODEL`. See [SETUP.md](SETUP.md).
