Current policy overrides older setup descriptions: manual authenticated month changes only, no failure emails or monthly triggers, Date in from the written tag date, Date out from the admitted Chicago scan day, and approved literal parts earnings. See [MANUAL_MONTH_ROLLOVER.md](MANUAL_MONTH_ROLLOVER.md), [DATE_RULES.md](DATE_RULES.md), [PARTS_EARNINGS.md](PARTS_EARNINGS.md) and [PHONE_UPLOAD.md](PHONE_UPLOAD.md) for the nine-file sync.

# Spreadsheet analysis: "Template 8 stores" (reviewed 2026-10-12)

Source: Kirsten's monthly Excel template (`.xls`, Excel 97-2003 format). The file itself is **not** in the repo.

## Verdict: converts cleanly to Google Sheets

| Check | Result |
|---|---|
| Macros (VBA) | None |
| Sheet protection, data validation, conditional formatting, named ranges | None |
| Formulas | Simple `SUM` and multiplication only; all work in Sheets |
| Totals tab references | All 48 point at the correct total cells ✅ |
| Customer data in template | None (blank template) |
| Oddity | Joliet tab has a stray formula in **V101** (`=SUM(T2:T100)+SUM(U2:U100)+SUM(W2:W100)`) inside the window data area. Not referenced by Totals. Harmless unless Joliet gets >99 window jobs; it can be deleted. |

## Layout

The letters below describe the original workbook. See [Tag sequence migration](TAG_SEQUENCE_MIGRATION.md)
for separate Tag x of N columns, shifted positions, header-adaptive writers and safe execution order.

9 tabs: one per store + `Totals`.

| Tab | Store (from Totals) | Screen rows | Window rows |
|---|---|---|---|
| `18559-(500)` | Downers Grove #18559 | 2–750 | 2–250 |
| `18563 (37)` | Lockport #18563 | 2–350 | 2–250 |
| `18556 (43)` | Plainfield #18556 | 2–750 | 2–250 |
| `18650 (60)` | Joliet #18650 | 2–350 | 2–250 |
| `Manhattan` | Manhattan | 2–750 | 2–250 |
| `Homer Glen` | Homer Glen | 2–1000 | 2–250 |
| `New Lenox` | New Lenox | 2–1000 | 2–250 |
| `Willowbrook` | Willowbrook | 2–750 | 2–250 |

Each store tab holds **two side-by-side tables**:

### Screens: columns B–L (totals rows at 750+4 / 350+4 / 1000+4)

| Col | Header | Type | Formula? | Proposed source from tag |
|---|---|---|---|---|
| B | Date in | date (d-mmm) | – | Scan date ✅ |
| C | Name | text | – | Last name ✅. Best reading; **"(?)" appended** when the last name is uncertain (names are often illegible; the ticket # identifies the job, so a hard name alone does not flag the row) |
| D | Date out | date | – | Scan date ✅ (they scan the day they fix it) |
| E | Ticket # | text | – | Ticket / tag # |
| F | Uni/In | number | – | Billable inches (QTY on tag = W + H rounded up) |
| G | Screening | $ | – | **Filled:** UI × material rate ($0.15 fiberglass / $0.19 aluminum / $0.25 pet). What the customer pays; they earn none ✅ |
| H | LB Earn | $ | – | **Filled:** UI × labor rate ($0.17 / $0.20 / $0.22 pet). What they earn ✅ (pet rate from tag, unconfirmed) |
| I | Spline | $ | `=F*0.07` | automatic |
| J | Spl Earn | $ | `=F*0.01` | automatic |
| K | Extras | $ | – | Not written |
| L | Earning | $ | – | Kirsten enters her extras earnings + notes. Script adds a **cell note listing the tag's extras** and highlights it |

Store total (K752 etc.) = SUM(H) + SUM(J) + SUM(L). `Totals` pulls H, J, L per store.

### Windows: columns N–W (totals at row 254)

| Col | Header | Notes |
|---|---|---|
| N / O / P / Q | Date in / Name / Date out / Ticket # | scan date / last name / scan date / ticket |
| R | S/W | pre-filled "W" |
| S | Glass Price | **Filled:** glass price from tag (recorded, not earned) |
| T | LB Price/ Earn | **Filled:** $18.50 × panes, $27 × panes for thermopane (both confirmed by Kirsten 2026-10-22). Panes = written count, else the window labor line's quantity, else 1 for a single glass line (rule 20). Summed into Totals "Window Labor" |
| U | Spl Earn | Kirsten enters (only some windows earn spline); highlighted + note when the tag shows spline |
| V | Other | not written |
| W | Other Earn | Kirsten enters extras (corners, latches); note lists the tag's extras |

Window mapping is built from Kirsten's description and the first real October window tags; every window row is still flagged for review while window tags are new.

## Write strategy (implemented in `apps-script/Workbook.gs`)

1. Pick the **store tab** from the tag's store value via a lookup table (e.g. `HOMER` → `Homer Glen`, `DG`/`Downers Grove` → `18559-(500)`).
   If the written store can't be read, the **colored store sticker** decides (per Kirsten): yellow = Downers Grove,
   red = Lockport, green = Plainfield, orange = Joliet, blue = Manhattan, purple/magenta = Homer Glen, black = New Lenox.
   Willowbrook's pink is not used (too close to Homer's magenta in photos). Written store wins; disagreements are flagged.
   **A form with no ticket number is never placed** (can't be traced or de-duplicated); it goes to NOT PLACED.
2. Pick the **block**: screens (B–L) or windows (N–W).
3. Write into the **first empty row** of that block (empty = Date in, Name, Ticket # and Uni/In all blank). Never overwrite. Columns with formulas (I, J) are never touched.
4. Also append every scan to a separate **`Scans` log tab** (always kept as the **last tab**, out of the way) (full detail, photo link, review flags), so nothing is lost if a row is edited or the store can't be matched.
5. If the store can't be matched or the block is full → row goes to `Scans` only, highlighted orange (see rule 16).
6. Flagged rows are highlighted **on the store tab** (B–H yellow) with a note on the Name cell listing what to check, since Kirsten works in the store tabs, not `Scans`.
7. Refunds are not entered (per Kirsten); they are only noted in `Scans`.
8. **New-build forms** (per Kirsten): same columns, plus **$9 added to LB Earn** and **$1.50 pre-filled in Earning**;
   she adds more for extras like pins. Earnings are **per frame**: a form saying "Build 2" becomes **two rows**
   (flagged, since stores should use one form per frame). A build with no screening (frame only) is flagged
   for her to enter Screening and LB Earn.
9. **Group tickets:** some stores (Homer) use **one ticket number for a group of tags**, each priced separately.
   Every tag gets its own row. Only an **exact rescan** (same store, ticket, "Qty x of N" and size) is skipped,
   with a calm "Already scanned" on the phone and no email. Same ticket with no "x of N" and a different size
   is written and flagged.
10. **Measurement-only forms** (e.g. new-build patio doors, per Kirsten): when no QTY is written, inches =
   each side rounded **up**, then added (35¼ + 79½ → 36 + 80 = 116"), and the row notes it was calculated.
11. **Conflicting quantities are never billed silently.** For a numeric size/QTY disagreement, literal written
   totals may settle inches only when all filled total rows imply the same whole inches at the existing rates,
   to the cent, and agree with the rounded size or a clear QTY-row majority. With no totals written, a strict
   majority of at least two QTY rows may settle. Every settlement is flagged; original readings and row evidence
   remain in the log/review note. Explicit size/slip conflicts, actual corrections during a disagreement,
   contradictory/unreadable totals, split/insufficient QTY evidence and implausible values keep **Uni/In,
   Screening and LB Earn blank** for manual review. Automatic settlement stays inside the existing dimension
   review envelope: sides 6–120 inches and whole billable inches 12–240. This is not a new price/rate table.
12. **Multi-screen forms:** a *build* form for N frames → N rows (earnings are per frame). A *repair* tag listing several
   screens → **one row with billing blank**, flagged for her to enter each screen. Notes describe exactly what was written.
13. **Dates** (Jared, 2026-10-13): **Date in = the date written on the tag; Date out = the scan date** (America/Chicago).
   A tag without a year always gets the admitted scan's Chicago calendar year, including when month/day is later than the scan date. Never infer last year; retain the date and flag a later date for review.
   "Oct 8" style dates are read; a two-digit year for this year or last is accepted silently. A missing or unreadable
   date leaves Date in blank, flagged. Written as serial day numbers, so the sheet's time zone can't shift them.
   See [DATE_RULES.md](DATE_RULES.md).
14. **No formulas from tag text.** Every value written goes through `safeCell_`/`safeRow_`: text starting with
   `=`, `+`, `-` or `@` gets a leading apostrophe so Sheets stores it as plain text (the apostrophe is hidden).
   Covered by `tests/offline.test.cjs` ("injection").
15. **Parts earnings** (approved 2026-10-13, Kirsten OK for now): parts with a known SKU and an explicit quantity are
   earned from the 2024 rate list into Earning (L) / Other Earn, once per tag or group; anything uncertain stays a
   flagged note for her. Rates are flat: 3D-printed corners earning more is still hers to adjust. See [PARTS_EARNINGS.md](PARTS_EARNINGS.md).
16. **Unresolved scans require reconciliation.** NOT PLACED/PENDING/INTERRUPTED rows are marked **orange**, and later phone replies report that earlier scans need reconciliation. Existing or partial store rows may already be present. Check them first; add a row only after confirming it is missing. Clear Needs Review "YES" only after reconciliation. Controlled RESCAN rows are excluded from the advisory count; OCR review text never decides whether a row counts. If this optional count read fails after a completed save, the phone retains confirmed success and reports that earlier review status is unavailable.
17. **Interrupted saves don't duplicate.** The `Scans` row is written first (PENDING) and finished after the store
   write, so a retry after a timeout says "Already scanned" and points at the store tab instead of adding a second row.

18. **Three review levels** (2026-10-21, from the October workbook: 56 of 78 scans were flagged, only 11 for money or
   placement; all 7 real ticket errors were among the flags):
   - **Row yellow** + "Flagged" on the phone + Scans *Needs Review = YES*: anything touching inches, prices, earnings,
     parts, windows, the store or a duplicate, and anything unrecognised.
   - **One pale cell** with a "Glance at this value" note: doubts about the ticket, Date in, Tag x of N or name only.
   - **Scans only** (listed in Review Reason, nothing on the store tab): phone digits/area code, crossed-out names
     or phones, width/height doubts when the inches agree.
19. **Store tabs can be named by number or by store** ("18559-(500)" or "Downers Grove"); both are found.
20. **Window panes** (Kirsten, 2026-10-22: $18.50 per pane, $27 thermopane; most windows are one pane, some are
    several). Tags don't write a pane count, so panes = the quantity on the window labor line (580500–580503,
    e.g. "1 580503 Labor $24.99"); with no quantity, one glass line = one pane (noted on the row). Two or more
    glass lines with no quantity leave LB Earn blank for Kirsten.
21. **Spring pins are $2.00 each to the customer, $0.50 each earned** (Kirsten, 2026-10-22). A pins line with no
    quantity ("580602 $2.00") is counted from its dollar total ÷ $2.00; the Earning note says so. An amount
    that isn't a whole multiple of $2.00, or a written quantity, is never re-derived.
22. **Tickets should be all 7 digits** (Kirsten, 2026-10-22; Plainfield sometimes has only the 4 handwritten
    digits readable). The scanner prefers the full printed number. A 4–5 digit reading keeps its value and gets a
    ticket-cell note with the likely 7-digit number from that store's series, or both numbers when two series
    share those last digits. Notes stay on the cell until someone clears them; correcting the value doesn't remove them.

23. **Group rows stay together** (Kirsten's request, approved by Jared 2026-10-22). The first tag of an "x of N" group
    (N = 2–12) holds the empty rows right after it, grey with a column-A note. Later tags of the same group (same
    name and N, same ticket or tickets within 50) fill those rows in any order; other jobs skip them. Rows are never
    inserted or moved. Holds expire after 14 days, a deleted note frees the row, and a held row typed into by hand
    is left alone. Screens block only, on tabs with the Tag x of N column.

## Review display for 0.13.18

Future placed scans use three review levels. Money, placement, interrupted-save
and unknown reasons keep row-yellow, phone review and Scans Needs Review YES.
Ticket, Date in, Tag x of N and name-only reasons tint the affected cell with a
note; phone and nonfinancial dimensional details stay listed in Scans. Monetary
language takes priority over metadata wording. Unplaced/pending/interrupted
records always remain actionable. All reasons stay recorded; old rows, their
colors and historical review flags are not reclassified automatically.

Store names and legacy numeric tab names are already supported. If both aliases
exist simultaneously, scanning/rollover stop rather than picking one. Canonical
keys in historical earnings receipts and migration journals remain stable.

## Open questions

See `docs/PLAN.md` → "Spreadsheet questions".
