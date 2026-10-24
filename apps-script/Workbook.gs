/**
 * Workbook.gs: how scans map onto Kirsten's monthly "8 stores" workbook.
 * See docs/SPREADSHEET.md for the layout this encodes.
 *
 * Each store has screens and windows blocks resolved from headers (Layout.gs).
 * Both legacy and sequence-column layouts are supported. A scan goes in the first empty row of the right
 * block on the right store tab, so the existing Totals tab keeps working.
 * Every scan is also logged to a "Scans" tab (Code.gs).
 */

/**
 * Store lookup. `keys` are the values a tag's "Store #" may contain, compared
 * case-insensitively with spaces and punctuation removed ("#18559" == "18559",
 * "Homer Glen" == "HOMERGLEN"). Add new codes here as stores use them.
 */
var STORES = [
  { tab: '18559-(500)', name: 'Downers Grove', keys: ['18559', '500', 'DG', 'Downers Grove', 'Downers'] },
  { tab: '18563 (37)',  name: 'Lockport',      keys: ['18563', '3700', '37', 'Lockport'] },
  { tab: '18556 (43)',  name: 'Plainfield',    keys: ['18556', '4300', '43', 'Plainfield'] },
  { tab: '18650 (60)',  name: 'Joliet',        keys: ['18650', '6000', '60', 'Joliet', 'Joilet'] },
  { tab: 'Manhattan',   name: 'Manhattan',     keys: ['Manhattan'] },
  { tab: 'Homer Glen',  name: 'Homer Glen',    keys: ['Homer', 'Homer Glen'] },
  { tab: 'New Lenox',   name: 'New Lenox',     keys: ['New Lenox'] },
  { tab: 'Willowbrook', name: 'Willowbrook',   keys: ['Willowbrook'] }
];

/** Keep canonical tab keys stable for historical earnings receipts; resolve display aliases only. */
function storeTabNames_(store) { return store.tab===store.name?[store.tab]:[store.tab,store.name]; }
function storeByTabName_(name) {
  return STORES.filter(function(st){return storeTabNames_(st).indexOf(name)>=0;})[0]||null;
}
function storeSheet_(ss, store) {
  var found=storeTabNames_(store).map(function(name){return ss.getSheetByName(name);}).filter(Boolean);
  if(found.length>1)throw new Error('Both old and city-named tabs exist for '+store.name+'. Resolve the duplicate tabs before scanning or rollover.');
  return found[0]||null;
}

/**
 * Each store marks its tags with a colored sticker (per Kirsten). Used when the written store
 * can't be read (e.g. the sticker covers the Store # box), and as a cross-check otherwise.
 *   Downers Grove yellow, Lockport red, Plainfield green, Joliet orange, Manhattan blue,
 *   Homer Glen purple/magenta, New Lenox black, Willowbrook pink.
 * Pink is NOT mapped on purpose: Homer's stickers photograph as magenta, which is too close to
 * pink to trust, so Willowbrook relies on the written store. The written store always wins;
 * a disagreement is flagged.
 * Confirmed on real tags: yellow, purple, blue, green.
 */
var STICKER_STORES = {
  yellow: 'Downers Grove',
  red: 'Lockport',
  green: 'Plainfield',
  orange: 'Joliet',
  blue: 'Manhattan',
  purple: 'Homer Glen',
  black: 'New Lenox'
};

/**
 * Colors that photograph alike. Real tags: Joliet's orange sticker read as "red" every time.
 * A color in a group only identifies "one of these stores", so it never places a tag on its
 * own and never flags a tag whose written store is in the same group.
 */
var STICKER_LOOKALIKES = [['red', 'orange']];

/** Every store a sticker color could mean (lookalike colors included). */
function storesForSticker_(color) {
  var colors = [color];
  STICKER_LOOKALIKES.forEach(function (g) { if (g.indexOf(color) !== -1) colors = g; });
  var out = [];
  colors.forEach(function (c) {
    var name = STICKER_STORES[c];
    for (var i = 0; name && i < STORES.length; i++) if (STORES[i].name === name) out.push(STORES[i]);
  });
  return out;
}

/** Store from sticker color, or null when the color is unmapped or could mean more than one store. */
function storeFromSticker_(color) {
  var candidates = storesForSticker_(color);
  return candidates.length === 1 ? candidates[0] : null;
}

/**
 * Decide the store: written store first, sticker as fallback. Returns { store, flag }.
 * When both are known and disagree, the written store wins and the row is flagged.
 */
function resolveStore_(x) {
  var written = matchStore_(x.store);
  var candidates = storesForSticker_(x.sticker_color);
  if (written && candidates.length && candidates.indexOf(written) === -1) {
    return { store: written, flag: 'Store says ' + written.name + ' but ' + x.sticker_color + ' sticker means ' +
      candidates.map(function (c) { return c.name; }).join(' or ') };
  }
  if (written) return { store: written };
  var bySticker = storeFromSticker_(x.sticker_color);
  if (bySticker) {
    return { store: bySticker, flag: x.store ? 'Store "' + x.store + '" unreadable; placed by ' + x.sticker_color + ' sticker' : null };
  }
  return { store: null };
}

/**
 * Per-inch rates printed on the Ace repair tags (Oct 2026). Kirsten confirmed G and H
 * use these; pet labor ($0.22) is from the tag and not yet confirmed by her.
 */
var RATES = {
  fiberglass: { material: 0.15, labor: 0.17 },
  aluminum:   { material: 0.19, labor: 0.20 },
  pet:        { material: 0.25, labor: 0.22 }
};
var FLAG_COLOR = '#fff3c4';
var HINT_COLOR = '#fdf6dd';

/** Words that make a ticket doubt a slip, quantity, other-job, rescan or money question (review of #19). */
var TICKET_DOUBT_SERIOUS = new RegExp(['slip', 'pay[- ]cashier', 'balance due', 'owed', '\\bqty\\b', 'quantit', '\\binch', '\\bscreen\\b',
  '\\b(?:tag|screen|form) \\d+ of \\d+\\b', '\\b(?:two|multiple|second) (?:tickets?|jobs?|screens?|tags?)\\b', 'two numbers',
  '\\b(?:other|another|previous|earlier) (?:tags?|tickets?|jobs?|screens?|stores?|locations?|customers?)\\b',
  'share[sd]? (?:this|the|a) (?:ticket|number)', 'same ticket', '\\ba repeat\\b', 'repeat (?:job|order|customer|ticket)', 'rescan',
  'scanned (?:earlier|before|twice|already)', 'work order', 'both tags', 'not a ticket', '\\d\\.\\d\\d'].join('|'), 'i');
/** A coloured sticker names a store, even when the doubt says it covers the number (checked on the full doubt). */
var STICKER_COLOR_RE = /(?:red|green|blue|yellow|orange) sticker|sticker[^;]*\b(?:red|green|blue|yellow|orange)\b/i;
/**
 * True when a reason names a store other than the one the tag was routed to (review of #19: wording alone can't
 * tell "Homer tag, digit faint" from "may be a Lockport ticket"). Number-only codes count after "Store #".
 * With no routed store, any store named counts (fail closed).
 */
function storeNamed_(r, routed) {
  return STORES.some(function (s) {
    if (routed && s.name === routed.name) return false;
    return s.keys.concat([s.name]).some(function (k) {
      return new RegExp(/[a-z]/i.test(k) ? '\\b' + k + '\\b' : 'store\\s*#\\s*' + k + '\\b', 'i').test(r);
    });
  });
}
/** Display severity only. Money/placement and unknown reasons fail closed to row review. */
function reviewTier_(reason, routed) {
  // "digit group" in an OCR doubt is about handwriting, not a group of tags (0.13.22, October data).
  var r = String(reason || '').replace(/\bdigit groups?\b/ig, 'digits');
  if (/^Group check \(name\)/.test(r)) return {tier:'cell',field:'NAME'};
  // Kirsten (2026-10-23): she doesn't use the tag year, so a year doubt alone is kept in the Scans log only.
  if (/^(?:Tag year \d{4} looks off|Two-digit tag year)/.test(r) && !/after the scan date|left blank|invalid|unreadable/i.test(r)) return {tier:'log'};
  if (/^Group check \(ticket\)/.test(r)) return {tier:'cell',field:'TICKET'};
  if (/^Group check \(tag\)/.test(r)) return {tier:'cell',field:'SEQUENCE'};
  var sequence = /tag_count|tag_index|tag x of n|x of n|\bqty( box)?\b[^.]*\b\d+ of \d+|\bqty box\b|'of n'|\bof n\b|\btotal n\b/i;
  var serious = /(?:^|[^a-z])(?:amount|cost|charge|fee)s?(?:[^a-z]|$)|inches|\$|price|earning|\bbill(?:ed|able|ing)\b|screening|lb earn|\bparts\b|part sku|unrecognized part|\blabor\b|\bextras?\b|group|receipt|reserved|unposted|unit needs|window|pane|thermopane|build|frame|screens|store|sticker|\bfull\b|duplicate|already scanned|material|glass|acrylic|routed|layout|type is unknown|not a tag|refund|credit|redo|warranty|cancel|no charge|no record|spline-reference|literal (?:qty|row)|pending|interrupted|not placed|unplaced|reconcil|\bpartial\b|original scan/i; // "partially uncertain" OCR is not a partial save
  // A doubt about the ticket reading is one value, even when it mentions a price-gun label (Homer, 2026-10-23), but
  // not when it also raises a store, slip, window, quantity or money question (review 2026-10-23).
  if (/^ticket_number\b/i.test(r)) {
    var rest = r.replace(/(?:ace )?price(?:[- ]gun| tag)? (?:label|sticker)s?|ace price|price[- ]gun|price tag|printed label|covered by (?:a |the )?(?:sticker|label)|(?:ace )?sticker (?:over|covers?|hides?|obscur\w*)|stickered|extra (?:\w+ )?digits?|store\s*#\s*\w+/ig, ''); // "Store # HOMER" is the form's own field
    if (!serious.test(rest) && !TICKET_DOUBT_SERIOUS.test(rest) && !storeNamed_(r, routed) && !STICKER_COLOR_RE.test(r)) return {tier:'cell',field:'TICKET'};
    return {tier:'row'}; // otherwise the generic "ticket" rule below would make it one cell again
  }
  if (/^Correction\/refund:/i.test(r)) {
    var what = r.replace(/^Correction\/refund:\s*/i, '');
    if (serious.test(what) || /size|inch|quantity/i.test(what)) return {tier:'row'};
    if (sequence.test(what)) return {tier:'cell',field:'SEQUENCE'};
    if (/\bqty\b/i.test(what)) return {tier:'row'};
    if (/ticket|tag (number|#)/i.test(what)) return {tier:'cell',field:'TICKET'};
    if (/phone|name/i.test(what)) return {tier:'log'};
    if (/\bdate\b/i.test(what)) return {tier:'cell',field:'DATE_IN'}; // a crossed-out date is one value, not money
    return {tier:'row'};
  }
  // A width/height doubt that the tag's own QTY or totals already confirm is detail for the Scans log.
  if (/^(?:width|height)(?:_in)?\b/i.test(r) && /\bmatch(?:es|ing)?\b/i.test(r) && !/\$|price|refund|credit/i.test(r)) return {tier:'log'};
  if (/^Ticket # /.test(r)) return {tier:'cell',field:'TICKET'}; // digit-count and ticket-book hints (may say "store")
  if (/Ticket already on/i.test(r) || serious.test(r)) return {tier:'row'};
  if (/in Scans only until the sequence-column migration/.test(r)) return {tier:'log'};
  if (sequence.test(r)) return {tier:'cell',field:'SEQUENCE'};
  if (/\bqty\b|quantity/i.test(r)) return {tier:'row'};
  if (/phone|area code/i.test(r)) return {tier:'log'};
  if (/ticket/i.test(r)) return {tier:'cell',field:'TICKET'};
  if (/date|tag year|century/i.test(r)) return {tier:'cell',field:'DATE_IN'};
  if (/no customer name|customer name|last name|\bname\b/i.test(r)) return {tier:'cell',field:'NAME'};
  if (/width|height|size|spline total|total .*digit|sku .*(unclear|handwriting)/i.test(r)) return {tier:'log'};
  return {tier:'row',unknown:true};
}

function appendReviewNote_(cell, note) {
  var existing = cell.getNote() || '';
  if (existing === note || existing.endsWith('\n\n' + note)) return;
  cell.setNote(existing ? existing + '\n\n' + note : note);
}

/**
 * Each store uses sequential ticket books (Homer 8169xxx, Downers Grove 8159xxx, ...). When the read
 * ticket isn't near any 7-digit ticket already on that store's tab, suggest the one-digit fix that is
 * (a staple hiding the first digit was the most common October correction). Never changes the value.
 */
function ticketBookHint_(sh, layout, ticket) {
  var t = String(ticket || '');
  if (!/^\d{4,7}$/.test(t)) return null;
  var known = [];
  ['screens', 'windows'].forEach(function (block) {
    var end = block === 'screens' ? screenBlockEnd_(sh) : WINDOW_LAST_ROW;
    sh.getRange(2, layout[block].TICKET, end - 1, 1).getValues().forEach(function (r) {
      var v = String(r[0]).trim(); if (/^\d{7}$/.test(v)) known.push(Number(v));
    });
  });
  if (known.length < 2) return null;
  var near = function (s) { var n = Number(s); return known.some(function (k) { return Math.abs(k - n) <= 300; }); };
  if (t.length === 7 && near(t)) return null;
  if (t.length <= 5) return shortTicketHint_(t, known, near);
  if (t.length === 7) { var alike = lookAlikeTicket_(t, known, near); if (alike) return alike; }
  var cands = {};
  for (var p = 0; p <= t.length; p++) for (var d = 0; d <= 9; d++) {
    var c = t.length === 6 ? t.slice(0, p) + d + t.slice(p) : (p < 7 ? t.slice(0, p) + d + t.slice(p + 1) : null);
    if (c && c.length === 7 && c !== t && near(c)) cands[c] = true;
  }
  // Rank by how many of the store's tickets each candidate sits near; a clear winner beats a stray misread.
  var score = function (c) { var n = Number(c); return known.filter(function (k) { return Math.abs(k - n) <= 300; }).length; };
  var list = Object.keys(cands).sort(function (a, b) { return score(b) - score(a); });
  var prefixes = {}; known.forEach(function (k) { var p4 = String(k).slice(0, 4); prefixes[p4] = (prefixes[p4] || 0) + 1; });
  var book = Object.keys(prefixes).sort(function (a, b) { return prefixes[b] - prefixes[a]; })[0] + 'xxx';
  if (list.length > 1 && score(list[0]) >= 2 * score(list[1]) && t.length === 7) list = [list[0]];
  if (list.length > 1 && t.length === 6 && score(list[0]) >= 2 * score(list[1]) && score(list[0]) >= 3) list = [list[0]];
  if (list.length === 1) return 'Ticket # ' + t + (t.length === 6 ? ' is missing a digit' : ' looks off for this store') +
    ' (' + book + '): likely ' + list[0] + ', check the tag';
  if (list.length > 1 && list.length <= 10 && t.length === 6) {
    var pattern = list[0].split('').map(function (ch, i) { return list.every(function (c) { return c[i] === ch; }) ? ch : '_'; }).join('');
    if ((pattern.match(/_/g) || []).length === 1) return 'Ticket # ' + t + ' is missing a digit: likely ' + pattern + ' (this store: ' + book + '), check the tag';
  }
  if (list.length && t.length === 6) return 'Ticket # ' + t + ' is missing a digit; this store\'s tickets look like ' + book + ', check the tag';
  return null;
}

/**
 * Handwritten look-alikes in the first four digits (New Lenox, 2026-10-23: 7s read as 2s, "2208169" for 7708169).
 * Swapping only confusable pairs into the store's ticket series gives one likely ticket; never changes the value.
 */
var LOOK_ALIKE = { '2': '7', '7': '21', '1': '7', '3': '8', '8': '3', '4': '9', '9': '4', '5': '6', '6': '50', '0': '6' };
function lookAlikeTicket_(t, known, near) {
  var books = {}; known.forEach(function (k) { var p = String(k).slice(0, 4); books[p] = (books[p] || 0) + 1; });
  if (books[t.slice(0, 4)] >= 2) return null; // its own book is an established series on the tab: not a misread
  var found = Object.keys(books).filter(function (p) {
    if (p === t.slice(0, 4) || books[p] < 2) return false;
    for (var i = 0; i < 4; i++) if (p.charAt(i) !== t.charAt(i) && (LOOK_ALIKE[t.charAt(i)] || '').indexOf(p.charAt(i)) < 0) return false;
    return near(p + t.slice(4));
  });
  if (found.length !== 1) return null;
  var fix = found[0] + t.slice(4), pairs = [];
  for (var i = 0; i < 4; i++) if (fix.charAt(i) !== t.charAt(i)) pairs.push(t.charAt(i) + '/' + fix.charAt(i));
  return 'Ticket # ' + t + ' looks off for this store (' + found[0] + 'xxx): likely ' + fix + ' (' + pairs.filter(function (p, k) { return pairs.indexOf(p) === k; }).join(', ') + ' look alike), check the tag';
}

/**
 * A 4- or 5-digit ticket is usually just the handwritten last digits (Plainfield, 2026-10-22: tickets should
 * be all 7). Suggest the full number from the store's ticket series; when two series share those last
 * digits, name both. Never changes the value.
 */
function shortTicketHint_(t, known, near) {
  var series = {};
  known.forEach(function (k) { var c = String(k).slice(0, 7 - t.length) + t; if (near(c)) series[c] = true; });
  var list = Object.keys(series).sort();
  var what = 'Ticket # ' + t + ' looks like only the last ' + t.length + ' digits';
  if (list.length === 1) return what + ': likely ' + list[0] + ', check the tag';
  if (list.length > 1 && list.length <= 3) return what + ': could be ' + list.join(' or ') + ' (more than one ticket series), check the tag';
  return null;
}

/** Row notes, one-cell hints or Scans-only details; never clear existing data or unrelated notes. */
function showReview_(sh, row, c, flags) {
  var rowFlags = [], cells = {};
  flags.forEach(function(f) {
    var t = reviewTier_(f, storeByTabName_(sh.getName()));
    if (t.tier === 'row') rowFlags.push(f);
    else if (t.tier === 'cell') {
      var col = c[t.field] || c.NAME;
      (cells[col] = cells[col] || []).push(f);
    }
  });
  if (rowFlags.length) sh.getRange(row,c.DATE_IN,1,c.LB_EARN-c.DATE_IN+1).setBackground(FLAG_COLOR);
  Object.keys(cells).forEach(function(key) {
    var col = Number(key);
    if (col === c.NAME && rowFlags.length) return;
    var cell = sh.getRange(row,col);
    if (!rowFlags.length) cell.setBackground(HINT_COLOR);
    appendReviewNote_(cell,'Glance at this value:\n- ' + cells[key].join('\n- '));
  });
  var nameNotes = rowFlags.concat(rowFlags.length ? cells[c.NAME] || [] : []);
  if (nameNotes.length) appendReviewNote_(sh.getRange(row,c.NAME),'Check against the tag:\n- ' + nameNotes.join('\n- '));
  return rowFlags.length > 0;
}

/**
 * New-build forms (per Kirsten): entered like a repair, but $9 is added to LB Earn and
 * $1.50 goes in Earning, plus more for extras like pins (she adds those by hand).
 * Applied once per tag; "Build 2" tags are flagged so she can check whether to double it.
 */
var NEW_BUILD = { laborAdd: 9.00, earningBase: 1.50 };
var COUNTER_COL = 1; // A: row numbers 1..N mark the screens block's data rows

/**
 * Windows block, 1-based columns (rows 2..250 on every tab; totals at row 254).
 * Per Kirsten (confirmed 2026-10-22): they earn $18.50 labor per pane, $27 for thermopane; glass
 * price is recorded but not earned; extras (corners, latches) and spline (only on some
 * windows) are entered by her.
 */
var WINDOW_LAST_ROW = 250;
var WINDOW_LABOR_PER_PANE = { standard: 18.50, thermopane: 27.00 };


function normStoreKey_(s) {
  return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Returns the STORES entry for a tag's store value, or null if unrecognised.
 * Stores write a number, a code or an abbreviation, and it varies, so this tries in order:
 *   1. an exact key ("HOMER", "DG", "18559", "500")
 *   2. the start of a store name, 4+ letters ("PLAIN" -> Plainfield)
 *   3. initials of a multi-word name, 2+ letters ("NL" -> New Lenox)
 *   4. a misspelled store name, 1 letter off for 5-6 letters, 2 for 7+ ("Manhatten" -> Manhattan)
 * Steps 2-4 only match when exactly one store fits; anything ambiguous returns null.
 */
function matchStore_(value) {
  var k = normStoreKey_(value);
  if (!k) return null;
  var i, j;
  for (i = 0; i < STORES.length; i++) {
    for (j = 0; j < STORES[i].keys.length; j++) {
      if (normStoreKey_(STORES[i].keys[j]) === k) return STORES[i];
    }
  }
  if (/^[A-Z]+$/.test(k)) {
    var hits = [];
    STORES.forEach(function (st) {
      var name = normStoreKey_(st.name);
      var words = st.name.toUpperCase().split(/\s+/);
      var initials = words.length > 1 ? words.map(function (w) { return w.charAt(0); }).join('') : '';
      if ((k.length >= 4 && name.indexOf(k) === 0) || (k.length >= 2 && k === initials)) hits.push(st);
    });
    if (hits.length === 1) return hits[0];
    if (k.length >= 5) {
      var allowed = k.length >= 7 ? 2 : 1;
      var near = STORES.filter(function (st) { return editDistance_(k, normStoreKey_(st.name)) <= allowed; });
      if (near.length === 1) return near[0];
    }
  }
  return null;
}

/** Levenshtein distance, for catching misspelled store names. */
function editDistance_(a, b) {
  var prev = [], cur, i, j;
  for (j = 0; j <= b.length; j++) prev[j] = j;
  for (i = 1; i <= a.length; i++) {
    cur = [i];
    for (j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/**
 * Last data row of the screens block: the last row numbered in column A
 * (750, 350 or 1000 depending on the store tab).
 */
function screenBlockEnd_(sh) {
  var vals = sh.getRange(2, COUNTER_COL, sh.getMaxRows() - 1, 1).getValues();
  var end = 1;
  for (var i = 0; i < vals.length; i++) {
    if (typeof vals[i][0] === 'number' && vals[i][0] > 0) end = i + 2;
  }
  return end;
}

/** First row at or after `from` in the screens block that is blank and not held for a group. */
function firstEmptyScreenRowFrom_(sh, from, endRow, layout) {
  if (from > endRow) return -1;
  var c = (layout || storeLayout_(sh)).screens;
  var cols = [c.DATE_IN, c.NAME, c.SEQUENCE, c.DATE_OUT, c.TICKET, c.UNI_IN, c.SCREENING, c.LB_EARN, c.EXTRAS, c.EARNING].filter(Boolean);
  var vals = sh.getRange(from, c.DATE_IN, endRow - from + 1, c.EARNING - c.DATE_IN + 1).getValues();
  var notes = sh.getRange(from, COUNTER_COL, endRow - from + 1, 1).getNotes(), today = scanDateSerial_(), meta = null;
  for (var i = 0; i < vals.length; i++) {
    if (!cols.every(function (col) { return vals[i][col - c.DATE_IN] === ''; })) continue;
    if (!notes[i][0]) return from + i;                          // no note, no hold: the common case, no metadata read
    meta = meta || groupHoldMeta_(sh);
    var hold = holdAt_(notes[i][0], meta, from + i);
    if (hold && today - hold.day <= GROUP_HOLD_DAYS) continue; // saved for the rest of a group
    if (hold) releaseGroupHold_(sh, from + i, c, meta);        // expired: free it for anyone
    return from + i;
  }
  return -1;
}

/**
 * Group rows (Kirsten, 2026-10-22): tags "1 of 6" ... "6 of 6" often arrive out of order and mixed with other
 * jobs. When the first tag of a group lands on a tab, the next empty rows are held for the rest of the group
 * (grey, with a note in column A). A later tag of the same group fills a held row; other jobs skip them.
 * Rows never move, so row-based receipts and the Scans log stay valid. Holds expire after GROUP_HOLD_DAYS.
 * Same group = same name and N, and the same ticket (Homer) or tickets within 50 (sequential books).
 */
var GROUP_HOLD = 'GROUP_HOLD_V1: ';        // 0.13.21 notes carried the data visibly; still read
var GROUP_HOLD_KEY = 'GROUP_HOLD_V2';        // 0.13.23: the data lives in hidden row metadata
var HOLD_NOTE = 'Saved for the rest of the '; // the visible note; deleting it frees the row
var HOLD_COLOR = '#ececec';
var GROUP_HOLD_MAX = 12;   // groups of 2..12 tags get holds; larger "x of N" readings are likely misreads
var GROUP_HOLD_DAYS = 14;
function groupKey_(x, c) {
  if (!c.SEQUENCE || !verifiedSequence_(tagOf_(x))) return null;
  var n = Number(x.tag_count), name = sequenceIdentity_(sheetName_(x));
  if (!(n >= 2 && n <= GROUP_HOLD_MAX) || !name) return null;
  var key = { name: name, of: n, ticket: String(x.ticket_number || '').trim(), index: Number(x.tag_index) };
  var phone = phoneKey_(x.phone);
  if (phone) key.phone = phone;
  return key;
}
/** Last 7 digits of a phone read, or '' if shorter. All tags of a group carry the customer's phone (Joliet, 2026-10-24). */
function phoneKey_(v) {
  var d = String(v || '').replace(/\D/g, '');
  return d.length >= 7 ? d.slice(-7) : '';
}
/** Tickets within 50 on their last 6 digits, so a 6-digit read or a misread first digit still lines up. */
function ticketsNear6_(a, b) {
  a = String(a || '').trim(); b = String(b || '').trim();
  if (!/^\d{6,7}$/.test(a) || !/^\d{6,7}$/.test(b)) return false;
  return Math.abs(Number(a.slice(-6)) - Number(b.slice(-6))) <= 50;
}

/** Names that differ by a misread letter or two ("Surm"/"Surim", "Busin"/"Rusin"). */
function namesClose_(a, b) {
  a = String(a || '').toLowerCase().replace(/[^a-z]/g, ''); b = String(b || '').toLowerCase().replace(/[^a-z]/g, '');
  if (!a || !b) return false;
  if (a === b) return true;
  return Math.min(a.length, b.length) >= 4 && editDistance_(a, b) <= 2;
}
/** Same ticket, sequential tickets within 50, or one misread digit ("8160684"/"8160084"). */
function ticketsClose_(a, b) {
  a = String(a || '').trim(); b = String(b || '').trim();
  if (!a || !b) return false;
  if (a === b) return true;
  if (/^\d{7}$/.test(a) && /^\d{7}$/.test(b) && Math.abs(Number(a) - Number(b)) <= 50) return true;
  if (a.length !== b.length || !/^\d+$/.test(a + b)) return false;
  var diff = 0; for (var i = 0; i < a.length; i++) if (a.charAt(i) !== b.charAt(i)) diff++;
  return diff === 1;
}
function sameGroup_(a, b) {
  return !!a && !!b && a.of === b.of && ticketsClose_(a.ticket, b.ticket) && namesClose_(a.name, b.name);
}
/**
 * Group check (0.13.22, October data: 5 of 9 name fixes and the missed tickets were group tags read differently).
 * Compares this tag with the other tags of its group already on the tab and returns cell notes for name, ticket
 * and "x of N" disagreements. Notes only: values are never changed. Siblings: same N, close name, and a close
 * ticket (or within 1000, since sequential books drift and misreads land nearby).
 */
function groupCheck_(sh, c, x, endRow) {
  var seq = verifiedSequence_(tagOf_(x)), out = [];
  if (!c.SEQUENCE || !seq || !(x.tag_count >= 2 && x.tag_count <= 100)) return out;
  var me = { name: sequenceIdentity_(sheetName_(x)), ticket: String(x.ticket_number || '').trim(), index: Number(x.tag_index), of: Number(x.tag_count) };
  var names = sh.getRange(2, c.NAME, endRow - 1, 1).getValues(), seqs = sh.getRange(2, c.SEQUENCE, endRow - 1, 1).getValues();
  var tickets = sh.getRange(2, c.TICKET, endRow - 1, 1).getValues(), sibs = [], today = scanDateSerial_();
  var outs = c.DATE_OUT ? sh.getRange(2, c.DATE_OUT, endRow - 1, 1).getValues() : [];
  for (var i = 0; i < names.length; i++) {
    var m = /^(\d+) of (\d+)$/.exec(String(seqs[i][0]).trim());
    if (!m || Number(m[2]) !== me.of) continue;
    var s = { row: i + 2, name: sequenceIdentity_(names[i][0]), ticket: String(tickets[i][0]).trim(), index: Number(m[1]) };
    // Strong: close name and a close ticket. Loose (only within GROUP_HOLD_DAYS of the scan, and never used for the
    // "already on row" or shared-ticket notes): tickets within 1000, the exact same name, or a close name the same day.
    // Two customers with one surname in a month must not read as one group (review 2026-10-23).
    var out_ = outs[i] ? daySerial_(outs[i][0]) : NaN, recent = today - out_ >= 0 && today - out_ <= GROUP_HOLD_DAYS;
    var strong = ticketsClose_(s.ticket, me.ticket) && namesClose_(s.name, me.name);
    var near = namesClose_(s.name, me.name) && /^\d{7}$/.test(s.ticket) && /^\d{7}$/.test(me.ticket) && Math.abs(Number(s.ticket) - Number(me.ticket)) <= 1000;
    var exact = s.name === me.name && me.name.replace(/[^a-z]/g, '').length >= 4; // misprinted ticket, same customer
    var sameDay = namesClose_(s.name, me.name) && s.index !== me.index && out_ === today;
    s.strong = strong;
    if (strong || (recent && (near || exact || sameDay))) sibs.push(s);
  }
  if (!sibs.length) return out;
  var firm = sibs.filter(function (s) { return s.strong; });
  var rowsOf = function (list) { return list.map(function (s) { return s.row; }).join(', '); };
  var others = sibs.filter(function (s) { return s.name !== me.name; });
  if (others.length) {
    var seen = {}; others.forEach(function (s) { seen[s.name] = true; });
    out.push('Group check (name): this tag reads "' + me.name + '"; other tags in this group read "' + Object.keys(seen).join('", "') +
      '" (rows ' + rowsOf(others) + '). Check which is right.');
  }
  var tks = {}; firm.forEach(function (s) { tks[s.ticket] = (tks[s.ticket] || 0) + 1; });
  // One ticket for the whole group (Homer) only counts when at least two other tags agree on it;
  // with a single earlier tag, sequential books (8159901, 8159903) are normal.
  var ranked = Object.keys(tks).sort(function (p, q) { return tks[q] - tks[p]; });
  var shared = ranked.length && tks[ranked[0]] >= 2 && (ranked.length === 1 || tks[ranked[0]] > tks[ranked[1]]) ? ranked[0] : null;
  var nearAny = sibs.some(function (s) { return s.ticket === me.ticket || (/^\d{7}$/.test(s.ticket) && /^\d{7}$/.test(me.ticket) && Math.abs(Number(s.ticket) - Number(me.ticket)) <= 50); });
  if (shared && shared !== me.ticket) {
    var agree = firm.filter(function (s) { return s.ticket === shared; });
    out.push('Group check (ticket): this tag reads ' + me.ticket + '; ' + agree.length + ' other tags in this group read ' + shared + ' (rows ' + rowsOf(agree) + ').');
  } else if (!shared && me.ticket && !nearAny) {
    var nums = sibs.map(function (s) { return s.ticket; }).filter(Boolean).sort();
    out.push('Group check (ticket): ' + me.ticket + ' is far from the rest of this group (' + nums[0] + (nums.length > 1 ? '–' + nums[nums.length - 1] : '') + ', rows ' + rowsOf(sibs) + ').');
  }
  var dup = firm.filter(function (s) { return s.index === me.index; }); // a same-size rescan is caught by the possible-duplicate check
  if (dup.length) {
    var have = {}; firm.concat([me]).forEach(function (s) { have[s.index] = true; });
    var missing = []; for (var k = 1; k <= me.of; k++) if (!have[k]) missing.push(k);
    out.push('Group check (tag): ' + me.index + ' of ' + me.of + ' is already on row ' + rowsOf(dup) +
      (missing.length && missing.length <= 4 ? '; not yet on the tab: ' + missing.join(', ') + ' of ' + me.of : '') + '.');
  }
  return out;
}
function readGroupHold_(note) {
  var line = String(note || '').split('\n').filter(function (l) { return l.indexOf(GROUP_HOLD) === 0; })[0];
  if (!line) return null;
  try {
    var h = JSON.parse(line.slice(GROUP_HOLD.length));
    return h && typeof h.name === 'string' && Number.isInteger(h.of) && typeof h.ticket === 'string' && Number.isFinite(h.day) ? h : null;
  } catch (err) { return null; }
}
/**
 * Hidden hold data by row: { row: { data, md, all } } (all = every entry on the row, for cleanup). If the read
 * itself fails, `failed` is set and every visible hold note counts as held, so no held row is reused (review 2026-10-23).
 */
function groupHoldMeta_(sh) {
  var out = {};
  try {
    sh.createDeveloperMetadataFinder().withKey(GROUP_HOLD_KEY).find().forEach(function (md) {
      try {
        var row = md.getLocation().getRow().getRow(), d = null;
        try { d = JSON.parse(md.getValue()); } catch (err) {}
        var slot = out[row] || (out[row] = { data: null, md: null, all: [] });
        slot.all.push(md);
        if (d && typeof d.name === 'string' && Number.isInteger(d.of) && typeof d.ticket === 'string' && Number.isFinite(d.day)) {
          if (!slot.data || d.day >= slot.data.day) { slot.data = d; slot.md = md; } // the newest hold wins
        }
      } catch (err) {}
    });
  } catch (err) { Object.defineProperty(out, 'failed', { value: true }); }
  return out;
}
/** The hold on a row: an old visible-data note, or the visible note plus hidden metadata. No note means no hold. */
function holdAt_(note, meta, row) {
  var v1 = readGroupHold_(note);
  if (v1) return v1;
  if (!String(note || '').split('\n').some(function (l) { return l.indexOf(HOLD_NOTE) === 0; })) return null; // any line: Kirsten may add one above
  if (meta[row] && meta[row].data) return meta[row].data;
  // Hidden data unreadable: treat the row as held (by no group, never expiring) rather than reuse it.
  return meta.failed ? { name: '', of: 0, ticket: '', day: scanDateSerial_(), unknown: true } : null;
}
/** Removes every hidden hold entry on a row (old entries from a hand-deleted note included). */
function clearHoldMeta_(meta, row) {
  if (!meta || !meta[row]) return;
  meta[row].all.forEach(function (md) { try { md.remove(); } catch (err) {} });
  delete meta[row];
}
/** Frees a held row. Only the scanner's own note lines are removed; anything else in the note is kept. */
function releaseGroupHold_(sh, row, c, meta, keepColors) {
  var cell = sh.getRange(row, COUNTER_COL);
  cell.setNote(String(cell.getNote() || '').split('\n').filter(function (l) {
    return l.indexOf(HOLD_NOTE) !== 0 && l.indexOf(GROUP_HOLD) !== 0;
  }).join('\n'));
  var block = sh.getRange(row, c.DATE_IN, 1, c.EARNING - c.DATE_IN + 1);
  if (!keepColors) block.setBackground(null);
  else block.setBackgrounds(block.getBackgrounds().map(function (r) { // a typed-in row keeps its own colours; only the hold grey goes
    return r.map(function (b) { return String(b).toLowerCase() === HOLD_COLOR ? null : b; });
  }));
  clearHoldMeta_(meta, row);
}
/** Writes one hold: visible note + hidden row metadata, or the old visible-data note if metadata fails. */
function writeGroupHold_(sh, row, c, data, label, meta) {
  clearHoldMeta_(meta, row);
  var note = HOLD_NOTE + label + ' group (' + data.of + ' tags). The scanner fills it when another tag of that group is ' +
    'scanned; released after ' + GROUP_HOLD_DAYS + ' days. Delete this note to free the row.';
  try { sh.getRange(row + ':' + row).addDeveloperMetadata(GROUP_HOLD_KEY, JSON.stringify(data)); }
  catch (err) { // visible fallback: no phone in a note anyone can read
    note += '\n' + GROUP_HOLD + JSON.stringify({ name: data.name, of: data.of, ticket: data.ticket, day: data.day });
  }
  var cell = sh.getRange(row, COUNTER_COL), own = String(cell.getNote() || '').split('\n').filter(function (l) {
    return l && l.indexOf(HOLD_NOTE) !== 0 && l.indexOf(GROUP_HOLD) !== 0; // a resized hold keeps Kirsten's own lines
  });
  cell.setNote(own.concat([note]).join('\n'));
  sh.getRange(row, c.DATE_IN, 1, c.EARNING - c.DATE_IN + 1).setBackground(HOLD_COLOR);
}
function rowBlank_(sh, row, c) {
  var cols = [c.DATE_IN, c.NAME, c.SEQUENCE, c.DATE_OUT, c.TICKET, c.UNI_IN, c.SCREENING, c.LB_EARN, c.EXTRAS, c.EARNING].filter(Boolean);
  var v = sh.getRange(row, c.DATE_IN, 1, c.EARNING - c.DATE_IN + 1).getValues()[0];
  return cols.every(function (col) { return v[col - c.DATE_IN] === ''; });
}
/** A held row for this tag's group, released for its use; -1 if none. Stale holds (row typed in) are dropped. */
function takeGroupHold_(sh, c, key, endRow, flags) {
  var notes = sh.getRange(2, COUNTER_COL, endRow - 1, 1).getNotes(), today = scanDateSerial_(), meta = null, found = [], holds = [];
  for (var i = 0; i < notes.length; i++) {
    if (!notes[i][0]) continue;
    meta = meta || groupHoldMeta_(sh);
    var h = holdAt_(notes[i][0], meta, i + 2);
    if (!h || h.unknown || today - h.day > GROUP_HOLD_DAYS) continue;
    var hold = { row: i + 2, h: h, note: String(notes[i][0]) };
    holds.push(hold);
    var rank = groupHoldRank_(h, key, today);
    // A different tag count ("1 of 6", then "7 of 7" after the order changed; Downers Grove, 2026-10-24) only
    // fills a hold on a strong match: the same ticket or within 50, or the same phone.
    if (rank && (h.of === key.of || rank <= 2)) found.push({ row: hold.row, rank: rank, hold: hold, resized: h.of !== key.of });
  }
  // Best match first (review 2026-10-23: a looser match must never take another customer's row while this
  // group's own hold exists). A loose match also needs this tag's "k of N" to be missing from the tab. A ticket
  // match fills its hold even when its "k of N" is taken: that is usually a misread index (New Lenox, October:
  // two "4 of 12" with different tickets and no 8 of 12), and the group check notes it.
  if (!found.length) return -1;
  if (found.some(function (f) { return f.rank === 4; }) && closeNameIndexTaken_(sh, c, key, endRow)) {
    found = found.filter(function (f) { return f.rank < 4; });
  }
  found.sort(function (a, b) { return a.rank - b.rank || (a.resized ? 1 : 0) - (b.resized ? 1 : 0) || a.row - b.row; });
  for (var k = 0; k < found.length; k++) {
    var blank = rowBlank_(sh, found[k].row, c);
    releaseGroupHold_(sh, found[k].row, c, meta, !blank);
    if (!blank) continue; // a held row someone typed into is dropped, its colours kept
    var hn = found[k].hold.h.name;
    if (flags && !namesClose_(hn, key.name)) { // matched on the phone: the names disagree (Kirsten's first check is names)
      flags.push('Group check (name): this tag reads "' + key.name + '"; the tag that saved this row reads "' + hn + '". Check which is right.');
    }
    if (found[k].resized) resizeGroupHolds_(sh, c, holds, found[k].hold, key, endRow, meta, flags);
    return found[k].row;
  }
  return -1;
}
/**
 * The tag count changed between tags of one group (an order grew from 6 to 7). The group's other held rows take
 * the larger count, and one more blank row is saved per extra tag. A smaller count never frees rows: other tags
 * may still say the larger one (Kirsten can delete a hold note to free a row). Adds a note for the count cell.
 */
function resizeGroupHolds_(sh, c, holds, taken, key, endRow, meta, flags) {
  var old = taken.h, size = Math.max(old.of, key.of);
  var same = function (h) { return h.name === old.name && h.of === old.of && h.ticket === old.ticket && h.day === old.day; };
  var mine = holds.filter(function (o) { return o.row !== taken.row && same(o.h); });
  if (flags) flags.push('Group check (tag): this tag says ' + key.index + ' of ' + key.of + '; an earlier tag of this group says of ' +
    old.of + (size > old.of ? '. Rows saved for the group now cover ' + size + ' tags' : '') + '. Check the tag count.');
  if (size === old.of) return;
  var data = { name: old.name, of: size, ticket: old.ticket, day: old.day };
  if (old.phone) data.phone = old.phone;
  var line = taken.note.split('\n').filter(function (l) { return l.indexOf(HOLD_NOTE) === 0; })[0] || '';
  var m = / group \(\d+ tags\)/.exec(line), label = m ? line.slice(HOLD_NOTE.length, m.index) : old.name;
  var last = taken.row;
  mine.forEach(function (o) { writeGroupHold_(sh, o.row, c, data, label, meta); last = Math.max(last, o.row); });
  var add = size - old.of;
  for (var r = last + 1; r <= endRow && add > 0; r++) {
    if (!rowBlank_(sh, r, c) || sh.getRange(r, COUNTER_COL).getNote()) break; // never a typed-in or noted row
    writeGroupHold_(sh, r, c, data, label, meta);
    add--;
  }
}
/**
 * How well a hold matches this tag's group (N is checked by the caller): 1 same ticket, 2 within 50 or the same phone, 3 one digit off,
 * 4 loose, 0 no match. Loose = a misprinted ticket (Lockport, 2026-10-23: wrong first digit) with exactly the same
 * name, or a name read two letters apart (New Lenox, 2026-10-23); either only when the hold was made the same day,
 * or for the exact name also when the ticket is from the same 4-digit book.
 */
function groupHoldRank_(h, key, today) {
  var a = String(h.ticket || ''), b = String(key.ticket || '');
  // Same phone and tickets that line up on their last 6 digits: the same customer even when the name is written two
  // ways (Joliet, 2026-10-24: first name and initial on two tags, the full name on the third, and a 6 read as 0).
  var phone = !!h.phone && h.phone === key.phone && ticketsNear6_(a, b);
  if (namesClose_(h.name, key.name) && ticketsClose_(a, b)) {
    if (a === b) return 1;
    return /^\d{7}$/.test(a) && /^\d{7}$/.test(b) && Math.abs(Number(a) - Number(b)) <= 50 ? 2 : (phone ? 2 : 3);
  }
  if (phone) return 2;
  var exactName = h.name === key.name && key.name.replace(/[^a-z]/g, '').length >= 4;
  var sameBook = /^\d{7}$/.test(a) && /^\d{7}$/.test(b) && a.slice(0, 4) === b.slice(0, 4);
  if ((exactName && (h.day === today || sameBook)) || (namesClose_(h.name, key.name) && h.day === today)) return 4;
  return 0;
}
/** True when a row with this (or a close) name and N already has this tag's "k of N". */
function closeNameIndexTaken_(sh, c, key, endRow) {
  var names = sh.getRange(2, c.NAME, endRow - 1, 1).getValues(), seqs = sh.getRange(2, c.SEQUENCE, endRow - 1, 1).getValues();
  for (var i = 0; i < names.length; i++) {
    if (namesClose_(sequenceIdentity_(names[i][0]), key.name) && String(seqs[i][0]).trim() === key.index + ' of ' + key.of) return true;
  }
  return false;
}
/** A Date-out cell as a Sheets serial day (numbers as written; Date objects as read back from Sheets). */
function daySerial_(v) {
  if (typeof v === 'number') return v;
  if (v instanceof Date) return serialFromYmd_(Utilities.formatDate(v, 'America/Chicago', 'yyyy-MM-dd'));
  return NaN;
}
/** After the first tag of a group is written at `row`, hold the next empty rows for the rest of it. */
function holdGroupRows_(sh, c, key, row, endRow, x) {
  var vals = sh.getRange(2, c.NAME, endRow - 1, 1).getValues(), seqs = sh.getRange(2, c.SEQUENCE, endRow - 1, 1).getValues();
  var tickets = sh.getRange(2, c.TICKET, endRow - 1, 1).getValues(), notes = sh.getRange(2, COUNTER_COL, endRow - 1, 1).getNotes();
  var meta = groupHoldMeta_(sh);
  if (meta.failed) return 0; // hidden data unreadable: a new hold could not be used, so don't grey rows
  for (var i = 0; i < vals.length; i++) {
    if (i + 2 === row) continue;
    var m = /^\d+ of (\d+)$/.exec(String(seqs[i][0]).trim());
    // Any tag count: a group whose count changed is still started (Downers Grove, 2026-10-24).
    var sibling = m && namesClose_(sequenceIdentity_(vals[i][0]), key.name) && ticketsClose_(String(tickets[i][0]).trim(), key.ticket);
    var h = holdAt_(notes[i][0], meta, i + 2), rank = h && !h.unknown ? groupHoldRank_(h, key, scanDateSerial_()) : 0;
    if (sibling || sameGroup_(h, key) || (rank && rank <= 2)) return 0; // group already started here: no new holds
  }
  var label = String(sheetName_(x)).replace(/[\r\n]+/g, ' ').slice(0, 60), held = 0, day = scanDateSerial_();
  for (var r = row + 1; r <= endRow && held < key.of - 1; r++) {
    // Only blank rows right after, and never a row with any note in column A (Kirsten's own notes are kept).
    if (!rowBlank_(sh, r, c) || sh.getRange(r, COUNTER_COL).getNote()) break;
    var data = { name: key.name, of: key.of, ticket: key.ticket, day: day };
    if (key.phone) data.phone = key.phone; // hidden row data in the sheet only, to match the group's other tags
    writeGroupHold_(sh, r, c, data, label, meta);
    held++;
  }
  return held;
}

/** Ticket lookup uses each block's current headers, including during migration. */
function ticketInStoreTab_(sh, ticket, layout) {
  if (!ticket) return false;
  var t = String(ticket);
  var l = layout || storeLayout_(sh);
  var end = screenBlockEnd_(sh);
  var screens = sh.getRange(2, l.screens.TICKET, end - 1, 1).getValues();
  var windows = sh.getRange(2, l.windows.TICKET, WINDOW_LAST_ROW - 1, 1).getValues();
  return screens.concat(windows).some(function (r) { return String(r[0]).trim() === t; });
}

/** First row in the windows block whose Date in, Name and Ticket # are all blank. */
function firstEmptyWindowRow_(sh, layout) {
  var c = (layout || storeLayout_(sh)).windows;
  var cols = [c.DATE_IN, c.NAME, c.SEQUENCE, c.DATE_OUT, c.TICKET, c.GLASS, c.LB_EARN, c.SPL_EARN, c.OTHER, c.OTHER_EARN].filter(Boolean);
  var vals = sh.getRange(2, c.DATE_IN, WINDOW_LAST_ROW - 1, c.OTHER_EARN - c.DATE_IN + 1).getValues();
  for (var i = 0; i < vals.length; i++) if (cols.every(function (col) { return vals[i][col - c.DATE_IN] === ''; })) return i + 2;
  return -1;
}

/** Header-adaptive window writer: no hardcoded data column positions. */
function writeWindowRow_(sh, store, x, flags, layout) {
  var c = (layout || storeLayout_(sh)).windows;
  var row = firstEmptyWindowRow_(sh, layout);
  if (row < 0) return { ok: false, store: store, problem: 'the ' + store.name + ' windows section is full' };
  flags.push('Window tag: new to the scanner, please check glass, panes and labor');
  var perPane = x.thermopane ? WINDOW_LABOR_PER_PANE.thermopane : WINDOW_LABOR_PER_PANE.standard;
  var labor = x.panes ? cents_(x.panes * perPane) : '';
  if (!x.panes) flags.push('Window LB Earn not filled: panes unknown');
  var winDue = balanceDueQty_(x);
  if (winDue.qty || winDue.bad) flags.push('Balance-due slip on a window tag: not added; enter it by hand');

  var dates = storeDates_(x);
  if (dates.reason) flags.push(dates.reason);
  sh.getRange(row, c.TICKET).setNumberFormat('@');
  writeStoreIdentity_(sh, row, c, x, dates);
  sh.getRange(row, c.TICKET).setValue(safeCell_(x.ticket_number || ''));
  sh.getRange(row, c.GLASS, 1, 2).setValues([safeRow_([x.glass_price === null ? '' : x.glass_price, labor])]);

  var extras = extraLaborPartsNote_(x, storeExtrasText_(x));
  if (extras) {
    var other = sh.getRange(row, c.OTHER_EARN);
    other.setNote('Extras on tag (enter your earning):\n' + extras);
    other.setBackground(FLAG_COLOR);
  }
  if (x.window_spline) {
    var spl = sh.getRange(row, c.SPL_EARN);
    spl.setNote('Spline is on this tag: enter Spl Earn if you earned it.');
    spl.setBackground(FLAG_COLOR);
  }
  applyPartsEarnings_(sh, row, c, x, true, 0);
  applyExtraLabor_(sh, row, c, x, true, labor, flags);
  showReview_(sh,row,c,flags);
  return { ok: true, store: store, tab: store.tab, row: row, block: 'windows', flags: flags };
}

/**
 * Today's date in the script's time zone (America/Chicago) as a Sheets serial day number.
 * A serial number is the same calendar day in every time zone, so the sheet's own time zone
 * can't shift it to the previous day (which a Date object at local midnight did).
 */
function scanDateSerial_() {
  return serialFromYmd_(Utilities.formatDate(new Date(), 'America/Chicago', 'yyyy-MM-dd'));
}

/** Tag date in; admission's Chicago calendar day out. Invalid dates never silently roll. */
var CENTURY_NOTE = 'Two-digit tag year treated as 20YY; verify the century';
function storeDates_(x) {
  var scan = x._scan_ymd || Utilities.formatDate(new Date(), 'America/Chicago', 'yyyy-MM-dd');
  var dateOut = serialFromYmd_(scan), raw = typeof x.date === 'string' ? x.date.trim() : '';
  if (!raw) return { dateIn: '', dateOut: dateOut, reason: 'Tag date missing: Date in left blank; enter it from the tag' };
  var scanYear = Number(scan.slice(0, 4));
  var iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(raw), us = /^(\d{1,2})[\/.\-](\d{1,2})(?:[\/.\-](\d{2}|\d{4}))?$/.exec(raw);
  var named = /^([a-z]{3,9})\.?[\s\-]*(\d{1,2})(?:st|nd|rd|th)?(?:,?[\s\-]+(\d{2}|\d{4}))?$/i.exec(raw);
  var year, month, day, reason = '';
  if (iso) { year=Number(iso[1]); month=Number(iso[2]); day=Number(iso[3]); }
  else if (us || (named && monthFromName_(named[1]))) {
    var m = us || named, y = m[3];
    month = us ? Number(m[1]) : monthFromName_(m[1]); day = Number(m[2]);
    year = y ? Number(y) : scanYear;
    // "26" on a tag scanned in 2026 or 2027 is plainly 2026; anything else gets a century check.
    if (y && y.length === 2) { year += 2000; if (year !== scanYear && year !== scanYear - 1) reason = CENTURY_NOTE; }
  } else return {dateIn:'',dateOut:dateOut,reason:'Tag date is unreadable/unsupported: Date in left blank; enter it from the tag'};
  if (!validYmd_(year, month, day)) {
    return {dateIn:'',dateOut:dateOut,reason:'Tag date is invalid: Date in left blank; verify the written date'};
  }
  var dateIn = Date.UTC(year,month-1,day)/86400000+25569;
  // User rule: a missing written year always uses the admitted scan calendar year.
  // A later month/day may need review, but never changes the inferred year.
  if (dateIn > dateOut) reason += (reason ? '; ' : '') + 'Tag date is after the scan date; verify it';
  // A written year far behind the scan (October audit: "24"/"2020"/"25" on 2026 tags; 4/6 and 0/6 look alike).
  // Over half a year, so a tag left over the winter (11/1 scanned 3/15) is not flagged; one note, not two.
  else if (year !== scanYear && dateOut - dateIn > 183) {
    reason = 'Tag year ' + year + ' looks off for a scan in ' + scanYear + ' (4/6 and 0/6 look alike' +
      (reason === CENTURY_NOTE ? '; a two-digit year is read as 20YY, verify the century' : '') + '); check the date on the tag';
  }
  return {dateIn:dateIn,dateOut:dateOut,reason:reason};
}
function validYmd_(year, month, day) {
  var check = new Date(Date.UTC(year, month - 1, day));
  return year >= 1900 && year <= 2199 && month >= 1 && month <= 12 && day >= 1 &&
    check.getUTCFullYear() === year && check.getUTCMonth() === month - 1 && check.getUTCDate() === day;
}
function monthFromName_(name) {
  var i = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(String(name).slice(0, 3).toLowerCase());
  var full = ['january','february','march','april','may','june','july','august','september','october','november','december'];
  var n = String(name).toLowerCase();
  return i >= 0 && (n.length === 3 || full[i].indexOf(n) === 0 || n === 'sept') ? i + 1 : 0;
}

/** "2026-10-12" -> 46307 (days since 1899-12-30, the Sheets/Excel epoch). */
function serialFromYmd_(ymd) {
  var p = String(ymd).split('-');
  return Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2])) / 86400000 + 25569;
}

/** Round to cents without floating-point drift (115 * 0.17 = 19.55, not 19.549999...). */
function cents_(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Write one scan into its store tab. Returns { ok, store, tab, row, block, flags } or { ok: false, problem }.
 * Never overwrites: only fills a row that is blank in B, C, E and F.
 * `reasons` (review flags) are shown on the store tab too, because that's where
 * Kirsten works: flagged rows get a yellow fill and a note on the Name cell.
 * Window tags go to the N–W block (writeWindowRow_).
 */
function writeToStoreTab_(ss, x, reasons) {
  var routing = resolveJobRouting_(x);
  if (!routing.type) return { ok: false, problem: 'item type is unknown; review the tag before placing it' };
  x = Object.assign({}, x, { item_type: routing.type, thermopane: routing.thermopane });
  var resolved = resolveStore_(x);
  var store = resolved.store;
  if (!store) return { ok: false, problem: 'store "' + (x.store || '') + '" not recognised' };
  // Without a ticket number a row can't be traced or checked for duplicates (e.g. a
  // stand-alone "Please Pay Cashier" slip), so a person places it.
  if (!x.ticket_number) return { ok: false, store: store, problem: 'no ticket number on the form (' + store.name + ')' };
  var sh = storeSheet_(ss, store);
  if (!sh) return { ok: false, store: store, problem: 'tab "' + store.tab + '" missing from this month\'s file' };
  var layout;
  try { layout = storeLayout_(sh); }
  catch (err) { return { ok: false, store: store, problem: 'unsupported store layout; no store cells changed' }; }
  var c = layout.screens;
  var flags = (reasons || []).slice();
  routing.flags.forEach(function (f) { if (flags.indexOf(f) < 0) flags.push(f); });
  var target = x.item_type === 'window' ? layout.windows : layout.screens;
  if (!target.SEQUENCE && tagOf_(x)) flags.push('Tag x of N is in Scans only until the sequence-column migration');
  if ((x.tag_index || x.tag_count) && !verifiedSequence_(tagOf_(x))) flags.push('Tag x of N could not be verified; left blank');
  if (resolved.flag) flags.push(resolved.flag);
  // Some stores (Homer) use one ticket number for a whole group of tags, so a ticket
  // already on the tab is normal when the tag says "Qty x of N". Exact rescans are
  // caught earlier against the Scans log (Code.gs). Here we only flag the ambiguous case.
  var bookHint = ticketBookHint_(sh, layout, x.ticket_number);
  if (bookHint) flags.push(bookHint);
  if (ticketInStoreTab_(sh, x.ticket_number, layout) && !(x.tag_count > 1)) {
    flags.push('Ticket already on the ' + store.name + ' tab: another tag in the group, or a duplicate?');
  }
  if (x.item_type === 'window') return writeWindowRow_(sh, store, x, flags, layout);

  var isBuild = x.form_type === 'new_build';
  var multi = x.screens_on_tag > 1;
  // Multi-screen forms (Kirsten: there should be one form per frame, so these are always flagged):
  //  - BUILD "Build 2": earnings are per frame, so write one row per frame, each with the build amounts.
  //  - REPAIR listing several screens: the tag's sizes/inches can't be split reliably, so write ONE
  //    row with inches/Screening/LB Earn blank for her to enter each screen.
  var count = isBuild && multi ? x.screens_on_tag : 1;
  var end = screenBlockEnd_(sh);
  var rows = [];
  groupCheck_(sh, c, x, end).forEach(function (f) { if (flags.indexOf(f) < 0) flags.push(f); });
  var group = count === 1 ? groupKey_(x, c) : null, heldRow = group ? takeGroupHold_(sh, c, group, end, flags) : -1;
  if (heldRow > 0) rows.push(heldRow);
  for (var r = 2; rows.length < count; r++) {
    var next = firstEmptyScreenRowFrom_(sh, r, end, layout);
    if (next < 0) break;
    rows.push(next);
    r = next;
  }
  if (rows.length < count) {
    return { ok: false, store: store, problem: 'the ' + store.name + ' tab is full (' + (end - 1) + ' rows)' };
  }

  var rate = RATES[x.material];
  var ui = x.billable_inches;
  var holdBilling = null; // reason billing is left blank for review
  var dueRead = balanceDueQty_(x), due = dueRead.qty;
  if (dueRead.bad) flags.push('Inches: balance-due slip QTY "' + dueRead.bad + '" unreadable, not added; enter the total by hand');
  var conflict = quantityConflict_(x), agreed = conflict && x.quantity_conflict ? unanimousInches_(x) : null;
  if (agreed) {
    flags.push('Inches ' + agreed + '" billed: the tag\'s size, QTY rows and $ totals all agree; Claude also noted: ' +
      String(x.quantity_conflict_details || 'a second size').slice(0, 160).replace(/[.\s]+$/, '') + '. Check the tag');
    conflict = null;
  }
  var settled = conflict && !(multi && !isBuild) ? settleInches_(x) : null;
  if (conflict) {
    [['Literal QTY rows',x.qty_rows],['Literal row totals',x.line_totals]].forEach(function(evidence) {
      if (typeof evidence[1] === 'string' && evidence[1].trim()) {
        flags.push(evidence[0] + ': ' + evidence[1].slice(0,200) + (evidence[1].length > 200 ? ' [too long; manual review]' : ''));
      }
    });
  }
  if (settled) { ui = settled.inches; flags.push(settled.note); }
  else if (conflict) holdBilling = 'Inches left blank, values disagree: ' + conflict;
  else if (multi && !isBuild) {
    holdBilling = 'Form lists ' + x.screens_on_tag + ' screens: entered as one row with inches, Screening and LB Earn ' +
      'left blank. Enter each screen (add rows if needed).';
  }
  // Some forms (e.g. new-build patio doors) only have measurements, no QTY. Per Kirsten:
  // round each side UP, then add.
  if (!holdBilling && (ui === null || ui === undefined) && typeof x.width_in === 'number' && typeof x.height_in === 'number') {
    ui = Math.ceil(x.width_in) + Math.ceil(x.height_in);
    flags.push('Inches calculated from measurements: ' + formatInches_(x.width_in) + ' + ' +
      formatInches_(x.height_in) + ' -> ' + ui + '"');
  }
  // Balance-due slip (Kirsten, 2026-10-23): bill what the customer was charged, so a "measured wrong / balance
  // due" slip's extra QTY is added to the tag's QTY. A shop re-measurement alone never changes the bill.
  if (due && rows.length > 1) {
    flags.push('Inches: balance-due slip adds ' + due + ' inches on a ' + rows.length + '-frame form, not added; add it to the right frame by hand');
  } else if (due && !holdBilling && typeof ui === 'number') {
    flags.push('Inches include a balance-due slip: tag QTY ' + ui + ' + slip QTY ' + due + ' = ' + (ui + due) + '"; check the slip');
    ui += due;
  } else if (due) {
    flags.push('Inches: balance-due slip adds ' + due + ' inches, not added because the tag\'s inches are ' +
      (holdBilling ? 'held' : 'missing') + '; enter the total by hand');
  }
  var screening = '', labor = '';
  if (holdBilling) {
    ui = '';
    flags.push(holdBilling);
  } else if (rate && typeof ui === 'number') {
    screening = cents_(ui * rate.material);
    labor = cents_(ui * rate.labor + (isBuild ? NEW_BUILD.laborAdd : 0));
  } else if (isBuild && !(typeof ui === 'number')) {
    flags.push('Build with no screening (frame only?): enter Screening and LB Earn');
  } else {
    flags.push('Screening/LB Earn not filled: ' + (rate ? 'no billable inches' : 'material unknown'));
  }

  if (isBuild && multi) {
    flags.push('Form lists ' + x.screens_on_tag + ' frames: entered as ' + count + ' rows, each with the build amounts');
  }
  var dates = storeDates_(x);
  if (dates.reason) flags.push(dates.reason);
  rows.forEach(function (row, i) {
    sh.getRange(row, c.TICKET).setNumberFormat('@');
    writeStoreIdentity_(sh, row, c, x, dates);
    sh.getRange(row, c.TICKET, 1, 4).setValues([safeRow_([x.ticket_number || '', ui, screening, labor])]);

    // Earning (L) is Kirsten's: amounts vary and depend on things not on the tag.
    // We pre-fill only the fixed new-build base, and list the tag's extras in a note.
    var extras = [x.extras || '', i === 0 && x._store_group_extras ?
      'Group extras (whole group; do not multiply by tag/frame count):\n' + x._store_group_extras : ''].filter(Boolean).join('\n');
    extras = extraLaborPartsNote_(x, extras);
    if (isBuild || extras) {
      var earn = sh.getRange(row, c.EARNING);
      var note = [];
      if (isBuild) {
        earn.setValue(safeCell_(NEW_BUILD.earningBase));
        note.push('New build: $' + NEW_BUILD.earningBase.toFixed(2) + ' entered, and $' +
          NEW_BUILD.laborAdd.toFixed(2) + ' added to LB Earn. Add any other extras (pins etc.).');
      }
      if (extras) note.push('Extras on tag (enter your earning):\n' + extras);
      if (count > 1) note.push('Frame ' + (i + 1) + ' of ' + count + ' from one form.');
      earn.setNote(escapePartsReceiptText_(note.join('\n\n')));
      earn.setBackground(FLAG_COLOR);
    }
    applyPartsEarnings_(sh, row, c, x, i === 0, isBuild ? NEW_BUILD.earningBase : 0);
    applyExtraLabor_(sh, row, c, x, i === 0, labor, flags);
    showReview_(sh,row,c,flags);
  });
  if (group && heldRow < 0) holdGroupRows_(sh, c, group, rows[0], end, x);
  return { ok: true, store: store, tab: store.tab, row: rows.join(', '), block: 'screens', flags: flags };
}


/**
 * Monthly rollover (optional). Copies the blank template into a new file for the
 * month and points the scanner at it. Kirsten gets the link by email.
 * Script Properties: TEMPLATE_ID (blank template file), MONTH_FOLDER_ID (optional
 * Drive folder), KIRSTEN_EMAIL (optional).
 * Install with installMonthlyTrigger_(); run manually any time to start a month early.
 */
function startNewMonth_() {
  throw new Error('Legacy/automatic rollover is disabled. Use Settings and re-enter the scanner password.');
}

/** Time-zone alignment remains an explicit owner/editor operation. */
function alignTimeZones_() {
  var props = PropertiesService.getScriptProperties();
  var tz = Session.getScriptTimeZone();
  ['SHEET_ID', 'TEMPLATE_ID'].forEach(function (key) {
    var id = props.getProperty(key);
    if (!id) return;
    var ss = SpreadsheetApp.openById(id);
    console.log(key + ': ' + ss.getName() + ' ' + ss.getSpreadsheetTimeZone() + ' -> ' + tz);
    ss.setSpreadsheetTimeZone(tz);
  });
}

function installMonthlyTrigger_() {
  throw new Error('Automatic monthly triggers are disabled. Use the manual Settings action.');
}
