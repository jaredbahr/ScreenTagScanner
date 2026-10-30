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
| K | Extras | text | – | Kirsten's notes. On a new row the scanner writes the parts it read ("2 pins, 3 rollers", 0.13.31) and, for patio doors, "new patio door W x H" first; never over text already there |
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
10. **Measurement-only forms** (per Kirsten; patio doors have their own rule 28): when no QTY is written, inches =
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
   Since 0.13.29 assembly / cuts (580625, $2.25 per side) is labor and is **added to LB Earn** on screen rows
   (Kirsten, 2026-10-27: 2 cuts on a 62" rescreen: $10.54 + $4.50 = $15.04), with its receipt in the LB Earn note.
   Builds still get none (covered by the build labor); windows keep it in Other Earn. With any written-in additional
   labor line on the tag it stays in Earning (as before) with a note; an LB Earn that is blank, a formula or changed
   leaves it for her with a note. The Earning note says when assembly went to LB Earn.
   Since 0.13.31 $0.50 hardware (pins, clips, tabs, buttons) written once for a whole group is split evenly per frame
   when the count divides by N and the line is for the group (marked, or unmarked at exactly 2 per frame with more than
   4 in all; Kirsten, 2026-10-27): each frame's row gets its share with its own receipt (on top of a $1.50 new-build
   base); a frame whose Earning she already filled gets a note and the pins row a flag. Same tab and month only; the
   pins row lists the frames still to come.
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
    Since 0.13.32 a reading with one space inside ("123456 7") that is exactly 7 digits without it is written as the 7
    digits, with a ticket-cell note showing the reading (Jared, 2026-10-30). Anything else is left as read.
    Since 0.13.31 a 6-digit group tag uses its group's tickets. When siblings with at least two different "x of N"
    all read one ticket (one ticket per order, as at Homer Glen) that ticket is "likely". Otherwise candidates sit inside the siblings' ticket clusters (gap
    10 or less), widened by the number of tags still missing only when the open tickets inside can't hold them, and
    are not already on the tab. One candidate in a group with only this tag missing (and no
    other row with this tag's "x of N") is "likely", unless the siblings' tickets rise with "x of N" and the candidate
    is out of that order; otherwise 1–3
    candidates are listed as "could be"; the first or last tag of a complete group whose tickets rise with "x of N"
    gets "could be" the ticket just outside the range; more gives no group hint (the store hint stays). An 8-digit reading is
    "likely" only when exactly one dropped digit lands near the store's series, or when one digit appears three times in
    a row and only one series reading comes from dropping a repeated digit (the reader doubled a written "99"); else "could be A or B" (up to 3).

23. **Group rows stay together** (Kirsten's request, approved by Jared 2026-10-22). The first tag of an "x of N" group
    (N = 2–12) holds the empty rows right after it, grey with a column-A note. Later tags of the same group (same
    name and N, same ticket or tickets within 50) fill those rows in any order; other jobs skip them. Rows are never
    inserted or moved. Holds expire after 14 days, a deleted note frees the row, and a held row typed into by hand
    is left alone. Screens block only, on tabs with the Tag x of N column. Since 0.13.22 the group match also
    accepts a name off by a letter or two and a ticket off by one digit. Since 0.13.23 an exact name and N with an
    "x of N" not yet on the tab also match (misprinted tickets), and the hold data sits in hidden row metadata; the
    visible note is plain text and deleting it still frees the row. A close name with the same N, filling a gap, also
    matches when the hold was made the same scanning day. Since 0.13.26 the best hold wins (same ticket, then within
    50, then one digit off, then loose), a loose exact-name match also needs the same day or the same 4-digit ticket
    book, a row with any note in column A is never held, only the scanner's own note lines are removed when a hold is
    filled, and if the hidden hold data can't be read every hold note counts as held. Since 0.13.27 a hold also matches
    on the same phone (last 7 digits, kept only in the hidden metadata; placeholders ignored) with tickets within 50
    on their last 6 digits and names that fit (close, a shared word, or an initial against the surname) or the same
    ticket. A strong match (same ticket or within 50 with a close name, or the phone) fills a hold even when N
    changed, unless the phones differ by 2+ digits: the group's other blank holds take the larger N, one more blank
    row is saved per extra tag right after the group, typed-in held rows are released, a smaller N frees nothing,
    and the Tag x of N cell gets a note. Since 0.13.29 the hold also keeps the full customer name, so a first name
    only on some tags fits the full name on another for the phone match.
23b. **Names from the group** (0.13.31, Kirsten 2026-10-27): a group tag with no name takes the name its siblings
    (scanned today, same N, same ticket or within 50) agree on; a named tag fills siblings whose Name is blank. Always
    "(?)" with a note; a name is never replaced; disagreeing names are left for her. A sibling whose Scans-log phone
    differs (both have one) is another customer and is ignored. Two rows with the same "x of N" in the window (named or
    blank, this tag included) mean two groups: nothing is borrowed or filled. A borrowed name takes the group's saved
    row only when the ticket is within 10 of a clearly read name's (not "(?)"); otherwise the tag goes to the next free row. The "No
    customer name" flag is dropped when a name is filled.
23c. **Repeat customers** (0.13.33, Jared 2026-10-30): when the tag's phone matches earlier rows on the same store's
    tab, every one of those names (non-blank, no "(?)") is the same spelling, Kirsten typed it herself (the cell differs
    from what the scanner wrote), and the reading is a close misspelling of it (both at least 5 letters), her spelling is
    written with a note on the name cell. A row counts only while it still holds its logged ticket (rows inserted or
    deleted never mislead), and patio forms are never evidence (they may carry the shop's phone). A spelling she kept as
    the scanner wrote it (or only removed "(?)") is not counted as hers, so it never triggers a change.
24. **Group check** (2026-10-23, from the October 22 scans). A group tag is compared with its group's tags already
    on the tab (same N, close name, ticket close or within 1000). Disagreeing name, ticket or "x of N" gets a note on
    that one cell (pale, not yellow). Values are never changed. Since 0.13.26 a looser match (ticket
    within 1000, the exact same name, or a close name the same day) only counts when that row's Date out is within 14
    days, and only for the name and "far from the rest" notes, never "already on row" or a shared-ticket note.
25. **Short last names** (2026-10-23): a last name of one or two letters keeps the name as written ("Ann B").
26. **Look-alike ticket digits** (2026-10-23): when swapping confusable digits (2/7, 1/7, 3/8, 4/9, 5/6) in the first
    four digits gives the store's ticket series, the ticket cell gets a "likely …" note. Values are never changed. No note when the
    ticket's own first four digits are already an established series on the tab (2+ tickets).
27. **Bill what the customer was charged** (Kirsten, 2026-10-23). A "measured wrong / balance due" slip's extra QTY
    of the standard screening SKUs is added to the tag QTY (row note). The shop's own marker re-measurement on a tag
    is ignored. A written tag year more than half a year behind the scan is noted in the Scans log (not the sheet:
    Kirsten doesn't use the year).
28. **Patio screen doors** (Kirsten, 2026-10-24). The shop's "Custom Patio Door Order" form is a screen, always
    fiberglass. Inches = width + height, each
    rounded up (75.5 x 48 -> 76 + 48 = 124"), billed at the fiberglass rates with **no** build labor and **no**
    Earning (blank, per Kirsten). Extras gets "new patio door" and the size as written. The handle height is never billed; a size whose short side is outside
    20-60" or long side outside 60-100" leaves the inches blank on a yellow row. A reported conflict, a different
    QTY read, QTY rows or "Quantity 2" turn the row yellow and say so. The supplier's Circle Glass order form is
    Kirsten's own ordering sheet, never scanned: it reads as not a tag, so nothing is written.

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
