# Phone upload page and admission limits

The normal phone flow is compact: a big **Take photo** button becomes the preview, a short result summary,
an always-visible **Needs review** indicator when required, and **Retake / Scan tag** controls. Full results are
available under **Details** instead of being clipped. Small viewports, zoom, keyboards and expanded details may
scroll; essential warnings are never cut off. Check the deployed page on the actual phone before relying on fit.

**Remember on this phone** is visibly enabled by default for the approved personal-phone workflow. It stores the
scanner password in browser local storage only after a valid RPC response explicitly includes `authenticated: true`.
Pre-auth settings errors, missing/old/malformed authentication signals and transport failures never authorize a new
save. A valid password may be remembered even when a post-auth scan is rejected by quotas or image validation.
Once a password is saved, the Remember checkbox hides with the password box; **Forget password** clears stored state.
The page carries no how-to paragraphs (Jared, 2026-10-13): the one-line status message is the only instruction.
A rejected/rotated remembered password is removed. If browser storage is blocked, the page reports that saving or
removal could not be confirmed rather than falsely claiming success. Clear site data if removal is blocked.
Anyone with access to that browser can use a remembered password; use this option only on a trusted personal phone.
Photos are never stored in browser persistence.


The standalone Apps Script web app serves a camera-first phone page at its normal `/exec` URL. **Take photo** activates a dedicated image input with `capture="environment"`, requesting the rear camera. **Choose existing photo** activates a separate input without capture. Browsers decide how they honor capture; some show a picker instead of launching the camera directly. If that happens, choose Camera. Actual Pixel/iPhone camera launch needs a device test. No `getUserMedia` or camera streaming is used in the Apps Script sandbox. See [MDN capture behavior and compatibility](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/capture).

No Shortcut is required for this page. The existing Shortcut POST body and JSON response (`token`, `user`, `image`; `status`, `message`, `speak`, `scanId`) are preserved. Use `/exec?health=1` for the plain-text health/version response.

## Sync and deploy

Sync all **nine runtime files** from one pinned revision: `Code.gs`, `Extraction.gs`, `Workbook.gs`, `Layout.gs`, `Routing.gs`, `Month.gs`, `Parts.gs`, `Upload.html`, and `appsscript.json`. Upload is an HTML file; `.gs` files are Script files. Keep the standalone project private and compare any newer editor work before replacing it. Follow [TAG_SEQUENCE_MIGRATION.md](TAG_SEQUENCE_MIGRATION.md) before inserting columns. Current policies: [GLASS_ROUTING.md](GLASS_ROUTING.md), [MANUAL_MONTH_ROLLOVER.md](MANUAL_MONTH_ROLLOVER.md), [DATE_RULES.md](DATE_RULES.md), [PARTS_EARNINGS.md](PARTS_EARNINGS.md).

Keep `SHEET_ID` on the TEST workbook. No secrets or workbook IDs are supplied by this repo. Jared enters `SHARED_TOKEN` and `ANTHROPIC_API_KEY` directly in Script Properties through the approved secure workflow. Do not paste them into HTML, source control, URLs, logs, or chat. `SAVE_IMAGES=false` leaves photo retention disabled.

When authorized, deploy as a **Web app**, **Execute as Me** (the approved Jared owner), **Who has access: Anyone**. The page is public, but scans require the shared token. Review Google's requested scopes; this change does not add scopes or approve any prompts. For an existing deployment, edit it and choose **New version** to preserve its URL. For the initial deployment, create it once. Do not install cleanup or monthly triggers as part of page deployment.

Opening the page does not perform extraction. Test its UI with synthetic/inert processing before live scanning. Live tag scans send customer data to Anthropic, incur API usage, and can write the configured workbook. Deployment alone does not establish phone compatibility or OCR accuracy.

## Using the page

1. Tap **Take photo**, photograph one well-lit tag, and check its preview. You can **Retake photo**, cancel a retake while preserving the previous preview, or **Clear photo**. A secondary **Choose existing photo** option remains available. Taking/selecting a photo never submits it automatically. The browser previews a re-encoded JPEG, resizes its longest edge to at most 2000 pixels without upscaling, and strips original file metadata by drawing it to a canvas. Browser-supported orientation behavior applies. Transparent backgrounds become white. Resolution and JPEG quality were not reduced for this camera-first change.
2. Enter the shared scanner password in the masked field. If **Remember on this phone** is checked, a server-validated password can be saved for subsequent scans. Uncheck it for session-only use; **Forget password** removes a saved value. Typed input is cleared on submit/page exit, and the preview is cleared after a response. Browser password managers are outside the page's control.
3. Tap **Scan tag** once. The page shows local photo preparation separately from uploading/waiting for reading and saving. The RPC does not expose exact server phase timings, so it does not claim to measure upload versus extraction latency. The button and inputs remain disabled while waiting. There are no automatic retries. A slow response does not enable a second submit. Camera-first capture removes the separate camera/gallery-selection steps; it does not promise faster network/API processing.
4. Read the short server-result summary and any **Needs review** indicator. Open **Details** for the full customer/result/error text. Unknown/interrupted responses can occur after a successful write: **check the workbook before reselecting and retrying**. An exact rescan can avoid another store row, but still needs extraction and consumes API usage/admission. Since 0.13.30 a saved scan also shows **Today: N tags saved** (tags placed on a store tab today, from the Scans log; rescans and unplaced scans don't count), and the header keeps "Today: N" for that day on this phone.

Input files must be browser-decodable images under 20 MB and at most 48 megapixels. The converted JPEG/base64 payload is capped at 5 MiB of base64 (approximately 3.75 MiB of JPEG bytes). The server enforces base64/JPEG boundaries, payload types and size as well; it does not rely on the page. Unsupported formats should be retaken or converted locally to JPEG. Do not automatically retry invalid/non-tag images.

## Shared admission controls

Both `doPost` and the page's `scanTag` RPC call the same private processing function. Authenticated attempts reserve quota **before any paid request**. Reservations use Script Properties under `LockService.getScriptLock`; the lock is released before extraction and the separate workbook-write lock. Requests from both phones and both interfaces share one quota.

| Optional Script Property | Default | Allowed values |
| --- | --- | --- |
| `MAX_SCANS_PER_MINUTE` | `10` | Integer `1`–`100`; rolling 60 seconds |
| `MAX_SCANS_PER_DAY` | `300` | Integer `1`–`10000`; America/Chicago calendar day. Busy months average ~75/day; 300 covers a big batch day and caps a leaked password at ~$4.50/day |

Unset/empty values use defaults. Invalid values, malformed stored state, lock contention, or state persistence failure reject the request before extraction. Do not modify the internally maintained `SCAN_LIMIT_STATE` property. Lower limits take effect on the next attempt. Chicago midnight resets the daily count; it does not reset the rolling-minute window. Daylight-saving changes follow Chicago time.

Authorized attempts count even when the image is invalid, the provider fails, the tag is not a tag, placement fails, or it is a duplicate. Invalid/missing passwords do not consume the shop's quota, incur API calls, or send emails. Malformed/oversized Shortcut JSON is rejected before admission. This is admission control, **not a currency hard cap**, bot protection, or a replacement for an API-provider spend limit. Google platform quotas and a leaked shared password can still affect availability. No request is automatically retried or refunded.

## Private helpers / editor operations

Only **doGet**, **doPost**, **scanTag**, **getMonthSettings**, and **startMonth** are public server functions. All helpers end with `_`. The month RPCs authenticate; changing month requires fresh confirmation input in Settings. Legacy automatic rollover/trigger helpers are disabled. Failure emails and the send-mail scope have been removed.

No triggers are installed by this change. If a preexisting trigger targets a former function name, an owner must deliberately review/recreate it with the new name; do not silently reinstall/delete triggers. The editor image test still follows token validation and admission controls and incurs paid usage when run; do not run it as an offline test.

## Offline checks

Run `node tests/offline.test.cjs` and `node tests/upload-ui.test.cjs`. Tests use synthetic records, an in-memory workbook, a fake provider, and inert DOM/canvas/RPC objects. They cover both processing interfaces, limits and lock/storage failures, private-function exposure, JPEG conversion dimensions/size, and submission/interruption behavior. They do not contact Google/Anthropic or use credentials/customer images. These tests are not a real mobile browser rendering or live Apps Script integration test.
