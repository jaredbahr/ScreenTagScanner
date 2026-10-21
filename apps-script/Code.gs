/**
 * Code.gs: phone upload page and the existing Shortcut JSON endpoint.
 *
 * Flow: Shortcut POST { token, user, image } → check token → Claude reads the tag
 *       → write into the store's tab (Workbook.gs) → log to "Scans" → reply.
 *
 * STATUS: DRAFT. Validate on the TEST workbook before production use.
 * Deploy as a STANDALONE Apps Script project (not bound to a sheet) so monthly
 * copies of the workbook don't copy the script. See docs/SETUP.md.
 *
 * Script Properties (Project Settings → Script Properties):
 *   ANTHROPIC_API_KEY  required  API key from the "Screen Tags" Console workspace
 *   SHARED_TOKEN       required  long random string, also stored in the Shortcut
 *   ALERT_EMAIL        legacy    ignored; scanner emails are disabled
 *   MODEL              optional  default claude-sonnet-5-5
 *   SHEET_ID           required  this month's workbook (switched by Settings → Start new month)
 *   MONTH_EDITORS      optional  comma-separated emails given Editor access to each new month (Month.gs)
 *   TEMPLATE_ID        optional  blank template, for the monthly rollover (Workbook.gs)
 *   SAVE_IMAGES        optional  "true" to keep photos in Drive (default false)
 *   RETENTION_DAYS     optional  days to keep saved photos (default 30)
 *   MAX_SCANS_PER_MINUTE optional authenticated attempts per rolling minute (default 10)
 *   MAX_SCANS_PER_DAY  optional authenticated attempts per Chicago day (default 100)
 */

var SCANS_TAB = 'Scans';
var PHOTO_FOLDER = 'Screen Tag Photos';
var DEFAULT_MODEL = 'claude-sonnet-5-5';
var MAX_IMAGE_B64 = 5 * 1024 * 1024; // Claude API per-image limit is 5 MB

// Full-detail log of every scan, kept alongside the store tabs as a safety net.
var HEADERS = [
  'Scanned At', 'Scanned By', 'Ticket #', 'Store', 'Customer', 'Last Name', 'Phone', 'Tag Date',
  'Width (in)', 'Height (in)', 'Billable in', 'Form', 'Material', 'Color', 'Tag x of N', 'Screens on Tag',
  'Extras / Fees', 'Notes', 'Corrections / Refund', 'Written To', 'Needs Review', 'Review Reason', 'Photo', 'Scan ID'
];
// 1-based column numbers in the Scans log, for text formatting and duplicate checks.
var COL = {
  TICKET: HEADERS.indexOf('Ticket #') + 1, STORE: HEADERS.indexOf('Store') + 1,
  PHONE: HEADERS.indexOf('Phone') + 1, DATE: HEADERS.indexOf('Tag Date') + 1,
  WIDTH: HEADERS.indexOf('Width (in)') + 1, HEIGHT: HEADERS.indexOf('Height (in)') + 1,
  TAG_OF: HEADERS.indexOf('Tag x of N') + 1, WRITTEN_TO: HEADERS.indexOf('Written To') + 1
};

function doPost(e) {
  var req;
  try {
    if (!e || !e.postData || typeof e.postData.contents !== 'string' ||
        e.postData.contents.length > MAX_IMAGE_B64 + 2048) {
      return reply_(false, 'Photo request is too large or missing. Choose a smaller photo.');
    }
    req = JSON.parse(e.postData.contents);
  } catch (err) {
    return reply_(false, 'Something went wrong sending the photo. Try again.');
  }

  var result = processScan_(req);
  return reply_(result.status === 'ok', result.message, result.speak, result.scanId);
}

/** Only photo-processing RPC exposed to the HTML client; shares Shortcut controls. */
function scanTag(req) {
  return processScan_(req);
}

function scanResult_(ok, message, speak, scanId, needsReview) {
  return { status: ok ? 'ok' : 'error', message: message, speak: speak || message, scanId: scanId || '',
    authenticated: false, needsReview: needsReview === true };
}

function processScan_(req) {
  var props;
  try { props = PropertiesService.getScriptProperties(); }
  catch (err) { return scanResult_(false, 'Scanner settings are unavailable. Contact Jared.'); }
  var expected;
  try { expected = props.getProperty('SHARED_TOKEN'); }
  catch (err) { return scanResult_(false, 'Scanner settings are unavailable. Contact Jared.'); }
  if (!req || typeof req !== 'object' || Array.isArray(req) ||
      typeof req.token !== 'string' || !expected || req.token.length > 512 || req.token !== expected) {
    // Don't email on bad tokens; that would let anyone spam the alert inbox.
    var denied = scanResult_(false, 'This phone is not set up for scanning. Check the password or call Jared.');
    denied.badToken = true; // lets the upload page forget a remembered password that no longer works
    return denied;
  }
  // Positive authentication is set only here, after validating the current shared token.
  // All pre-auth errors remain false; Shortcut JSON stays unchanged via reply_.
  var result = processAuthenticatedScan_(req, props);
  result.authenticated = true;
  return result;
}

function processAuthenticatedScan_(req, props) {
  // Count authenticated attempts, including invalid photos and provider/write failures.
  // Reserve admission under a lock, then release it before the paid call / workbook lock.
  var admitted = {};
  try { // Includes uncertain admission writes as well as every processing return.
  var admission = admitScan_(props, admitted);
  if (admission) return scanResult_(false, admission);
  if (typeof req.image !== 'string' || !req.image) {
    return scanResult_(false, 'No photo came through. Choose a photo and try again.');
  }
  if (req.image.length > MAX_IMAGE_B64) {
    return scanResult_(false, 'Photo is too large. Choose a smaller photo or check the Shortcut resize step.');
  }
  if ((req.user !== undefined && typeof req.user !== 'string') ||
      (req.user && req.user.length > 200) || Object.keys(req).some(function (k) {
        return ['token', 'user', 'image'].indexOf(k) === -1;
      })) {
    return scanResult_(false, 'Invalid scan request. Choose the photo again.');
  }
  try {
    if (req.image.length % 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(req.image)) throw new Error('base64');
    var bytes = Utilities.base64Decode(req.image);
    if (bytes.length < 5 || (bytes[0] & 255) !== 255 || (bytes[1] & 255) !== 216 ||
        (bytes[2] & 255) !== 255 || (bytes[bytes.length - 2] & 255) !== 255 ||
        (bytes[bytes.length - 1] & 255) !== 217) throw new Error('jpeg');
  } catch (err) {
    return scanResult_(false, 'Photo must be a JPEG image. Choose a photo again.');
  }

  var user = String(req.user || 'Unknown').substring(0, 40);
  var scanId = Utilities.getUuid().substring(0, 8);

  try {
    var x = normalizeJobInput_(extractTag_(req.image, props));
    x._scan_ymd = admitted.scannedYmd;
    var reasons = reviewReasons_(x).concat(x.routing_review);
    var photoUrl = props.getProperty('SAVE_IMAGES') === 'true' ? savePhoto_(req.image, scanId, x) : '';
    var placed = saveScan_(x, user, reasons, photoUrl, scanId, admitted.sheetId, admitted.leaseId);

    if (placed.rescan) {
      return scanResult_(true, 'Already scanned: ' + confirmationText_(x).replace(/^Added: /, '') +
        '. Nothing new added.' + (placed.needsReview ? '\nNeeds review: reconcile the original row and earnings before retrying.' : '') + waitingText_(placed.waiting, placed.waitingUnavailable),
        'Already scanned. Nothing new added.' + (placed.needsReview ? ' It still needs review.' : ''), scanId, placed.needsReview);
    }
    if (!placed.ok) {
      // Saved to the Scans log but not to a store tab: needs a person.
      notice_(props, user, scanId, placed.problem, x);
      return scanResult_(true, 'Saved, but ' + placed.problem + '. It is in Scans for manual review.' + waitingText_(placed.waiting, placed.waitingUnavailable),
        'Saved to the scan log only. It needs manual review.', scanId, true);
    }
    var msg = confirmationText_(x) + ' → ' + placed.store.name;
    if (reasons.length) msg += '\n⚠️ Flagged for a double check.';
    msg += waitingText_(placed.waiting, placed.waitingUnavailable);
    return scanResult_(true, msg, spokenText_(x, reasons.length > 0), scanId, reasons.length > 0);
  } catch (err) {
    alert_(props, user, scanId, err, req.image);
    return scanResult_(false, err.userMessage || 'Save could not be confirmed. Check the active workbook in Settings before retrying.');
  }
  } finally { releaseMonthScan_(props, admitted.leaseId); }
}

/** Basic health check: open the web app URL in a browser to confirm it's deployed. */
function doGet(e) {
  if (e && e.parameter && e.parameter.health === '1') {
    return ContentService.createTextOutput('Screen tag scanner is running. Version ' + EXTRACTION_VERSION);
  }
  return HtmlService.createHtmlOutputFromFile('Upload').setTitle('Screen Tag Scanner')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** Persistent quota reservation shared by every authenticated processing entry. */
function admitScan_(props, admitted) {
  var lock, acquired = false;
  try {
    lock = LockService.getScriptLock();
    lock.waitLock(5000); acquired = true;
    if (props.getProperty('ROLLOVER_PENDING')) return 'New-month setup is pending. No photo was sent. Open Settings to recover, or contact Jared.';
    if (props.getProperty('TAG_SEQUENCE_MIGRATION_ACTIVE') || props.getProperty('TAG_SEQUENCE_SCAN_PAUSE') === 'true') {
      return 'Workbook upgrade in progress. No photo was sent. Wait for Jared before scanning.';
    }
    function limit(key, fallback, max) {
      var raw = props.getProperty(key);
      if (raw === null || raw === '') return fallback;
      if (!/^\d+$/.test(raw)) throw new Error('Invalid limit');
      var n = Number(raw);
      if (n < 1 || n > max) throw new Error('Invalid limit');
      return n;
    }
    var minuteLimit = limit('MAX_SCANS_PER_MINUTE', 10, 100);
    var dailyLimit = limit('MAX_SCANS_PER_DAY', 100, 10000);
    var now = Date.now(), day = Utilities.formatDate(new Date(now), 'America/Chicago', 'yyyy-MM-dd');
    var raw = props.getProperty('SCAN_LIMIT_STATE');
    var state = raw ? JSON.parse(raw) : { day: day, daily: 0, recent: [] };
    if (typeof state.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(state.day) ||
        !Number.isInteger(state.daily) || state.daily < 0 || !Array.isArray(state.recent) ||
        state.recent.length > 100 || state.recent.some(function (t) {
          return !Number.isInteger(t) || t < 0 || t > now;
        }) || state.day > day) throw new Error('Invalid limit state');
    if (state.day !== day) { state.day = day; state.daily = 0; }
    state.recent = state.recent.filter(function (t) { return t > now - 60000; });
    if (state.daily >= dailyLimit) return 'Daily scan limit reached. Contact Jared or try tomorrow. No photo was sent.';
    if (state.recent.length >= minuteLimit) return 'Too many scans this minute. Wait a minute before trying again. No photo was sent.';
    if (admitted) {
      admitted.sheetId = props.getProperty('SHEET_ID');
      admitted.scannedYmd = Utilities.formatDate(new Date(), 'America/Chicago', 'yyyy-MM-dd');
      if (!admitted.sheetId) throw new Error('Workbook missing');
    }
    state.recent.push(now); state.daily++;
    props.setProperty('SCAN_LIMIT_STATE', JSON.stringify(state));
    if (admitted) {
      var leases=monthScanLeases_(props);
      if(Object.keys(leases).length>=40)throw new Error('Scan admission recovery needed');
      admitted.leaseId=Utilities.getUuid();
      leases[admitted.leaseId]={sheetId:admitted.sheetId,started:now};
      props.setProperty('MONTH_SCAN_LEASES',JSON.stringify(leases));
    }
    return '';
  } catch (err) {
    return 'Scan limits could not be checked. No photo was sent. Contact Jared.';
  } finally {
    if (acquired) lock.releaseLock();
  }
}

function extractTag_(imageB64, props) {
  var apiKey = props.getProperty('ANTHROPIC_API_KEY');
  if (!apiKey) throw friendlyError_('ANTHROPIC_API_KEY not set', 'Scanner is not set up yet. Call Jared.');
  var model = props.getProperty('MODEL') || DEFAULT_MODEL;
  var built = buildRequest_(model, imageB64, 'image/jpeg');

  var headers = { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' };
  if (built.betas.length) headers['anthropic-beta'] = built.betas.join(',');

  var res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post',
    contentType: 'application/json',
    headers: headers,
    payload: JSON.stringify(built.body),
    muteHttpExceptions: true
  });

  var code = res.getResponseCode();
  var body = res.getContentText();
  if (code === 429 || code === 529 || code >= 500) {
    throw friendlyError_('HTTP ' + code + ': ' + body, 'The tag reader is busy. Try again in a minute.');
  }
  if (code !== 200) {
    throw friendlyError_('HTTP ' + code + ': ' + body, 'The tag reader is having trouble. Try later or ask Jared to check the scanner.');
  }
  var x = parseResponse_(JSON.parse(body));
  if (!x.is_tag) {
    throw friendlyError_('Model says not a tag: ' + JSON.stringify(x),
      'Couldn\'t find a tag in that photo. Try again with the tag filling the screen.');
  }
  return x;
}

function getWorkbook_(admittedId) {
  var id = admittedId || PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  var ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw friendlyError_('SHEET_ID not set', 'Scanner is not set up yet. Call Jared.');
  return ss;
}

function getScansSheet_(ss) {
  var sh = ss.getSheetByName(SCANS_TAB);
  if (!sh) {
    sh = ss.insertSheet(SCANS_TAB, ss.getNumSheets());
    sh.appendRow(safeRow_(HEADERS));
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  }
  // The log is the script's record, not a store: keep it as the last tab, out of Kirsten's way.
  var last = ss.getNumSheets();
  if (sh.getIndex() !== last) { ss.setActiveSheet(sh); ss.moveActiveSheet(last); }
  return sh;
}

/**
 * Journal the scan before its store write, then confirm completion. One lock means
 * two phones scanning at once can't claim the same row.
 * Returns the writeToStoreTab_ result ({ ok, store, row, problem }).
 */
function saveScan_(x, user, reasons, photoUrl, scanId, admittedId, leaseId) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    // Same lock as rollover: an expired lease can never write after the archive snapshot.
    if(admittedId) {
      var lease=monthScanLeases_(PropertiesService.getScriptProperties())[leaseId];
      if(!lease||lease.sheetId!==admittedId)throw friendlyError_('Expired scan admission',
        'This scan took too long and no worksheet data was saved. Check the active month in Settings before retrying.');
    }
    var ss = getWorkbook_(admittedId);
    var log = getScansSheet_(ss);
    x = normalizeJobInput_(x);
    x.routing_review.forEach(function (f) { if (reasons.indexOf(f) < 0) reasons.push(f); });
    x._store_group_extras = x.group_extras && !groupExtrasLogged_(log, x) ? x.group_extras : '';
    x._extra_labor_plan = prepareExtraLabor_(ss, x);
    x._extra_labor_plan.flags.forEach(function (f) { if (reasons.indexOf(f) < 0) reasons.push(f); });
    x._parts_plan = preparePartsEarnings_(ss, x);
    x._parts_plan.flags.forEach(function (f) { if (reasons.indexOf(f) < 0) reasons.push(f); });
    // Dates are written as serial day numbers (correct in any time zone), but a mismatched
    // spreadsheet time zone still shifts the Scans log timestamps; note it in the log only.
    var logOnly = [];
    var sheetTz = ss.getSpreadsheetTimeZone(), scriptTz = Session.getScriptTimeZone();
    if (sheetTz !== scriptTz) {
      logOnly.push('Spreadsheet time zone is ' + sheetTz + ', script is ' + scriptTz + ' (run alignTimeZones_)');
    }
    var groupNote = '', writtenTo = 'PENDING';
    function logRow(why) {
      return safeRow_([
        new Date(), user, x.ticket_number || '', x.store || '', x.customer_name || '', x.last_name || '',
        formatPhone_(x.phone), x.date || '', x.width_in, x.height_in, x.billable_inches,
        x.form_type, x.material, x.screen_color, tagOf_(x), x.screens_on_tag,
        x.extras || '', [escapePartsReceiptText_([x.notes || '', groupNote].filter(Boolean).join('\n')), x._parts_plan.posted.length ? PARTS_RECEIPT + JSON.stringify(x._parts_plan.posted) : ''].filter(Boolean).join('\n'), x.has_corrections ? (x.correction_details || 'YES') : '', writtenTo,
        why.length ? 'YES' : '', why.concat(logOnly).join('; '), photoUrl, scanId
      ]);
    }
    var placed, row = 0;
    if (PropertiesService.getScriptProperties().getProperty('TAG_SEQUENCE_MIGRATION_ACTIVE')) {
      placed = { ok: false, problem: 'workbook upgrade in progress; scan kept in Scans for manual placement' };
    } else if (isExactRescan_(log, x, reasons)) {
      placed = { ok: false, rescan: true, needsReview: reasons.length > 0, problem: 'this exact tag was already scanned' };
    } else {
      // Log first, marked PENDING: if the store write or the final log update is interrupted,
      // a retry matches this row as an exact rescan instead of writing a second store row.
      log.appendRow(logRow(reasons.concat(['Save started; if this stays PENDING, check the store tab before rescanning'])));
      row = log.getLastRow();
      log.getRange(row, 1, 1, HEADERS.length).setBackground(UNPLACED_COLOR);
      try { placed = writeToStoreTab_(ss, x, reasons); }
      catch (err) {
        writtenTo = 'INTERRUPTED';
        log.getRange(row, 1, 1, HEADERS.length).setValues([logRow(reasons.concat(['Save interrupted: reconcile existing or partial store rows before adding anything']))]).setBackground(UNPLACED_COLOR);
        throw err;
      }
    }
    if (placed.rescan && x._extra_labor_plan.items.length) {
      reasons.push('Exact rescan has unposted additional labor; reconcile the original row manually');
      placed.needsReview = true;
    }
    if (placed.rescan && x._parts_plan.items.length) {
      reasons.push('Exact rescan has new unposted parts earnings; reconcile the original row manually');
      placed.needsReview = true;
    }
    if (!placed.ok) reasons.push(placed.problem);
    else placed.flags.slice(reasons.length).forEach(function (f) { reasons.push(f); }); // store-tab-only flags
    writtenTo = placed.ok ? placed.store.name + ' ' + placed.block + ' row ' + placed.row : (placed.rescan ? 'RESCAN' : 'NOT PLACED');
    groupNote = x.group_extras ? (placed.ok && x._store_group_extras ? 'Group extras recorded once: ' :
      placed.ok ? 'Group extras already recorded: ' : 'Group extras pending placement: ') + x.group_extras : '';

    if (row) log.getRange(row, 1, 1, HEADERS.length).setValues([logRow(reasons)]);
    else { log.appendRow(logRow(reasons)); row = log.getLastRow(); }
    // Ticket #, store, phone and tag date as text so Sheets doesn't reinterpret them.
    [COL.TICKET, COL.STORE, COL.PHONE, COL.DATE, COL.TAG_OF].forEach(function (c) {
      log.getRange(row, c).setNumberFormat('@');
    });
    log.getRange(row, 1, 1, HEADERS.length).setBackground(reasons.length ? (placed.ok || placed.rescan ? '#fff3c4' : UNPLACED_COLOR) : null);
    // Advisory only: store and completion log writes have already succeeded.
    try { placed.waiting = unplacedCount_(log, row); }
    catch (err) { placed.waiting = 0; placed.waitingUnavailable = true; }
    return placed;
  } finally {
    // Complete buffered store/log writes before rollover can acquire this lock.
    try { SpreadsheetApp.flush(); } finally { lock.releaseLock(); }
  }
}

var UNPLACED_COLOR = '#f6c7a8'; // orange: reconcile existing/partial store rows before adding anything

/**
 * Earlier Scans rows needing reconciliation: NOT PLACED, PENDING or INTERRUPTED, and
 * still marked Needs Review = YES. Interrupted saves may already have store rows.
 * Clearing YES after reconciliation removes the count. Controlled RESCAN rows are excluded.
 */
function unplacedCount_(log, exceptRow) {
  var last = log.getLastRow();
  if (last < 2) return 0;
  var rows = log.getRange(2, 1, last - 1, HEADERS.length).getValues(), n = 0;
  var review = HEADERS.indexOf('Needs Review');
  rows.forEach(function (r, i) {
    if (i + 2 === exceptRow) return;
    if (['NOT PLACED', 'PENDING', 'INTERRUPTED'].indexOf(String(r[COL.WRITTEN_TO - 1])) < 0) return;
    if (r[review] !== 'YES') return;
    n++;
  });
  return n;
}

function waitingText_(n, unavailable) {
  if (unavailable) return '\nEarlier scan review status could not be checked. Check Scans and store tabs before adding rows.';
  return n ? '\n⚠️ ' + n + ' earlier scan' + (n === 1 ? '' : 's') + ' still need' + (n === 1 ? 's' : '') +
    ' reconciliation. See orange rows in Scans. Existing or partial store rows may already be present; add a row only after confirming it is missing.' : '';
}

function tagOf_(x) {
  return x.tag_index && x.tag_count ? x.tag_index + ' of ' + x.tag_count : '';
}

/**
 * True if this exact tag was already scanned and placed: same store, ticket, "x of N"
 * and size. Some stores reuse one ticket for a group of tags, so ticket alone isn't enough.
 */
function isExactRescan_(log, x, reasons) {
  if (!x.ticket_number) return false;
  var last = log.getLastRow();
  if (last < 2) return false;
  var rows = log.getRange(2, 1, last - 1, HEADERS.length).getValues();
  var currentStore=resolveStore_(x).store;
  return rows.some(function (r) {
    var destination=String(r[COL.WRITTEN_TO-1]),placed=/^(.*?) (screens|windows) row \d+(?:, \d+)*$/.exec(destination);
    var priorStore=placed?STORES.filter(function(st){return st.name===placed[1];})[0]:null;
    priorStore=priorStore||matchStore_(r[COL.STORE-1]);
    var sameStore=currentStore&&priorStore?currentStore.tab===priorStore.tab:
      !priorStore&&(['PENDING','INTERRUPTED'].indexOf(destination)>=0||
        !currentStore&&String(r[COL.STORE-1]).toLowerCase()===String(x.store||'').toLowerCase());
    var match = String(r[COL.TICKET - 1]) === String(x.ticket_number) &&
      sameStore &&
      String(r[COL.TAG_OF - 1]) === tagOf_(x) &&
      Number(r[COL.WIDTH - 1]) === Number(x.width_in) &&
      Number(r[COL.HEIGHT - 1]) === Number(x.height_in) &&
      String(r[COL.WRITTEN_TO - 1]) !== 'NOT PLACED';
    if (match && reasons && ['PENDING', 'INTERRUPTED'].indexOf(String(r[COL.WRITTEN_TO - 1])) >= 0) {
      reasons.push('An earlier save of this tag was interrupted; check the store tab before entering it');
    } else if(match && reasons && r[HEADERS.indexOf('Needs Review')] === 'YES') {
      reasons.push('Earlier placed scan remains marked for review; reconcile the original row');
    }
    return match;
  });
}

function savePhoto_(imageB64, scanId, x) {
  var folders = DriveApp.getFoldersByName(PHOTO_FOLDER);
  var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(PHOTO_FOLDER);
  var name = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HHmm') +
    '_' + (x.last_name || 'unknown') + '_' + scanId + '.jpg';
  var blob = Utilities.newBlob(Utilities.base64Decode(imageB64), 'image/jpeg', name);
  return folder.createFile(blob).getUrl();
}

/** Daily cleanup of saved photos older than RETENTION_DAYS. Installed by installTriggers_(). */
function purgeOldPhotos_() {
  var days = Number(PropertiesService.getScriptProperties().getProperty('RETENTION_DAYS') || 30);
  var cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  var folders = DriveApp.getFoldersByName(PHOTO_FOLDER);
  if (!folders.hasNext()) return;
  var files = folders.next().getFiles();
  while (files.hasNext()) {
    var f = files.next();
    if (f.getDateCreated().getTime() < cutoff) f.setTrashed(true);
  }
}

/** Run once from the editor after enabling SAVE_IMAGES. */
function installTriggers_() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'purgeOldPhotos_') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('purgeOldPhotos_').timeBased().everyDays(1).atHour(3).create();
}

/** Minimal non-customer diagnostic only; no email, image, token or provider text. */
function scannerDiagnostic_(event, scanId) {
  var id = /^[a-f0-9]{8}$/.test(String(scanId)) ? scanId : 'unavailable';
  console.error('Scanner event: ' + event + '; scanId=' + id);
}
function alert_(props, user, scanId, err, imageB64) { scannerDiagnostic_('scan-failed', scanId); }
function notice_(props, user, scanId, problem, x) { scannerDiagnostic_('not-placed', scanId); }

function reply_(ok, message, speak, scanId) {
  return ContentService
    // "status" is a plain string because Shortcuts compares text more reliably than booleans.
    .createTextOutput(JSON.stringify({
      status: ok ? 'ok' : 'error', message: message, speak: speak || message, scanId: scanId || ''
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Editor test: upload a tag photo to Drive, paste its file ID, run this.
 * Exercises the full path except the Shortcut.
 */
function testWithDriveImage_() {
  var FILE_ID = 'PASTE_DRIVE_FILE_ID_HERE';
  var b64 = Utilities.base64Encode(DriveApp.getFileById(FILE_ID).getBlob().getBytes());
  var out = doPost({ postData: { contents: JSON.stringify({
    token: PropertiesService.getScriptProperties().getProperty('SHARED_TOKEN'),
    user: 'Editor test',
    image: b64
  }) } });
  console.log(out.getContent());
}
