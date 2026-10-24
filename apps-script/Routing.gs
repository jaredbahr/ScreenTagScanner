/** Exact, classification-only reference. No reference prices or earnings are encoded. */
var GLASS_JOB_SKUS = {
  singleGlass: '11502 11504 11507 11510 11512 11515 11518 11519 11521 12083 11522 11524 11525 11526 11528 11529 11530 11531 11532 11533 11534 11931 11536 11537 12138 11618 11538 11539 11541 11619 11542 11543 11545 11546 11547 11933 11548 11549 12164 11945 11551 13235 11694'.split(' '),
  gasLightGlass: ['181500'], doubleStrengthGlass: '11621 11556 11562 11572'.split(' '),
  obscureGlass: ['1002591'], mirror: ['1073956'],
  acrylic: '12763 12175 11870 10101 10138 12237 12028 11854 11871 12029 12176 12764 12177 13157 10168 1005453 12765 11695 13158 13159 13160 19571 19570 11697'.split(' '),
  windowLabor: '580500 580501 580502 580503'.split(' ')
};
function exactGlassSkus_(text) {
  var tokens = String(text || '').match(/\b\d{5,7}\b/g) || [], out = [];
  Object.keys(GLASS_JOB_SKUS).forEach(function (family) { tokens.forEach(function (sku) {
    if (GLASS_JOB_SKUS[family].indexOf(sku) >= 0 && !out.some(function (s) { return s.sku === sku; })) out.push({ sku: sku, family: family });
  }); });
  return out;
}
function actualJobEvidence_(x) {
  // Evidence is copied from filled job fields by the extractor, never generic preprinted SKU lists.
  return [typeof x.job_evidence === 'string' ? x.job_evidence : '', typeof x.notes === 'string' ? x.notes : ''].join('\n')
    .split('\n').filter(function (line) { return !/\b(?:preprinted|printed (?:options|list|template)|unfilled|blank options|generic template)\b/i.test(line); }).join('\n');
}
function glassWordEvidence_(text) {
  var t = String(text || '').replace(/\b(?:fiber|fibre)[\s-]*glass\b/ig, 'fiberglass')
    .replace(/\b(?:(?:sliding|slider|patio|storm|screen)\s+)?glass\s+doors?\b/ig, 'door');
  return /\bglass\b|\bplexi(?:glas|glass)\b|\bacrylic\b|\bmirror\b/i.test(t);
}
function resolveJobRouting_(x) {
  var text = actualJobEvidence_(x);
  var skuText = actualJobEvidence_({ job_evidence: x.job_evidence,
    notes: String(x.notes || '').split('\n').filter(function (line) { return /\bsku\b|\bwindow labor\b|\bglass\b|\bacrylic\b|\bplexi(?:glas|glass)\b/i.test(line); }).join('\n') });
  var skus = exactGlassSkus_(skuText);
  // Glass words count only in job_evidence (the written material), never free-text notes: patio
  // screens are routinely noted "for sliding glass door", which is a screen job.
  var glassWords = glassWordEvidence_(actualJobEvidence_({ job_evidence: x.job_evidence }));
  // A patio screen door form is never a window, even with "Glass" in the supplier's name (Circle Glass, 2026-10-24).
  var windowEvidence = x.form_type !== 'patio_door' && (skus.length > 0 || glassWords);
  var flags = [], type = x.form_type === 'patio_door' ? 'screen' : x.item_type === 'screen' || x.item_type === 'window' ? x.item_type : null;
  if (windowEvidence) {
    if (type !== 'window') flags.push('Glass/acrylic or window-labor job evidence: routed to windows, check the tag');
    type = 'window';
  }
  var thermopaneEvidence = /\bthermopane\b|\binsulated\b|\bdouble[- ]pane\b/i.test(text) || skus.some(function (s) { return s.sku === '580500'; });
  var thermopane = x.thermopane === true;
  if (thermopaneEvidence) thermopane = true;
  else if (/\btempered\b/i.test(text) && thermopane) { thermopane = false; flags.push('Tempered glass is not evidence of thermopane; verify glass/labor'); }
  return { type: type, thermopane: thermopane, flags: flags, skus: skus };
}
/**
 * Window panes (Kirsten, 2026-10-22: $18.50 per pane, most windows are one pane). Real tags don't write a
 * pane count; they list a glass line and a window labor line ("1 11562 Glass $37.99; 1 580503 Labor $24.99").
 * Count from the labor line's quantity, else from a single glass line (one glass line = one pane).
 */
function windowPanes_(x) {
  if (Number.isInteger(x.panes) && x.panes >= 1) return { panes: x.panes, how: '' };
  var segs = String(x.job_evidence || '').split(/\n|;/).map(function (t) { return t.trim(); }).filter(Boolean);
  var qtyOf = function (seg) {
    var m = /^(\d{1,2})\s+(?=\d{5,7}\b)/.exec(seg) || /\b(?:qty|quantity)\s*[:=#]?\s*(\d{1,2})\b/i.exec(seg);
    return m && Number(m[1]) >= 1 ? Number(m[1]) : null;
  };
  var labor = segs.filter(function (t) { return GLASS_JOB_SKUS.windowLabor.some(function (k) { return new RegExp('\\b' + k + '\\b').test(t); }); });
  var glass = segs.filter(function (t) { return labor.indexOf(t) < 0 && (/\b\d{5,7}\b/.test(t) || glassWordEvidence_(t)); });
  if (labor.length && labor.every(qtyOf)) {
    return { panes: labor.reduce(function (n, t) { return n + qtyOf(t); }, 0), how: 'labor' };
  }
  if (glass.length === 1 && labor.length <= 1) return { panes: qtyOf(glass[0]) || 1, how: qtyOf(glass[0]) ? 'glass' : 'one-glass-line' };
  return { panes: null, how: '' };
}
function groupPartsLine_(line) { return /\b(?:on|for) (?:all|every) (?:frames?|screens?|tags?)\b/i.test(line); }
function normalizeJobInput_(original) {
  var x = Object.assign({}, original), evidence = typeof x.job_evidence === 'string' ? x.job_evidence : '';
  var group = typeof x.group_extras === 'string' ? x.group_extras : '', extras = [];
  String(x.extras || '').split('\n').filter(Boolean).forEach(function (line) {
    if (groupPartsLine_(line)) { if (group.indexOf(line) < 0) group += (group ? '\n' : '') + line; }
    else if (exactGlassSkus_(line).length) { if (evidence.indexOf(line) < 0) evidence += (evidence ? '\n' : '') + line; }
    else extras.push(line);
  });
  x.extras = extras.length ? extras.join('\n') : null; x.group_extras = group; x.job_evidence = evidence;
  var routing = resolveJobRouting_(x);
  x.item_type = routing.type || 'unknown'; x.thermopane = routing.thermopane;
  x.routing_review = Array.isArray(original.routing_review) ? original.routing_review.slice() : [];
  if (x.form_type === 'patio_door') patioDoor_(x, original);
  if (x.item_type === 'window' && !(Number.isInteger(x.panes) && x.panes >= 1)) {
    var wp = windowPanes_(x);
    if (wp.panes) {
      x.panes = wp.panes;
      if (wp.how === 'one-glass-line') x.routing_review.push('Panes: 1 counted from the one glass line (no quantity written)');
    }
  }
  routing.flags.forEach(function (f) { if (x.routing_review.indexOf(f) < 0) x.routing_review.push(f); });
  if (group && (groupPartsLine_(group) || /\b\d{5,7}\b/.test(group))) { // a real whole-group instruction, not a one-screen comment
    var note = 'Group extras need manual allocation; never multiply by tag/frame count';
    if (x.routing_review.indexOf(note) < 0) x.routing_review.push(note);
  }
  if (/\b\d*\s*PK\b/i.test(String(x.extras || '') + '\n' + group) && !Array.isArray(x.parts)) {
    var pack = 'PK means earnings, not a pack count; verify the literal part quantity before calculating';
    if (x.routing_review.indexOf(pack) < 0) x.routing_review.push(pack);
  }
  if (evidence && String(x.notes || '').indexOf('Filled job evidence: ' + evidence) < 0) {
    x.notes = (x.notes ? x.notes + '\n' : '') + 'Filled job evidence: ' + evidence;
  }
  return x;
}
/**
 * Patio screen doors (Kirsten, 2026-10-24): always fiberglass, billed like a repair on width + height with each side
 * rounded up (75.5 x 48 -> 76 + 48 = 124"), and no build labor or earning base. The handle height on the form is
 * never billed. The forms have no QTY rows, so the inches are worked out here. Safe to run twice (rescans).
 */
var PATIO_DOOR_SIZE = { minWidth: 20, maxWidth: 60, minHeight: 60, maxHeight: 100 };
function patioDoor_(x, original) {
  var note = function (t) { if (x.routing_review.indexOf(t) < 0) x.routing_review.push(t); };
  if (original.item_type === 'window') note('Patio door form: placed as a screen door; check the tag');
  x.item_type = 'screen'; x.thermopane = false;
  if (x.material && x.material !== 'fiberglass' && x.material !== 'unknown') {
    note('Patio door: the tag was read as ' + x.material + '; billed as fiberglass (patio doors are always fiberglass)');
  }
  x.material = 'fiberglass';
  var w = x.width_in, h = x.height_in, s = PATIO_DOOR_SIZE;
  x.quantity_conflict = false; x.qty_rows = ''; x.line_totals = '';
  if (typeof w === 'number' && typeof h === 'number' && w >= s.minWidth && w <= s.maxWidth && h >= s.minHeight && h <= s.maxHeight) {
    x.billable_inches = Math.ceil(w) + Math.ceil(h);
    note('Patio door: inches = width + height, each rounded up (' + Math.ceil(w) + ' + ' + Math.ceil(h) + ' = ' +
      x.billable_inches + '"); no build labor or earning added');
  } else {
    x.billable_inches = null;
    note('Patio door: size ' + (typeof w === 'number' ? formatInches_(w) : '?') + ' x ' + (typeof h === 'number' ? formatInches_(h) : '?') +
      ' looks off (the handle height is never billed): inches left blank, enter them by hand');
  }
}
function storeExtrasText_(x) {
  return escapePartsReceiptText_([x.extras || '', x._store_group_extras ? 'Group extras (whole group; do not multiply by tag/frame count):\n' + x._store_group_extras : ''].filter(Boolean).join('\n'));
}
function groupPartsKey_(text) {
  var skus = String(text || '').match(/\b\d{5,7}\b/g);
  if (skus) return skus.filter(function (s,i) { return skus.indexOf(s) === i; }).sort().join('|');
  return String(text || '').toLowerCase().replace(/\b(?:on|for) (?:all|every) (?:frames?|screens?|tags?)\b/g,'')
    .replace(/[^a-z0-9]/g,'');
}
function groupExtrasLogged_(log, x) {
  if (!(x.tag_count > 1) || !x.ticket_number || log.getLastRow() < 2) return false;
  var store = resolveStore_(x).store; if (!store) return false;
  var notesCol = HEADERS.indexOf('Notes'), nameCol = HEADERS.indexOf('Last Name');
  return log.getRange(2, 1, log.getLastRow() - 1, HEADERS.length).getValues().some(function (r) {
    var of = /^(\d+) of (\d+)$/.exec(String(r[COL.TAG_OF - 1]));
    return sequenceIdentity_(r[COL.TICKET - 1]) === sequenceIdentity_(x.ticket_number) && of && Number(of[2]) === x.tag_count &&
      sequenceIdentity_(r[nameCol]) === sequenceIdentity_(x.last_name || x.customer_name) &&
      String(r[COL.WRITTEN_TO - 1]).indexOf(store.name + ' ') === 0 &&
      String(r[notesCol]).indexOf('Group extras recorded once: ') >= 0 &&
      groupPartsKey_(String(r[notesCol]).split('Group extras recorded once: ')[1]) === groupPartsKey_(x.group_extras);
  });
}

/** Historical repair preview only: no rows are moved/cleared, no prices inferred. */
function previewMisroutedGlassRepairs_() {
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var ss = getWorkbook_(), log = ss.getSheetByName(SCANS_TAB), out = [];
    if (!log || log.getLastRow() < 2) return out;
    log.getRange(2, 1, log.getLastRow()-1, HEADERS.length).getValues().forEach(function (r, i) {
      var placed = /^(.*?) screens row (\d+)$/.exec(String(r[COL.WRITTEN_TO-1])); if (!placed) return;
      var st = STORES.filter(function (s) { return s.name === placed[1]; })[0]; if (!st) return;
      var notes = String(r[HEADERS.indexOf('Notes')] || ''), extras = String(r[HEADERS.indexOf('Extras / Fees')] || '');
      // Review-only: older Scans rows predate job_evidence, so their notes count as evidence here.
      if (resolveJobRouting_({item_type:'unknown',notes:notes,job_evidence:[notes,extras].join('\n')}).type !== 'window') return;
      var sh=storeSheet_(ss, st), c=storeLayout_(sh).screens, row=Number(placed[2]);
      if (row<2 || row>screenBlockEnd_(sh)) { out.push({tab:st.tab,screenRow:row,scansRow:i+2,action:'manual-review-only',reason:'Logged row is outside the data block'});return; }
      var identity=!!sequenceIdentity_(r[COL.TICKET-1]) && !!sequenceIdentity_(r[HEADERS.indexOf('Last Name')]||r[HEADERS.indexOf('Customer')]) &&
        sequenceIdentity_(sh.getRange(row,c.TICKET).getValues()[0][0])===sequenceIdentity_(r[COL.TICKET-1]) &&
        sequenceIdentity_(sh.getRange(row,c.NAME).getValues()[0][0])===sequenceIdentity_(r[HEADERS.indexOf('Last Name')]||r[HEADERS.indexOf('Customer')]);
      var billing=sh.getRange(row,c.SCREENING,1,2).getValues()[0].some(function(v){return v!=='';});
      out.push({tab:st.tab,screenRow:row,scansRow:i+2,identityMatches:identity,billingPresent:billing,
        action:identity&&!billing?'review-window-placement':'manual-review-only',reason:'Historical glass evidence in a screen placement; panes/glass/labor earnings must be verified manually'});
    });
    console.log(JSON.stringify(out));return out;
  } finally {lock.releaseLock();}
}
