# iPhone Shortcut build guide: "Scan Tag"

Build once on your own iPhone, test it, then share it to Paul's and Kirsten's phones via iCloud link.

> **Status: draft.** Action names are from current iOS Shortcuts, but menus move between iOS versions. Adjust as needed and note any changes here.

## What it does

Tap icon → camera opens → take photo → **"Added: Smith, 630-555-0142, 35 1/2 x 48"** (and Siri reads it aloud).
The photo is never saved to the camera roll; it exists only in the Shortcut's memory while it runs.

## Before you start

You need two values from the Apps Script deployment (see [SETUP.md](SETUP.md)):

| Value | Where it comes from |
|---|---|
| `WEB_APP_URL` | Apps Script → Deploy → Manage deployments → Web app URL (ends in `/exec`) |
| `SHARED_TOKEN` | The same random string you put in Script Properties |

## Actions, in order

| # | Action | Settings |
|---|---|---|
| 1 | **Take Photo** | Camera: Back · **Show Camera Preview: ON** · Count: 1 |
| 2 | **Resize Image** | Longest edge **2000** (if your iOS doesn't offer longest edge: Width 1500, Height auto). Tested: 1600 px misread a phone digit that 2000 px read correctly. |
| 3 | **Convert Image** | Format **JPEG** · Quality ~0.8 · **Preserve Metadata: OFF** (strips location) |
| 4 | **Base64 Encode** | Input: Converted Image · Line Breaks: **None** |
| 5 | **Get Device Details** | Detail: **Device Name** (so the sheet shows whose phone scanned) |
| 6 | **Get Contents of URL** | URL: `WEB_APP_URL` · Method: **POST** · Request Body: **JSON** with three Text fields: `token` = `SHARED_TOKEN`, `user` = *Device Name*, `image` = *Base64 Encoded* |
| 7 | **Get Dictionary from Input** | Input: Contents of URL |
| 8 | **Get Dictionary Value** | Key `status` → rename variable **Status** |
| 9 | **Get Dictionary Value** | Key `message` → **Message** |
| 10 | **Get Dictionary Value** | Key `speak` → **Speak** |
| 11 | **If** | *Status* **is** `ok` |
| 12 | ↳ **Show Notification** | Title: "Tag added" · Body: *Message* |
| 13 | ↳ **Speak Text** | *Speak* (optional; remove if they find it annoying) |
| 14 | **Otherwise** | |
| 15 | ↳ **Show Alert** | Title: "Not saved" · Message: *Message* · Show Cancel: OFF |
| 16 | ↳ **Speak Text** | *Message* |
| 17 | **End If** | |

## Shortcut settings

- **Name:** `Scan Tag` (this is also the Siri phrase: "Hey Siri, scan tag")
- **Icon:** camera glyph, bright color
- **Add to Home Screen:** yes, on both phones, first page
- **Optional trigger:** Settings → Accessibility → Touch → **Back Tap → Double Tap → Scan Tag**, or the **Action Button** on iPhone 15 Pro and newer

## Known limitations / things to verify in testing

| Item | Notes |
|---|---|
| Apps Script redirect | Apps Script answers POSTs with a 302 redirect to `script.googleusercontent.com`. Shortcuts normally follows it and returns the JSON. **Verify on the first test.** If the response comes back empty or as HTML, we fall back to a tiny Cloudflare Worker proxy. |
| No internet | If Wi-Fi is down, step 6 fails with Shortcuts' own generic error, not our friendly message. Shortcuts has no try/catch. Acceptable for a home shop on Wi-Fi; revisit if it happens. |
| Speed | Expect roughly 3–8 s from shutter to confirmation (upload + Claude + sheet write). Measure during testing. |
| Token in Shortcut | Anyone with the Shortcut file has the token. Only share the iCloud link with their two phones; rotate the token (Script Properties + Shortcut) if a phone is lost. |

## On-site install checklist

- [ ] Open the iCloud link on each phone → Add Shortcut
- [ ] Run once on each phone and tap **Always Allow** on every permission prompt (camera, sending to `script.google.com`)
- [ ] Add to Home Screen; set up Back Tap / Action Button if wanted
- [ ] Test "Hey Siri, scan tag"
- [ ] Scan 3 real tags per phone and check them on the laptop
