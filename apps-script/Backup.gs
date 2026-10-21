/** Full native workbook backups. Private helpers only; no public RPC or backup deletion. */
var WORKBOOK_BACKUP_MIME = 'application/vnd.google-apps.spreadsheet';

function workbookBackupPrivate_(item) {
  // My Drive's root owner identifies the executing account using the existing Drive scope.
  // Session.getEffectiveUser().getEmail() would introduce a userinfo.email scope requirement.
  var owner = item.getOwner(), rootOwner = DriveApp.getRootFolder().getOwner();
  var me = rootOwner ? rootOwner.getEmail() : '';
  if (!owner || !me || owner.getEmail().toLowerCase() !== me.toLowerCase() ||
      item.isTrashed() || item.getSharingAccess() !== DriveApp.Access.PRIVATE ||
      item.getEditors().concat(item.getViewers()).some(function(user) {
        return String(user.getEmail()).toLowerCase() !== me.toLowerCase();
      })) {
    throw new Error('Backup destination/copy must be restricted to its executing owner.');
  }
}

function workbookBackupLayout_(id) {
  return JSON.stringify(SpreadsheetApp.openById(id).getSheets().map(function(sh) {
    return [sh.getName(), sh.getMaxRows(), sh.getMaxColumns(), sh.getFrozenRows(), sh.getFrozenColumns()];
  }));
}

function workbookBackupFile_(file, folder, journal, templateId) {
  workbookBackupPrivate_(folder);
  workbookBackupPrivate_(file);
  var parents = file.getParents(), ids = [];
  while (parents.hasNext()) ids.push(parents.next().getId());
  if (file.getId() === journal.sourceId || file.getId() === templateId ||
      file.getMimeType() !== WORKBOOK_BACKUP_MIME || file.getName() !== journal.name ||
      ids.length !== 1 || ids[0] !== folder.getId() ||
      workbookBackupLayout_(file.getId()) !== journal.layout) {
    throw new Error('Backup identity, location or workbook structure needs owner review.');
  }
}

function workbookBackupStatus_(p, status, purpose, completedAt) {
  // Never log file IDs, names, workbook content, raw exceptions or credentials.
  console.log('Workbook backup: ' + status + '.');
  p.setProperty('WORKBOOK_BACKUP_LAST_STATUS', JSON.stringify({status:status, purpose:purpose,
    at:status === 'complete' && completedAt ? completedAt : new Date().toISOString()}));
}

/** Lock must already be held. Receipts are private metadata, never active-workbook pointers. */
function workbookBackupLocked_(p, sourceId, purpose) {
  if (typeof sourceId !== 'string' || !sourceId || sourceId === p.getProperty('TEMPLATE_ID') ||
      !/^(daily-\d{4}-\d{2}-\d{2}|rollover-[A-Za-z0-9_-]{1,100})$/.test(purpose)) {
    throw new Error('Backup source/purpose needs owner review.');
  }
  var folderId = p.getProperty('BACKUP_FOLDER_ID');
  if (!folderId || folderId === p.getProperty('MONTH_FOLDER_ID')) {
    throw new Error('Configure a separate owner-only backup folder before enabling backups.');
  }
  var folder = DriveApp.getFolderById(folderId);
  workbookBackupPrivate_(folder);
  // Bounded bookkeeping: retain the latest receipt per purpose, while keeping every Drive copy.
  var key = purpose.indexOf('daily-') === 0 ? 'WORKBOOK_BACKUP_DAILY' : 'WORKBOOK_BACKUP_ROLLOVER';
  var raw = p.getProperty(key), receipt = raw ? JSON.parse(raw) : null;
  if (receipt && (receipt.version !== 1 || receipt.key !== key || !receipt.copyId || !receipt.sourceId ||
      !receipt.purpose || !receipt.folderId || !receipt.layout || !receipt.name)) {
    throw new Error('Backup receipt needs owner review.');
  }
  if (receipt && (receipt.sourceId !== sourceId || receipt.purpose !== purpose)) receipt = null;
  var pendingRaw = p.getProperty('WORKBOOK_BACKUP_PENDING');
  var pending = pendingRaw ? JSON.parse(pendingRaw) : null;
  if (pending && (pending.key !== key || pending.sourceId !== sourceId || pending.purpose !== purpose ||
      pending.folderId !== folderId)) throw new Error('Reconcile the existing backup operation first.');
  if (receipt) {
    if (receipt.version !== 1 || receipt.key !== key || receipt.folderId !== folderId ||
        receipt.sourceId !== sourceId || receipt.purpose !== purpose || !receipt.copyId) {
      throw new Error('Backup receipt needs owner review.');
    }
    workbookBackupFile_(DriveApp.getFileById(receipt.copyId), folder, receipt, p.getProperty('TEMPLATE_ID'));
    if (pending) p.deleteProperty('WORKBOOK_BACKUP_PENDING');
    return receipt;
  }
  if (p.getProperty('SHEET_ID') !== sourceId) throw new Error('Active workbook changed before backup.');
  var source = DriveApp.getFileById(sourceId);
  if (source.isTrashed() || source.getMimeType() !== WORKBOOK_BACKUP_MIME) {
    throw new Error('Active workbook is missing or is not a native Google spreadsheet.');
  }
  var fresh = !pending;
  if (fresh) {
    pending = {version:1, key:key, sourceId:sourceId, folderId:folderId, purpose:purpose,
      name:'Screen workbook backup ' + Utilities.formatDate(new Date(), 'America/Chicago', 'yyyy-MM-dd') +
        ' ' + purpose + ' [' + Utilities.getUuid() + ']',
      layout:workbookBackupLayout_(sourceId), started:new Date().toISOString()};
    p.setProperty('WORKBOOK_BACKUP_PENDING', JSON.stringify(pending));
  }
  if (pending.version !== 1 || !pending.name || !pending.layout ||
      pending.copyId === sourceId || pending.copyId === p.getProperty('TEMPLATE_ID')) {
    throw new Error('Pending backup metadata needs owner review.');
  }
  var file;
  if (pending.copyId) file = DriveApp.getFileById(pending.copyId);
  else {
    var files = folder.getFilesByName(pending.name);
    while (files.hasNext()) {
      if (file) throw new Error('Multiple pending backup copies need owner review.');
      file = files.next();
    }
    if (!file) {
      // A timeout may mean Google created a copy. Never blindly make a second one.
      if (!fresh) throw new Error('Earlier backup creation is uncertain; reconcile it before another copy.');
      file = source.makeCopy(pending.name, folder);
    }
    pending.copyId = file.getId();
    p.setProperty('WORKBOOK_BACKUP_PENDING', JSON.stringify(pending));
  }
  workbookBackupFile_(file, folder, pending, p.getProperty('TEMPLATE_ID'));
  if (p.getProperty('SHEET_ID') !== sourceId) throw new Error('Active workbook changed during backup.');
  receipt = Object.assign({}, pending, {completed:new Date().toISOString()});
  p.setProperty(key, JSON.stringify(receipt));
  p.deleteProperty('WORKBOOK_BACKUP_PENDING');
  return receipt;
}

/** Owner-run or approved nightly trigger entry; one copy per active workbook per Chicago day. */
function backupActiveWorkbook_() {
  var p, lock, held = false;
  var purpose = 'daily-' + Utilities.formatDate(new Date(), 'America/Chicago', 'yyyy-MM-dd');
  try {
    lock = LockService.getScriptLock(); lock.waitLock(20000); held = true;
    p = PropertiesService.getScriptProperties();
    if (p.getProperty('ROLLOVER_PENDING') || monthPaused_(p) || Object.keys(monthScanLeases_(p)).length) {
      throw new Error('A rollover, migration or admitted scan must finish before backup.');
    }
    var receipt = workbookBackupLocked_(p, p.getProperty('SHEET_ID'), purpose);
    workbookBackupStatus_(p, 'complete', purpose, receipt.completed);
    return receipt;
  } catch (err) {
    if (held && p) { try { workbookBackupStatus_(p, 'needs-owner-review', purpose); } catch (ignored) {} }
    throw new Error('Workbook backup did not complete. Check the owner execution log and backup status.');
  } finally { if (held) lock.releaseLock(); }
}

/** Expected backup failures are reported in status/logs, not thrown into trigger failure emails. */
function nightlyWorkbookBackup_() {
  try { return backupActiveWorkbook_(); }
  catch (err) {
    console.log('Nightly workbook backup needs owner review.');
    return {status:'needs-owner-review'};
  }
}

/** Hook AFTER PDF archive, BEFORE the first SHEET_ID switch; caller holds ScriptLock. */
function backupBeforeMonthSwitch_(p, pending) {
  try {
    if (Object.keys(monthScanLeases_(p)).length) throw new Error('An admitted scan is still finishing.');
    var receipt = workbookBackupLocked_(p, pending.priorSheetId, 'rollover-' + pending.operationId);
    workbookBackupStatus_(p, 'complete', 'rollover', receipt.completed);
    return receipt;
  } catch (err) {
    try { workbookBackupStatus_(p, 'needs-owner-review', 'rollover'); } catch (ignored) {}
    throw new Error('Previous workbook backup did not complete. The month switch must wait for owner review.');
  }
}

/** Private owner inspection only; do not expose receipts or destination IDs through scanner RPC. */
function getWorkbookBackupStatus_() {
  var status = PropertiesService.getScriptProperties().getProperty('WORKBOOK_BACKUP_LAST_STATUS');
  var result = status ? JSON.parse(status) : {status:'not-configured'};
  console.log('Workbook backup status: ' + result.status + '.');
  return result;
}

function workbookBackupSummary_(p) {
  try {
    var statusRaw = p.getProperty('WORKBOOK_BACKUP_LAST_STATUS'), status = statusRaw ? JSON.parse(statusRaw) : null;
    var scheduleRaw = p.getProperty('WORKBOOK_BACKUP_TRIGGER'), schedule = scheduleRaw ? JSON.parse(scheduleRaw) : null;
    var scheduled = schedule && schedule.handler === 'nightlyWorkbookBackup_' && schedule.hour === 2 &&
      schedule.minute === 0 && schedule.timeZone === 'America/Chicago' && schedule.days === 1;
    if (scheduled) scheduled = ScriptApp.getProjectTriggers().filter(function(t) {
      return t.getHandlerFunction() === 'nightlyWorkbookBackup_' && t.getUniqueId() === schedule.id;
    }).length === 1;
    var text = scheduled ? 'Backups: nightly around 2 a.m. Chicago time, plus before month changes. All copies are kept.' :
      'Backups: setup needs owner review before month changes.';
    if (status && status.status === 'complete' && /^\d{4}-\d{2}-\d{2}T[0-9:.]+Z$/.test(status.at || '')) {
      text += ' Last backup completed: ' + status.at + '.';
    } else if (status && status.status === 'needs-owner-review') text += ' Last backup needs owner review.';
    else text += ' No completed backup has been recorded yet.';
    return text;
  } catch (err) { return 'Backups: status needs owner review.'; }
}

/** Owner-run setup only. Creates one private folder and the explicitly approved nightly trigger. */
function installWorkbookBackups_() {
  var lock = LockService.getScriptLock(), held = false;
  try {
    lock.waitLock(20000); held = true;
    var p = PropertiesService.getScriptProperties(), folderId = p.getProperty('BACKUP_FOLDER_ID'), folder;
    if (folderId) {
      if (folderId === p.getProperty('MONTH_FOLDER_ID')) throw new Error('Use a separate owner-only backup folder.');
      folder = DriveApp.getFolderById(folderId);
    } else {
      var root = DriveApp.getRootFolder(), raw = p.getProperty('WORKBOOK_BACKUP_FOLDER_PENDING');
      var pending = raw ? JSON.parse(raw) : null, fresh = !pending;
      if (fresh) {
        pending = {name:'Screen workbook backups [' + Utilities.getUuid() + ']'};
        p.setProperty('WORKBOOK_BACKUP_FOLDER_PENDING', JSON.stringify(pending));
      }
      if (!pending || typeof pending.name !== 'string' || !/^Screen workbook backups \[[A-Za-z0-9_-]+\]$/.test(pending.name)) {
        throw new Error('Pending backup folder needs owner review.');
      }
      var folders = root.getFoldersByName(pending.name);
      while (folders.hasNext()) {
        if (folder) throw new Error('Multiple pending backup folders need owner review.');
        folder = folders.next();
      }
      if (!folder) {
        if (!fresh) throw new Error('Earlier backup folder creation is uncertain; reconcile it first.');
        folder = root.createFolder(pending.name);
      }
      workbookBackupPrivate_(folder);
      p.setProperty('BACKUP_FOLDER_ID', folder.getId());
      p.deleteProperty('WORKBOOK_BACKUP_FOLDER_PENDING');
    }
    workbookBackupPrivate_(folder);
    var matches = ScriptApp.getProjectTriggers().filter(function(t) { return t.getHandlerFunction() === 'nightlyWorkbookBackup_'; });
    if (matches.length > 1) throw new Error('Multiple backup triggers need owner review; no trigger was removed.');
    var scheduleRaw = p.getProperty('WORKBOOK_BACKUP_TRIGGER'), schedule = scheduleRaw ? JSON.parse(scheduleRaw) : null;
    var intent = p.getProperty('WORKBOOK_BACKUP_TRIGGER_PENDING');
    if (matches.length) {
      if (schedule && schedule.id === matches[0].getUniqueId() && schedule.handler === 'nightlyWorkbookBackup_' &&
          schedule.hour === 2 && schedule.minute === 0 && schedule.days === 1 && schedule.timeZone === 'America/Chicago') {
        console.log('Workbook backup schedule already configured.'); return {status:'already-configured'};
      }
      if (schedule) throw new Error('Existing backup trigger metadata needs owner review.');
      if (intent !== 'daily-0200-America/Chicago') throw new Error('Existing backup trigger schedule needs owner review.');
    } else {
      if (schedule || intent) throw new Error('Earlier backup trigger result needs owner review; no duplicate was installed.');
      p.setProperty('WORKBOOK_BACKUP_TRIGGER_PENDING', 'daily-0200-America/Chicago');
      matches = [ScriptApp.newTrigger('nightlyWorkbookBackup_').timeBased().atHour(2).nearMinute(0)
        .everyDays(1).inTimezone('America/Chicago').create()];
    }
    p.setProperty('WORKBOOK_BACKUP_TRIGGER', JSON.stringify({id:matches[0].getUniqueId(), handler:'nightlyWorkbookBackup_',
      hour:2, minute:0, days:1, timeZone:'America/Chicago'}));
    p.deleteProperty('WORKBOOK_BACKUP_TRIGGER_PENDING');
    console.log('Workbook backup schedule configured: nightly around 2 a.m. Chicago time.');
    return {status:'configured'};
  } catch (err) {
    console.log('Workbook backup setup needs owner review; no existing backup or trigger was deleted.');
    throw new Error('Workbook backup setup did not complete. Check the owner execution log and pending setup state.');
  } finally { if (held) lock.releaseLock(); }
}
