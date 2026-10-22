# Scanner failure emails disabled

User requested this at 2026-10-13 **03:41 UTC**. The cloud worker cleared the nonsecret alert recipient at **03:43:09** for immediate silence. This source change makes that policy permanent regardless of a leftover/restored recipient value.

Failure and NOT PLACED handlers make **no MailApp call**, create no photo attachments, and log only a controlled event category and generated scan ID. They do not log passwords, API/provider bodies, photos, customer names or phone numbers. Phone errors still return `status: error`; a scan saved only in Scans says so and requires manual review. It no longer says someone was notified or “has been told.” Store highlights/review notes and visible phone summaries remain.

The manual month Settings path sends no email. The old private email-producing rollover helper and its automatic monthly-trigger installer are disabled with actionable errors, without deleting any existing file, trigger, email or history. Photo-retention helpers are unrelated and remain private/explicit; no trigger is installed by this change. No other projects' notifications are changed.

There are no remaining MailApp calls in server files, so the `script.send_mail` OAuth scope is removed from appsscript.json. No expanded grant or unrelated settings/credentials are changed. `ALERT_EMAIL` is legacy/ignored, not erased by source code. Deployment must sync the manifest as well as code; existing account-level grants are not silently revoked by this repository edit.

Offline regressions cover zero mail calls on provider failures and unplaced records, truthful phone responses, non-customer diagnostics, disabled legacy rollover/trigger calls, and absence of MailApp/send-mail scope. They use a fake provider and synthetic data, not a paid failure scan.
