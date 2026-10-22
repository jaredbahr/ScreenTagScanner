'use strict';
// Offline checks only. No Drive, Sheets, credentials, customer data or network.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const candidate = fs.readFileSync(path.join(root, 'apps-script/Backup.gs'), 'utf8');
const mime = 'application/vnd.google-apps.spreadsheet';
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS backup: ' + name); }
function iterator(items) { let i = 0; return {hasNext:() => i < items.length, next:() => items[i++]}; }
function fixture() {
  const state = {locked:false, copies:0, folderCreates:0, triggerCreates:0, day:'2026-10-19', now:Date.parse('2026-10-20T00:35:00Z')};
  const props = {SHEET_ID:'S', TEMPLATE_ID:'T', BACKUP_FOLDER_ID:'B', MONTH_FOLDER_ID:'M'};
  const files = new Map(), books = new Map(), logs = [];
  const owner = () => ({getEmail:() => 'owner@example.invalid'});
  const access = item => Object.assign(item, {access:'private', editors:[], viewers:[], trashed:false,
    getOwner:owner, isTrashed(){return this.trashed;}, getSharingAccess(){return this.access;},
    getEditors(){return this.editors;}, getViewers(){return this.viewers;}});
  const folders = new Map(), triggers = [];
  function makeFolder(id, name) {
    const f = access({name, getId:() => id, getFilesByName:filename => iterator([...files.values()].filter(file => file.name === filename && file.parent === f))});
    folders.set(id, f); return f;
  }
  const folder = makeFolder('B', 'Synthetic backup folder');
  const rootFolder = {getOwner:owner, getFoldersByName:name => iterator([...folders.values()].filter(f => f.name === name)), createFolder(name) {
    state.folderCreates++; if(state.folderFail)throw Error('Synthetic private failure');
    const f = makeFolder('FOLDER' + state.folderCreates, name);
    if(state.afterFolderThrow)throw Error('Synthetic private failure'); return f;
  }};
  const p = {getProperty:key => props[key] ?? null, setProperty(key, value) {
    assert.equal(state.locked, true, 'metadata writes require shared ScriptLock');
    if (state.failProperty === key) { state.failProperty = null; throw Error('Synthetic private failure'); }
    props[key] = value;
  }, deleteProperty(key) { assert.equal(state.locked, true); delete props[key]; }};
  function file(id, name, parent = null) {
    const f = access({id, name, parent, mime, getId(){return this.id;}, getName(){return this.name;},
      getMimeType(){return this.mime;}, getParents(){return iterator(this.parent ? [this.parent] : []);},
      makeCopy(copyName, destination) {
        assert.equal(state.locked, true); assert.equal(props.SHEET_ID, 'S'); state.copies++;
        if (state.createFail) throw Error('Synthetic private failure');
        const copy = file('COPY' + state.copies, copyName, destination);
        files.set(copy.id, copy); books.set(copy.id, structuredClone(books.get(id)));
        if (state.sharedCopy) copy.editors.push({getEmail:() => 'other@example.invalid'});
        if (state.wrongLayout) books.get(copy.id).pop();
        if (state.wrongMime) copy.mime = 'application/pdf';
        if (state.wrongParent) copy.parent = null;
        if (state.afterCreateThrow) throw Error('Synthetic private failure');
        return copy;
      }});
    return f;
  }
  files.set('S', file('S', 'Synthetic active workbook')); files.set('T', file('T', 'Synthetic template'));
  books.set('S', ['Store A', 'Store B', 'Totals', 'Scans'].map(name => ({name, rows:10, cols:26, frozen:1,
    values:[['Invented job', 17]], formulas:[['=SUM(B2:B9)']], notes:[['Invented note']], formats:['$0.00'],
    colors:['#ffffff'], validations:['synthetic rule'], merges:[[1, 1, 1, 4]]})));
  class FakeDate extends Date { constructor(...args) { super(...(args.length ? args : [state.now])); } static now(){return state.now;} }
  const ctx = {JSON, Object, Array, Date:FakeDate, console:{log:line => logs.push(line)},
    Session:{getEffectiveUser:owner}, PropertiesService:{getScriptProperties:() => p},
    LockService:{getScriptLock:() => ({waitLock(){if(state.locked)throw Error('Busy');state.locked = true;}, releaseLock(){state.locked = false;}})},
    Utilities:{getUuid:() => 'synthetic-op-' + state.copies, formatDate:() => state.day,
      DigestAlgorithm:{SHA_256:'sha256'}, computeDigest:(algorithm, text) => [...crypto.createHash('sha256').update(text).digest()]},
    DriveApp:{Access:{PRIVATE:'private'}, getRootFolder:() => rootFolder, getFolderById:id => {if(!folders.has(id))throw Error('Missing synthetic folder');return folders.get(id);},
      getFileById:id => {if(!files.has(id))throw Error('Synthetic private failure');return files.get(id);}},
    SpreadsheetApp:{openById:id => ({getSheets:() => books.get(id).map(sh => ({getName:() => sh.name,
      getMaxRows:() => sh.rows, getMaxColumns:() => sh.cols, getFrozenRows:() => sh.frozen, getFrozenColumns:() => 0}))})},
    ScriptApp:{getProjectTriggers:() => triggers.slice(), newTrigger(handler) {
      assert.equal(state.locked, true); const config = {handler}, builder = {};
      for(const method of ['timeBased','atHour','nearMinute','everyDays','inTimezone'])builder[method] = value => {config[method] = value ?? true;return builder;};
      builder.create = () => {state.triggerCreates++;if(state.triggerFail)throw Error('Synthetic private failure');
        state.triggerConfig = config;const trigger = {getHandlerFunction:() => handler, getUniqueId:() => 'TRIGGER' + state.triggerCreates};triggers.push(trigger);
        if(state.afterTriggerThrow)throw Error('Synthetic private failure');return trigger;};
      return builder;
    }}, monthPaused_:() => !!state.paused};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'apps-script/MonthArchive.gs'), 'utf8'), ctx);
  vm.runInContext(candidate, ctx);
  function rollover() { state.locked = true; try { return ctx.backupBeforeMonthSwitch_(p, {priorSheetId:'S', operationId:'invented-rollover'}); } finally {state.locked = false;} }
  return {ctx, state, props, p, files, books, folder, folders, triggers, logs, file, rollover};
}

test('native full copy preserves all tabs, values, formulas, formatting, notes and metadata without changing pointers', () => {
  const t = fixture(), before = structuredClone(t.books.get('S')), r = t.ctx.backupActiveWorkbook_();
  assert.deepEqual(t.books.get(r.copyId), before); assert.deepEqual(t.books.get('S'), before);
  assert.equal(t.props.SHEET_ID, 'S'); assert.equal(t.props.TEMPLATE_ID, 'T');
  assert.equal(t.props.MONTH_FOLDER_ID, 'M'); assert.equal(t.state.copies, 1);
  assert.equal(t.props.WORKBOOK_BACKUP_PENDING, undefined); assert.equal(t.state.locked, false);
  assert.equal(t.ctx.getWorkbookBackupStatus_().status, 'complete');
  assert.ok(t.files.get(r.copyId).name.includes('daily-2026-10-19'));
  assert.doesNotMatch(t.logs.join('\n'), /COPY1|owner@|Invented|Synthetic private/);
});
test('repeat day is idempotent and a later day retains the previous backup', () => {
  const t = fixture(), first = t.ctx.backupActiveWorkbook_();
  t.state.now += 3600000;
  assert.equal(t.ctx.backupActiveWorkbook_().copyId, first.copyId); assert.equal(t.state.copies, 1);
  assert.equal(JSON.parse(t.props.WORKBOOK_BACKUP_LAST_STATUS).at, first.completed, 'show the actual snapshot time, not the later retry');
  t.state.day = '2026-10-20'; const next = t.ctx.backupActiveWorkbook_();
  assert.notEqual(next.copyId, first.copyId); assert.equal(t.state.copies, 2);
  assert.equal(t.files.get(first.copyId).trashed, false);
});
test('an owner listed among editors remains owner-only while any other person blocks backup', () => {
  const t = fixture();t.folder.editors.push({getEmail:() => 'OWNER@example.invalid'});
  assert.equal(t.ctx.backupActiveWorkbook_().copyId, 'COPY1');
  t.files.get('COPY1').viewers.push({getEmail:() => 'other@example.invalid'});
  assert.throws(() => t.ctx.backupActiveWorkbook_());assert.equal(t.state.copies, 1);
});
test('missing/semi-shared/foreign-owned destination stops before copying', () => {
  for (const change of [t => delete t.props.BACKUP_FOLDER_ID, t => t.props.BACKUP_FOLDER_ID = 'M',
    t => t.folder.access = 'anyone_with_link', t => t.folder.editors.push({}),
    t => t.folder.viewers.push({}), t => t.folder.trashed = true,
    t => t.folder.getOwner = () => ({getEmail:() => 'other@example.invalid'})]) {
    const t = fixture(); change(t); assert.throws(() => t.ctx.backupActiveWorkbook_(), /did not complete/);
    assert.equal(t.state.copies, 0); assert.equal(t.props.SHEET_ID, 'S');
  }
});
test('scans, pending rollover, migration pause, malformed lease state and lock contention all block daily copy', () => {
  for (const change of [t => t.props.MONTH_SCAN_LEASES = JSON.stringify({scan:{sheetId:'S', started:t.state.now}}),
    t => t.props.MONTH_SCAN_LEASES = 'bad', t => t.props.ROLLOVER_PENDING = '{}',
    t => t.state.paused = true, t => t.state.locked = true]) {
    const t = fixture(); change(t); assert.throws(() => t.ctx.backupActiveWorkbook_()); assert.equal(t.state.copies, 0);
  }
});
test('template, trashed source, and non-spreadsheet source cannot be backed up as active', () => {
  for (const change of [t => t.props.SHEET_ID = 'T', t => t.files.get('S').trashed = true, t => t.files.get('S').mime = 'text/plain']) {
    const t = fixture(); change(t); assert.throws(() => t.ctx.backupActiveWorkbook_()); assert.equal(t.state.copies, 0);
  }
});
test('uncertain creation recovers the exact named copy without another copy', () => {
  const t = fixture(); t.state.afterCreateThrow = true;
  assert.throws(() => t.ctx.backupActiveWorkbook_()); assert.ok(t.props.WORKBOOK_BACKUP_PENDING);
  t.state.afterCreateThrow = false; assert.equal(t.ctx.backupActiveWorkbook_().copyId, 'COPY1'); assert.equal(t.state.copies, 1);
});
test('uncertain creation with no visible copy stops retries instead of blindly duplicating', () => {
  const t = fixture(); t.state.createFail = true; assert.throws(() => t.ctx.backupActiveWorkbook_());
  t.state.createFail = false; assert.throws(() => t.ctx.backupActiveWorkbook_()); assert.equal(t.state.copies, 1);
});
test('multiple matching copies stop recovery without deleting or creating anything', () => {
  const t = fixture(); t.state.afterCreateThrow = true; assert.throws(() => t.ctx.backupActiveWorkbook_());
  const pending = JSON.parse(t.props.WORKBOOK_BACKUP_PENDING);
  t.files.set('DUPLICATE', t.file('DUPLICATE', pending.name, t.folder));
  assert.throws(() => t.ctx.backupActiveWorkbook_()); assert.equal(t.state.copies, 1);
  assert.equal([...t.files.values()].some(f => f.trashed), false);
});
test('unverified access, structure, mime or parent retains the copy for review and keeps production pointers', () => {
  for (const flag of ['sharedCopy', 'wrongLayout', 'wrongMime', 'wrongParent']) {
    const t = fixture(); t.state[flag] = true; assert.throws(() => t.ctx.backupActiveWorkbook_());
    assert.equal(t.props.SHEET_ID, 'S'); assert.ok(t.props.WORKBOOK_BACKUP_PENDING);
    assert.equal(t.files.get('COPY1').trashed, false); assert.equal(t.ctx.getWorkbookBackupStatus_().status, 'needs-owner-review');
  }
});
test('metadata failure before creation makes no copy; failure after creation recovers exactly once', () => {
  const t = fixture(); t.state.failProperty = 'WORKBOOK_BACKUP_PENDING';
  assert.throws(() => t.ctx.backupActiveWorkbook_()); assert.equal(t.state.copies, 0);
  const u = fixture(); const set = u.p.setProperty; let pendingWrites = 0;
  u.p.setProperty = (key, value) => { if(key === 'WORKBOOK_BACKUP_PENDING' && ++pendingWrites === 2)throw Error('Synthetic private failure');return set(key, value); };
  assert.throws(() => u.ctx.backupActiveWorkbook_()); assert.equal(u.state.copies, 1);
  u.p.setProperty = set; assert.equal(u.ctx.backupActiveWorkbook_().copyId, 'COPY1'); assert.equal(u.state.copies, 1);
});
test('a trashed or moved completed backup blocks idempotent success instead of inventing a replacement', () => {
  for (const modify of [f => f.trashed = true, f => f.parent = null]) {
    const t = fixture(), r = t.ctx.backupActiveWorkbook_(); modify(t.files.get(r.copyId));
    assert.throws(() => t.ctx.backupActiveWorkbook_()); assert.equal(t.state.copies, 1);
  }
});
test('changing destination or day during a pending operation requires reconciliation', () => {
  const t = fixture(); t.state.createFail = true; assert.throws(() => t.ctx.backupActiveWorkbook_());
  t.state.day = '2026-10-20'; t.state.createFail = false;
  assert.throws(() => t.ctx.backupActiveWorkbook_()); assert.equal(t.state.copies, 1);
});
test('rollover hook backs up the old workbook while its pointer is still active, once per operation', () => {
  const t = fixture(), r = t.rollover(); assert.equal(t.props.SHEET_ID, 'S');
  assert.equal(t.rollover().copyId, r.copyId); assert.equal(t.state.copies, 1);
  t.props.SHEET_ID = 'NEW'; assert.equal(t.rollover().copyId, r.copyId, 'existing receipt supports recovery after switch');
  assert.equal(t.props.SHEET_ID, 'NEW'); assert.equal(t.state.copies, 1);
});
test('rollover hook cannot create an after-the-fact backup after active source changed', () => {
  const t = fixture(); t.props.SHEET_ID = 'NEW'; assert.throws(() => t.rollover()); assert.equal(t.state.copies, 0);
});
test('backup has no public endpoint, email, sharing changes, deletion or active-pointer writes', () => {
  assert.doesNotMatch(candidate, /MailApp\s*\.|setTrashed\s*\(|setSharing\s*\(|addEditor\s*\(|removeEditor\s*\(|deleteTrigger\s*\(/);
  assert.doesNotMatch(candidate, /setProperty\(['"](?:SHEET_ID|TEMPLATE_ID|CURRENT_WORKBOOK_MONTH)/);
  assert.ok([...candidate.matchAll(/^function (\w+)\(/gm)].every(m => m[1].endsWith('_')));
});

test('approved setup creates exactly one private folder and nightly Chicago trigger; repeat is a no-op', () => {
  const t = fixture(); delete t.props.BACKUP_FOLDER_ID;
  assert.equal(t.ctx.installWorkbookBackups_().status, 'configured');
  assert.equal(t.state.folderCreates, 1); assert.equal(t.state.triggerCreates, 1);
  assert.deepEqual(t.state.triggerConfig, {handler:'nightlyWorkbookBackup_', timeBased:true, atHour:2, nearMinute:0, everyDays:1, inTimezone:'America/Chicago'});
  assert.equal(t.ctx.installWorkbookBackups_().status, 'already-configured');
  assert.equal(t.state.folderCreates, 1); assert.equal(t.state.triggerCreates, 1); assert.equal(t.state.copies, 0);
  assert.equal(t.props.SHEET_ID, 'S'); assert.equal(t.props.TEMPLATE_ID, 'T');
  assert.match(t.ctx.workbookBackupSummary_(t.p), /nightly around 2 a.m. Chicago time/);
});
test('uncertain folder and trigger creation recover without duplicate resources', () => {
  const t = fixture();delete t.props.BACKUP_FOLDER_ID;t.state.afterFolderThrow = true;
  assert.throws(() => t.ctx.installWorkbookBackups_());t.state.afterFolderThrow = false;
  assert.equal(t.ctx.installWorkbookBackups_().status, 'configured'); assert.equal(t.state.folderCreates, 1);
  const u = fixture();u.state.afterTriggerThrow = true;assert.throws(() => u.ctx.installWorkbookBackups_());
  u.state.afterTriggerThrow = false;assert.equal(u.ctx.installWorkbookBackups_().status, 'configured');assert.equal(u.state.triggerCreates, 1);
});
test('uncertain invisible resources stop retries; preexisting or duplicate backup triggers require review', () => {
  const t = fixture();delete t.props.BACKUP_FOLDER_ID;t.state.folderFail = true;
  assert.throws(() => t.ctx.installWorkbookBackups_());t.state.folderFail = false;
  assert.throws(() => t.ctx.installWorkbookBackups_());assert.equal(t.state.folderCreates, 1);
  const u = fixture();u.state.triggerFail = true;assert.throws(() => u.ctx.installWorkbookBackups_());u.state.triggerFail = false;
  assert.throws(() => u.ctx.installWorkbookBackups_());assert.equal(u.state.triggerCreates, 1);
  for(const count of [1, 2]) {
    const v = fixture(); for(let i = 0; i < count; i++)v.triggers.push({getHandlerFunction:() => 'nightlyWorkbookBackup_',getUniqueId:() => 'existing' + i});
    assert.throws(() => v.ctx.installWorkbookBackups_());assert.equal(v.state.triggerCreates, 0);assert.equal(v.triggers.length, count);
  }
});
test('setup preserves unrelated triggers; status is visible without private IDs or raw errors', () => {
  const t = fixture(); t.triggers.push({getHandlerFunction:() => 'purgeOldPhotos_',getUniqueId:() => 'unrelated'});
  t.ctx.installWorkbookBackups_(); t.ctx.backupActiveWorkbook_();
  assert.equal(t.triggers.length, 2); assert.match(t.ctx.workbookBackupSummary_(t.p), /Last backup completed/);
  t.files.get('COPY1').trashed = true;assert.throws(() => t.ctx.backupActiveWorkbook_());
  assert.match(t.ctx.workbookBackupSummary_(t.p), /Last backup needs owner review/);
  assert.doesNotMatch(t.ctx.workbookBackupSummary_(t.p), /TRIGGER|COPY1|FOLDER|owner@|Synthetic/);
});
test('bookkeeping stays bounded across days while every backup copy remains', () => {
  const t = fixture();for(let i = 1; i <= 12; i++){t.state.day = '2026-10-' + String(i).padStart(2, '0');t.ctx.backupActiveWorkbook_();}
  assert.equal(t.state.copies, 12); assert.equal(t.files.size, 14);
  assert.deepEqual(Object.keys(t.props).filter(k => k.startsWith('WORKBOOK_BACKUP_')).sort(), ['WORKBOOK_BACKUP_DAILY','WORKBOOK_BACKUP_LAST_STATUS']);
});
test('nightly failure returns visible review status without throwing into trigger email notifications', () => {
  const t = fixture();t.state.createFail = true;
  assert.equal(t.ctx.nightlyWorkbookBackup_().status, 'needs-owner-review');
  assert.equal(t.ctx.getWorkbookBackupStatus_().status, 'needs-owner-review');
  assert.match(t.logs.join('\n'), /Nightly workbook backup needs owner review/);
  assert.equal(t.props.SHEET_ID, 'S');
});
test('a missing recorded trigger does not appear as an active nightly schedule', () => {
  const t = fixture();t.ctx.installWorkbookBackups_();t.triggers.length = 0;
  assert.match(t.ctx.workbookBackupSummary_(t.p), /setup needs owner review/);
  assert.throws(() => t.ctx.installWorkbookBackups_());assert.equal(t.state.triggerCreates, 1);
});

// Exercise the production hook using the existing offline rollover fixture.
function integrated() {
  const t = require('./month-rollover.test.cjs').fixture({backup:true});
  t.props.BACKUP_FOLDER_ID = 'B';
  const owner = () => ({getEmail:() => 'synthetic-owner@example.invalid'});
  t.ctx.Session.getEffectiveUser = owner;
  t.root.getOwner = owner;
  const folder = {getId:() => 'B', getOwner:owner, isTrashed:() => false, getSharingAccess:() => 'private',
    getEditors:() => [], getViewers:() => [], getFilesByName:name => iterator([...t.files.values()].filter(f => f.name === name && f.parent === folder))};
  function decorate(file) { file.isTrashed = () => false; file.getMimeType = () => mime; file.getParents = () => iterator(file.parent ? [file.parent] : []); return file; }
  const getFile = t.ctx.DriveApp.getFileById, getFolder = t.ctx.DriveApp.getFolderById;
  t.ctx.DriveApp.getFileById = id => decorate(getFile(id));
  t.ctx.DriveApp.getFolderById = id => id === 'B' ? folder : getFolder(id);
  const source = t.files.get('S'), copy = source.makeCopy;
  source.makeCopy = (name, destination) => { assert.equal(t.props.SHEET_ID, 'S'); const f = copy.call(source, name, t.root); f.parent = destination; return decorate(f); };
  const monthSource = fs.readFileSync(path.join(root, 'apps-script/Month.gs'), 'utf8');
  const marker = '    // This one property write is the atomic active-workbook switch, after copy verification.';
  assert.equal(monthSource.split(marker).length, 2);
  assert.ok(monthSource.indexOf('backupBeforeMonthSwitch_(p,pending);') < monthSource.indexOf(marker));
  return {t, folder};
}
test('actual startMonth backs up populated old data before activating the blank new month', () => {
  const {t} = integrated(), before = new Map(t.ss.tabs['Homer Glen'].cells);
  t.ss.tabs['Homer Glen'].set(2, 3, 'Invented retained job'); before.set('2,3', 'Invented retained job');
  const r = t.ctx.startMonth({token:'t', year:2026, month:11, expectedSheetId:'S'});
  assert.equal(r.status, 'ok', r.message); assert.equal(t.props.SHEET_ID, 'C1'); assert.equal(t.operations.copies, 2);
  assert.deepEqual(t.sheets.get('C2').tabs['Homer Glen'].cells, before);
  assert.deepEqual(t.ss.tabs['Homer Glen'].cells, before); assert.equal(t.sheets.get('C1').tabs['Homer Glen'].get(2, 3), '');
});
test('backup failure in actual startMonth keeps the old workbook active', () => {
  const {t, folder} = integrated(); folder.getViewers = () => [{}];
  const r = t.ctx.startMonth({token:'t', year:2026, month:11, expectedSheetId:'S'});
  assert.equal(r.status, 'error'); assert.match(r.message, /backup did not complete/);
  assert.equal(t.props.SHEET_ID, 'S'); assert.equal(t.operations.copies, 1);
});
test('actual rollover recovery after pointer activation reuses the original full backup', () => {
  const {t} = integrated(), getProps = t.ctx.PropertiesService.getScriptProperties;
  let fail = true;
  t.ctx.PropertiesService.getScriptProperties = () => {
    const p = getProps(); const set = p.setProperty;
    p.setProperty = (key, value) => {if(key === 'CURRENT_WORKBOOK_MONTH' && fail){fail = false;throw Error('Synthetic metadata failure');}return set(key, value);};
    return p;
  };
  const req = {token:'t', year:2026, month:11, expectedSheetId:'S'};
  assert.equal(t.ctx.startMonth(req).status, 'error');assert.equal(t.props.SHEET_ID, 'C1');assert.equal(t.operations.copies, 2);
  const r = t.ctx.startMonth(req);assert.equal(r.status, 'ok', r.message);assert.equal(t.operations.copies, 2);
  assert.equal(t.props.TEMPLATE_ID, 'T');assert.equal(t.props.ROLLOVER_PENDING, undefined);
});
console.log(passed + ' workbook-backup tests passed');
