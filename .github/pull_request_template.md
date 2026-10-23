## What and why
<!-- One or two sentences. Link the issue: Closes #NN -->

## Changes
-

## Triple check (CONTRIBUTING)
- [ ] 1. Author re-read the whole diff; `npm run release:validate` passes; tests cover new and neighboring behavior
- [ ] 2. Independent review done (who: ___); findings fixed or answered below
- [ ] 3. Writes differently? Read-only replay against real data: ___ (or "no change to what gets written")
- Behavior changes Kirsten will see:

## Checks
- [ ] `npm test` passes (all suites)
- [ ] New or changed behavior has a test
- [ ] `EXTRACTION_VERSION` bumped, and a line added to **CHANGELOG.md** and to **What's new** (Upload.html) when behavior changes
- [ ] No customer data (names, phones, tickets, photos, spreadsheets) in code, tests, docs or this PR
- [ ] Prompt/schema change: stays within 16 nullable fields (schema test)
- [ ] Needs Google-side action after deploy (Script Properties, sharing): listed here
