## What and why
<!-- One or two sentences. Link the issue: Closes #NN -->

## Changes
-

## Money impact (CONTRIBUTING: be conservative)
<!-- Pick one. Anything but "None" needs the business rule (who, date), a read-only replay result, and yellow-row flags. -->
- [ ] None: wording, notes, docs or tests only
- [ ] Placement only: which row or group (falls back to the old behavior when unsure)
- [ ] Changes amounts or billing: rule from ___ on ___; replay result: ___; every automatic decision flags the row

## Checks
- [ ] `npm test` passes (all suites)
- [ ] New or changed behavior has a test
- [ ] `EXTRACTION_VERSION` bumped, and a line added to **CHANGELOG.md** and to **What's new** (Upload.html) when behavior changes
- [ ] No customer data (names, phones, tickets, photos, spreadsheets) in code, tests, docs or this PR
- [ ] Prompt/schema change: stays within 16 nullable fields (schema test)
- [ ] Needs Google-side action after deploy (Script Properties, sharing): listed here
