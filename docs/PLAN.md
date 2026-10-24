# Project plan: screen tag scanner

## Goal

Paul and Kirsten photograph a screen tag on their iPhone and the details land in their spreadsheet. **Picture, done.** No camera-roll clutter, no typing, nothing to configure.

## Context

| Fact | Implication |
|---|---|
| Two users only, both at the home shop, on Wi-Fi | No multi-user auth, no offline queue in v1 |
| Users in their 60s, low-tech; Jared is support | Zero choices in the flow; failures alert Jared, not them |
| 3 formats seen: typed repair tag, handwritten repair tag, Whitmore "Build A New Screen" form | Same fields every time, but many different handwriters; test across stores |
| Window and screen tags look slightly different; some stores print their own variation | Prompt must handle both layouts; sample photos must include both and several stores |
| Tag fields map 1:1 to spreadsheet columns; formulas do the rest | Schema = the tag's printed fields, nothing hand-entered afterward |
| Repair tags: whole inches. Build forms: exact fractions on a diagram | Both supported; billed QTY (= W + H, each rounded up) cross-checks the size |
| Tag says screen / window / replacement | Captured as a column |
| Date received = scan date | Timestamp column feeds the formulas |
| One photo per screen | One row per photo |
| Sheet is sent monthly (by a person for now) | No automated reporting in v1 |
| Newer iPhones | "Longest edge" resize and Back Tap available; Action Button on 15 Pro+ |
| Kirsten is the main laptop/spreadsheet user | She gets the Google Sheets walkthrough |
| Spreadsheet is Excel on a laptop, with formulas | Convert to Google Sheets; script writes to its own tab only |
| No Microsoft 365 | Google Sheets + Apps Script (Option 1) |

## Architecture (decided)

```
iPhone Shortcut "Scan Tag"
  Take Photo (not saved) → resize 2000px → JPEG → base64
  → POST { token, user, image } over HTTPS
        ↓
Google Apps Script web app (bound to the sheet, runs as the business account)
  check token → Claude API (vision, structured JSON output)
  → sanity checks → append row to "Scans" tab → (optional) save photo to Drive, 30-day purge
  → reply { status, message, speak }
        ↓
Shortcut shows notification + Siri reads it aloud
Failures → email to Jared with the photo attached
```

### Options considered and rejected

| Option | Why not |
|---|---|
| Claude chat / Claude Code session | Interactive tools that need a person driving them; not a backend |
| Web app (PWA) with review screen | More to build and support; review step unnecessary for clean handwriting |
| Native iOS app | $99/yr, App Store/TestFlight overhead, overkill |
| Power Apps + AI Builder | Requires M365 + premium licensing; they have no M365 |
| Excel + Azure Function + Graph | Viable fallback if the Sheets conversion fails; more moving parts |
| Hosting in my employer's Microsoft 365 tenant | Employer liability/ownership problem. **Never.** |

## Decisions log

| # | Decision | Status |
|---|---|---|
| D1 | Google Sheets + Apps Script + iOS Shortcut | ✅ Decided |
| D2 | One row per screen photo | ✅ Decided |
| D9 | Google files owned by Jared's personal Google account, Kirsten Editor, script private (changed from business-owned account) | ✅ Decided |
| D3 | API cost covered by Jared's Console org credits ($200/mo confirmed 2026-10-11); separate "Screen Tags" workspace with its own spend limit | ✅ Decided |
| D4 | No instruction card (family; Jared trains in person) | ✅ Decided |
| D5 | Model: start with `claude-sonnet-5-5` (Jared, 2026-10-11). Accuracy test still compares Haiku/Opus; move up to Opus only if Sonnet misreads | ✅ Decided (revisit after test) |
| D6 | Keep photos 30 days in Drive (`SAVE_IMAGES`) | ⏳ Recommended, confirm |
| D7 | Final field list and column mapping | ⏳ After spreadsheet + tag review |
| D8 | Go/no-go on Excel → Sheets conversion | ✅ Go: no macros, simple formulas (see SPREADSHEET.md) |

## Cost (measured 2026-10-11 on synthetic tags, ~1600 px JPEG)

| Model | $/MTok in / out | Measured per tag | Per 1,000 tags | Latency |
|---|---|---|---|---|
| Haiku 5.5 | 0.10 / 0.50 | $0.00045 | ~$0.45 | ~2 s |
| **Sonnet 5.5** (default) | 2 / 10 | **$0.0089** | **~$9** | 2–4 s |
| Opus 5.5 | 4 / 20 | $0.018 | ~$18 | 3–5 s |

~3,900 input tokens per photo (almost all image) and under 200 output tokens. Accuracy on real Ace tags is still untested;
synthetic tags were 100% on all models. Hosting: $0 (Apps Script).

## Accuracy on real tags (Sonnet 5.5, 4 tags, 2026-10-12)

| Image size | Fields correct | Cost/tag | Notes |
|---|---|---|---|
| 1600 px | 37/40 | ~$0.012 | Misread a phone digit (768→268); ticket digit varied between runs |
| **2000 px (chosen)** | **39/40** | **~$0.015** | Both fixed and stable across 2 runs |

- The remaining miss (area code 708 read as 709) is made by every model at every setting; the
  "area code not local" check flags it.
- **Every wrong value, at either size, was in a row flagged for review naming that field.** No silent errors.
- Higher effort and Opus did not beat Sonnet at low effort. Decision: Sonnet, effort low, 2000 px.

### Batch 2 (8 photos, texted so only 450×600 px; 2026-10-12)

- Fields checked: item type, size, billable inches, material, "x of N" all 100%; last name 4/4; phone 5/6; ticket 4/5; store 4/5.
- Every miss was flagged or safely not placed: the 708/709 area code; a ticket digit; a store box hidden under a sticker (read as "79" → NOT PLACED + email).
- New cases handled: misspelled store ("Manhatten" → Manhattan, via edit distance), "Please Pay Cashier" slips (read, flagged; slip-only → NOT PLACED), crossed-out material rows (flagged), extras like turn buttons.
- At this resolution "(?)" shows on more names than needed; recheck at full 2000 px.

## Phases

| Phase | Work | Exit criteria |
|---|---|---|
| 0. Prep ✅ | Repo, draft prompt/schema, Apps Script skeleton, test harness, Shortcut + setup guides | This commit |
| 1. Discovery | Receive spreadsheet + 10–20 tag photos + truth values; answers to the questions below | Field list final (D7), conversion go/no-go (D8) |
| 2. Accuracy test | `tools/extract-test` across models | Per-field accuracy + real cost/tag; D5 decided |
| 3. Build | Finalize `Extraction.gs` fields and `Code.gs` column mapping; deploy to TEST sheet; build Shortcut | End-to-end scan from Jared's phone works |
| 4. Pilot | Install on both phones (on site); one week on TEST copy | Zero lost scans, few flags |
| 5. Go live | Point at real sheet; laptop set up with Sheets | Old manual entry stops |

## Waiting on (from Jared)

**Files**
- [ ] Spreadsheet (.xlsx/.xlsm), the actual file; names/phones may be scrambled, formulas intact
- [ ] Which tab they type into + 5–10 example rows
- [ ] 10–20 tag photos (minimum 5): clean, messy, fractions, missing phone, glare/angle, back side if used. **Send in chat, never commit.**
- [ ] Truth values for each photo

**Questions for Paul & Kirsten**: ✅ answered 2026-10-11 (see Context table)

**New open questions**
- [x] Store number is on the tag and tracked → added as a field
- [x] Ticket/Tag # on every form. Homer reuses one ticket for a group → duplicate = store + ticket + "x of N" + size
- [ ] Store values are names/codes (HOMER, DG, Downers Grove): what does the spreadsheet use? Need a lookup table?
- [x] "Build 2" → two rows
- [x] Confirmed hard values from Paul/Kirsten (2026-10-12); truth.csv updated
- [ ] Extras (rollers etc.), fees and refunds: does the spreadsheet track them? Structured columns or notes?
- [x] Ace agreement: informal, nothing written → no contractual data terms; still minimize data kept (see Risks)

**Spreadsheet questions** (see docs/SPREADSHEET.md)
- [x] Write into store tabs + `Scans` log: implemented (Workbook.gs), pending Jared's OK
- [x] (500)/(3700)/(4300)/(6000) are store numbers → in the lookup
- [x] Stores write an abbreviation (HOMER, DG) or the store number; varies → forgiving matcher (exact key, name prefix, initials)
- [x] Name = last name
- [x] Date in = scan date
- [x] G = UI × material rate (customer price), H = UI × labor rate (their earnings) → auto-filled; values match tag totals
- [ ] Kirsten to confirm pet labor rate ($0.22 from tag)
- [x] Extras all go in L with her notes; refunds not entered → script adds a note on L listing the tag's extras; she enters the amount
- [x] New builds: same columns, H = UI × $0.17 + $9, L starts at $1.50 (+ extras by hand)
- [x] "Build 2" = two rows, earnings per frame
- [x] Date out = scan date (day fixed)
- [ ] Frame-only builds (no screening): how are they entered? (currently flagged, G/H blank)
- [x] Monthly copy of the template → optional auto-rollover built (`startNewMonth_`); Kirsten must agree
- [x] Windows: $18.50/pane labor (thermopane ~$27?), glass price not earned, extras + spline by hand → built
- [ ] Window tag photos to test it; confirm thermopane rate

- [x] Sticker = tab color (from template). Mapped: yellow DG, red Lockport, blue Manhattan, purple Homer, black New Lenox
- [x] Kirsten: green = Plainfield, orange = Joliet, pink = Willowbrook (pink not used: too close to Homer magenta)
- [x] Patio doors (0.13.28, rule 28): sides rounded up, then added; fiberglass; no build labor or earning base
- [x] Real patio-door form photos (Kirsten, 2026-10-24: the shop's order form and the supplier's)

## Risks

| Risk | Mitigation |
|---|---|
| Excel → Sheets habit change on the laptop | Install as Chrome app, keep layout identical, in-person walkthrough; Excel+Azure fallback |
| Formulas/macros don't convert | Review before deciding (D8) |
| Misread dimensions (fractions, W/H order) | Prompt rules + sanity checks + yellow "Needs Review" rows + spoken confirmation |
| Apps Script POST redirect not followed by Shortcuts | Verify on first test; fallback is a small Cloudflare Worker proxy |
| Customer PII | Photos never in git; optional 30-day Drive retention; EXIF stripped in Shortcut |
| Ace customer data sent to a third-party AI service | No written agreement with Ace; Anthropic commercial API terms don't train on inputs by default; consider `SAVE_IMAGES=false` |
| Many different Ace handwriters | Test on tags from several stores; review flags catch low-confidence reads |
| Lost phone exposes token | Rotate `SHARED_TOKEN` in Script Properties + Shortcut |
| Runaway API cost from a bug | Console spend limit |
| Shortcut breaks after iOS update / new phone | Rebuild guide in `docs/SHORTCUT.md`; keep iCloud link |
