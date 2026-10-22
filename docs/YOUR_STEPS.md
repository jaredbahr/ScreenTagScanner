# Your steps: Screen Tag Scanner setup

Everything you (Jared) need to do, in order. Each phase ends with a ✅ check so you know it worked before moving on.
Detail lives in [SETUP.md](SETUP.md) and [SHORTCUT.md](SHORTCUT.md); this page is the checklist.

**Time:** ~1.5 hours at your desk + ~1 hour at Paul & Kirsten's house.

---

## Progress (as of 2026-10-12)

| Item | Status |
|---|---|
| Google owner account | ✅ Decided: **Jared owns** the files (his personal Google account); Kirsten is Editor on the workbook. Script stays private. |
| `Screens TEMPLATE (do not edit)` | ✅ Created and checked (8 store tabs + Totals, no errors). IDs are in the handoff note, not in this repo. |
| `Screens TEST` (shared with Kirsten as Editor) | ✅ Created. A final layout comparison against the original .xls is still pending. |
| Apps Script project | ✅ Created. Editor test passed on `d4f6049`; fixes for date / conflicts / multi-screen / schema limit synced and re-tested OK on `409e0d8` (0.10.1-draft). |
| Web app deployment + Shortcut | ⏳ **Next: Phase 3.6 (deploy), then Phase 4.** |
| New API key / old key disabled | ⏳ Phase 1.2 |

---

## Phase 0: Before you start

- [ ] Laptop with Chrome
- [ ] Your iPhone (build and test the Shortcut on yours first)
- [ ] Kirsten's blank template (`Copy of Template 8 stores…xls`)
- [ ] 1–2 real tag photos saved to your computer (for the first test)
- [ ] Password manager open (you'll create 2 secrets)

---

## Phase 1: Accounts (15 min)

### 1.1 Google account ✅ done
- [x] Owner: Jared's personal Google account. Do Phase 3 **signed in as that account**.
- [ ] Make sure 2-Step Verification is on for it
- [ ] Write down in your password manager who to call / how Kirsten gets access if you're unavailable (the files live in your account)

> Not in an employer's tenant.

### 1.2 Anthropic API key
- [ ] console.anthropic.com → **Settings → Workspaces → Create** `Screen Tags`
- [ ] In that workspace: **Limits → monthly spend limit** $40 (peak month ≈ $27)
- [ ] **API Keys → Create key** in the `Screen Tags` workspace → save it in your password manager
- [ ] **Disable the key you pasted into chat earlier** (API Keys → that key → Disable/Delete)

✅ You have: a business Google login, and a new API key that has never been pasted anywhere.

---

## Phase 2: Spreadsheet ✅ done (TEMPLATE + TEST exist)

Only remaining check: open `Screens TEST` side by side with the original `.xls` and spot-check a few tabs (headers, column widths, the Totals tab).
<details><summary>Original steps, for reference</summary>

- [ ] Signed in as the business account → drive.google.com → **New → File upload** → Kirsten's template
- [ ] Open it → **File → Save as Google Sheets**. Rename it `Screens TEMPLATE (do not edit)`
- [ ] Optional: on the **Joliet** tab, delete the stray formula in cell **V101**
- [ ] **File → Make a copy** → name it `Screens TEST`
- [ ] Copy both file IDs into a note (the long part of the URL between `/d/` and `/edit`):
  - `TEMPLATE_ID` = …
  - `SHEET_ID` (TEST copy for now) = …

✅ `Screens TEST` opens, has 8 store tabs + Totals, and the Totals formulas show $0.00 (not errors).
</details>

---

## Phase 3: Apps Script (30 min)

### 3.1 Create the project
- [ ] Go to **script.google.com → New project** (standalone; **not** Extensions → Apps Script inside the sheet)
- [ ] Rename it `Screen Tag Scanner`
- [ ] Delete the sample code in `Code.gs` and paste in [`apps-script/Code.gs`](../apps-script/Code.gs)
- [ ] **+ → Script**, name it `Extraction` → paste [`apps-script/Extraction.gs`](../apps-script/Extraction.gs)
- [ ] **+ → Script**, name it `Workbook` → paste [`apps-script/Workbook.gs`](../apps-script/Workbook.gs)
- [ ] **Project Settings (gear) → ✔ Show "appsscript.json"** → back in the editor, open it and replace its contents with [`apps-script/appsscript.json`](../apps-script/appsscript.json)
- [ ] **Save** (Ctrl+S)

> Copy from GitHub using the **Raw** button on each file so you get plain text.

### 3.2 Create the Shortcut password
Run this in PowerShell and save the result in your password manager as `SHARED_TOKEN`:

```powershell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 40 | ForEach-Object { [char]$_ })
```

### 3.3 Script Properties
**Project Settings → Script Properties → Add script property** for each:

| Property | Value |
|---|---|
| `ANTHROPIC_API_KEY` | the new key from 1.2 |
| `SHARED_TOKEN` | the password from 3.2 |
| `ALERT_EMAIL` | your email |
| `SHEET_ID` | the **TEST** copy ID |
| `TEMPLATE_ID` | the template ID |
| `SAVE_IMAGES` | `false` until go-live, then `true` |
| `RETENTION_DAYS` | `30` |

Leave `MODEL` unset (defaults to Sonnet). Skip `KIRSTEN_EMAIL` / `MONTH_FOLDER_ID` for now.

### 3.4 First test from the editor
- [ ] Upload a tag photo to the business Google Drive → open it → copy its file ID from the URL
- [ ] In `Code.gs`, find `testWithDriveImage_` → replace `PASTE_DRIVE_FILE_ID_HERE` with that ID → Save
- [ ] Select `testWithDriveImage_` in the function dropdown → **Run**
- [ ] Approve the permissions. You'll see *"Google hasn't verified this app"*: click **Advanced → Go to Screen Tag Scanner (unsafe)**. That's normal for your own script.
- [ ] Check **Execution log**: it should print `"status":"ok"` and a message like `Added: … → Homer Glen`

✅ In `Screens TEST`: a new row on the right store tab (dates, name, ticket, inches, Screening, LB Earn filled), and a new **Scans** tab with the full record.
❌ If not: copy the Execution log text and send it to me.

### 3.5 Turn on photo cleanup
- [ ] Only once `SAVE_IMAGES` is `true`: function dropdown → `installTriggers_` → **Run** (deletes saved photos after 30 days)

### 3.6 Deploy
- [ ] **Deploy → New deployment → ⚙ Select type → Web app**
  - Description: `v1`
  - Execute as: **Me**
  - Who has access: **Anyone**
- [ ] **Deploy** → copy the **Web app URL** (ends in `/exec`) into your note as `WEB_APP_URL`
- [ ] Paste that URL into a browser

✅ The browser shows the phone upload page. Use `/exec?health=1` for the plain-text version check. See [PHONE_UPLOAD.md](PHONE_UPLOAD.md) for Android/Pixel use and request limits; add `Upload.html` as an HTML file when syncing this version.

> **Updating later:** always **Deploy → Manage deployments → ✏ Edit → Version: New version → Deploy**. That keeps the same URL. Never make a *new deployment* (the URL would change and the Shortcut would break).

---

## Syncing a revision to Apps Script

Always sync a **pinned commit**, not "whatever is on the branch", so we both know exactly what's running.

1. Get the commit SHA I give you (e.g. `abc1234…`).
2. For each file, open `https://github.com/jaredbahr/ScreenTagScanner/raw/<SHA>/apps-script/<file>` and paste it over the file in Apps Script:
   `Code.gs`, `Extraction.gs`, `Workbook.gs` (and `appsscript.json` only if I say it changed).
3. Ctrl+S. Check `Extraction.gs` line ~19 shows the expected `EXTRACTION_VERSION`.
4. Before any paid test: run `node tests/offline.test.cjs` locally (or ask me), expect "0 failed".
5. If deployed as a web app: **Deploy → Manage deployments → ✏ → New version → Deploy** (same URL).

---

## Phase 4: Shortcut on YOUR iPhone (20 min)

Open **Shortcuts → + (new)** and add these actions in order. Name it **Scan Tag**.

| # | Action | Settings |
|---|---|---|
| 1 | **Take Photo** | Show Camera Preview **ON** |
| 2 | **Resize Image** | Longest edge **2000** (or Width 1500 if longest-edge isn't offered) |
| 3 | **Convert Image** | **JPEG**, quality ~0.8, Preserve Metadata **OFF** |
| 4 | **Base64 Encode** | Line Breaks: **None** |
| 5 | **Get Device Details** | **Device Name** |
| 6 | **Get Contents of URL** | URL = `WEB_APP_URL` · Method **POST** · Request Body **JSON** · 3 Text fields: `token` = `SHARED_TOKEN`, `user` = *Device Name*, `image` = *Base64 Encoded* |
| 7 | **Get Dictionary from Input** | input: Contents of URL |
| 8 | **Get Dictionary Value** | key `status` |
| 9 | **Get Dictionary Value** | key `message` |
| 10 | **Get Dictionary Value** | key `speak` |
| 11 | **If** | *status* **is** `ok` |
| 12 | ↳ **Show Notification** | body: *message* |
| 13 | ↳ **Speak Text** | *speak* |
| 14 | **Otherwise** | |
| 15 | ↳ **Show Alert** | message: *message* |
| 16 | ↳ **Speak Text** | *message* |
| 17 | **End If** | |

Full detail: [SHORTCUT.md](SHORTCUT.md).

### 4.1 Test scans (on the TEST sheet)
- [ ] **Scan 1, a normal tag** → banner says `Added: …` within ~10 s
- [ ] **Scan the same tag again** → `Saved, but ticket already on the … tab`
- [ ] **Scan something that isn't a tag** (a receipt) → `Couldn't find a tag in that photo…`
- [ ] Open `Screens TEST` on the laptop and check the rows and the Scans tab
- [ ] Check your camera roll: **no new photos**

✅ All four behave as described.

**Watch for this:** if step 6 returns nothing, an error, or a page of HTML, that's the Google redirect issue I flagged. Tell me exactly what the alert said and I'll set up the fallback (~15 min).

---

## Phase 5: Send me (so I can tune it)

- [ ] What each test scan's banner said
- [ ] Anything wrong on the sheet (wrong store, wrong numbers, wrong name)
- [ ] How long each scan took, roughly
- [ ] More tag photos when you can, **in chat, not the repo**:
  - [ ] 2–3 **window** tags (ideally one thermopane, one with spline)
  - [ ] 1–2 more **new-build** forms
  - [ ] Tags from **other stores** (Lockport, Plainfield, Joliet, Manhattan, New Lenox, Willowbrook)
- [ ] Kirsten's answers: **thermopane rate** ($27?), **pet labor** ($0.22?), **frame-only builds**, and whether **Date in** should be the tag date instead of the scan date

---

## Phase 6: At Paul & Kirsten's house (~1 hour)

**Phones (each one):**
- [ ] On your iPhone: Shortcut → ⋯ → **Share → Copy iCloud Link** → text it to them
- [ ] Open the link on their phone → **Add Shortcut**
- [ ] Run it once and tap **Always Allow** on every prompt (camera, sending to Google)
- [ ] Long-press the home screen → add the **Scan Tag** icon to page 1
- [ ] Optional: **Settings → Accessibility → Touch → Back Tap → Double Tap → Scan Tag**
- [ ] Test **"Hey Siri, scan tag"**
- [ ] Each person scans 2 real tags

**Laptop (Kirsten):**
- [ ] Sign in to the business Google account in Chrome
- [ ] Open `Screens TEST` → **⋮ → Cast, save, and share → Install page as app** (desktop icon)
- [ ] Turn on offline: Drive → ⚙ Settings → **Offline**
- [ ] Show her: yellow rows = check against the tag; the note on the Name cell says what to check; the yellow Earning cell = enter her extras; "(?)" after a name = hard to read

---

## Phase 7: Pilot week, then go live

- [ ] One week of real scans on `Screens TEST` alongside her normal process
- [ ] Go-live check: no lost scans, flags make sense, Kirsten is comfortable
- [ ] Make this month's real file (copy the template), then in Script Properties change `SHEET_ID` to its ID. No redeploy needed.
- [ ] Decide on the **monthly auto-copy** with Kirsten. If yes: add `KIRSTEN_EMAIL`, then run `installMonthlyTrigger_` once. **Only if she stops making the copy herself.**

---

## Later / as needed

| Situation | What to do |
|---|---|
| Email: "Screen scan needs placing" | Open the Scans tab, find the **NOT PLACED** row, enter it by hand. If it's a new store code, tell me (or add it to `STORES` in Workbook.gs) |
| Email: "Screen scanner failed" | Photo is attached. Usually a busy/retry; if it repeats, forward it to me |
| A phone is lost or replaced | Change `SHARED_TOKEN` in Script Properties **and** in the Shortcut on the remaining phones |
| I send you a code update | Paste the changed file(s) → **Manage deployments → Edit → New version → Deploy** |
| Monthly API cost check | console.anthropic.com → Usage (expect a few dollars a month) |
