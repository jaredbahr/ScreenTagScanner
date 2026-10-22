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

/** Display severity only. Money/placement and unknown reasons fail closed to row review. */
function reviewTier_(reason) {
  var r = String(reason || '');
  var sequence = /tag_count|tag_index|tag x of n|x of n|\bqty( box)?\b[^.]*\b\d+ of \d+|\bqty box\b/i;
  var serious = /(?:^|[^a-z])(?:amount|cost|charge|fee)s?(?:[^a-z]|$)|inches|\$|price|earning|\bbill(?:ed|able|ing)\b|screening|lb earn|\bparts\b|part sku|unrecognized part|\blabor\b|\bextras?\b|group|receipt|reserved|unposted|unit needs|window|pane|thermopane|build|frame|screens|store|sticker|\bfull\b|duplicate|already scanned|material|glass|acrylic|routed|layout|type is unknown|not a tag|refund|credit|redo|warranty|cancel|no charge|no record|spline-reference|literal (?:qty|row)|pending|interrupted|not placed|unplaced|reconcil|\bpartial\b|original scan/i; // "partially uncertain" OCR is not a partial save
  if (/^Correction\/refund:/i.test(r)) {
    var what = r.replace(/^Correction\/refund:\s*/i, '');
    if (serious.test(what) || /size|inch|quantity/i.test(what)) return {tier:'row'};
    if (sequence.test(what)) return {tier:'cell',field:'SEQUENCE'};
    if (/\bqty\b/i.test(what)) return {tier:'row'};
    if (/ticket|tag (number|#)/i.test(what)) return {tier:'cell',field:'TICKET'};
    if (/phone|name/i.test(what)) return {tier:'log'};
    return {tier:'row'};
  }
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
    var t = reviewTier_(f);
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

/** First row at or after `from` in the screens block whose Date in, Name, Ticket # and Uni/In are blank. */
function firstEmptyScreenRowFrom_(sh, from, endRow, layout) {
  if (from > endRow) return -1;
  var c = (layout || storeLayout_(sh)).screens;
  var cols = [c.DATE_IN, c.NAME, c.SEQUENCE, c.DATE_OUT, c.TICKET, c.UNI_IN, c.SCREENING, c.LB_EARN, c.EXTRAS, c.EARNING].filter(Boolean);
  var vals = sh.getRange(from, c.DATE_IN, endRow - from + 1, c.EARNING - c.DATE_IN + 1).getValues();
  for (var i = 0; i < vals.length; i++) if (cols.every(function (col) { return vals[i][col - c.DATE_IN] === ''; })) return from + i;
  return -1;
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
    if (y && y.length === 2) { year += 2000; if (year !== scanYear && year !== scanYear - 1) reason = 'Two-digit tag year treated as 20YY; verify the century'; }
  } else return {dateIn:'',dateOut:dateOut,reason:'Tag date is unreadable/unsupported: Date in left blank; enter it from the tag'};
  if (!validYmd_(year, month, day)) {
    return {dateIn:'',dateOut:dateOut,reason:'Tag date is invalid: Date in left blank; verify the written date'};
  }
  var dateIn = Date.UTC(year,month-1,day)/86400000+25569;
  // User rule: a missing written year always uses the admitted scan calendar year.
  // A later month/day may need review, but never changes the inferred year.
  if (dateIn > dateOut) reason += (reason ? '; ' : '') + 'Tag date is after the scan date; verify it';
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
  var conflict = quantityConflict_(x);
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
