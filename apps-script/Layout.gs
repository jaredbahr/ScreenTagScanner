/** Header-derived store layouts and private, journaled sequence-column migration.
 * No workbook IDs, credentials or customer records belong in this file.
 */
var SEQUENCE_HEADER = 'Tag x of N';
var STORE_HEADERS = {
  screens: [['DATE_IN','Date in'],['NAME','Name'],['DATE_OUT','Date out'],['TICKET','Ticket #'],
    ['UNI_IN','Uni/In'],['SCREENING','Screening'],['LB_EARN','LB Earn'],['SPLINE','Spline'],
    ['SPL_EARN','Spl Earn'],['EXTRAS','Extras'],['EARNING','Earning']],
  windows: [['DATE_IN','Date in'],['NAME','Name'],['DATE_OUT','Date out'],['TICKET','Ticket #'],
    ['SW','S/W'],['GLASS','Glass Price'],['LB_EARN','LB Price/ Earn'],['SPL_EARN','Spl Earn'],
    ['OTHER','Other'],['OTHER_EARN','Other Earn']]
};

function headerKey_(v) { return String(v || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
function storeHeaders_(sh) {
  if (sh.getMaxColumns() > 100) throw new Error('Store has more than 100 columns; review layout manually');
  return sh.getRange(1, 1, 1, sh.getMaxColumns()).getDisplayValues()[0];
}
function storeLayout_(sh, pendingBlank) {
  var h = storeHeaders_(sh), out = {};
  Object.keys(STORE_HEADERS).forEach(function (block) {
    var found = [];
    h.forEach(function (v, i) {
      var c = {}, p = i, sequence = 0, pending = false;
      var valid = STORE_HEADERS[block].every(function (field, k) {
        if (k === 2 && headerKey_(h[p]) === headerKey_(SEQUENCE_HEADER)) { sequence = ++p; }
        else if (k === 2 && pendingBlank === p + 1 && h[p] === '') { sequence = ++p; pending = true; }
        if (headerKey_(h[p]) !== headerKey_(field[1])) return false;
        c[field[0]] = ++p; return true;
      });
      if (valid) { c.SEQUENCE = sequence; c.pending = pending; found.push(c); }
    });
    if (found.length !== 1) throw new Error('Missing or ambiguous ' + block + ' headers');
    out[block] = found[0];
  });
  if (out.screens.EARNING >= out.windows.DATE_IN || out.screens.DATE_IN !== 2) {
    throw new Error('Overlapping blocks or changed screen counter');
  }
  var recognized = [out.screens.SEQUENCE, out.windows.SEQUENCE].filter(Boolean);
  h.forEach(function (v, i) {
    if (headerKey_(v) === headerKey_(SEQUENCE_HEADER) && recognized.indexOf(i + 1) < 0) {
      throw new Error('Unexpected sequence header outside a store block');
    }
  });
  return out;
}

function verifiedSequence_(text) {
  var m = /^(\d+) of (\d+)$/.exec(String(text || ''));
  return m && Number(m[1]) >= 1 && Number(m[1]) <= Number(m[2]) && Number(m[2]) <= 1000
    ? Number(m[1]) + ' of ' + Number(m[2]) : '';
}
function writeStoreIdentity_(sh, row, c, x, dates) {
  sh.getRange(row, c.DATE_IN).setValue(dates.dateIn);
  sh.getRange(row, c.NAME).setValue(safeCell_(sheetName_(x)));
  if (c.SEQUENCE) sh.getRange(row, c.SEQUENCE).setNumberFormat('@').setValue(verifiedSequence_(tagOf_(x)));
  sh.getRange(row, c.DATE_OUT).setValue(dates.dateOut);
}

function sequenceTargets_() {
  var props = PropertiesService.getScriptProperties(), ids = ['SHEET_ID','TEMPLATE_ID'].map(function (k) {
    var id = props.getProperty(k); if (!id) throw new Error(k + ' is required'); return id;
  });
  if (ids[0] === ids[1]) throw new Error('TEST and TEMPLATE must be distinct');
  return ids.map(function (id) { return SpreadsheetApp.openById(id); });
}
function mergedShape_(sh) {
  return sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).getMergedRanges().map(function (r) {
    return { row: r.getRow(), col: r.getColumn(), rows: r.getNumRows(), cols: r.getNumColumns() };
  });
}
function formulaAudit_(ss) {
  var count = 0, errors = [], dynamic = [];
  ss.getSheets().forEach(function (sh) {
    var r = sh.getDataRange(), f = r.getFormulas(), v = r.getDisplayValues();
    f.forEach(function (row, i) { row.forEach(function (formula, j) {
      if (formula) count++;
      if (/\b(INDIRECT|ADDRESS|OFFSET|QUERY)\s*\(/i.test(formula)) dynamic.push(sh.getName() + ':r' + (i+1) + 'c' + (j+1));
      if (/^#(REF!|ERROR!|VALUE!|DIV\/0!|N\/A|NAME\?|NUM!)/.test(v[i][j])) errors.push(sh.getName() + ':r' + (i+1) + 'c' + (j+1));
    }); });
  });
  return { count: count, errors: errors, dynamic: dynamic };
}
function readSequenceJournal_() {
  var raw = PropertiesService.getScriptProperties().getProperty('TAG_SEQUENCE_JOURNAL');
  return raw ? JSON.parse(raw) : null;
}
function journalBlank_(ss, sh, j) {
  if (!j || j.workbook !== ss.getId()) return 0;
  var journalStore=storeByTabName_(j.tab);
  var journalSheet=journalStore&&storeSheet_(ss,journalStore);
  if(!journalSheet||journalSheet.getName()!==sh.getName())return 0;
  var h = storeHeaders_(sh), blank = j.headers.slice(); blank.splice(j.after, 0, '');
  var complete = blank.slice(); complete[j.after] = SEQUENCE_HEADER;
  if (JSON.stringify(h) === JSON.stringify(j.headers) && sh.getMaxColumns() === j.columns) return 0;
  if (sh.getMaxColumns() !== j.columns + 1) throw new Error('Interrupted migration column count changed');
  if (JSON.stringify(h) === JSON.stringify(blank)) return j.after + 1;
  if (JSON.stringify(h) === JSON.stringify(complete)) return 0;
  throw new Error('Interrupted migration headers changed; manual review required');
}
function sequenceMigrationPlan_(targets) {
  var journal = readSequenceJournal_();
  var plan = { version: 1, targets: [] };
  targets.forEach(function (ss) {
    var audit = formulaAudit_(ss);
    if (audit.errors.length || audit.dynamic.length) throw new Error('Resolve formula errors / address-string formulas before migration');
    if (!ss.getSheetByName('Totals')) throw new Error('Totals tab missing');
    var target = { workbook: ss.getId(), formulaCount: audit.count, stores: [] };
    STORES.forEach(function (st) {
      var sh = storeSheet_(ss, st); if (!sh) throw new Error('Missing store tab ' + st.tab);
      var layout = storeLayout_(sh, journalBlank_(ss, sh, journal)), merges = mergedShape_(sh);
      ['windows','screens'].forEach(function (block) {
        var c = layout[block], end = block === 'screens' ? screenBlockEnd_(sh) : WINDOW_LAST_ROW;
        if (end < 2) throw new Error('Missing numbered screen rows');
        if (!c.SEQUENCE || c.pending) merges.forEach(function (m) {
          if (m.row <= end && m.col <= c.NAME && m.col + m.cols - 1 > c.NAME) {
            throw new Error('Merge crosses sequence insertion in data/header area: ' + st.tab);
          }
        });
      });
      target.stores.push({ tab: st.tab, headers: storeHeaders_(sh), columns: sh.getMaxColumns(),
        rows: sh.getMaxRows(), frozenColumns: sh.getFrozenColumns(), frozenRows: sh.getFrozenRows(),
        merges: merges, layout: layout });
    });
    plan.targets.push(target);
  });
  return plan;
}
function sequencePlanCode_(plan) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify(plan)).map(function (b) {
    return ('0' + (b & 255).toString(16)).slice(-2);
  }).join('');
}

/** Stop new paid admissions. Previously admitted executions must finish before migration. */
function pauseTagSequenceScans_() {
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var p = PropertiesService.getScriptProperties();
    p.setProperty('TAG_SEQUENCE_SCAN_PAUSE', 'true');
    p.deleteProperty('TAG_SEQUENCE_DRAIN_CONFIRMED');
    return { status: 'admission-paused', next: 'Verify no earlier web-app executions remain active, then preview and approve migration.' };
  } finally { lock.releaseLock(); }
}

/** Read-only manifest. Review before setting nonsecret TAG_SEQUENCE_APPROVED_PLAN to approvalCode. */
function previewTagSequenceMigration_() {
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var targets = sequenceTargets_(), plan = sequenceMigrationPlan_(targets);
    var result = { approvalCode: sequencePlanCode_(plan), plan: plan,
      backfill: targets.map(function (ss) { return { workbook: ss.getId(), report: sequenceBackfill_(ss, false) }; }) };
    console.log('Migration approvalCode: ' + result.approvalCode);
    console.log(JSON.stringify(result));
    return result;
  } finally { lock.releaseLock(); }
}

function finishSequenceInsertion_(ss, sh, j) {
  var pending = journalBlank_(ss, sh, j);
  if (!pending && JSON.stringify(storeHeaders_(sh)) === JSON.stringify(j.headers)) {
    sh.insertColumnAfter(j.after); SpreadsheetApp.flush();
    pending = journalBlank_(ss, sh, j);
  }
  var col = j.after + 1, data = sh.getRange(2, col, j.end - 1, 1);
  if (data.getValues().some(function (r) { return r[0] !== ''; }) ||
      data.getFormulas().some(function (r) { return r[0] !== ''; })) {
    throw new Error('New sequence column changed during interruption; no values overwritten');
  }
  // Format only the new column's header/data rows; merged footer titles stay untouched.
  sh.getRange(1, j.after, j.end, 1).copyTo(sh.getRange(1, col, j.end, 1), { formatOnly: true });
  sh.getRange(1, col, j.end, 1).setNumberFormat('@').setDataValidation(null);
  sh.getRange(1, col).setValue(SEQUENCE_HEADER);
  sh.setColumnWidth(col, 92);
  sh.setFrozenColumns(j.frozenColumns + (j.after < j.frozenColumns ? 1 : 0));
  if (sh.getFrozenRows() !== j.frozenRows) throw new Error('Frozen rows changed');
  var expectedMerges = j.merges.map(function (m) {
    var n = { row: m.row, col: m.col, rows: m.rows, cols: m.cols };
    if (m.col > j.after) n.col++;
    else if (m.col + m.cols - 1 > j.after) n.cols++;
    return n;
  });
  if (JSON.stringify(mergedShape_(sh)) !== JSON.stringify(expectedMerges)) throw new Error('Merged title shape changed unexpectedly');
  storeLayout_(sh);
  PropertiesService.getScriptProperties().deleteProperty('TAG_SEQUENCE_JOURNAL');
}

/** Private owner/editor operation; does nothing without reviewed nonsecret approval code.
 * A failure retains the gate/journal so scans fail closed and the operation can resume.
 */
function applyTagSequenceMigration_() {
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var props = PropertiesService.getScriptProperties(), targets = sequenceTargets_(), plan = sequenceMigrationPlan_(targets);
    var approved = props.getProperty('TAG_SEQUENCE_APPROVED_PLAN'), activeRaw = props.getProperty('TAG_SEQUENCE_MIGRATION_ACTIVE');
    var done = props.getProperty('TAG_SEQUENCE_MIGRATION_DONE');
    var ids = targets.map(function (ss) { return ss.getId(); });
    var allReady = plan.targets.every(function (t) { return t.stores.every(function (st) {
      return st.layout.screens.SEQUENCE && !st.layout.screens.pending && st.layout.windows.SEQUENCE && !st.layout.windows.pending;
    }); });
    if (!activeRaw && done === JSON.stringify(ids) && allReady) {
      console.log('Tag sequence columns already migrated; no changes made');
      return { status: 'already-migrated', plan: plan };
    }
    if (!approved) throw new Error('Review preview, then set TAG_SEQUENCE_APPROVED_PLAN to its approvalCode');
    if (props.getProperty('TAG_SEQUENCE_SCAN_PAUSE') !== 'true' ||
        props.getProperty('TAG_SEQUENCE_DRAIN_CONFIRMED') !== approved) {
      throw new Error('Pause admission and confirm all earlier executions have drained before migration');
    }
    var active = activeRaw ? JSON.parse(activeRaw) : null;
    if (active) {
      if (approved !== active.approval || JSON.stringify(ids) !== JSON.stringify(active.ids)) throw new Error('Resume approval / target mismatch');
    } else {
      if (approved !== sequencePlanCode_(plan)) throw new Error('Dry-run preconditions changed; preview again');
      active = { approval: approved, ids: ids, counts: plan.targets.map(function (t) { return t.formulaCount; }) };
      props.setProperty('TAG_SEQUENCE_MIGRATION_ACTIVE', JSON.stringify(active));
    }
    plan.targets.forEach(function (t, i) { if (t.formulaCount !== active.counts[i]) throw new Error('Formula count changed during interruption'); });
    targets.forEach(function (ss) {
      STORES.forEach(function (st) {
        var sh = storeSheet_(ss, st), journal = readSequenceJournal_();
        if (journal && journal.workbook === ss.getId() && journal.tab === st.tab) finishSequenceInsertion_(ss, sh, journal);
        ['windows','screens'].forEach(function (block) {
          var c = storeLayout_(sh)[block]; if (c.SEQUENCE) return;
          var j = { workbook: ss.getId(), tab: st.tab, block: block, after: c.NAME,
            end: block === 'screens' ? screenBlockEnd_(sh) : WINDOW_LAST_ROW,
            headers: storeHeaders_(sh), columns: sh.getMaxColumns(), merges: mergedShape_(sh),
            frozenColumns: sh.getFrozenColumns(), frozenRows: sh.getFrozenRows() };
          props.setProperty('TAG_SEQUENCE_JOURNAL', JSON.stringify(j));
          finishSequenceInsertion_(ss, sh, j);
        });
      });
    });
    SpreadsheetApp.flush();
    var backfill = targets.map(function (ss) { return { workbook: ss.getId(), report: sequenceBackfill_(ss, true) }; });
    targets.forEach(function (ss, i) {
      var audit = formulaAudit_(ss);
      if (audit.errors.length || audit.count !== active.counts[i]) throw new Error('Post-migration formula audit failed; gate retained');
    });
    props.setProperty('TAG_SEQUENCE_MIGRATION_DONE', JSON.stringify(ids));
    props.deleteProperty('TAG_SEQUENCE_MIGRATION_ACTIVE');
    var result = { status: 'migrated', plan: sequenceMigrationPlan_(targets), backfill: backfill };
    console.log(JSON.stringify(result));
    return result;
  } finally { lock.releaseLock(); }
}

/** Explicit owner/editor step only after external post-checks; never resumes on failure. */
function resumeTagSequenceScans_() {
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var p = PropertiesService.getScriptProperties(), targets = sequenceTargets_();
    if (p.getProperty('TAG_SEQUENCE_MIGRATION_ACTIVE') || p.getProperty('TAG_SEQUENCE_JOURNAL')) throw new Error('Migration not complete');
    var plan = sequenceMigrationPlan_(targets);
    if (p.getProperty('TAG_SEQUENCE_MIGRATION_DONE') !== JSON.stringify(targets.map(function (ss) { return ss.getId(); })) ||
        !plan.targets.every(function (t) { return t.stores.every(function (s) { return s.layout.screens.SEQUENCE && s.layout.windows.SEQUENCE; }); })) {
      throw new Error('Verify completed migration and both target workbooks before resuming');
    }
    p.deleteProperty('TAG_SEQUENCE_SCAN_PAUSE');p.deleteProperty('TAG_SEQUENCE_DRAIN_CONFIRMED');
    console.log('Sequence migration complete; scan admission resumed');
    return { status: 'admission-resumed' };
  } finally { lock.releaseLock(); }
}

function sequenceIdentity_(v) {
  return String(v || '').replace(/^'(?=[=+\-@\t\r])/, '').replace(/ \(\?\)$/, '').trim().toLowerCase();
}
/** Conservative backfill. No Scans/Totals restructuring, rescan, or paid request. */
function sequenceBackfill_(ss, commit) {
  var log = ss.getSheetByName(SCANS_TAB), candidates = {}, report = [];
  if (!log || log.getLastRow() < 2) return report;
  var h = log.getRange(1, 1, 1, HEADERS.length).getDisplayValues()[0];
  var keys = ['Written To','Ticket #','Last Name','Customer','Tag x of N','Store','Billable in'], index = {};
  keys.forEach(function (k) { if (h.filter(function (v) { return v === k; }).length !== 1) throw new Error('Ambiguous Scans header'); index[k] = h.indexOf(k); });
  log.getRange(2, 1, log.getLastRow() - 1, HEADERS.length).getValues().forEach(function (r) {
    var m = /^(.*?) (screens|windows) row (\d+(?:, \d+)*)$/.exec(String(r[index['Written To']]));
    var seq = verifiedSequence_(r[index['Tag x of N']]);
    if (!m || !seq) return;
    var st = STORES.filter(function (s) { return s.name === m[1]; })[0]; if (!st) return;
    var rawStore = matchStore_(r[index['Store']]); if (rawStore && rawStore !== st) return;
    m[3].split(', ').forEach(function (row) {
      var k = st.tab + '|' + m[2] + '|' + row;
      (candidates[k] || (candidates[k] = [])).push({ seq: seq, ticket: sequenceIdentity_(r[index['Ticket #']]),
        name: sequenceIdentity_(r[index['Last Name']] || r[index.Customer]), inches: r[index['Billable in']] });
    });
  });
  Object.keys(candidates).forEach(function (k) {
    var parts = k.split('|'), sh = storeSheet_(ss, storeByTabName_(parts[0])), block = parts[1], row = Number(parts[2]);
    var c = storeLayout_(sh, journalBlank_(ss, sh, readSequenceJournal_()))[block], end = block === 'screens' ? screenBlockEnd_(sh) : WINDOW_LAST_ROW;
    if (row < 2 || row > end) { report.push({ tab: parts[0], block: block, row: row, action: 'review', reason: 'logged row outside data block' }); return; }
    var dest = c.SEQUENCE ? sh.getRange(row, c.SEQUENCE) : null;
    if (dest && (dest.getValues()[0][0] !== '' || dest.getFormulas()[0][0])) {
      report.push({ tab: parts[0], block: block, row: row, action: 'preserve-existing' }); return;
    }
    var matches = candidates[k], candidate = matches[0], reason = '';
    var ticket = sequenceIdentity_(sh.getRange(row, c.TICKET).getValues()[0][0]);
    var name = sequenceIdentity_(sh.getRange(row, c.NAME).getValues()[0][0]);
    if (matches.length !== 1) reason = 'multiple placed log records';
    else if (!candidate.ticket || !candidate.name || ticket !== candidate.ticket || name !== candidate.name) reason = 'destination identity differs from log';
    else if (block === 'screens' && sh.getRange(row, c.UNI_IN).getValues()[0][0] !== candidate.inches) reason = 'destination inches differ from log';
    else if (Object.keys(candidates).some(function (other) { return other !== k && other.indexOf(parts[0] + '|' + block + '|') === 0 && candidates[other].some(function (x) {
      return x.ticket === ticket && x.name === name && x.seq !== candidate.seq && (block !== 'screens' || x.inches === candidate.inches);
    }); })) reason = 'indistinguishable group rows could have been reordered';
    var entry = { tab: parts[0], block: block, row: row, action: reason ? 'review' : 'fill', reason: reason || '', sequence: reason ? '' : candidate.seq };
    if (commit) {
      if (!dest) throw new Error('Sequence column missing; migrate structure before backfill');
      // Re-read immediately before writing; humans should pause edits as well as scans.
      if (dest.getValues()[0][0] !== '' || dest.getFormulas()[0][0]) { entry.action = 'preserve-existing'; }
      else if (sequenceIdentity_(sh.getRange(row, c.TICKET).getValues()[0][0]) !== ticket ||
          sequenceIdentity_(sh.getRange(row, c.NAME).getValues()[0][0]) !== name) { throw new Error('Destination changed during backfill'); }
      else if (!reason) dest.setNumberFormat('@').setValue(candidate.seq);
      else {
        var note = 'Tag sequence backfill needs review: ' + reason;
        var prior = dest.getNote(); if (prior.indexOf(note) < 0) dest.setNote(prior ? prior + '\n' + note : note);
        dest.setBackground(FLAG_COLOR);
      }
    }
    report.push(entry);
  });
  return report;
}
