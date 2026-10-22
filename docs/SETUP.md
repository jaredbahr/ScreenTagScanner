Current policy overrides older setup descriptions: manual authenticated month changes only, no failure emails or monthly triggers, Date in from the written tag date, Date out from the admitted Chicago scan day, and approved literal parts earnings. See [MANUAL_MONTH_ROLLOVER.md](MANUAL_MONTH_ROLLOVER.md), [DATE_RULES.md](DATE_RULES.md), [PARTS_EARNINGS.md](PARTS_EARNINGS.md) and [PHONE_UPLOAD.md](PHONE_UPLOAD.md) for the nine-file sync.

# Setup guide: accounts, Apps Script deployment, configuration

> **Status: draft.** Do not point this at the real spreadsheet until the field list is final and a week of testing on a copy is clean.

## 1. Accounts

| Account | Owner | Notes |
|---|---|---|
| Google account for the business | Paul & Kirsten (business name) | Jared added as editor. Turn on 2-step verification with their phone. |
| Anthropic Console (console.anthropic.com) | Jared (for now) | Create a workspace **"Screen Tags"**, one API key, **monthly spend limit $40** (peak month ≈ 1,600 tags × $0.015 ≈ $27). Separate from the Claude.ai subscription; prepaid credits. |

Design rule: everything lives in accounts the business owns (or can be handed over cleanly). **Nothing in an employer's tenant.**

## 2. Spreadsheet

1. Upload Kirsten's blank template to the business Google Drive → Open with Google Sheets → **File → Save as Google Sheets**. This is the **template** (`TEMPLATE_ID`). Optional: delete the stray formula in Joliet!V101.
2. Make this month's working copy (later months: Settings → Start new month on the phone page). For testing, make a **TEST copy** and use its ID.
3. The script writes each scan into the matching **store tab** (next empty row in the screens block, columns B, C, E, F) and logs every scan to a **`Scans`** tab it creates. Spline formulas (I, J) and all totals are never touched. See [SPREADSHEET.md](SPREADSHEET.md).

## 3. Apps Script (standalone project)

Use a **standalone** project (script.google.com → New project), not Extensions → Apps Script. A script bound to the sheet would be copied into every monthly file.

1. Create files matching [`apps-script/`](../apps-script): `Code.gs`, `Extraction.gs`, `Workbook.gs`, and `Upload.html` (**HTML** file type, named **Upload**). See [PHONE_UPLOAD.md](PHONE_UPLOAD.md) for the phone page, shared limits, and private editor helpers.
2. Project Settings → **Show "appsscript.json"** → paste [`appsscript.json`](../apps-script/appsscript.json).
3. Project Settings → **Script Properties**:

| Property | Value |
|---|---|
| `ANTHROPIC_API_KEY` | key from the "Screen Tags" workspace |
| `SHARED_TOKEN` | long random string. PowerShell: `-join ((48..57)+(65..90)+(97..122) \| Get-Random -Count 40 \| % {[char]$_})` |
| `ALERT_EMAIL` | legacy, ignored (scanner emails are off) |
| `SHEET_ID` | this month's workbook ID (the part of its URL between `/d/` and `/edit`) |
| `TEMPLATE_ID` | blank template ID (for the monthly rollover) |
| `MONTH_FOLDER_ID` | Drive folder new months are created in (the part of its URL after `/folders/`). Share the folder with Kirsten **by name** as Editor; every month inherits it. Keep the TEMPLATE outside it. |
| `MONTH_EDITORS` | optional: comma-separated emails that get Editor access to each new month (Settings → Start new month), e.g. Kirsten |
| `KIRSTEN_EMAIL` | legacy, ignored |
| `MODEL` | optional; default `claude-sonnet-5-5` |
| `SAVE_IMAGES` | `true` keeps each tag photo in a private **Screen Tag Photos** folder in the owner's Drive (not the shared monthly folder), linked from the Scans tab's Photo column, for troubleshooting. File names carry no customer name. A failed photo save never stops a scan. Photos older than `RETENTION_DAYS` are trashed automatically once a day after a scan (no trigger needed). |
| `RETENTION_DAYS` | `30` |

4. Run **`testWithDriveImage_`** once (paste a Drive file ID of a tag photo) and approve the OAuth prompts. Check the store tab and `Scans`.
5. `SAVE_IMAGES=true` needs no trigger: the cleanup runs after the first scan each day.
6. **Deploy → New deployment → Web app**: Execute as **Me**, Who has access **Anyone**. Copy the `/exec` URL.
7. Monthly rollover is manual: phone page → **Settings → Start new month** (password re-entered). The old automatic trigger is disabled. See [MANUAL_MONTH_ROLLOVER.md](MANUAL_MONTH_ROLLOVER.md).
8. Open the `/exec` URL in a browser. It should show the phone upload page. `/exec?health=1` retains the plain-text *"Screen tag scanner is running."* health/version check. Opening either page does not scan a photo.

> **Why "Anyone"?** The Shortcut can't sign in to Google. The endpoint is protected by `SHARED_TOKEN`; requests without it are rejected before anything is called or written.

### Updating the script later

Edit → **Deploy → Manage deployments → Edit (pencil) → Version: New version → Deploy**. This keeps the **same URL**, so the Shortcut doesn't change. (A *new deployment* changes the URL. Avoid it.)

### Adding a store code

If a store starts writing something new in "Store #", the scan lands in `Scans` as **NOT PLACED** (orange). Later replies count unresolved NOT PLACED/PENDING/INTERRUPTED rows until their Needs Review YES is cleared after reconciliation. Check existing/partial store rows before adding anything; only add a row after confirming it is missing. Exact retries use controlled RESCAN state and add no store rows. Add a new store code to that store's `keys` in `STORES` (Workbook.gs) and follow the authorized sync/deployment workflow.

## 4. Laptop (Google Sheets in place of Excel)

- Chrome → open the sheet → ⋮ → **Cast, save, and share → Install page as app** (desktop icon, own window; menu wording varies by Chrome version)
- Turn on offline access: Drive settings → **Offline**
- Walk whoever uses the laptop most through it once before go-live

## 5. Go-live criteria

- [ ] One week on the TEST copy, both phones
- [ ] Zero lost scans
- [ ] Review flags are rare and make sense
- [ ] Then: point `SHEET_ID` at the real sheet (or move the script), redeploy as a new version
