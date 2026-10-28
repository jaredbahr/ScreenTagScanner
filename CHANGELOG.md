# Changelog

## 0.13.31-draft — automation from the 10/27 audit

From an audit of Kirsten's 10/27 edits (144 placed tags, about 60 hand fixes).
- **Group pins split per frame** (8 hand entries on one New Lenox group; "I wanted to see it on each frame"): $0.50
  hardware (580602/580603/580604/580607) written once for a group is split evenly per frame when the count divides by
  N and the line is for the group (marked group-wide, or over 4 at 4 or fewer per frame). The pins tag gets its share;
  frames already on the tab get theirs then (only into a blank Earning with no receipt or formula, otherwise a note);
  frames scanned later pick theirs up from the receipts. Each share has its own receipt (scope [tab,"frames",id,k]),
  so a rescan never pays twice. Uneven counts keep the old once-for-the-group credit. October: the 10/22 24-over-12
  and 10/27 16-over-8 New Lenox groups qualify; single-frame "2 pins" tags don't.
  Independent review of #31: one split per group and SKU (a second pins line or a rescan with another ticket reading
  reuses it); a group paid whole before 0.13.31 is never split on top; the phone (split and Scans log) must not differ;
  unmarked lines split only at 2 per frame; a new-build frame gets its share on top of the $1.50 base; the pins row
  lists paid and owed frames and flags any skipped; a plain group tag never gets a review flag from another row's
  receipt; receipt columns are read once per block. Round 2: a pins tag paid the whole count on one row before
  0.13.31 (as 0.13.30 did for the 10/27 group) is never split on top; a rescan reading another count on a split group is
  flagged, not paid; a split reused from another ticket gets a "check it is the same group" flag; unmarked lines split
  at exactly 2 per frame; frames older than 14 days are named in the note, and "phone not checked" is noted.
  Real-data replay of the two New Lenox groups: frames whose tickets were misread ("770763 4", "1707635") missed their
  share, so a frame scanned within a day of the split also matches on name, N and phone. Result: the 10/27 group gets
  $1.00 on all 8 frames (what Kirsten typed); the 10/22 group 11 of 12 (its misread duplicate "4 of 12" is held and the
  pins row lists frame 8 as owed).

## 0.13.30-draft — daily scan count

Kirsten (2026-10-27): "Is there a way to keep a daily scan count somewhere?" Each saved scan's reply to the phone page
now carries `today`: the tags placed on a store tab today (Chicago), counted from the Scans log, so no sheet change.
Rescans and scans that weren't placed don't count. The page adds "Today: N tags saved." under the result and keeps
"Today: N" in the header (remembered on the phone for that day only). A failure reading the count never fails a
saved scan. The Shortcut's JSON reply is unchanged. The count covers every phone but reaches a phone when it scans;
the header hides a count from an earlier day when the page comes back. It reads the active month's Scans log, so a
mid-day new month starts it again.

## 0.13.29-draft — assembly / cuts in LB Earn; first-name group tags

Kirsten (2026-10-27), after the first live Willowbrook tag with a pay-cashier slip for 2 cuts: "I need this sku to be
added to the LB earn amount." SKU 580625 (Assembly, $2.25 per side) is now added to LB Earn on screen rows instead of
Earning (62" rescreen + 2 cuts: $10.54 + $4.50 = $15.04; Earning blank). The parts receipt (`column: "lb"`) lives in
the LB Earn note, is written before the value (as for additional labor), and is checked on later scans so a rescan
never adds it twice; a receipt moved by hand between columns counts as edited. Not added when LB Earn is blank, a
formula or changed (the row says so). With any written-in additional labor line on the tag (credited, credited on a
sibling, or held), assembly stays in Earning as before, with a note: LB Earn keeps one receipt chain and Kirsten is
never sent into it (independent review of #27: a whole-group case could otherwise credit twice). The Earning note says
when assembly went to LB Earn. Builds still get none; windows keep it in Other Earn. Rows written before this keep
their Earning amount.

Group holds (Kirsten, 2026-10-27, Plainfield): three tags of a group said only the first name, the fourth had the
full name; same phone, sequential tickets. The phone match needs names that fit, and a first name never fit the
surname, so the fourth tag missed its saved row. The hold now also keeps the full customer name (hidden metadata
only) and the phone match lets full names fit; a different first name on the same phone still doesn't match.

## 0.13.28-draft — patio screen doors

Kirsten (2026-10-24), with the shop's "Custom Patio Door Order" form as the example.
- New `form_type` value `patio_door` (schema enum only; no new field). Prompt: width and height are the door's; the
  handle height is never a dimension; "Quantity this size" is screens_on_tag; the circled door size/price line and
  frame color are not extras or parts; a patio order form is never new_build and a patio-door repair tag is a repair.
  The supplier's Circle Glass order form is Kirsten's own ordering sheet (she sent it by mistake): it reads as not a
  tag, so nothing is written.
- Script: always fiberglass (another material read gets a note), inches = width + height each rounded up, no $9
  build labor and no $1.50 Earning base (Kirsten: Earning stays blank). Extras gets "new patio door" and the size,
  which she used to type. The inches note goes on the Uni/In cell, not a yellow row.
- Never dropped silently (independent review of #25): a conflict Claude reported, a different QTY read, or QTY/total
  rows (a sign of a repair tag) keep the worked-out inches but turn the row yellow and say what was read. A size whose
  short side is outside 20-60" or long side outside 60-100" (a handle height read as the height) leaves the inches
  blank on a yellow row; width and height either way round bill the same. "Quantity this size 2" is one held row.
- Never routed to windows; a glass SKU on a patio form is noted. A patio door's phone never keys a group hold.
- Rescans: a patio door also needs a close last name read on both, so two customers with the same number and a
  standard door size are two rows, and two unnamed doors are never one lost door. A conflict detail of "none" or
  "n/a" is not a conflict.
- Docs: rule 28; rule 10 no longer calls patio doors builds.

## 0.13.27-draft — group holds match on the phone and survive a changed tag count

From Kirsten's first scans on version 15 (2026-10-24). Both left extra blank lines; no amounts were wrong.
- **Phone match (Joliet):** two tags had a first name and initial, the third the full name and a 6 read as 0, so it missed the
  held row and left a blank line. A hold now also matches when the phone (last 7 digits) is the same and the tickets
  are within 50 on their last 6 digits. The phone is kept only in the hidden row metadata, never in a visible note.
- **Changed tag count (Downers Grove):** "1 of 6", then the order grew and later tags said "of 7". Holds required the
  same N, so the "of 7" tags started a second group: 10 grey rows for 4 missing tags. A hold with a different N is
  now filled on a strong match (same ticket, within 50, or the same phone). The group's other holds take the larger N
  and one more blank row is saved per extra tag; a smaller N never frees rows. The Tag x of N cell gets a note.
- The phone match also needs names that fit (close, a shared word, or a first name and initial against the surname)
  or the same ticket; placeholder phones ("000-0000") never match. In October every phone seen under two spellings
  was one customer's name misread (16 of 99 phones).
- A changed N never crosses to a hold whose phone differs by 2+ digits (one digit off is a common misread: 6 of 114
  October groups). Close names with near tickets and different phones stay apart (independent review of #23).
- Growing a group releases held rows someone typed into (their colours kept) instead of re-greying them, and the
  count note says how many rows were actually saved.
- No new group is started for a "7 of 7" after "1 of 6" already on the tab; the same customer's next order
  ("1 of 3" after "2 of 2") still gets its own rows, with a note naming the earlier count in case it is a reprinted
  tag of that order.
- A repeated "k of N" matched on the phone gets a note on the Tag x of N cell.
- Rewriting a hold keeps Kirsten's own lines in the column-A note, and an older hold picks up the phone.
- Tests: each synthetic customer now has their own phone (same name, same phone), since every fixture tag used to
  share one. A misprinted ticket with a repeated "k of N" fills the hold when the phone confirms the customer.

## 0.13.26-draft — money fixes from the independent review of 0.13.23–0.13.25

Found by the pre-deploy review (CONTRIBUTING: triple check). Nothing here was live except the short-name receipt bug
(0.13.22), which had not fired: October has no extra-labor receipts.
- **Balance-due slip on a multi-frame build** was added to every frame (40" billed for a 20" slip). Now it is not added
  and the rows say to add it to the right frame by hand. A single-frame build still adds it once.
- **Slip labor paid twice:** extra labor on a tag with a balance-due slip is held for reconciliation instead of being
  credited on top of the slip inches. The prompt's general slip rule now excludes balance-due slips.
- **Unreadable slip QTY** ("20 in", "+20", "999") was dropped silently. It is now a yellow-row note to enter by hand.
- **Unanimous-tag billing** no longer overrides a conflict that names a slip, a balance due, a wrong measurement,
  another screen or a correction; price arithmetic ("not a second size", "read correctly") still bills (October
  replay: Downers Grove row 39 still bills; the two New Lenox balance-due tags stay held). No double period.
- **Short last names** ("Amy Li"): extra-labor receipts were read as invalid, which blocked every later extra-labor
  credit on that tab for the month, and tag 2 of a group-wide part was held as "edited by hand". Receipts now accept
  the full name the Name cell holds; older receipts (both kinds) still read.
- Empty-looking slip values ("00", "-", "None.") count as no slip, not as unreadable.
- Notes: a slip on a tag with missing inches says "missing", not "held"; a slip on a window tag gets a note.

Group placement fixes (same review; the group check and looser matching have been live since 0.13.22):
- **Best hold wins:** a tag fills its own group's held row first (same ticket, then within 50, then one digit off,
  then a loose match). Before, two customers with one surname could fill each other's rows and leave a grey row.
- A loose exact-name match (misprinted ticket) also needs the same day or the same 4-digit ticket book.
- **Group check:** a loose match (ticket within 1000, exact name, or close name the same day) only counts within 14
  days and never gives "already on row" or a shared-ticket note; the same surname weeks later is no longer called a
  duplicate.
- **Kirsten's notes are kept:** a row with any note in column A is never held, and filling a hold removes only the
  scanner's own lines.
- If the hidden hold data can't be read, held rows are not reused and no new holds are written; old hidden entries on
  a row are cleared. A hold note still counts when Kirsten adds a line above it.
- Test and comment ticket numbers that matched real October tickets were replaced with made-up ones.
- No look-alike ticket hint when the ticket's own book is already an established series on the tab (2+ tickets).
- October replay (170 scans, read-only): identical placements and notes to before.

Review levels and messages (same review):
- A **ticket doubt** that also raises a store, slip, window, quantity, group or money question keeps the yellow row
  (0.13.25 had made every "ticket_number" doubt one pale cell). A plain reading doubt, price-gun label included,
  stays one cell. October replay: all 154 reasons keep their level except the two year-only notes (now Scans log).
- **Tag year:** Kirsten (2026-10-23) doesn't use the year, so a year doubt alone now goes to the Scans log only, not
  her sheet. It is flagged only when more than half a year behind the scan (a tag left over the winter is not), with
  one note instead of two for a two-digit year. A date after the scan, or an unreadable date, still gets a cell note.
- Ticket doubts that mention Pay Cashier, a second screen, inches, another tag or job, a rescan, a store by name, or
  a price instead of a ticket also keep the yellow row; plain sticker and price-tag reading doubts stay one cell.
- **Phone topics:** "reconcile before crediting" is prices, not a correction; "extra 20 inches" is inches, not parts;
  "store" and "pins" must be whole words.
- The phone summary uses the last "→", so a name holding one can't garble it.
- **What's new** on the phone page has the 0.13.26 entry, and a test now fails if the newest entry doesn't match
  `EXTRACTION_VERSION` (Jared: What's new is always updated).

## 0.13.25-draft — balance-due slips, shop re-measurements, tag years (October 23 audit)

Rules from Kirsten (2026-10-23): **bill what the customer was charged.**
- A "measured wrong / balance due" Pay Cashier slip that charges more of the standard screening SKUs adds its QTY to
  the tag's QTY (new plain-string field `balance_due_qty`; 75 + 20 = 95), with a row note. Not added when the inches
  are held. Before, the slip went to extras and Kirsten re-entered inches and prices by hand.
- A large marker re-measurement written on the tag ("39 x 36 = 75") is the shop's own note and is ignored for size,
  QTY and conflicts; the tag's QTY is billed (before, it held billing as a conflict).
- A written tag year more than 120 days behind the scan ("24", "2020", "25" on 2026 tags: five October rows) gets a
  Date in note; the prompt lists 4/6 in years. Values are never changed.
- The prompt warns that a thin handwritten 1 between digits is easy to skip.
- Price arithmetic written beside the rows ("20 x .19 = 3.80") is not a size (prompt). If Claude still reports a
  conflict while the tag's size, every QTY row and every $ total agree to the cent, the row is billed with a note.

## 0.13.24-draft — plain phone messages

Kirsten found the phone reply hard to act on ("reconciliation" three times, no row, no names). Now:
- **Saved:** "Saved to Homer Glen, row 49."
- **Flagged:** the yellow banner says what to check ("Check on the sheet: ticket, inches"), from the row-level reasons.
- **Earlier tags that didn't save:** named, with the fix ("1 earlier tag didn't save: Name (Homer Glen, 2 of 4). Add it
  by hand or scan again, then clear its YES in the Scans tab."); a possibly partial save says to check its tab first.
- **Not placed:** "Not added to the sheet: … It is an orange row in the Scans tab; add it by hand or scan it again."
No change to what is written to the sheet or when a row is flagged.

## 0.13.23-draft — misprinted group tickets, plain-text hold notes

From Kirsten's Lockport group on 2026-10-23 (the second tag's ticket was printed wrong, so it skipped the grey row):
- A tag whose name and N match a held group exactly, and whose "x of N" isn't on the tab yet, fills the held row even
  when its ticket is far off; the group check notes the ticket difference.
- Same scanning day: a close name (a letter or two off) with the same N, filling a gap in the group, matches too, even
  when the ticket is misread to the wrong length (New Lenox, 2026-10-23). The group check now notes a ticket that
  doesn't match its group whatever its length.
- Look-alike digits: a ticket whose first four digits become the store's series by swapping confusable digits
  (2/7, 1/7, 3/8, 4/9, 5/6) gets a "likely …" note. New Lenox 7s were often read as 2s ("2208169" for 7708169).
  The prompt now lists 2/7. Replayed over October: one note, a likely misread.
- Homer price-gun labels: the prompt says a printed "ACE PRICE" label on the Tag # line is the ticket number (one
  such tag was left unplaced on 2026-10-23 because the label was rejected), and a ticket doubt that mentions a price
  label or sticker tints only the ticket cell.
- The hold note is plain text ("Saved for the rest of the … group"); its data moved to hidden row metadata
  (`GROUP_HOLD_V2`). Deleting the note still frees the row. Notes from 0.13.21–0.13.22 keep working. If Sheets
  rejects the metadata, the old visible note is written instead; a metadata read failure never stops a scan.

## 0.13.22-draft — group check, looser group matching, fewer false yellow rows

From the 61 scans of 2026-10-22 (Kirsten fixed 9 names, 5 of them group tags read differently; 13 rows were yellow
and she changed 1):
- **Group check.** A tag in an "x of N" group is compared with the group's tags already on the tab. A different
  name, a ticket that disagrees with two or more agreeing tags or sits more than 50 from all of them, or the same
  "x of N" twice gets a one-cell note ("4 of 12 is already on row 20; not yet on the tab: 8 of 12"). Notes only;
  values are never changed. Replayed over the October workbook it raised 12 notes, all real disagreements.
- **Looser group matching** for held rows: a name off by a letter or two, or a ticket off by one digit, still
  matches (same N required).
- **Short last names.** A last name of one or two letters ("S") keeps the name as written ("Ann B").
- **Review levels.** An overwritten "of N", "digit group" handwriting doubts, width/height doubts the QTY already
  confirms, and a crossed-out date no longer turn the whole row yellow.

## 0.13.21-draft — group rows stay together

Kirsten's request (2026-10-22, approved by Jared): when the first tag of an "x of N" group (2–12 tags) lands on a store
tab, the rows right after it are held for the rest of the group (grey, with a note in column A). Later tags of that
group fill those rows in any order; other jobs skip them. Same group = same name and N with the same ticket, or
tickets within 50. Rows never move, so earnings receipts and the Scans log stay valid. Holds expire after 14 days;
deleting the note frees a row; a held row typed into by hand is left alone. Only on tabs with the Tag x of N
column; windows and multi-frame builds unchanged. Seven synthetic tests (`tests/group-holds.test.cjs`).

## 0.13.20-draft — conservative pin-price evidence

Missing pin quantities stay manual for refund/negative amounts, multiple prices, conflicting literal evidence, unit/PK prices or unresolved uncertainty. Only a consistent positive total tied to the exact pin SKU may use the existing price rule. Explicit quantities, rates, group deduplication and rescans remain intact. Fourteen synthetic regression cases cover this boundary. No Google deployment occurred.

Notable changes, newest first. Versions are `EXTRACTION_VERSION` in `apps-script/Extraction.gs`
(shown by `/exec?health=1`). The phone page's **What's new** view carries the plain-language version
of the same notes. No customer data appears here.

Google deployments are recorded as GitHub issues labelled `deployment` (see
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)). Versions 1–6 were recorded in the archived
[docs/AUDIT_LEDGER.md](docs/AUDIT_LEDGER.md).

From 2026-10-13 to 2026-10-22 there were two lines: this default branch (development) and Codex's stacked
PRs #2–#6 (what was deployed to Google, versions 7–11). Both used version numbers 0.13.13–0.13.18 for
different changes. They were joined in 0.13.19; both histories are listed below.

## 0.13.19 — 2026-10-22
- Joined the default branch with the deployed line (Codex PRs #2–#6, Google version 11). One source again:
  twelve production files, including full-workbook backups, monthly Totals PDFs, additional labor,
  scan leases and store-alias safeguards, plus everything below from the default branch (Kirsten's
  2026-10-22 answers, ticket-book hints, scoped parts receipts, troubleshooting photos, What's new, CI).
- Review levels: Codex's version kept (appends to existing notes, money wording wins), with ticket-book hints
  checked first and "partially uncertain" OCR no longer mistaken for a partial save.
- Codex's release gate kept (`npm run release:check`, `npm run release:validate`); it now allows the
  `tests` workflow, which is free on this public repository.

## Default-branch line

### 0.13.18 — 2026-10-22
Kirsten's answers of 2026-10-22, built:
- Window LB Earn filled at $18.50 per pane ($27 thermopane, now confirmed): panes from the window labor line's quantity, or one pane for a single glass line. Previously blank on every real window tag.
- Spring pins with no quantity written are counted from the $2.00-each customer price ("580602 $2.00" = 1 pin = $0.50 earned).
- A 4–5 digit ticket (only the handwritten last digits) gets a note with the likely full 7-digit number from the store's series, or both candidates when two series match. The prompt prefers the full printed number.

### 0.13.17 — 2026-10-22
- Daily scan cap default raised from 100 to 300 (busy months average ~75/day); Console spend limit guidance $40/month.
- Process: GitHub Actions runs every test suite and a customer-data guard on each push and pull request; issue, deployment and PR templates; CONTRIBUTING, deployment runbook, this changelog.

### 0.13.16 — 2026-10-22
- Troubleshooting photos (`SAVE_IMAGES=true`): private Drive folder, file names without customer names, a failed photo save never stops a scan, 30-day cleanup runs daily after a scan instead of depending on a trigger.
- **What's new** view on the phone page.

### 0.13.15 — 2026-10-22
- Fixed: one hand-corrected parts earning blocked automatic parts earnings for the whole store tab. A mismatched earnings receipt now only holds items for the same ticket.
- Fixed: earnings receipts on tabs named by store were treated as invalid.
- Ticket-book hints: a ticket that doesn't fit the store's sequential ticket numbers gets a cell note with the likely one-digit fix (never changed automatically).
- Possible-duplicate flag for a tag rescanned with its ticket read differently.

### 0.13.14 — 2026-10-21
- Parts on attached Pay Cashier slips are extracted and earned.
- A one-screen comment in `group_extras` no longer holds the tag's parts or raises the group flag.

### 0.13.13 — 2026-10-21
- Three review levels: row yellow only for money/placement problems; one-value doubts tint a single cell; phone-number doubts stay in the Scans tab. On October's real scans: 56 of 78 rows yellow before, 11 after, with every corrected ticket still marked.
- Store tabs found by template number ("18559-(500)") or store name ("Downers Grove").

### 0.13.12 — 2026-10-21
- Size/QTY disagreements settled from the tag: dollar totals that agree with width + height, or a clear majority of QTY rows. Contradictions still hold billing. New plain-string fields `qty_rows`, `line_totals`.

### 0.13.10 – 0.13.11 — 2026-10-19/20
- Tickets that aren't 7 digits are flagged; prompt reads handwritten parts lines in blank rows.
- Start new month creates the workbook in `MONTH_FOLDER_ID` and inherits that folder's sharing.

### 0.13.8 – 0.13.9 — 2026-10-14
- Start new month shares the new workbook with `MONTH_EDITORS` before it becomes active.
- The Scans log is kept as the last tab.

### 0.13.6 – 0.13.7 — 2026-10-13
- Glass routing uses written material and listed SKUs only, never free-text notes.
- Interrupted saves are journaled (Scans row written first as PENDING), so a retry can't duplicate a store row.
- Unplaced scans highlighted orange and counted on later phone replies.
- Date in = written tag date (missing year = scan year); Date out = scan date. Deployed as Version 6.

### 0.12.x – 0.13.5 — 2026-10-12/13
- Separate **Tag x of N** column with a journaled, header-adaptive migration.
- Glass/acrylic routing by exact SKU; approved parts earnings credited once with recoverable receipts.
- Manual month rollover from Settings; failure emails removed. Deployed as Versions 4–5.

### 0.11.x — 2026-10-12/13
- Phone upload page (camera-first, one screen, remembered password) and shared scan admission limits.
- Pay Cashier slips that add parts go to extras; red/orange sticker lookalikes. Deployed as Versions 1–3.

### 0.10.x and earlier — 2026-10-11/12
- Extraction prompt and schema fitted to real Ace tags; 2000 px photos; Sonnet at low effort.
- Store-tab writer, store matching (keys, prefixes, initials, edit distance, sticker colors), rates for Screening/LB Earn, new builds, windows, group tickets.
- Dates as serial numbers (no time-zone shift), conflicts hold billing, schema kept within 16 nullable fields, formula-injection guard on every write.

## Deployed line (Codex PRs #2–#6)

### 0.13.18-draft - 2026-10-21

- Integrate three prospective review levels from `e1c4b68` onto deployed
  `ac44e4e`: money/placement/unknown reasons remain row warnings, metadata hints
  tint one cell, and phone/nonfinancial details remain in Scans.
- Retain stronger store-name lookup and duplicate-tab rejection, all twelve
  production modules, QTY evidence guards, labor, archives, leases and backups.
  Do not repaint historical rows or reinterpret old review flags.
- Prepare default-branch reconciliation with both histories and add a verified
  release manifest, root source guidance, ancestry/module/security gates and a
  sequential local regression runner. No paid CI or branch policy changes.

### 0.13.17-draft - 2026-10-21

- Integrate the new size/QTY evidence rule from `c7e7fdb` onto deployed source
  `5ed9a8a`, retaining backups, monthly PDFs, additional labor, city-tab lookup,
  group/rescan controls and all twelve production files.
- On a numeric size/QTY disagreement, agreeing written totals may settle inches
  if supported by size or a clear QTY-row majority. With no totals, a strict
  majority of at least two QTY rows may settle. Every settlement remains flagged.
- Preserve original readings and literal evidence in review notes; hold explicit
  conflicts, corrections, malformed/implausible evidence and contradictory totals.
  Rates, scopes, scan caps, workbook columns and installed triggers are unchanged.
- Deployed version 10 remains the baseline until a separate deployment receipt.

### 0.13.16-draft - 2026-10-20

- Add full native workbook backups to a separate owner-only Drive folder,
  nightly around 2 a.m. Chicago time and before month switches. Keep all copies.
- Serialize copies with scans/rollover, recover uncertain creation without blind
  duplication, and keep active/template pointers and live cells untouched.
- Add owner-run idempotent setup, Settings completion/review status, and offline
  backup/rollover regressions. Deployment and installation need separate receipts.

### 0.13.15-draft - 2026-10-20

- Reconcile handwritten highlighted parts and seven-digit ticket safeguards from
  `07afdac` onto the newer 0.13.14 source, preserving pricing, review holds,
  duplicate controls, additional labor and monthly archives.
- Warn on non-seven-digit numeric ticket readings without guessing or padding
  digits. Add synthetic offline regression fixtures and source provenance.
- This source change does not itself change the recorded version 8 deployment.

### 0.13.14-draft - 2026-10-19

- Prevent duplicate base charges when the same tag is rescanned with a numeric, city-name or sticker-resolved store alias. Match the canonical placed store rather than raw OCR text, while retaining ticket, tag sequence and dimensions as identity constraints. Different known stores remain distinct.
- Document the requested clean October beta reset with existing-ID reuse, coordinated test-cell/log/receipt cleanup, state reconciliation and recoverable duplicate-file cleanup. The checklist is not an executed reset.
- Unknown-store interrupted saves remain held for review instead of risking a second placement. Correctable NOT PLACED rows remain eligible for placement. Retry guidance now directs users to the active workbook in Settings.

### 0.13.13-draft — 2026-10-19

- Route explicit standalone additional LB/labor amounts to the header-resolved LB Earn column, added to calculated base labor. SKU cost-sheet items continue to use approved PK rates in Earning, including labor-like service SKUs. Never substitute customer retail prices for PK rates.
- Keep additional labor in separate canonical-store receipts with reserve/write/posted recovery and conservative group deduplication. Formula-backed, changed, ambiguous, negated, included/total, per-unit or conflicting charges remain manual. No historical rows are retroactively edited.
- Preserve literal LB labels, amount and scope in extraction; do not invent SKU or labor amounts. Clarify that service SKUs 580301 and 580408 use the approved job unit only when quantity is clear. No fallback unit coercion or new SKU rates.
- Add 32 synthetic labor regressions and seven service-unit tests. These exercise prompt and post-extraction behavior, not real-image model accuracy. Raw photos, customer data, personal IDs and private evidence remain outside the repository.
- Deployment must include the new ExtraLabor.gs file alongside MonthArchive.gs and preserve existing scopes, properties and URL. Compatible code must be deployed and old executions drained before store-tab renaming; no deployment or live rename is performed by this source update.

### 0.13.12-draft — 2026-10-19

- Clarify extraction of an unambiguous same-SKU additive third pin: two spring pins plus one additional third pin means three total. Require clear quantity, SKU and shared scope; retain uncertainty otherwise. Keep retail charges separate from approved PK earnings (SKU 580602 earns $0.50 each, not its example $2 retail price). No new labor/service-price inference is introduced.

- Accept either the historical numbered tab or its exact city name for Downers Grove, Lockport, Plainfield, and Joliet. Mixed old/new workbooks are supported. If both aliases exist, refuse to guess before store/parts writes or template acceptance.
- Keep canonical store identities in parts receipts and group scopes, migration journals and backfill keys. Renaming must not credit an old group twice or invalidate a reserved receipt.
- Apply aliases consistently to scan routing, parts allocation, historical routing review, sequence migration/backfill, and monthly template validation. Totals uses existing direct references; code does not rewrite formulas or rename tabs.
- Rename the four tabs only after compatible code is deployed and scans have drained. Preserve sheet IDs and colors (yellow, red, green, orange respectively), then verify native direct-reference updates, Totals results, formulas, and layout in both workbooks. Do not rename during a pending rollover or sequence migration.
- Regression coverage includes all four renamed stores, mixed templates, ambiguous aliases, old/new billing receipts, interrupted migration recovery and historical backfill. Live rename/formula adjustment is a separate verification step.

### 0.13.11-draft — 2026-10-19

- Before activating a new month, archive only the previous workbook’s Totals sheet as a single-page PDF in the configured monthly folder. Heading uses the archived month: `P & K Window & Screen Repair September 2026`. Keep the source workbook and formulas.
- Name new workbooks with the full month and year, such as `October 2026`. Preserve internal YYYY-MM keys, ID-bound metadata, legacy `Screens YYYY-MM` recognition, and pending-operation identities.
- Drain live scan leases before snapshotting. Expired orphans recover automatically; a lock-protected exact lease/workbook fence prevents late writes. Flush writes before releasing the lock. Admission failures clean their own lease.
- Journal PDF/scratch creation and reuse verified artifacts on retry. Archive failure prevents activation; uncertain creation never blindly duplicates files. Completion receipts retain scratch cleanup references.
- Validation: 195 offline tests across eight suites; actual Google synthetic and original-template-copy archive tests. Template proof produced one Letter page, the complete heading, eight stores, and all 73 expected amounts. Verified source/template invariance, retry identity, and named-folder access. The body is compact but visually readable. No customer data or paid OCR calls were used.
- Limits: isolated archive tests are not a full live rollover transaction; later template-format changes need their own verification. PDF page-object validation fails closed on unfamiliar encoding. Keep raw evidence, private IDs, addresses, and temporary validation helpers out of the repository/deployment.

#### Template appearance maintenance (separate from code deployment)

- Apply requested tab colors to the verified blank TEMPLATE by store: Downers Grove yellow, Lockport red, Plainfield green, Joliet orange, Manhattan blue, Homer Glen purple, New Lenox black, Willowbrook pink. Do not rename tabs or change their IDs, formulas, data, dimensions, or protections.
- For currency repairs, inspect the current approved amount/total ranges first. Apply USD currency number formatting only to confirmed monetary cells; do not format dates, quantities, sequence numbers, measurements, or whole sheets indiscriminately. Preserve numeric values and formulas, then compare before/after values, formulas, and displayed amounts. Recheck a disposable copied Totals PDF after any change that affects its display.
- Verified format-only repair on the TEMPLATE and current October workbook: Manhattan `L102:M750`; Homer Glen and New Lenox `L102:M1000`; those three stores’ `U102:V250` and `Y102:Y250`; and `W3:W250` on those three plus Downers Grove and Willowbrook. All 7,475 targeted cells per workbook were checked; only number formats changed, with values, formulas, notes, validation, and other formatting preserved. Totals endpoints and row capacities were not expanded. These repairs followed the template archive proof, so that proof does not validate their revised rendering.
- New months inherit template formatting. Existing workbooks require a separately scoped format-only repair; deploying code does not recolor or reformat them.

#### Release checklist

- Recheck the remote base for concurrent changes; review the exact release commit and run all `tests/*.test.cjs` after resolving any delta.
- Confirm monthly folder and archived-month metadata, reconcile old pending operations, stop new scans and drain all old-version executions before upgrading (they have no leases).
- Sync all production files including `MonthArchive.gs`, preserve existing properties/scopes/deployment URL, remove temporary test helpers, then verify the deployed version. Do not start a real new month merely to test deployment.
