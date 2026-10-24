/**
 * Extraction.gs: what Claude is asked to read off a screen tag, and the
 * pure helpers that clean up and sanity-check the answer.
 *
 * This file is the single source of truth for the prompt and schema.
 * It runs in two places:
 *   1. Google Apps Script (production), alongside Code.gs
 *   2. tools/extract-test/run.mjs (local accuracy testing), loaded with node:vm
 * Keep it plain ES2019 with no Apps Script services (no SpreadsheetApp, etc.)
 * so both environments can execute it.
 *
 * STATUS: DRAFT v0.4. Fields are based on three real tag formats (Oct 2026):
 *   - Typed/handwritten "Screen Repair Tag" (Tag #, Store #, Screen Size W x H, Qty x of N)
 *   - Whitmore Ace "Build A New Screen Form" (Ticket #, store name printed, exact
 *     fractional measurements on a diagram, Notes like "Build 2")
 * Column mapping to the real spreadsheet is still pending. See TODO(fields).
 */

var EXTRACTION_VERSION = '0.13.28-draft';

var SYSTEM_PROMPT = [
  'You read Ace Hardware screen tags for a small screen repair shop. Each photo shows one paper form',
  'filled in by an Ace store employee (handwritten or typed). Several layouts exist, including:',
  '- "Screen Repair Tag": Tag #, Store #, Customer Name, Phone, Date, Screen Size (W x H), Qty "x of N",',
  '  and a price table whose QTY column holds the billable inches.',
  '- "Build A New Screen Form" (e.g. Whitmore Ace): Ticket #, store name printed in the header,',
  '  exact measurements written beside a rectangle diagram, and a Notes box.',
  'Other stores may use their own variation of these.',
  '',
  'Extract exactly what is written. Never guess or invent a value:',
  '- If a field is missing or unreadable, return null and say why in "unclear".',
  '- If two readings are plausible (1/7, 2/7, 3/8, 5/9, 0/6, 4/6 in years...), pick the more likely one and list it in "unclear".',
  '  A handwritten 7 with a curled foot is often misread as 2 in ticket numbers: look twice before reading a 2.',
  '  A thin handwritten 1 between other digits is easy to skip ("1201345" read as "120345"): look for it.',
  '- Ignore crossed-out text, stamps, staples, highlighter, and colored stickers.',
  '',
  'Field rules:',
  '- form_type: "repair" for repair tags, "new_build" for build-a-new-screen forms, "patio_door" for patio screen',
  '  door order forms ("Custom Patio Door Order", Circle Glass "Custom Size Patio Screen Doors"), else "unknown".',
  '  Patio door forms: item_type "screen" (a screen door, even though "Glass" is in a company name); width_in and',
  '  height_in are the door\'s Width and Height. Never use "Height to bottom of handle" (or a number written beside',
  '  it) as a dimension. billable_inches null (the script works it out). The circled door size/price line',
  '  (596001, 596048) and frame color are not extras. "Page 1 of 1" is not tag_index/tag_count.',
  '  Circle Glass forms are the shop\'s own order to the supplier: the printed Company, Contact, Phone, Fax,',
  '  Ship To, Email, Store # and P.O. # are the shop\'s, NOT the customer\'s. Take store, customer, phone and',
  '  ticket only from handwritten notes for the customer (e.g. "DG Smith 1234567" in a margin). If a handwritten',
  '  7-digit number could be a phone or a ticket, use it as the ticket and list "ticket_number" in unclear.',
  '- item_type: "window" if the form is for a window / glass repair (glass, panes, glazing), "screen" for',
  '  screen repairs and builds, else "unknown".',
  '  Glass (including tempered, double-strength, obscure, gas-light panels and mirrors), PLEXIGLAS and',
  '  acrylic jobs are windows even when the paper uses a generic Screen/Window Repair heading.',
  '  Fiberglass/fibre glass screen mesh is NOT glass. Tempered glass is NOT thermopane; do not infer insulated panes.',
  '- job_evidence: copy the literal written material, selected/filled job SKU or window-labor SKU with its',
  '  filled quantity/description. Use "" if absent. Do NOT list generic preprinted, unfilled SKU/options.',
  '  Window labor SKUs: 580500 thermopane, 580501 putty wood, 580502 putty aluminum/steel, 580503 aluminum/vinyl insert.',
  '  Treat exact known material SKUs as classification only; never guess a near-match or reference price.',
  '- panes: for window tags, the number of glass panes being repaired: the pane count if written, otherwise the',
  '  quantity on the window labor line (580500-580503), e.g. "1 580503 Labor $24.99" = 1 (null if neither).',
  '- glass_price: for window tags, the glass price written on the tag in dollars (null if none).',
  '- thermopane: true if a window tag says thermopane / insulated / double-pane glass, else false.',
  '- window_spline: true if a window tag has a spline line filled in, else false.',
  '- ticket_number: some stores (Homer) put a printed Ace price-gun label ("ACE PRICE 1234567") on the Tag # line instead',
  '  of writing it: that label\'s number IS the ticket number. Use it; it is normal, not uncertain.',
  '- ticket_number: the Tag # or Ticket # as written, digits only. If the printed store tag shows the full number',
  '  and a short number is also handwritten, use the full printed number. A staple,',
  '  hole or fold may cover a leading digit: preserve exactly the digits you can read, never guess or pad,',
  '  and list "ticket_number" in unclear when any digit is obscured or uncertain. Do not count digits or',
  '  judge ticket length; the script checks it separately.',
  '- store: the Store # field exactly as written (it is often a name or code like "HOMER" or "DG", not a',
  '  number; that is normal and not uncertain). If the form has no Store # field, use the store or town',
  '  name printed on the form (e.g. "Downers Grove").',
  '- sticker_color: color of the round store sticker on the tag, if any: "yellow", "purple" (includes',
  '  magenta and lavender), "pink" (only a light/pastel pink), "blue", "green", "orange", "red", "black",',
  '  "white" or "none".',
  '  Not the paper or ink color.',
  '- customer_name: full customer name as written. last_name: the last word of it, Title Case.',
  '  Names are often hard to read. Give your best reading. name_unclear: true ONLY if the LAST name itself',
  '  is uncertain (an unclear first name does not count). Never list names in "unclear".',
  '- phone: digits only, as written.',
  '- date: the date as written (e.g. "10-8", "9/21", "10/7/2026").',
  '- width_in / height_in: the screen dimensions in inches, exactly as written, fractions converted',
  '  (72 7/16 -> 72.4375). On repair tags use "Screen Size W x H" (first number is width).',
  '  On build forms use the measurement beside the horizontal arrow as width and the one beside the',
  '  vertical arrow as height. Fractions on build forms are normal, not uncertain.',
  '- billable_inches: the number written in the QTY column of the filled-in material rows (they are',
  '  normally all the same). null if none is written.',
  '  If width + height (each rounded up) does not equal QTY, re-check both: 4/9, 1/7, 3/8 and 5/6 can',
  '  be confused in handwriting. Report what is written; never change a number just to make it match.',
  '- qty_rows: literal QTY readings on the filled material/spline/labor rows, top to bottom, comma-',
  '  separated (at most 3), e.g. "78, 78, 78". Use ? for an unreadable digit ("78, 7?, 78"); "" if none.',
  '- line_totals: written TOTAL dollars in material, spline, labor row order, e.g. "16.53, 6.09, 17.40".',
  '  Keep a ? for a missing/unreadable internal row so later totals never shift into another rate position.',
  '  Trailing absent rows may be omitted. Do not infer row identity, compute totals or include extras; "" if none.',
  '- material: "fiberglass", "aluminum" or "pet" according to which material rows are filled in, else "unknown".',
  '- screen_color: "black" or "gray" if circled/marked, else "unknown".',
  '- tag_index / tag_count: from a "Qty x of N" box (x = which tag this is, N = tags in the group),',
  '  e.g. "Qty 2 of 3" -> 2 and 3. Some stores use one ticket number for a group of tags. null if absent.',
  '- Large marker measurements written across the form by the repair shop (e.g. "39 x 36 = 75") are the shop\'s own',
  '  re-measurement, not what the customer was charged: ignore them for width, height, QTY and quantity_conflict.',
  '- balance_due_qty: only when an attached Pay Cashier slip says the screen was measured wrong / balance due and',
  '  charges more of the standard screening SKUs (material 575001/575003/575006, spline 575005, labor 575011/',
  '  575013/580606) with one extra QTY: that extra QTY as digits (e.g. "20"). The tag\'s own QTY stays in',
  '  billable_inches, and those slip lines go nowhere else (not extras, parts or quantity_conflict). Else "".',
  '- Arithmetic written beside the rows (QTY times the price, e.g. "20 x .19 = 3.80") is a price calculation, not a',
  '  screen size: never use it for width/height and never report it as a quantity_conflict.',
  '- quantity_conflict: true if the form, or a slip attached to it, gives DIFFERENT sizes or inches for this',
  '  job (e.g. a corrected size, or a Pay Cashier slip listing other screens/sizes than the tag). Do not pick',
  '  one: put every version in quantity_conflict_details (e.g. "Tag: 27x73 = 100 in. Slip: two 28x37 = 130 in.").',
  '  quantity_conflict_details is always a string: use "" (empty string) when there is no conflict.',
  '- screens_on_tag: how many frames/screens this one form asks for, e.g. a note like "Build 2" -> 2.',
  '  A "Qty x of N" box does NOT count here (each tag in a group is its own form) -> 1. Default 1.',
  '- extras: every filled-in line for an extra item, part or fee beyond the screening/spline/labor rows,',
  '  copied as written, one per line (e.g. "580404 rollers 2 x $15.99 = $63.96", "DE102 Delivery fee $15.00").',
  '  On build forms include corners, labor, frame and extras rows that are filled in. Do not do any math.',
  '  Handwritten lines in the blank rows under the printed SKU list are filled parts lines too, often',
  '  highlighted (e.g. "4 580401 Corners 4.00 16"): include each one in extras AND in parts.',
  '  null if none.',
  '  Standard glass/acrylic material and window-labor lines belong in job_evidence/glass_price, not extras;',
  '  they must not be charged twice as Other Earn. Copy additional parts SKU, description and quantity literally.',
  '  PK on the approved parts reference means shop EARNINGS, not a package count. Spring pins are EACH,',
  '  not a two-pack. Preserve literal quantities; never infer quantity from tag_index/tag_count or unclear text.',
  '- parts: an array for actual FILLED additional-parts lines (not standard screening/glass/window labor),',
  '  including parts written on an attached Pay Cashier slip (e.g. "1 580605 frame spreader 6.95").',
  '  Return at most 30 parts lines; quantities must be explicit integers from 1 through 1000, or 0 if uncertain.',
  '  Each item has sku (literal part number, "" if missing), quantity (explicit integer QTY, 0 if uncertain),',
  '  unit (each, set4, side, job, inch or unknown), group_wide (true only for the whole group/form),',
  '  and raw (the literal line, including any dollar amounts). Do not invent a SKU from generic "pins" or printed unfilled catalog entries.',
  '  A spring pins line (580602) with no quantity written: quantity 0 and copy its dollar amount into raw.',
  '  580601 is a SET OF FOUR, not per corner; 580625 is per SIDE/PIECE. Use unknown for unclear units.',
  '  Service SKUs 580301 (extra labor for wood-frame screens) and 580408 (pet-grille installation)',
  '  use unit job, not each/side/inch. A clearly filled quantity 1 is one job; do not infer a missing',
  '  quantity or use the number of screens/tags as a quantity. Preserve uncertain SKU digits in unclear.',
  '  Their written customer prices are not shop earnings: the approved local PK table supplies the rate.',
  '  Keep group-wide 35 spring pins separate from a sibling marker such as 3 of 11; do not duplicate/multiply.',
  '  A clearly additive ordinal can state one additional part: a filled line "2 580602 Spring Pins"',
  '  plus an attached charge "3rd pin 580602" means THREE pins total, not three additional pins.',
  '  Consolidate those two lines into ONE parts item with quantity 3, unit each, and both literal lines in raw,',
  '  ONLY when the same exact SKU, same job/scope, initial quantity 2, and one additional third pin are clear.',
  '  A third-pin label alone, a repair/replacement of an already counted pin, conflicting quantities, different',
  '  SKUs, or unclear handwriting is not enough: retain the uncertainty and do not infer a total.',
  '  Never treat "3 of 3" (tag sequence) as a parts quantity. Preserve group_wide; do not allocate a group',
  '  charge to every sibling. Customer prices ($2 each/$6 total here) are NOT PK earnings; rates come from',
  '  the approved local SKU table. Unlisted service prices alone are not evidence of PK earnings.',
  '  Standalone additional LB/labor charges remain literal extras (including the LB label and dollar amount),',
  '  not invented parts SKUs. Preserve total/base-vs-additional wording, each/per-door basis, and group scope.',
  '  Do not turn retail prices, existing base labor, or unclear amounts into additional labor earnings.',
  '- group_extras: literal group-wide instructions such as "pins on all frames"; use "" if none. A comment',
  '  about this one screen (e.g. "missing frame spreader") is a note, not a group instruction.',
  '  Keep group-wide parts separate from this tag\'s extras. Never multiply them by tag_index/tag_count or',
  '  repeat them as per-frame quantities on sibling tags such as 3 of 11. Uncertain earnings remain manual.',
  '- notes: comments / notes / screen condition text. null if none.',
  '- has_corrections: true for an actual crossed-out/rewritten value, changed job quantities or sizes,',
  '  refund, credit, cancellation, redo, warranty, "no charge" or "no record". Describe the actual change',
  '  in correction_details. The words "Pay Cashier" alone are NOT a correction: ordinary added parts or',
  '  fees belong in extras, with has_corrections false and correction_details null unless an actual',
  '  correction is also present. Different screen sizes/inches must also set quantity_conflict true.',
  '- correction_details: short description of every correction/refund as written, else null.',
  '- unclear: one short string per field whose VALUE you were unsure about. Formatting, conversions and',
  '  layout differences are not uncertainty. Empty list if everything is clear.',
  '- An Ace "Please Pay Cashier" slip may be attached (or be the only form; still read it, is_tag true).',
  '  Most other slips (not a balance-due slip; see balance_due_qty) just ADD parts or fees (corners, latches, frame, cut, springs): copy those lines into extras,',
  '  not corrections. Set has_corrections only if the slip records a refund, redo, credit, "no record", or',
  '  changes what was already on the tag. Set quantity_conflict only if it lists different screen SIZES or',
  '  inches than the tag. If a second, different tag is visible behind the main one, read only the front tag.',
  '- is_tag: false if the photo does not show one of these forms at all.'
].join('\n');

var USER_TEXT = 'Read this screen tag and return the fields.';

var NULLABLE_STRING = { anyOf: [{ type: 'string' }, { type: 'null' }] };
var NULLABLE_NUMBER = { anyOf: [{ type: 'number' }, { type: 'null' }] };

/** JSON Schema for structured output. All fields required; null when absent. */
var TAG_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'is_tag', 'form_type', 'item_type', 'panes', 'glass_price', 'thermopane', 'window_spline', 'ticket_number', 'store', 'sticker_color', 'customer_name', 'last_name', 'name_unclear', 'phone', 'date',
    'width_in', 'height_in', 'billable_inches', 'material', 'screen_color', 'tag_index', 'tag_count', 'screens_on_tag', 'quantity_conflict', 'quantity_conflict_details', 'qty_rows', 'line_totals', 'balance_due_qty',
    'extras', 'notes', 'has_corrections', 'correction_details', 'unclear', 'job_evidence', 'group_extras', 'parts'
  ],
  properties: {
    parts: { type:'array',description:'At most 30 literal filled parts lines; bounds are enforced locally.',items:{type:'object',additionalProperties:false,required:['sku','quantity','unit','group_wide','raw'],properties:{
      sku:{type:'string'},quantity:{type:'integer',description:'Explicit integer quantity 1 through 1000; 0 means uncertain and is held for review.'},unit:{type:'string',enum:['each','set4','side','job','inch','unknown']},group_wide:{type:'boolean'},raw:{type:'string'}
    }}},
    job_evidence: { type: 'string' },
    group_extras: { type: 'string' },
    is_tag:          { type: 'boolean' },
    form_type:       { type: 'string', enum: ['repair', 'new_build', 'patio_door', 'unknown'] },
    item_type:       { type: 'string', enum: ['screen', 'window', 'unknown'] },
    panes:           { anyOf: [{ type: 'integer' }, { type: 'null' }] },
    glass_price:     NULLABLE_NUMBER,
    thermopane:      { type: 'boolean' },
    window_spline:   { type: 'boolean' },
    ticket_number:   NULLABLE_STRING,
    store:           NULLABLE_STRING,
    sticker_color:   { type: 'string', enum: ['yellow', 'purple', 'pink', 'blue', 'green', 'orange', 'red', 'black', 'white', 'none'] },
    customer_name:   NULLABLE_STRING,
    last_name:       NULLABLE_STRING,
    name_unclear:    { type: 'boolean' },
    phone:           NULLABLE_STRING,
    date:            NULLABLE_STRING,
    width_in:        NULLABLE_NUMBER,
    height_in:       NULLABLE_NUMBER,
    billable_inches: NULLABLE_NUMBER,
    material:        { type: 'string', enum: ['fiberglass', 'aluminum', 'pet', 'unknown'] },
    screen_color:    { type: 'string', enum: ['black', 'gray', 'unknown'] },
    tag_index:       { anyOf: [{ type: 'integer' }, { type: 'null' }] },
    tag_count:       { anyOf: [{ type: 'integer' }, { type: 'null' }] },
    screens_on_tag:  { type: 'integer' },
    quantity_conflict:         { type: 'boolean' },
    // Plain string, not nullable: structured outputs allow at most 16 union-typed (nullable)
    // fields per schema (see tests/offline.test.cjs). "" means no conflict.
    quantity_conflict_details: { type: 'string' },
    qty_rows:                 { type: 'string' },
    balance_due_qty:          { type: 'string' },
    line_totals:              { type: 'string' },
    extras:          NULLABLE_STRING,
    notes:           NULLABLE_STRING,
    has_corrections: { type: 'boolean' },
    correction_details: NULLABLE_STRING,
    unclear:         { type: 'array', items: { type: 'string' } }
  }
};

/**
 * Area codes for the shop's service area (Chicago suburbs). A phone outside these is
 * usually a misread digit (e.g. 709 for 708). Flag only; never auto-correct.
 */
var LOCAL_AREA_CODES = ['224', '312', '331', '464', '630', '708', '773', '779', '815', '847', '872'];

/** Models that support server-side refusal fallbacks (Haiku does not). */
function supportsFallbacks_(model) {
  return /^claude-(opus|sonnet|fable)-/.test(model);
}

/**
 * Build the Messages API request body. Shared by Apps Script and the test harness.
 * Returns { body, betas } so each caller can attach headers its own way.
 */
function buildRequest_(model, imageBase64, mediaType) {
  var body = {
    model: model,
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
    output_config: {
      effort: 'low',
      format: { type: 'json_schema', schema: TAG_SCHEMA }
    },
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: imageBase64 } },
        { type: 'text', text: USER_TEXT }
      ]
    }]
  };
  var betas = [];
  if (supportsFallbacks_(model)) {
    body.fallbacks = 'default';
    betas.push('server-side-fallback-2026-07-01');
  }
  return { body: body, betas: betas };
}

/**
 * Pull the extracted fields out of a Messages API response.
 * Throws an Error with a plain-English .userMessage on failure.
 */
function parseResponse_(resp) {
  if (resp.type === 'error' || resp.error) {
    throw friendlyError_('API error: ' + JSON.stringify(resp.error || resp),
      'The tag reader is having trouble right now. Try again in a minute.');
  }
  if (resp.stop_reason === 'refusal') {
    throw friendlyError_('Model refused: ' + JSON.stringify(resp.stop_details),
      'Couldn\'t read that one. Try another photo.');
  }
  if (resp.stop_reason === 'max_tokens') {
    throw friendlyError_('Hit max_tokens before finishing', 'Couldn\'t read that one. Try again.');
  }
  var text = null;
  for (var i = 0; i < (resp.content || []).length; i++) {
    if (resp.content[i].type === 'text') { text = resp.content[i].text; }
  }
  if (!text) {
    throw friendlyError_('No text block in response', 'Couldn\'t read that one. Try again.');
  }
  return JSON.parse(text);
}

function friendlyError_(detail, userMessage) {
  var e = new Error(detail);
  e.userMessage = userMessage;
  return e;
}

/**
 * Make a value safe to write into a cell. Sheets treats text starting with = + - @ (or a
 * tab/CR before them) as a formula, and text comes from tags, Claude and the phone, so any
 * such string gets a leading apostrophe: Sheets stores it as plain text and hides the
 * apostrophe. Numbers, dates and ordinary text pass through unchanged.
 * EVERY value the script writes to a sheet must go through safeCell_ / safeRow_.
 */
function safeCell_(v) {
  return typeof v === 'string' && /^[=+\-@\t\r]/.test(v) ? "'" + v : v;
}

function safeRow_(values) {
  return values.map(safeCell_);
}

/** "6305550142" -> "630-555-0142"; 7 digits -> "555-0142"; otherwise unchanged. */
function formatPhone_(digits) {
  if (!digits) return '';
  var d = String(digits).replace(/\D/g, '');
  if (d.length === 11 && d.charAt(0) === '1') d = d.substring(1);
  if (d.length === 10) return d.substring(0, 3) + '-' + d.substring(3, 6) + '-' + d.substring(6);
  if (d.length === 7) return d.substring(0, 3) + '-' + d.substring(3);
  return String(digits);
}

/** 35.5 -> "35 1/2", 35.0625 -> "35 1/16". Rounds to the nearest 1/16". */
function formatInches_(n) {
  if (n === null || n === undefined || isNaN(n)) return '?';
  var sixteenths = Math.round(n * 16);
  var whole = Math.floor(sixteenths / 16);
  var num = sixteenths % 16;
  if (num === 0) return String(whole);
  var den = 16;
  while (num % 2 === 0) { num /= 2; den /= 2; }
  return (whole ? whole + ' ' : '') + num + '/' + den;
}

/** Spoken version: 35.5 -> "35 and a half". Falls back to the written form. */
function speakInches_(n) {
  var words = { '1/2': 'and a half', '1/4': 'and a quarter', '3/4': 'and three quarters' };
  var s = formatInches_(n);
  var parts = s.split(' ');
  if (parts.length === 2 && words[parts[1]]) return parts[0] + ' ' + words[parts[1]];
  return s;
}

/**
 * Sanity checks on top of the model's own "unclear" list.
 * Returns a list of reasons this row should be reviewed by a human (empty = fine).
 */
function reviewReasons_(x) {
  var reasons = (x.unclear || []).filter(function (u) { return !/name/i.test(u); });
  if (!x.is_tag) reasons.push('Photo may not be a tag');
  if (!x.ticket_number) reasons.push('No ticket number');
  else if (/^\d+$/.test(x.ticket_number) && x.ticket_number.length !== 7) {
    // Every Ace ticket seen so far is 7 digits; a staple over the first digit is the usual cause.
    reasons.push('Ticket # has ' + x.ticket_number.length + ' digits (Ace tickets have 7): ' +
      (x.ticket_number.length <= 5 ? 'it may be only the handwritten last digits' : 'a staple may hide a digit') + ', check the tag');
  }
  if (!x.store && (!x.sticker_color || x.sticker_color === 'none')) reasons.push('No store');
  if (!x.last_name) reasons.push('No customer name');

  var d = String(x.phone || '').replace(/\D/g, '');
  if (d.length === 11 && d.charAt(0) === '1') d = d.substring(1);
  if (!d) {
    reasons.push('No phone');
  } else if (d.length !== 10) {
    reasons.push('Phone has ' + d.length + ' digits');
  } else if (LOCAL_AREA_CODES.indexOf(d.substring(0, 3)) === -1) {
    reasons.push('Area code ' + d.substring(0, 3) + ' is not local (misread?)');
  }

  if (x.item_type === 'window') {
    if (!x.panes) reasons.push('Window: number of panes not found');
  } else if (x.width_in === null || x.height_in === null) {
    reasons.push('Missing a dimension');
  } else {
    if (x.width_in < 6 || x.width_in > 120) reasons.push('Width ' + x.width_in + '" looks unusual');
    if (x.height_in < 6 || x.height_in > 120) reasons.push('Height ' + x.height_in + '" looks unusual');

  }
  if (x.has_corrections) reasons.push('Correction/refund: ' + (x.correction_details || 'see tag'));
  // How a conflict or multi-screen form is WRITTEN is decided (and described) in Workbook.gs.
  var conflict = quantityConflict_(x);
  if (conflict) reasons.push('Inches disagree: ' + conflict);
  if (x.screens_on_tag > 1) reasons.push('Form lists ' + x.screens_on_tag + ' screens');
  return reasons;
}

/** Last name as written to the sheet: best reading, with "(?)" when Claude wasn't sure. */
function sheetName_(x) {
  var n = x.last_name || x.customer_name || '';
  // "Ann B": a last name of one or two letters is an initial, so keep the name as written (0.13.22).
  var full = String(x.customer_name || '').replace(/\s+/g, ' ').trim();
  if (String(x.last_name || '').replace(/[^A-Za-z]/g, '').length <= 2 && full.length > String(x.last_name || '').length && /[A-Za-z]{2}/.test(full)) n = full;
  return n && x.name_unclear ? n + ' (?)' : n;
}

/**
 * Describes conflicting quantities on a tag, or returns null. Two sources:
 *  - Claude saw different sizes/inches on the form or an attached slip (quantity_conflict)
 *  - the billed QTY doesn't equal width + height, each rounded UP (how Ace bills)
 * Never picks a winner; the caller leaves billing blank for a person to decide.
 */
function quantityConflict_(x) {
  if (x.quantity_conflict) return x.quantity_conflict_details || 'the form shows more than one size';
  if (typeof x.billable_inches === 'number' && typeof x.width_in === 'number' && typeof x.height_in === 'number') {
    var expected = Math.ceil(x.width_in) + Math.ceil(x.height_in);
    if (expected !== x.billable_inches) {
      return 'size ' + formatInches_(x.width_in) + ' x ' + formatInches_(x.height_in) + ' = ' + expected +
        '" but billed QTY is ' + x.billable_inches + '"';
    }
  }
  return null;
}

/**
 * A reported conflict that the tag itself contradicts unanimously (New Lenox, 2026-10-23: price arithmetic
 * "20 x .19" read as a second size): the rounded size, the billed QTY, every QTY row (2 or more) and every dollar
 * total (2 or more, at this material's rates, to the cent) all give the same inches. Corrections still hold.
 */
var UNANIMOUS_REFUSE = new RegExp(['slip', 'cashier', 'receipt', 'balance', '\\bdue\\b', 'wrong', 'should be', 'refund', 'redo',
  '\\bcorrect(?:ed|ion|ions|s)?\\b', 'second screen', '\\b2nd\\b', 'another', 'additional', '\\bextra\\b', 'other (?:screen|size)',
  '\\b(?:two|three|\\d+) screens', 'owe[sd]?\\b', 'charged', 'upcharge', 'mis-?measur', '\\bplus \\d', 'more inch', 'crossed', 'changed',
  'also lists', '\\bscreen \\d'].join('|'), 'i');
function unanimousInches_(x) {
  // A conflict that names a slip, a balance due, another screen or a correction is a real disagreement, not price
  // arithmetic ("20 x .19 = 3.80 ... not a second size" and "read correctly" still pass). Review 2026-10-23.
  if (UNANIMOUS_REFUSE.test(String(x.quantity_conflict_details || ''))) return null;
  if (x.has_corrections || !Number.isFinite(x.width_in) || !Number.isFinite(x.height_in) ||
      x.width_in < 6 || x.width_in > 120 || x.height_in < 6 || x.height_in > 120) return null;
  var rate = Object.prototype.hasOwnProperty.call(RATES, x.material) ? RATES[x.material] : null;
  if (!rate || typeof x.qty_rows !== 'string' || typeof x.line_totals !== 'string') return null;
  var n = Math.ceil(x.width_in) + Math.ceil(x.height_in);
  if (x.billable_inches !== n || !isSettlementInches_(n)) return null;
  var rows = x.qty_rows.split(/[,;\s]+/).filter(Boolean), totals = x.line_totals.split(/[,;\s]+/).filter(Boolean);
  if (rows.length < 2 || rows.length > 3 || rows.some(function (t) { return t !== String(n); })) return null;
  var rates = [rate.material, 0.07, rate.labor];
  if (totals.length < 2 || totals.length > 3 || totals.some(function (t, i) {
    return !/^\$?\d+(?:\.\d{1,2})?$/.test(t) || Math.round(Number(t.replace(/^\$/, '')) * 100) !== Math.round(n * rates[i] * 100);
  })) return null;
  return n;
}

/**
 * Balance-due slip QTY (0.13.25): {qty} when it reads as 1-200 whole inches, {qty: 0} when empty,
 * else {qty: 0, bad: raw} so the caller flags it instead of dropping it silently.
 */
function balanceDueQty_(x) {
  var raw = x && x.balance_due_qty !== null && x.balance_due_qty !== undefined ? String(x.balance_due_qty).trim() : '';
  if (!raw || /^(?:0+(?:\.0+)?|none|no|nil|n\/?a|n\.a|null|[-\u2013\u2014]+)\.?$/i.test(raw)) return { qty: 0 };
  if (/^\d{1,3}$/.test(raw) && Number(raw) >= 1 && Number(raw) <= 200) return { qty: Number(raw) };
  return { qty: 0, bad: raw.slice(0, 40) };
}

/** Conservative envelope derived from the existing 6..120-inch dimension review limits. */
function isSettlementInches_(n) {
  return Number.isSafeInteger(n) && n >= 12 && n <= 240;
}

/**
 * Reconcile a size/QTY disagreement from literal tag evidence; never edit the original readings.
 * Explicit conflicts and unusual/missing dimensions remain manual. All written totals must agree
 * to the cent, then agree with size or a clear QTY-row majority. With no totals, use that majority.
 * A written but unreadable/contradictory total blocks the QTY fallback. Every result needs review.
 */
function settleInches_(x) {
  if (x.quantity_conflict || x.has_corrections || !Number.isFinite(x.width_in) || !Number.isFinite(x.height_in) ||
      x.width_in < 6 || x.width_in > 120 || x.height_in < 6 || x.height_in > 120) return null;
  var rate = Object.prototype.hasOwnProperty.call(RATES, x.material) ? RATES[x.material] : null;
  if (!rate) return null;
  if (x.qty_rows != null && typeof x.qty_rows !== 'string' ||
      x.line_totals != null && typeof x.line_totals !== 'string') return null;
  var qtyText = x.qty_rows || '', totalText = x.line_totals || '';
  if (qtyText.length > 200 || totalText.length > 200) return null;
  var tokens = qtyText.split(/[,;\s]+/).filter(Boolean);
  var totals = totalText.split(/[,;\s]+/).filter(Boolean);
  if (tokens.length > 3 || totals.length > 3 || totalText.trim() && !totals.length) return null;
  // Row readings may contain unreadable digits, but a tag sequence or prose is not row evidence.
  if (tokens.some(function(t) { return !/^[0-9?]+$/.test(t); })) return null;
  var sizeSum = Math.ceil(x.width_in) + Math.ceil(x.height_in), counts = {}, best = null;
  tokens.forEach(function(t) {
    if (/^\d+$/.test(t) && isSettlementInches_(Number(t))) counts[t] = (counts[t] || 0) + 1;
  });
  Object.keys(counts).forEach(function(k) { if (best === null || counts[k] > counts[best]) best = k; });
  var qty = best !== null && counts[best] >= 2 && counts[best] * 2 > tokens.length ? Number(best) : null;
  var byTotals = null, amounts = [], rates = [rate.material, 0.07, rate.labor];
  if (totals.length >= 2 && totals.every(function(t) { return /^\$?\d+(?:\.\d{1,2})?$/.test(t); })) {
    amounts = totals.map(function(t) { return Number(t.replace(/^\$/, '')); });
    var implied = amounts.map(function(n, i) {
      var q = Math.round(n / rates[i]);
      return Number.isFinite(n) && n > 0 && isSettlementInches_(q) &&
        Math.round(q * rates[i] * 100) === Math.round(n * 100) ? q : null;
    });
    if (implied[0] !== null && implied.every(function(q) { return q === implied[0]; })) byTotals = implied[0];
  }
  if (byTotals !== null && (byTotals === sizeSum || byTotals === qty)) {
    return {inches:byTotals, note:'Inches ' + byTotals + '" taken from the written $ totals (' +
      amounts.map(function(n) { return '$' + n.toFixed(2); }).join(', ') + '), matching ' +
      (byTotals === sizeSum ? 'the rounded written size' : 'the QTY-row majority') +
      '. Original billed QTY: ' + (x.billable_inches == null ? 'blank' : x.billable_inches + '"') + '; check the tag'};
  }
  if (!totals.length && qty !== null) {
    return {inches:qty, note:'Billed from QTY-row majority ' + qty + '" (rows read ' + tokens.join(', ') +
      '); rounded written size is ' + sizeSum + '". Original billed QTY: ' +
      (x.billable_inches == null ? 'blank' : x.billable_inches + '"') + '; check the size and tag'};
  }
  return null;
}

/** One-line confirmation shown on the phone. */
function confirmationText_(x) {
  var who = (sheetName_(x) || '(no name)') + (x.ticket_number ? ' #' + x.ticket_number : '');
  if (x.item_type === 'window') {
    return 'Added window: ' + who + ', ' + (x.panes ? x.panes + ' pane' + (x.panes > 1 ? 's' : '') : 'panes ?');
  }
  return 'Added: ' + who + ', ' + formatInches_(x.width_in) + ' x ' + formatInches_(x.height_in);
}

/** Version for Siri to read aloud. */
function spokenText_(x, needsReview) {
  var s = x.item_type === 'window'
    ? 'Added window for ' + (x.last_name || 'no name') + (x.panes ? ', ' + x.panes + ' pane' + (x.panes > 1 ? 's' : '') : '') + '.'
    : 'Added ' + (x.last_name || 'no name') + ', ' + speakInches_(x.width_in) + ' by ' + speakInches_(x.height_in) + '.';
  if (needsReview) s += ' Please double check this one.';
  return s;
}
