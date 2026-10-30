#!/usr/bin/env node
/**
 * Offline regression tests for the Apps Script code. No network, no Google, no API key.
 * Loads apps-script/*.gs into a VM with in-memory fakes for SpreadsheetApp etc.
 * All data is synthetic (no customer data).
 *
 *   node tests/offline.test.cjs
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..', 'apps-script');
const SCRIPT_TZ = 'America/Chicago'; // appsscript.json timeZone
const LEGACY_HEADERS = {
  screens: ['Date in','Name','Date out','Ticket #','Uni/In','Screening','LB Earn','Spline','Spl Earn','Extras','Earning'],
  windows: ['Date in','Name','Date out','Ticket #','S/W','Glass Price','LB Price/ Earn','Spl Earn','Other','Other Earn']
};
const columnName = n => { let s=''; for(;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s; };
const columnNumber = s => [...s].reduce((n,c)=>n*26+c.charCodeAt(0)-64,0);

// ---------- fakes ----------
class Sheet {
  constructor(name, screenRows = 750) {
    this.name = name; this.cells = new Map(); this.notes = new Map(); this.bg = new Map();
    this.validations=new Map();this.formats=new Map();this.widths=new Map();this.merges=[];
    this.maxColumns=26;this.frozenColumns=0;this.frozenRows=0;this.insertions=[];this.devMeta=[];
    LEGACY_HEADERS.screens.forEach((h,i)=>this.set(1,i+2,h));
    LEGACY_HEADERS.windows.forEach((h,i)=>this.set(1,i+14,h));
    for (let r = 2; r <= screenRows; r++) {
      this.set(r, 1, r - 1);                 // A: row counter marks the screens block
      this.set(r, 9, `=F${r}*0.07`);         // I: Spline (formula, must survive)
      this.set(r, 10, `=F${r}*0.01`);        // J: Spl Earn
    }
    this.set(screenRows + 4, 8, `=SUM(H2:H${screenRows})`);
    for (let r = 2; r <= 250; r++) { this.set(r, 18, 'W'); this.set(r,13,r-1); }
    this.maxRows = screenRows + 4;
  }
  key(r, c) { return r + ',' + c; }
  get(r, c) { const v = this.cells.get(this.key(r, c)); return v === undefined ? '' : v; }
  set(r, c, v) { this.cells.set(this.key(r, c), v); }
  getMaxRows() { return this.maxRows; }
  getLastRow() { let m = 0; for (const k of this.cells.keys()) m = Math.max(m, +k.split(',')[0]); return m; }
  appendRow(a) { const r = this.getLastRow() + 1; a.forEach((v, i) => this.set(r, i + 1, v)); this.maxRows = Math.max(this.maxRows, r); }
  getName(){return this.name;}
  getIndex(){return Object.values(this.ss.tabs).indexOf(this)+1;}
  getMaxColumns(){return this.maxColumns;}
  getFrozenRows(){return this.frozenRows;}
  getFrozenColumns(){return this.frozenColumns;}
  setFrozenRows(n){this.frozenRows=n;}
  setFrozenColumns(n){this.frozenColumns=n;}
  setColumnWidth(c,n){this.widths.set(c,n);}
  getDataRange(){let col=1;for(const k of this.cells.keys())col=Math.max(col,+k.split(',')[1]);return this.getRange(1,1,Math.max(1,this.getLastRow()),col);}
  insertColumnAfter(after){
    this.insertions.push(after);this.maxColumns++;
    for(const key of ['cells','notes','bg','validations','formats']){
      const shifted=new Map();for(const [k,v] of this[key]){const [r,c]=k.split(',').map(Number);shifted.set(this.key(r,c>after?c+1:c),v);}this[key]=shifted;
    }
    this.widths=new Map([...this.widths].map(([c,v])=>[c>after?c+1:c,v]));
    this.merges=this.merges.map(m=>({...m,col:m.col>after?m.col+1:m.col,cols:m.col<=after&&m.col+m.cols-1>after?m.cols+1:m.cols}));
    const sheets=this.ss?this.ss.getSheets():[this];
    for(const sh of sheets)for(const [k,v] of sh.cells){if(typeof v!=='string'||!v.startsWith('='))continue;
      sh.cells.set(k,v.replace(/(?:(?:'([^']+)'|([A-Za-z_][A-Za-z0-9_]*))!)?(\$?)([A-Z]{1,3})(\$?\d+)/g,(whole,quoted,plain,absolute,col,row)=>{
        const target=quoted||plain;const n=columnNumber(col);
        if((target?target===this.name:sh===this)&&n>after)return whole.slice(0,whole.length-absolute.length-col.length-row.length)+absolute+columnName(n+1)+row;
        return whole;
      }));
    }
    if(this.failAfterInsert){this.failAfterInsert=false;throw Error('Synthetic interruption after insertion');}
  }
  // Row-level developer metadata, as Apps Script allows it (whole rows only, via A1 "5:5").
  createDeveloperMetadataFinder(){const s=this;let key=null;return{withKey(k){key=k;return this;},find(){if(s.failMetadataRead)throw Error('Synthetic metadata failure');
    return s.devMeta.filter(m=>!key||m.key===key).map(m=>({getKey:()=>m.key,getValue:()=>m.value,getLocation:()=>({getRow:()=>({getRow:()=>m.row})}),remove(){s.devMeta=s.devMeta.filter(x=>x!==m);}}));}};}
  getRange(r, c, nr = 1, nc = 1) {
    const s = this;
    if (typeof r === 'string') { const m = /^(\d+):(\d+)$/.exec(r); assert.ok(m && m[1] === m[2], 'only whole single rows take metadata: ' + r);
      return { addDeveloperMetadata(k, v) { if (s.failMetadata) throw Error('Synthetic metadata failure'); s.devMeta.push({ key: k, value: v, row: Number(m[1]) }); } }; }
    const range = {
      getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => s.get(r + i, c + j))),
      getDisplayValues: () => range.getValues().map(row=>row.map(v=>String(v??''))),
      getFormulas: () => range.getValues().map(row=>row.map(v=>typeof v==='string'&&v.startsWith('=')?v:'')),
      getNote:()=>s.notes.get(s.key(r,c))||'',
      getNotes:()=>Array.from({length:nr},(_,i)=>Array.from({length:nc},(_,j)=>s.notes.get(s.key(r+i,c+j))||'')),
      getMergedRanges:()=>s.merges.filter(m=>m.row<=r+nr-1&&m.row+m.rows-1>=r&&m.col<=c+nc-1&&m.col+m.cols-1>=c).map(m=>({getRow:()=>m.row,getColumn:()=>m.col,getNumRows:()=>m.rows,getNumColumns:()=>m.cols})),
      setValues: v => { v.forEach((row, i) => row.forEach((x, j) => s.set(r + i, c + j, x))); return range; },
      setValue: v => { s.set(r, c, v); return range; },
      setNumberFormat: f => {for(let i=0;i<nr;i++)for(let j=0;j<nc;j++)s.formats.set(s.key(r+i,c+j),f);return range;},
      setDataValidation: f => {for(let i=0;i<nr;i++)for(let j=0;j<nc;j++){const k=s.key(r+i,c+j);if(f===null)s.validations.delete(k);else s.validations.set(k,f);}return range;},
      copyTo: (dest,opts) => {assert.equal(opts.formatOnly,true);dest.setNumberFormat('copied-format');return range;},
      setFontWeight: () => range,
      setBackground: b => { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) s.bg.set(s.key(r + i, c + j), b); return range; },
      getBackgrounds: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => s.bg.get(s.key(r + i, c + j)) || '#ffffff')),
      setBackgrounds: g => { g.forEach((row, i) => row.forEach((b, j) => s.bg.set(s.key(r + i, c + j), b))); return range; },
      setNote: n => { s.notes.set(s.key(r, c), n); return range; }
    };
    return range;
  }
}

function workbook() {
  const tabs = {};
  for (const [t, rows] of [['18559-(500)', 750], ['18563 (37)', 350], ['18556 (43)', 750], ['18650 (60)', 350],
    ['Manhattan', 750], ['Homer Glen', 1000], ['New Lenox', 1000], ['Willowbrook', 750]]) tabs[t] = new Sheet(t, rows);
  const totals=new Sheet('Totals',1);totals.cells.clear();totals.maxRows=1;tabs.Totals=totals;
  const ss={
    tabs,
    id:'S',getId(){return this.id;},getSheets:()=>Object.values(tabs),getNumSheets:()=>Object.keys(tabs).length,
    setActiveSheet(sh){this.active=sh;return sh;},
    moveActiveSheet(pos){const all=Object.keys(tabs),name=all.find(n=>tabs[n]===this.active),order=all.filter(n=>n!==name);order.splice(pos-1,0,name);
      const copy={...tabs};for(const n of all)delete tabs[n];for(const n of order)tabs[n]=copy[n];},
    tz: SCRIPT_TZ,
    getSheetByName: n => tabs[n] || null,
    insertSheet: n => { const sh = new Sheet(n, 1); sh.cells.clear(); sh.maxRows = 1;sh.ss=ss; return (tabs[n] = sh); }, // a new tab is empty
    getSpreadsheetTimeZone() { return this.tz; },
    setSpreadsheetTimeZone(z) { this.tz = z; }
  };for(const sh of Object.values(tabs))sh.ss=ss;return ss;
}

/** Utilities.formatDate stand-in using Intl (only the patterns the code uses). */
function formatDate(d, tz, pattern) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d).map(x => [x.type, x.value]));
  if (pattern === 'yyyy-MM-dd') return `${p.year}-${p.month}-${p.day}`;
  if (pattern === 'yyyy-MM-dd_HHmm') return `${p.year}-${p.month}-${p.day}_${p.hour}${p.minute}`;
  throw new Error('formatDate pattern not faked: ' + pattern);
}

function load(opts = {}) {
  const ss = workbook();
  const template=workbook();template.id='T';
  const mails = [];
  let modelOutput = null;
  let now = opts.now || new Date('2026-10-12T20:19:00Z');
  const props = { SHARED_TOKEN: 't', ANTHROPIC_API_KEY: 'k', ALERT_EMAIL: 'a@example.com', SHEET_ID: 'S', TEMPLATE_ID:'T', ...opts.props };
  let locked = false, fetches = 0;
  class FakeDate extends Date { constructor(...a) { if (a.length) super(...a); else super(now.getTime()); } static now() { return now.getTime(); } }
  const ctx = {
    console:{log(){},error(){}}, JSON, Math, String, Number, Error, Array, Object, RegExp, Date: FakeDate,
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] || null, setProperty: (k, v) => { props[k] = v; },deleteProperty:k=>{delete props[k];} }) },
    SpreadsheetApp: { openById: id => id==='T'?template:ss, getActiveSpreadsheet: () => null,flush(){} },
    LockService: { getScriptLock: () => ({ waitLock() { if (locked) throw Error('Lock busy'); locked = true; }, releaseLock() { locked = false; } }) },
    Session: { getScriptTimeZone: () => SCRIPT_TZ },
    Utilities: { getUuid: () => 'abcdef123456', base64Decode: s => [...Buffer.from(s, 'base64')], newBlob: () => ({}), formatDate,
      DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(alg,text)=>[...require('crypto').createHash(alg).update(text).digest()] },
    UrlFetchApp: { fetch: () => { fetches++; if (opts.fetchFail) throw Error('Synthetic provider failure'); return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(modelOutput) }] }) }; } },
    MailApp: { sendEmail: (a, b) => mails.push(typeof a === 'string' ? b : a.subject) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: s => ({ setMimeType() { return this; }, getContent: () => s }) }
  };
  vm.createContext(ctx);
  for (const f of ['Extraction.gs', 'Workbook.gs', 'Code.gs', 'Layout.gs', 'Routing.gs', 'Month.gs', 'MonthArchive.gs', 'Parts.gs', 'ExtraLabor.gs', 'Backup.gs']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  const scan = x => {
    modelOutput = Object.assign({}, BASE, x);
    return JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify({ token: 't', user: 'Test', image: '/9j/AP/Z' }) } }).getContent());
  };
  return { ctx, ss, template,mails, props, scan, setNow: d => { now = d; }, fetches: () => fetches,
    setOutput: x => { modelOutput = Object.assign({}, BASE, x); }, setLocked: v => { locked = v; } };
}

const BASE = {
  is_tag: true, form_type: 'repair', item_type: 'screen', panes: null, glass_price: null, thermopane: false, window_spline: false,
  ticket_number: '1000001', store: 'HOMER', sticker_color: 'none', customer_name: 'Test Person', last_name: 'Person',
  name_unclear: false, phone: '6305550100', date: '10-8', width_in: 36, height_in: 79, billable_inches: 115,
  material: 'fiberglass', screen_color: 'black', tag_index: null, tag_count: null, screens_on_tag: 1,
  quantity_conflict: false, quantity_conflict_details: '',
  extras: null, notes: null, has_corrections: false, correction_details: null, unclear: []
};

// Excel/Sheets serial day number: days since 1899-12-30, independent of any timezone.
const serial = ymd => { const [y, m, d] = ymd.split('-').map(Number); return Date.UTC(y, m - 1, d) / 86400000 + 25569; };
const findRow = (sh, ticket, col = 5) => { for (let r = 2; r <= sh.getMaxRows(); r++) if (String(sh.get(r, col)) === ticket) return r; return -1; };
const rowsWith = (sh, ticket, col = 5) => { const out = []; for (let r = 2; r <= sh.getMaxRows(); r++) if (String(sh.get(r, col)) === ticket) out.push(r); return out; };

// ---------- tests ----------
let passed = 0, failed = 0;
function test(name, fn) {
  if(require.main!==module)return;
  try { fn(); passed++; console.log('PASS  ' + name); }
  catch (e) { failed++; console.log('FAIL  ' + name + '\n      ' + String(e.message).split('\n').join('\n      ')); }
}

test('plain repair: row written, money columns from rates, formulas intact', () => {
  const t = load(); const r = t.scan({});
  assert.equal(r.status, 'ok');
  const hg = t.ss.tabs['Homer Glen']; const row = findRow(hg, '1000001');
  assert.equal(row, 2);
  assert.deepEqual([hg.get(row, 6), hg.get(row, 7), hg.get(row, 8)], [115, 17.25, 19.55]);
  assert.equal(hg.get(row, 9), '=F2*0.07'); assert.equal(hg.get(1004, 8), '=SUM(H2:H1000)');
});

// Structured-output schema limits (Anthropic API rejects the request otherwise)
const MAX_UNION_FIELDS = 16; // nullable fields are anyOf unions; the API allows at most 16 per schema
test('schema: at most 16 union-typed (nullable) fields', () => {
  const { ctx } = load(); const props = ctx.TAG_SCHEMA.properties;
  const unions = Object.keys(props).filter(k => props[k].anyOf || Array.isArray(props[k].type));
  assert.ok(unions.length <= MAX_UNION_FIELDS,
    `${unions.length} union fields (limit ${MAX_UNION_FIELDS}): ${unions.join(', ')}. Make a new field a plain type instead.`);
});
test('schema: every property required, no extra properties, quantity_conflict_details is a plain string', () => {
  const { ctx } = load(); const sch = ctx.TAG_SCHEMA;
  assert.equal(sch.additionalProperties, false);
  assert.deepEqual([...sch.required].sort(), Object.keys(sch.properties).sort());
  assert.deepEqual(JSON.parse(JSON.stringify(sch.properties.quantity_conflict_details)), { type: 'string' });
  assert.match(ctx.SYSTEM_PROMPT, /quantity_conflict_details is always a string: use "" \(empty string\)/);
});
test('schema: request body carries the schema via output_config.format', () => {
  const { ctx } = load(); const { body } = ctx.buildRequest_('claude-sonnet-5-5', 'AAAA', 'image/jpeg');
  assert.equal(body.output_config.format.type, 'json_schema');
  assert.equal(body.output_config.format.schema, ctx.TAG_SCHEMA);
});
test('conflict with empty details string still counts (generic description)', () => {
  const { ctx } = load();
  assert.equal(ctx.quantityConflict_(Object.assign({}, BASE, { quantity_conflict: true, quantity_conflict_details: '' })), 'the form shows more than one size');
  assert.equal(ctx.quantityConflict_(Object.assign({}, BASE)), null);
});

// Formula injection: text from a tag (or the phone's device name) must never become a formula.
const FORMULA_START = /^[=+\-@\t\r]/;
function writtenCells(sheet, before) {
  const out = [];
  for (const [k, v] of sheet.cells) if (!before.has(k) || before.get(k) !== v) out.push([k, v]);
  return out;
}
test('injection: hostile text in every field is written as plain text, never a formula', () => {
  const t = load();
  const hg = t.ss.tabs['Homer Glen']; const before = new Map(hg.cells);
  const hostile = {
    ticket_number: '+1000800', last_name: '=HYPERLINK("http://evil","x")', customer_name: '@SUM(A1)',
    store: 'HOMER', phone: '-6305550100', date: '=TODAY()', extras: '=1+1', notes: '+cmd', correction_details: '-2',
    has_corrections: true, quantity_conflict_details: '', unclear: ['=bad']
  };
  t.scan(hostile);
  // device name comes from the phone, also untrusted
  const r = JSON.parse(t.ctx.doPost({ postData: { contents: JSON.stringify({ token: 't', user: '=EVIL()', image: '/9j/AP/Z' }) } }).getContent());
  assert.equal(r.status, 'ok');
  const bad = [];
  for (const [k, v] of writtenCells(hg, before)) if (typeof v === 'string' && FORMULA_START.test(v)) bad.push(`Homer Glen ${k}: ${v}`);
  const log = t.ss.tabs['Scans'];
  for (const [k, v] of log.cells) if (typeof v === 'string' && FORMULA_START.test(v)) bad.push(`Scans ${k}: ${v}`);
  assert.deepEqual(bad, [], 'cells that would become formulas');
  // ...and the text is preserved (with a leading apostrophe, which Sheets hides)
  const row = findRow(hg, "'+1000800");
  assert.ok(row > 0, 'ticket stored as text');
  assert.equal(hg.get(row, 3), `'=HYPERLINK("http://evil","x")`);
});
test('injection: safeCell_ leaves ordinary values alone', () => {
  const { ctx } = load();
  for (const v of ['Smith', '630-555-0100', '8339183', 115, 17.25, '', null, 'O\'Brien (?)']) assert.equal(ctx.safeCell_(v), v);
  assert.equal(ctx.safeCell_('=1+1'), "'=1+1");
  assert.equal(ctx.safeCell_('\t=1'), "'\t=1");
});

test('prompt: Pay Cashier slips that add parts go to extras, not corrections or conflicts', () => {
  const { ctx } = load(); const p = ctx.SYSTEM_PROMPT;
  assert.match(p, /Most other slips \(not a balance-due slip; see balance_due_qty\) just ADD parts or fees/);
  assert.match(p, /copy those lines into extras/);
  assert.match(p, /Set quantity_conflict only if it lists different screen SIZES/);
  const rule=p.slice(p.indexOf('- has_corrections:'),p.indexOf('- correction_details:'));
  assert.doesNotMatch(rule,/or "pay cashier"/i,'earlier field rule must not contradict extras rule');
  assert.match(rule,/words "Pay Cashier" alone are NOT a correction/);
  assert.match(rule,/ordinary added parts or[\s\S]*fees belong in extras, with has_corrections false/);
  assert.match(rule,/Different screen sizes\/inches must also set quantity_conflict true/);
});
test('extras-only slip: row billed normally, extras listed on Earning, no correction flag', () => {
  const t = load(); t.scan({ store: 'Lockport', sticker_color: 'red', ticket_number: '7000001', width_in: 18, height_in: 29,
    billable_inches: 47, extras: '580401 corners 4 x $4 = $16.00\n580625 cut $3.00\n54398 frame $14.99' });
  const lp = t.ss.tabs['18563 (37)']; const row = findRow(lp, '7000001');
  assert.deepEqual([lp.get(row, 6), lp.get(row, 7), lp.get(row, 8)], [47, 7.05, 7.99]);
  assert.match(lp.notes.get(row + ',12') || '', /frame \$14\.99/);
  assert.match(lp.notes.get(row + ',3'), /no structured parts evidence/, 'earnings need review without a structured quantity');
  assert.equal(t.ss.tabs.Scans.get(2,t.ctx.HEADERS.indexOf('Corrections / Refund')+1),'','ordinary extras are not corrections/refunds');
});

test('stickers: red/orange look alike, so they never place alone and never flag Lockport/Joliet', () => {
  const { ctx } = load(); const r = x => ctx.resolveStore_(x);
  // real Joliet tags: orange sticker read as red
  assert.equal(r({ store: 'Joliet', sticker_color: 'red' }).store.name, 'Joliet');
  assert.equal(r({ store: 'Joliet', sticker_color: 'red' }).flag, undefined);
  assert.equal(r({ store: 'Lockport', sticker_color: 'orange' }).flag, undefined);
  // unreadable store + red/orange: could be either, so not placed
  assert.equal(r({ store: '??', sticker_color: 'red' }).store, null);
  assert.equal(r({ store: null, sticker_color: 'orange' }).store, null);
  // a clear mismatch is still flagged, naming both possibilities
  assert.match(r({ store: 'DG', sticker_color: 'red' }).flag, /Lockport or Joliet/);
  // unambiguous colors still work as before
  assert.equal(r({ store: '79', sticker_color: 'yellow' }).store.name, 'Downers Grove');
  assert.equal(r({ store: '??', sticker_color: 'green' }).store.name, 'Plainfield');
});

// Issue 3: dates
test('date: 20:19 UTC Oct 12 is written as Oct 12 (serial, timezone-proof)', () => {
  const t = load({ now: new Date('2026-10-12T20:19:00Z') }); t.scan({});
  const hg = t.ss.tabs['Homer Glen'];
  assert.equal(hg.get(2, 2), serial('2026-10-08'), 'Date in from tag');
  assert.equal(hg.get(2, 4), serial('2026-10-12'), 'Date out');
});
test('date: 23:30 Chicago (04:30 UTC next day) is still the Chicago date', () => {
  const t = load({ now: new Date('2026-10-13T04:30:00Z') }); t.scan({});
  assert.equal(t.ss.tabs['Homer Glen'].get(2, 4), serial('2026-10-12'));
});
test('date: 00:30 Chicago is the new Chicago date', () => {
  const t = load({ now: new Date('2026-10-13T05:30:00Z') }); t.scan({});
  assert.equal(t.ss.tabs['Homer Glen'].get(2, 4), serial('2026-10-13'));
});
test('date: DST change day (Nov 1 2026, 23:00 CST) stays Nov 1', () => {
  const t = load({ now: new Date('2026-11-02T05:00:00Z') }); t.scan({});
  assert.equal(t.ss.tabs['Homer Glen'].get(2, 4), serial('2026-11-01'));
});
test('date: window rows use the same serial date', () => {
  const t = load(); t.scan({ item_type: 'window', panes: 1, width_in: null, height_in: null, billable_inches: null, ticket_number: '1000099' });
  const hg = t.ss.tabs['Homer Glen']; const row = findRow(hg, '1000099', 17);
  assert.equal(hg.get(row, 14), serial('2026-10-08')); assert.equal(hg.get(row, 16), serial('2026-10-12'));
});
test('date: a spreadsheet in a different timezone is flagged in the log', () => {
  const t = load(); t.ss.tz = 'America/Los_Angeles'; t.scan({});
  const log = t.ss.tabs['Scans']; const reason = log.get(log.getLastRow(), t.ctx.HEADERS.indexOf('Review Reason') + 1);
  assert.match(String(reason), /time ?zone/i);
});

// Issue 1: multi-screen notes must describe what was written
test('multi-screen REPAIR: one row, billing blank, note says so (not "entered as 2 rows")', () => {
  const t = load(); t.scan({ screens_on_tag: 2, ticket_number: '1000200' });
  const hg = t.ss.tabs['Homer Glen']; const rows = rowsWith(hg, '1000200');
  assert.equal(rows.length, 1, 'one row');
  assert.deepEqual([hg.get(rows[0], 6), hg.get(rows[0], 7), hg.get(rows[0], 8)], ['', '', ''], 'F/G/H blank');
  const note = hg.notes.get(rows[0] + ',3') || '';
  assert.doesNotMatch(note, /entered as 2 rows/);
  assert.match(note, /2 screens/); assert.match(note, /one row/i);
});
test('multi-screen BUILD: two rows, each with build amounts, note says two rows', () => {
  const t = load(); t.scan({ form_type: 'new_build', screens_on_tag: 2, ticket_number: '1000300', billable_inches: 102, width_in: 29, height_in: 72.4375 });
  const hg = t.ss.tabs['Homer Glen']; const rows = rowsWith(hg, '1000300');
  assert.equal(rows.length, 2);
  for (const r of rows) { assert.deepEqual([hg.get(r, 6), hg.get(r, 7), hg.get(r, 8), hg.get(r, 12)], [102, 15.3, 26.34, 1.5]); }
  assert.match(hg.notes.get(rows[0] + ',3') || '', /2 rows/);
});

// Issue 2: conflicting quantities must not be billed silently
test('conflict flagged by model (tag 100" vs slip 130"): billing blank, both values in note', () => {
  const t = load(); t.scan({ ticket_number: '1000400', width_in: 27, height_in: 73, billable_inches: 100, material: 'aluminum',
    has_corrections: true, correction_details: 'Pay Cashier slip: 2 separate screens 28x37 = 65 each, 130 total',
    quantity_conflict: true, quantity_conflict_details: 'Tag: 27x73 = 100 in. Slip: two 28x37 = 130 in.' });
  const hg = t.ss.tabs['Homer Glen']; const row = findRow(hg, '1000400');
  assert.deepEqual([hg.get(row, 6), hg.get(row, 7), hg.get(row, 8)], ['', '', '']);
  const note = hg.notes.get(row + ',3') || '';
  assert.match(note, /100/); assert.match(note, /130/);
});
test('conflict found by code (36x79 but billed 114"): billing blank, both values in note', () => {
  const t = load(); t.scan({ ticket_number: '1000500', billable_inches: 114 });
  const hg = t.ss.tabs['Homer Glen']; const row = findRow(hg, '1000500');
  assert.deepEqual([hg.get(row, 6), hg.get(row, 7), hg.get(row, 8)], ['', '', '']);
  const note = hg.notes.get(row + ',3') || '';
  assert.match(note, /114/); assert.match(note, /115/);
});
test('no conflict: billing kept', () => {
  const t = load(); t.scan({ ticket_number: '1000600' });
  const hg = t.ss.tabs['Homer Glen']; assert.equal(hg.get(findRow(hg, '1000600'), 6), 115);
});

// existing behaviour that must not regress
test('measurement-only build: inches = ceil(W) + ceil(H)', () => {
  const t = load(); t.scan({ store: 'DG', form_type: 'new_build', ticket_number: '2000001', width_in: 35.25, height_in: 79.5, billable_inches: null });
  const dg = t.ss.tabs['18559-(500)']; const row = findRow(dg, '2000001');
  assert.deepEqual([dg.get(row, 6), dg.get(row, 7), dg.get(row, 8), dg.get(row, 12)], [116, 17.4, 28.72, 1.5]);
});
test('group tickets: 1 of 2 and 2 of 2 both written; exact rescan skipped quietly', () => {
  const t = load();
  t.scan({ ticket_number: '1000700', tag_index: 1, tag_count: 2 });
  t.scan({ ticket_number: '1000700', tag_index: 2, tag_count: 2 });
  const again = t.scan({ ticket_number: '1000700', tag_index: 2, tag_count: 2 });
  assert.match(again.message, /Already scanned/);
  assert.equal(rowsWith(t.ss.tabs['Homer Glen'], '1000700').length, 2);
  assert.equal(t.mails.length, 0);
});
test('no ticket number: retained unplaced, no failure email or false notification claim', () => {
  const t = load(); const r = t.scan({ ticket_number: null, store: null, sticker_color: 'green' });
  assert.match(r.message, /no ticket number/); assert.equal(t.mails.length, 0);
  assert.doesNotMatch(r.message+' '+r.speak,/has been told|notified|will fix it/);
});
test('sticker fallback and misspelled store', () => {
  const t = load(); t.ctx; // matchStore_/resolveStore_ are pure
  assert.equal(t.ctx.resolveStore_({ store: '79', sticker_color: 'yellow' }).store.name, 'Downers Grove');
  assert.equal(t.ctx.resolveStore_({ store: 'Manhatten', sticker_color: 'none' }).store.name, 'Manhattan');
  assert.equal(t.ctx.resolveStore_({ store: '??', sticker_color: 'pink' }).store, null);
});
test('full tab: nothing written, not placed', () => {
  const t = load(); const lp = t.ss.tabs['18563 (37)'];
  for (let r = 2; r <= 350; r++) { lp.set(r, 2, 1); lp.set(r, 3, 'x'); lp.set(r, 5, 'T' + r); lp.set(r, 6, 1); }
  const r = t.scan({ store: 'Lockport', ticket_number: '3000001' });
  assert.match(r.message, /full/); assert.equal(findRow(lp, '3000001'), -1);
});

const request = overrides => ({ token: 't', user: 'Offline phone', image: '/9j/AP/Z', ...overrides });
const post = (t, req) => JSON.parse(t.ctx.doPost({postData:{contents:JSON.stringify(req)}}).getContent());
test('browser RPC and Shortcut share processing and admission counters', () => {
  const t = load({props:{MAX_SCANS_PER_MINUTE:'2'}}); t.setOutput({});
  assert.equal(t.ctx.scanTag(request()).status,'ok');
  assert.equal(post(t,request()).status,'ok');
  assert.match(t.ctx.scanTag(request()).message,/minute/);
  assert.equal(t.fetches(),2); assert.equal(JSON.parse(t.props.SCAN_LIMIT_STATE).daily,2);
});
test('missing/wrong/nonstring tokens reject on both entries without spend, mail or quota', () => {
  for(const token of [undefined,'wrong',7,null,{}]) {
    const t=load(); t.setOutput({});
    assert.equal(t.ctx.scanTag(request({token})).status,'error');
    assert.equal(post(t,request({token})).status,'error');
    assert.equal(t.fetches(),0); assert.equal(t.mails.length,0); assert.equal(t.props.SCAN_LIMIT_STATE,undefined);
  }
  const t=load({props:{SHARED_TOKEN:''}}); assert.equal(t.ctx.scanTag(request()).status,'error');
});
test('malformed JSON and oversized Shortcut envelope reject before admission', () => {
  const t=load();
  for(const contents of ['{','x'.repeat(t.ctx.MAX_IMAGE_B64+2049)]) assert.equal(JSON.parse(t.ctx.doPost({postData:{contents}}).getContent()).status,'error');
  assert.equal(t.fetches(),0); assert.equal(t.props.SCAN_LIMIT_STATE,undefined);
});
test('malformed photos and extra fields count attempts but never reach paid calls', () => {
  for(const extra of [{image:undefined},{image:{}},{image:'AAAA'},{image:'/9j/'},{image:'!bad!'},
    {image:'A'.repeat(5*1024*1024+4)},{user:{}},{other:'unrecognized'}]) {
    const t=load(); assert.equal(t.ctx.scanTag(request(extra)).status,'error');
    assert.equal(t.fetches(),0); assert.equal(JSON.parse(t.props.SCAN_LIMIT_STATE).daily,1);
  }
});
test('minute admission is rolling, including boundary, not fixed minute buckets', () => {
  const t=load({props:{MAX_SCANS_PER_MINUTE:'1'}}); t.setOutput({}); t.ctx.scanTag(request());
  t.setNow(new Date('2026-10-12T20:19:59.999Z')); assert.match(t.ctx.scanTag(request()).message,/minute/);
  t.setNow(new Date('2026-10-12T20:20:00Z')); assert.equal(t.ctx.scanTag(request()).status,'ok'); assert.equal(t.fetches(),2);
});
test('daily cap resets only at Chicago midnight and includes non-tags', () => {
  const t=load({now:new Date('2026-10-13T04:59:59Z'),props:{MAX_SCANS_PER_DAY:'1'}});
  t.setOutput({is_tag:false}); assert.equal(t.ctx.scanTag(request()).status,'error');
  assert.match(t.ctx.scanTag(request()).message,/Daily/); assert.equal(t.fetches(),1);
  t.setNow(new Date('2026-10-13T05:00:00Z')); t.setOutput({}); assert.equal(t.ctx.scanTag(request()).status,'ok');
  assert.equal(t.fetches(),2);
});
test('provider failures consume reserved admission without automatic retry', () => {
  const t=load({fetchFail:true,props:{MAX_SCANS_PER_DAY:'1'}});
  assert.equal(t.ctx.scanTag(request()).status,'error'); assert.match(post(t,request()).message,/Daily/); assert.equal(t.fetches(),1);
});
test('invalid limit settings/state fail closed without spend', () => {
  for(const props of [{MAX_SCANS_PER_DAY:'0'},{MAX_SCANS_PER_MINUTE:'101'},{MAX_SCANS_PER_DAY:'bad'},
    {SCAN_LIMIT_STATE:'bad'},{SCAN_LIMIT_STATE:'{"day":"2026-10-12","daily":-1,"recent":[]}'},
    {SCAN_LIMIT_STATE:'{"day":"2099-01-01","daily":1,"recent":[]}'}]) {
    const t=load({props}); assert.match(t.ctx.scanTag(request()).message,/could not be checked/);assert.equal(t.fetches(),0);
  }
});
test('lock contention fails closed; reservation releases before workbook lock', () => {
  const t=load();t.setOutput({});t.setLocked(true);
  assert.match(t.ctx.scanTag(request()).message,/could not be checked/);assert.equal(t.fetches(),0);
  t.setLocked(false);assert.equal(t.ctx.scanTag(request()).status,'ok');
  // Shared state survives subsequent requests rather than an in-memory per-execution counter.
  const state=JSON.parse(t.props.SCAN_LIMIT_STATE);assert.equal(state.daily,1);assert.equal(state.recent.length,1);
});
test('limit-state read/write failure prevents paid request', () => {
  for(const which of ['read','write']) {
    const t=load();t.ctx.PropertiesService.getScriptProperties=()=>({getProperty:k=>{
      if(which==='read'&&k==='SCAN_LIMIT_STATE')throw Error('storage');return t.props[k]??null;
    },setProperty(){throw Error('storage');}});
    assert.match(t.ctx.scanTag(request()).message,/could not be checked/);assert.equal(t.fetches(),0);
  }
});
test('default quotas are ten per rolling minute and three hundred per day', () => {
  const t=load(),p=t.ctx.PropertiesService.getScriptProperties();
  for(let batch=0;batch<30;batch++) {
    t.setNow(new Date(Date.parse('2026-10-12T14:00:00Z')+batch*61000));
    for(let i=0;i<10;i++)assert.equal(t.ctx.admitScan_(p),'');
    if(batch<29)assert.match(t.ctx.admitScan_(p),/minute/);
  }
  assert.match(t.ctx.admitScan_(p),/Daily/);assert.equal(JSON.parse(t.props.SCAN_LIMIT_STATE).daily,300);
});
test('overlapping reservation cannot read/write state outside the shared lock', () => {
  const t=load();let contender,once=true;const original=t.ctx.PropertiesService.getScriptProperties;
  t.ctx.PropertiesService.getScriptProperties=()=>({getProperty:k=>{
    if(k==='SCAN_LIMIT_STATE'&&once){once=false;contender=t.ctx.scanTag(request());}
    return t.props[k]??null;
  },setProperty:(k,v)=>{t.props[k]=v;}});
  t.setOutput({});assert.equal(t.ctx.scanTag(request()).status,'ok');
  assert.match(contender.message,/could not be checked/);assert.equal(t.fetches(),1);assert.equal(JSON.parse(t.props.SCAN_LIMIT_STATE).daily,1);
  t.ctx.PropertiesService.getScriptProperties=original;
});
test('authentication signal is positive only after actual token validation', () => {
  for(const mode of ['service','property']) {
    const t=load();t.ctx.PropertiesService.getScriptProperties=()=>{
      if(mode==='service')throw Error('unavailable');return {getProperty(){throw Error('unavailable');}};
    };
    const r=t.ctx.scanTag(request());assert.equal(r.authenticated,false);assert.equal(t.fetches(),0);
  }
  const denied=load();assert.equal(denied.ctx.scanTag(request({token:'wrong'})).authenticated,false);
  for(const extra of [{image:'AAAA'},{image:undefined}]) {
    const t=load();assert.equal(t.ctx.scanTag(request(extra)).authenticated,true);assert.equal(t.fetches(),0);
  }
  const limited=load({props:{MAX_SCANS_PER_DAY:'1'}});limited.setOutput({});
  assert.equal(limited.ctx.scanTag(request()).authenticated,true);assert.equal(limited.ctx.scanTag(request()).authenticated,true);
});
test('review signal reaches the page while Shortcut JSON interface stays unchanged', () => {
  const t=load();t.setOutput({has_corrections:true,correction_details:'Synthetic refund'});
  const r=t.ctx.scanTag(request());assert.equal(r.authenticated,true);assert.equal(r.needsReview,true);
  const json=post(t,request({image:'AAAA'}));assert.deepEqual(Object.keys(json).sort(),['message','scanId','speak','status']);
});
test('synthetic actual correction stays flagged, unlike ordinary extras-only slips', () => {
  const t=load();t.setOutput({has_corrections:true,correction_details:'Synthetic credit for returned parts',extras:'Extra corners'});
  const r=t.ctx.scanTag(request());assert.equal(r.needsReview,true);assert.match(r.message,/Check on the sheet:/);
});
test('provider failure returns phone error with zero emails and no secrets/customer text in diagnostic', () => {
  const t=load({fetchFail:true}),diagnostics=[];t.ctx.console.error=s=>diagnostics.push(s);
  const r=t.scan({});assert.equal(r.status,'error');assert.equal(t.mails.length,0);assert.equal(diagnostics.length,1);
  assert.match(diagnostics[0],/^Scanner event: scan-failed; scanId=/);
  assert.doesNotMatch(diagnostics[0],/Test Person|630555|ANTHROPIC|SHARED_TOKEN|Synthetic provider failure/);
});
test('no server file calls MailApp and send-mail scope is removed; legacy rollover/trigger cannot notify', () => {
  const t=load();for(const f of fs.readdirSync(ROOT).filter(f=>f.endsWith('.gs')))assert.doesNotMatch(fs.readFileSync(path.join(ROOT,f),'utf8'),/MailApp\s*\./);
  const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'appsscript.json'),'utf8'));assert.ok(!manifest.oauthScopes.some(s=>s.endsWith('/script.send_mail')));
  assert.throws(()=>t.ctx.startNewMonth_(),/disabled/);assert.throws(()=>t.ctx.installMonthlyTrigger_(),/disabled/);assert.equal(t.mails.length,0);
});
test('only intended public server functions are remotely callable', () => {
  const names=[];
  for(const f of fs.readdirSync(ROOT).filter(f=>f.endsWith('.gs'))) {
    const s=fs.readFileSync(path.join(ROOT,f),'utf8');
    for(const m of s.matchAll(/^function (\w+)\(/gm)) if(!m[1].endsWith('_')) names.push(m[1]);
  }
  assert.deepEqual(names.sort(),['doGet','doPost','getMonthSettings','scanTag','startMonth']);
});
test('HTML page served, explicit health endpoint preserved', () => {
  const t=load();let name,meta,title;
  t.ctx.HtmlService={createHtmlOutputFromFile:n=>{name=n;return {setTitle:v=>{title=v;return {addMetaTag:(k,v)=>{meta=[k,v];return 'html';}};}};}};
  assert.equal(t.ctx.doGet({parameter:{}}),'html');assert.equal(name,'Upload');assert.equal(title,'Screen Tag Scanner');
  assert.deepEqual(meta,['viewport','width=device-width, initial-scale=1']);
  assert.match(t.ctx.doGet({parameter:{health:'1'}}).getContent(),/Screen tag scanner is running/);
});
test('a ticket that is not 7 digits is flagged (a staple hid the leading 8 on a real Homer tag)', () => {
  const t = load();
  const r = t.scan({ ticket_number: '339725' });
  assert.doesNotMatch(r.message, /Check on the sheet:/, 'one value to glance at, not a row flag');
  assert.match(t.ss.tabs['Homer Glen'].notes.get('2,5'), /Glance at this value:\n- Ticket # has 6 digits \(Ace tickets have 7\)/);
  assert.equal(t.ss.tabs['Homer Glen'].bg.get('2,5'), t.ctx.HINT_COLOR);
  assert.notEqual(t.ss.tabs['Homer Glen'].bg.get('2,2'), t.ctx.FLAG_COLOR, 'row stays white');
  assert.equal(t.ss.tabs['Homer Glen'].get(2, 5), '339725', 'written as read, never guessed');
  const u = load();
  assert.equal(u.scan({ ticket_number: '8339725' }).message.includes('Check on the sheet:'), false);
  assert.equal(u.ss.tabs['Homer Glen'].bg.get('2,5'), undefined);
  assert.match(t.ctx.SYSTEM_PROMPT, /staple,/); assert.match(t.ctx.SYSTEM_PROMPT, /blank rows under the printed SKU list/);
});

test('settle inches: $ totals that agree with width + height bill the job (real Plainfield tag 7547)', () => {
  const t = load(), sh = t.ss.tabs['18556 (43)'];
  const r = t.scan({ store: 'Plainfield', ticket_number: '7547000', material: 'aluminum', width_in: 40, height_in: 47,
    billable_inches: 47, qty_rows: '47, 67, 87', line_totals: '16.53, 6.09, 17.40' });
  assert.equal(sh.get(2, 6), 87); assert.equal(sh.get(2, 7), 16.53); assert.equal(sh.get(2, 8), 17.4);
  assert.match(sh.notes.get('2,3'), /Inches 87" taken from the written \$ totals \(\$16\.53, \$6\.09, \$17\.40\)/);
  assert.match(r.message, /Check on the sheet:/, 'still yellow so she glances at it');
});

test('settle inches: consistent QTY rows bill even when the size is misread (real Homer tag, 46 read as 96)', () => {
  const t = load(), sh = t.ss.tabs['Homer Glen'];
  t.scan({ ticket_number: '8339728', width_in: 32, height_in: 96, billable_inches: 78, qty_rows: '78, 78, 78', line_totals: '' });
  assert.equal(sh.get(2, 6), 78); assert.equal(sh.get(2, 7), 11.7); assert.equal(sh.get(2, 8), 13.26);
  assert.match(sh.notes.get('2,3'), /Billed from QTY-row majority 78" \(rows read 78, 78, 78\); rounded written size is 128"/);
  // A clear majority with one odd row still bills, and says which rows it saw.
  const u = load(); u.scan({ ticket_number: '8339728', width_in: 32, height_in: 96, billable_inches: 78, qty_rows: '78, 70, 78' });
  assert.equal(u.ss.tabs['Homer Glen'].get(2, 6), 78); assert.match(u.ss.tabs['Homer Glen'].notes.get('2,3'), /rows read 78, 70, 78/);
});

test('settle inches: still held when the tag cannot settle it', () => {
  const held = (x) => { const t = load(); t.scan({ ticket_number: '8339001', width_in: 32, height_in: 96, billable_inches: 78, ...x });
    const sh = t.ss.tabs['Homer Glen']; return { ui: sh.get(2, 6), note: sh.notes.get('2,3') || '' }; };
  for (const x of [
    { qty_rows: '78, 70', line_totals: '' },                       // no majority
    { qty_rows: '7?, 7?, 78', line_totals: '' },                   // unreadable rows
    { qty_rows: '', line_totals: '' },                             // nothing to go on
    { qty_rows: '78, 78, 78', line_totals: '11.70, 5.46, 13.60' }, // totals disagree with each other
    { qty_rows: '78, 78, 78', quantity_conflict: true, quantity_conflict_details: 'Slip lists another size' }, // explicit conflict
  ]) { const r = held(x); assert.equal(r.ui, '', JSON.stringify(x)); assert.match(r.note, /Inches left blank, values disagree/, JSON.stringify(x)); }
  // No conflict at all: unchanged behavior.
  const t = load(); t.scan({ ticket_number: '8339002', qty_rows: '115, 115, 115', line_totals: '' });
  assert.equal(t.ss.tabs['Homer Glen'].get(2, 6), 115); assert.equal(t.ss.tabs['Homer Glen'].notes.get('2,3'), undefined);
});

test('review levels: money/placement turns the row yellow; one-value doubts tint one cell; phone stays in Scans', () => {
  const t = load(), tier = x => { const v = t.ctx.reviewTier_(x); return v.tier + (v.field ? ':' + v.field : ''); };
  // Wording taken from real October 2026 Review Reasons (no customer data).
  const cases = {
    'Inches left blank, values disagree: size 40 x 47 = 87" but billed QTY is 47"': 'row',
    'Parts quantity/identity was flagged unclear: earnings need manual review': 'row',
    'Window: number of panes not found': 'row',
    'store partly covered by sticker, read as Plainfield': 'row',
    'Ticket already on the Homer Glen tab: another tag in the group, or a duplicate?': 'row',
    'Correction/refund: refund of $20 written on slip': 'row',
    'something entirely new the code has never seen': 'row',
    'ticket number digits 1234567 partially uncertain': 'cell:TICKET',
    'Ticket # has 4 digits (Ace tickets have 7): a staple may hide a digit, check the tag': 'cell:TICKET',
    'Correction/refund: Ticket number and phone area digits were written over/crossed out and rewritten.': 'cell:TICKET',
    'Qty 1 of 1 box is written as single vertical strokes': 'cell:SEQUENCE',
    'tag_count could be 9 or 7': 'cell:SEQUENCE',
    'Correction/refund: Qty box has crossed-out original values, rewritten as 2 of 2.': 'cell:SEQUENCE',
    'Tag date missing: Date in left blank; enter it from the tag': 'cell:DATE_IN',
    'date: could be 10/16 or 10/1': 'cell:DATE_IN',
    'No customer name': 'cell:NAME',
    'Area code 517 is not local (misread?)': 'log',
    'phone: digits partly unclear': 'log',
    'Correction/refund: Phone number crossed out and rewritten': 'log',
    'Correction/refund: Customer name has a crossed-out first word': 'log',
    'height_in: staple covers part of the second digit, read as 75': 'log',
    'Tag x of N is in Scans only until the sequence-column migration': 'log',
  };
  for (const [reason, want] of Object.entries(cases)) assert.equal(tier(reason), want, reason);
  // On the sheet: a phone-only doubt leaves the row clean, and the phone isn't told it was flagged.
  const r = t.scan({ ticket_number: '8339500', phone: '5175550100' });
  const sh = t.ss.tabs['Homer Glen'];
  assert.doesNotMatch(r.message, /Check on the sheet:/); assert.equal(sh.bg.get('2,2'), undefined); assert.equal(sh.notes.get('2,3'), undefined);
  const log = t.ss.tabs.Scans, H = t.ctx.HEADERS;
  assert.equal(log.get(2, H.indexOf('Needs Review') + 1), '', 'not marked in Scans either');
  assert.match(log.get(2, H.indexOf('Review Reason') + 1), /Area code 517/, 'but still listed there');
});

test('store tabs named by store ("Downers Grove") work the same as the template numbers ("18559-(500)")', () => {
  const t = load();
  for (const [from, to] of [['18559-(500)', 'Downers Grove'], ['18556 (43)', 'Plainfield']]) {
    const sh = t.ss.tabs[from]; delete t.ss.tabs[from]; sh.name = to; t.ss.tabs[to] = sh;
  }
  const r = t.scan({ store: 'DG', ticket_number: '7221999' });
  assert.match(r.message, /→ Downers Grove/); assert.equal(t.ss.tabs['Downers Grove'].get(2, 5), '7221999');
  assert.match(t.scan({ store: 'Plainfield', ticket_number: '6567999' }).message, /→ Plainfield/);
});

test('ticket book: a ticket that doesn\'t fit the store\'s sequence gets a likely fix in its note (real October misreads)', () => {
  const t = load(), sh = t.ss.tabs['Homer Glen'];
  for (const [i, tk] of ['8339712', '8339736', '8339740'].entries()) t.scan({ ticket_number: tk, width_in: 20 + i, billable_inches: 99 + i });
  const note = (tk, extra) => { const u = t; u.scan({ ticket_number: tk, ...extra }); const row = rowsWith(sh, tk)[0]; return { row, note: sh.notes.get(row + ',5') || '', value: sh.get(row, 5) }; };
  let r = note('339725', { width_in: 30, billable_inches: 109 });
  assert.match(r.note, /likely 8339725/); assert.equal(r.value, '339725', 'value is never changed');
  r = note('6339751', { width_in: 31, billable_inches: 110 });
  assert.match(r.note, /looks off for this store \(8339xxx\): likely 8339751/);
  r = note('8339735', { width_in: 32, billable_inches: 111 });
  assert.doesNotMatch(r.note, /likely/, 'a ticket that fits the book gets no hint');
  const d = load(), dg = d.ss.tabs['18559-(500)'];
  for (const [i, tk] of ['8159012', '8159068'].entries()) d.scan({ store: 'DG', ticket_number: tk, width_in: 20 + i, billable_inches: 99 + i });
  d.scan({ store: 'DG', ticket_number: '815901', width_in: 40, billable_inches: 119 });
  assert.match(dg.notes.get(rowsWith(dg, '815901')[0] + ',5'), /815901 is missing a digit; this store's tickets look like 8159xxx/);
});

test('a 4-digit ticket (handwritten last digits, Plainfield) gets the full 7-digit suggestion; two series are both named', () => {
  const t = load(), sh = t.ss.tabs['18556 (43)'];
  for (const [i, tk] of ['6567512', '6567633'].entries()) t.scan({ store: 'Plainfield', ticket_number: tk, width_in: 20 + i, billable_inches: 99 + i });
  t.scan({ store: 'Plainfield', ticket_number: '7580', width_in: 30, billable_inches: 109 });
  const row = rowsWith(sh, '7580')[0];
  assert.match(sh.notes.get(row + ',5'), /7580 looks like only the last 4 digits: likely 6567580, check the tag/);
  assert.equal(sh.get(row, 5), '7580', 'value is never changed');
  assert.match(sh.notes.get(row + ',5'), /only the handwritten last digits/);
  t.scan({ store: 'Plainfield', ticket_number: '7487560', width_in: 31, billable_inches: 110 });
  t.scan({ store: 'Plainfield', ticket_number: '7590', width_in: 32, billable_inches: 111 });
  assert.match(sh.notes.get(rowsWith(sh, '7590')[0] + ',5'), /could be 6567590 or 7487590 \(more than one ticket series\)/);
});

test('a tag rescanned with a different ticket reading is flagged as a possible duplicate (real New Lenox case)', () => {
  const t = load(), sh = t.ss.tabs['New Lenox'];
  const tag = { store: 'New Lenox', last_name: 'Synthetic', width_in: 22, height_in: 54, billable_inches: 76, tag_index: 1, tag_count: 1 };
  t.scan({ ...tag, ticket_number: '7707611' });
  const r = t.scan({ ...tag, ticket_number: '7702611' });
  assert.match(r.message, /Check on the sheet:/);
  assert.match(sh.notes.get('3,3'), /Possible duplicate: same name, size and Tag x of N as New Lenox screens row 2 \(ticket read as 7707611\)/);
  const u = load(); u.scan({ ...tag, ticket_number: '7707611' }); u.scan({ ...tag, ticket_number: '7707612', tag_index: 2, tag_count: 2 });
  assert.equal(u.ss.tabs['New Lenox'].notes.get('3,3'), undefined, 'a different tag in the group is not a duplicate');
});

test('saved photos: a Drive failure never stops the scan; file names carry no customer name; cleanup once a day', () => {
  const t = load({ props: { SAVE_IMAGES: 'true' } });
  t.ctx.DriveApp = undefined; // Drive unavailable
  const r = t.scan({ ticket_number: '8339601' });
  assert.equal(r.status, 'ok'); assert.match(r.message, /Added/);
  const u = load({ props: { SAVE_IMAGES: 'true' } }), made = [], trashed = [];
  // Ages use the script's frozen clock, not the real one (the real clock made this fail after 2026-10-22).
  const file = (name, ageDays) => ({ getDateCreated: () => new Date(u.ctx.Date.now() - ageDays * 864e5), setTrashed() { trashed.push(name); } });
  const old = [file('old', 40), file('new', 2)];
  const folder = { createFile: b => { made.push(b.name); return { getUrl: () => 'https://drive.example/' + made.length }; },
    getFiles: () => { let i = 0; return { hasNext: () => i < old.length, next: () => old[i++] }; } };
  u.ctx.DriveApp = { getFoldersByName: () => { let done = false; return { hasNext: () => !done, next: () => { done = true; return folder; } }; } };
  u.ctx.Utilities.newBlob = (bytes, type, name) => ({ name });
  u.scan({ ticket_number: '8339602', last_name: 'Synthname' }); u.scan({ ticket_number: '8339603', last_name: 'Synthname', width_in: 30, billable_inches: 109 });
  assert.equal(made.length, 2); assert.doesNotMatch(made.join(' '), /Synthname/); assert.match(made[0], /^\d{4}-\d{2}-\d{2}_\d{4}_[a-f0-9]+\.jpg$/);
  assert.deepEqual(trashed, ['old'], 'only the 40-day-old photo, and only once that day');
  assert.equal(u.ss.tabs.Scans.get(2, u.ctx.HEADERS.indexOf('Photo') + 1), 'https://drive.example/1');
});

test('the Scans log is created as, and kept as, the last tab', () => {
  const t = load();
  t.scan({ ticket_number: '7800001' });
  let names = t.ss.getSheets().map(s => s.getName());
  assert.equal(names.at(-1), 'Scans');
  // An older workbook where Scans landed up front gets tidied on the next scan; nothing else moves.
  const all = Object.keys(t.ss.tabs), copy = { ...t.ss.tabs };
  for (const n of all) delete t.ss.tabs[n];
  for (const n of ['Scans', ...all.filter(n => n !== 'Scans')]) t.ss.tabs[n] = copy[n];
  t.scan({ ticket_number: '7800002' });
  names = t.ss.getSheets().map(s => s.getName());
  assert.deepEqual(names, [...all.filter(n => n !== 'Scans'), 'Scans']);
  assert.equal(t.ss.tabs.Scans.get(3, t.ctx.COL.TICKET), '7800002', 'log rows intact after the move');
});

test('interrupted save: Scans row is written first, so a retry never adds a second store row', () => {
  for(const migrated of [false,true]){
  const t = recoveryFixture(migrated), C = t.ctx.COL, sh = t.ss.tabs['Homer Glen'], ticketCol=t.ctx.storeLayout_(sh).screens.TICKET;
  // Store row lands, then the execution dies before the final log update.
  const real = t.ctx.writeToStoreTab_;
  t.ctx.writeToStoreTab_ = (...a) => {
    assert.equal(t.ss.tabs.Scans.get(2,C.WRITTEN_TO),'PENDING');assert.equal(t.ss.tabs.Scans.bg.get('2,1'),t.ctx.UNPLACED_COLOR);
    real(...a); throw Error('Synthetic timeout after store write');
  };
  const r1 = t.scan({ ticket_number: '7700001' }), log = t.ss.tabs.Scans;
  assert.equal(r1.status, 'error');
  assert.equal(log.get(2, C.WRITTEN_TO), 'INTERRUPTED');
  assert.equal(log.bg.get('2,1'),t.ctx.UNPLACED_COLOR);
  assert.equal(rowsWith(sh, '7700001',ticketCol).length, 1);
  t.ctx.writeToStoreTab_ = real;
  const next=t.scan({ticket_number:'7700002'});assert.equal(next.status,'ok');assert.match(next.message,/1 earlier tag didn't save/);assert.match(next.message,/may be partly saved, so check its store tab first/);assert.doesNotMatch(next.message,/needs? placing/);
  const r2 = t.scan({ ticket_number: '7700001' });
  assert.match(r2.message, /Already scanned/);
  assert.equal(rowsWith(sh, '7700001',ticketCol).length, 1, 'retry did not duplicate the store row');
  assert.match(log.get(log.getLastRow(), t.ctx.HEADERS.indexOf('Review Reason') + 1), /interrupted; check the store tab/);
  // A killed execution leaves PENDING; that also blocks a duplicate.
  log.set(2, C.WRITTEN_TO, 'PENDING');
  assert.match(t.scan({ ticket_number: '7700001' }).message, /Already scanned/);
  assert.equal(rowsWith(sh, '7700001',ticketCol).length, 1);
  }
});

test('unplaced scans are counted on every phone reply until their Needs Review YES is cleared', () => {
  const t = load(), review = t.ctx.HEADERS.indexOf('Needs Review') + 1;
  const r1 = t.scan({ ticket_number: '7700010', store: 'NOWHERE' }), log = t.ss.tabs.Scans;
  assert.match(r1.message, /NOT PLACED|not recognised/);
  assert.doesNotMatch(r1.message, /earlier (?:scan|tag)/, 'the scan itself is not counted as earlier');
  assert.equal(log.bg.get('2,1'), t.ctx.UNPLACED_COLOR);
  const r2 = t.scan({ ticket_number: '7700011' });
  assert.match(r2.message, /1 earlier tag didn't save/);
  t.scan({ ticket_number: '7700011' }); // exact rescan: not counted
  const r3 = t.scan({ ticket_number: '7700012', store: 'NOWHERE' });
  assert.match(r3.message, /1 earlier tag didn't save/);
  assert.match(t.scan({ ticket_number: '7700013' }).message, /2 earlier tags didn't save/);
  log.set(2, review, ''); log.set(5, review, '');      // Kirsten placed both by hand
  assert.doesNotMatch(t.scan({ ticket_number: '7700014' }).message, /earlier (?:scan|tag)/);
});

function recoveryFixture(migrated) {
  const t=load(),sh=t.ss.tabs['Homer Glen'];
  if(migrated){sh.insertColumnAfter(15);sh.set(1,16,'Tag x of N');sh.insertColumnAfter(3);sh.set(1,4,'Tag x of N');}
  return t;
}
test('completion interruption stays orange and requires checking existing rows, never automatic placement',()=>{
  for(const migrated of [false,true]){
    const t=recoveryFixture(migrated),log=t.ctx.getScansSheet_(t.ss),sh=t.ss.tabs['Homer Glen'],c=t.ctx.storeLayout_(sh).screens,range=log.getRange.bind(log);let fail=true;
    const formulas=[...sh.cells].filter(([,v])=>typeof v==='string'&&v.startsWith('='));
    log.getRange=(r,col,n=1,m=1)=>{const x=range(r,col,n,m);if(r===2&&col===1&&m===t.ctx.HEADERS.length){const set=x.setValues;x.setValues=v=>{if(fail){fail=false;throw Error('Synthetic completion interruption');}return set(v);};}return x;};
    assert.equal(t.scan({ticket_number:'RECOVER'}).status,'error');assert.equal(rowsWith(sh,'RECOVER',c.TICKET).length,1);
    assert.equal(log.get(2,t.ctx.COL.WRITTEN_TO),'PENDING');assert.equal(log.bg.get('2,1'),t.ctx.UNPLACED_COLOR);
    log.getRange=range;
    const next=t.scan({ticket_number:'NEXT'});assert.equal(next.status,'ok');assert.match(next.message,/1 earlier tag didn't save/);
    assert.match(next.message,/may be partly saved, so check its store tab first/);assert.doesNotMatch(next.message,/needs? placing/);
    assert.equal(log.bg.get('3,1'),null,'clean completion clears the initial orange pending fill');
    assert.match(t.scan({ticket_number:'RECOVER'}).message,/Already scanned/);assert.equal(rowsWith(sh,'RECOVER',c.TICKET).length,1);
    for(const [k,v] of formulas)assert.equal(sh.cells.get(k),v);
  }
});
test('optional count read failure after durable completion preserves confirmed success, including rescans',()=>{
  for(const migrated of [false,true]){
    const t=recoveryFixture(migrated),sh=t.ss.tabs['Homer Glen'],c=t.ctx.storeLayout_(sh).screens;
    t.ctx.unplacedRows_=()=>{throw Error('Synthetic count read failure');};
    t.setOutput({ticket_number:'COUNT'});const r=t.ctx.scanTag(request());assert.equal(r.status,'ok');assert.match(r.message,/Added/);assert.match(r.message,/Could not check for earlier tags/);assert.doesNotMatch(r.message,/Save could not be confirmed/);
    assert.equal(rowsWith(sh,'COUNT',c.TICKET).length,1);assert.match(t.ss.tabs.Scans.get(2,t.ctx.COL.WRITTEN_TO),/screens row/);assert.equal(t.ss.tabs.Scans.bg.get('2,1'),null);
    const again=t.ctx.scanTag(request());assert.equal(again.status,'ok');assert.match(again.message,/Already scanned/);assert.equal(rowsWith(sh,'COUNT',c.TICKET).length,1);
  }
});
test('unresolved count uses controlled state, never the phrase already scanned in OCR review text',()=>{
  for(const migrated of [false,true]){
    const t=recoveryFixture(migrated);t.scan({ticket_number:'WAIT',store:'NOWHERE',has_corrections:true,correction_details:'already scanned; cancel duplicate'});
    const log=t.ss.tabs.Scans;assert.equal(log.get(2,t.ctx.COL.WRITTEN_TO),'NOT PLACED');assert.equal(t.ctx.unplacedCount_(log,0),1);
    t.scan({ticket_number:'CONTROL'});t.scan({ticket_number:'CONTROL'});assert.equal(log.get(4,t.ctx.COL.WRITTEN_TO),'RESCAN');assert.equal(t.ctx.unplacedCount_(log,0),1,'genuine controlled rescan is excluded');
    assert.match(t.scan({ticket_number:'AFTER'}).message,/1 earlier tag didn't save/);
    log.set(2,t.ctx.HEADERS.indexOf('Needs Review')+1,'');assert.equal(t.ctx.unplacedCount_(log,0),0);
  }
});
module.exports={load,Sheet,workbook,BASE,LEGACY_HEADERS};
if(require.main===module){console.log(`\n${passed} passed, ${failed} failed`);process.exit(failed ? 1 : 0);}
