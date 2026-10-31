'use strict';
// The one-time prompt A/B test (runPromptEval_): gated, read-only on the workbook, results to a Drive file.
// Synthetic data only.
const assert = require('node:assert/strict');
const { load } = require('./offline.test.cjs');
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS ' + name); }

function setup() {
  const t = load({ props: { SAVE_IMAGES: 'true' } }), files = {}, drive = [];
  let n = 0;
  const fileObj = (name, content) => { const f = { name, content, trashed: false, failSave: false,
    getBlob: () => ({ getDataAsString: () => f.content }), isTrashed: () => f.trashed, setTrashed(v) { f.trashed = v; },
    setContent(c) { if (f.failSave) throw new Error('Drive save failed'); f.content = c; files[name] = c; } };
    drive.push(f); files[name] = content; return f; };
  const folder = {
    createFile: (a, content) => { if (typeof a === 'string') return fileObj(a, content);
      const id = 'synthphotoid' + String(++n).padStart(21, '0'); return { getUrl: () => 'https://drive.example/file/d/' + id + '/view' }; },
    getFiles: () => ({ hasNext: () => false }),
    getFilesByName: name => { const list = drive.filter(f => f.name === name); let k = 0; return { hasNext: () => k < list.length, next: () => list[k++] }; }, // trashed files too, as Drive does
  };
  t.ctx.DriveApp = { getFoldersByName: () => { let done = false; return { hasNext: () => !done, next: () => { done = true; return folder; } }; },
    getFileById: () => ({ getBlob: () => ({ getBytes: () => [255, 216, 1, 2] }) }) };
  t.ctx.Utilities.newBlob = (bytes, type, name) => ({ name });
  t.ctx.Utilities.base64Encode = bytes => Buffer.from(bytes).toString('base64');
  let held = false;
  t.ctx.LockService.getUserLock = () => ({ tryLock() { if (held) return false; held = true; return true; }, releaseLock() { held = false; } });
  t.holdUserLock = v => { held = v; };
  return { t, files, drive };
}

test('the variant changes only the 7s line; production keeps the current prompt', () => {
  const { t } = setup(), ctx = t.ctx;
  assert.equal(ctx.promptVariant_('current'), ctx.SYSTEM_PROMPT);
  const v = ctx.promptVariant_('sevens');
  assert.notEqual(v, ctx.SYSTEM_PROMPT); assert.match(v, /Handwritten 7s on these tags are often misread as 2/);
  assert.equal(v.replace(ctx.SEVENS_NEW_LINES, ctx.SEVENS_OLD_LINE), ctx.SYSTEM_PROMPT);
  assert.throws(() => ctx.promptVariant_('other'), /Unknown prompt variant/);
  assert.equal(ctx.buildRequest_('m', 'AAAA', 'image/jpeg').body.system[0].text, ctx.SYSTEM_PROMPT);
});

test('refuses to spend without PROMPT_EVAL_APPROVED', () => {
  const { t } = setup();
  assert.throws(() => t.ctx.runPromptEval_(), /PROMPT_EVAL_APPROVED/);
});

test('reads corrected scans and controls with both prompts, writes only a results file, never the workbook', () => {
  const { t, files } = setup(), sh = t.ss.tabs['New Lenox'];
  t.scan({ store: 'New Lenox', ticket_number: '2277617', width_in: 30, billable_inches: 70 }); // misread; fixed by hand below
  t.scan({ store: 'New Lenox', ticket_number: '7777612', width_in: 31, billable_inches: 71 }); // kept: a control
  const c = t.ctx.storeLayout_(sh).screens;
  sh.set(2, c.TICKET, '7777617');
  const before = JSON.stringify([...sh.cells]);
  t.props.PROMPT_EVAL_APPROVED = 'yes';
  const calls = [];
  t.ctx.UrlFetchApp.fetchAll = reqs => reqs.map(r => {
    const body = JSON.parse(r.payload), variant = body.system[0].text !== t.ctx.SYSTEM_PROMPT; calls.push(variant);
    const out = { ...JSON.parse(JSON.stringify(require('./offline.test.cjs').BASE)), store: 'New Lenox', ticket_number: calls.length <= 2 ? (variant ? '7777617' : '2277617') : '7777612' };
    return { getContentText: () => JSON.stringify({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(out) }] }) };
  });
  const sum = t.ctx.runPromptEval_();
  assert.equal(calls.length, 4); assert.deepEqual(calls.filter(Boolean).length, 2, 'each photo read once per prompt');
  assert.equal(sum.done, 2); assert.equal(sum.errors, 0);
  assert.deepEqual(JSON.parse(JSON.stringify(sum.corrected.ticket)), { total: 1, current: 0, variant: 1 });
  assert.deepEqual(JSON.parse(JSON.stringify(sum.control.ticket)), { total: 1, current: 1, variant: 1 });
  const res = JSON.parse(files['prompt-eval-sevens.json']);
  assert.equal(res.rows[0].kind, 'corrected'); assert.equal(res.rows[1].kind, 'control');
  assert.doesNotMatch(JSON.stringify(res), /Person|630-555|synthphotoid/, 'no names, phones or photo ids in the results');
  assert.equal(JSON.stringify([...sh.cells]), before, 'the workbook is never written');
  for (const k of ['PROMPT_EVAL_APPROVED', 'PROMPT_EVAL_CURSOR', 'PROMPT_EVAL_CASES']) assert.equal(t.props[k], undefined, k + ' is cleared when done');
  assert.throws(() => t.ctx.runPromptEval_(), /PROMPT_EVAL_APPROVED/, 'never pays twice');
  t.props.PROMPT_EVAL_APPROVED = 'yes';
  assert.throws(() => t.ctx.runPromptEval_(), /already exists/, 'a second approval still needs the old results trashed');
  assert.equal(calls.length, 4);
});

function twoScans(t) {
  t.scan({ store: 'New Lenox', ticket_number: '2277617', width_in: 30, billable_inches: 70 });
  t.scan({ store: 'New Lenox', ticket_number: '7777612', width_in: 31, billable_inches: 71 });
  t.ss.tabs['New Lenox'].set(2, t.ctx.storeLayout_(t.ss.tabs['New Lenox']).screens.TICKET, '7777617');
  t.props.PROMPT_EVAL_APPROVED = 'yes';
}

test('a missing photo or a failed fetch is recorded as an error and the run still finishes', () => {
  const { t, files } = setup();
  twoScans(t);
  const real = t.ctx.DriveApp.getFileById; let first = true;
  t.ctx.DriveApp.getFileById = id => { if (first) { first = false; throw new Error('gone'); } return real(id); };
  t.ctx.UrlFetchApp.fetchAll = () => { throw new Error('network'); };
  const sum = t.ctx.runPromptEval_();
  assert.equal(sum.done, 2); assert.equal(sum.errors, 2);
  const rows = JSON.parse(files['prompt-eval-sevens.json']).rows;
  assert.equal(rows[0].a.error, 'photo missing'); assert.equal(rows[1].a.error, 'fetch failed');
  assert.equal(t.props.PROMPT_EVAL_APPROVED, undefined);
});

test('resumes from the cursor with the saved case list, without repeating or skipping', () => {
  const { t, files } = setup();
  for (let k = 0; k < 6; k++) t.scan({ store: 'New Lenox', ticket_number: '777761' + k, width_in: 30 + k, billable_inches: 70 + k });
  t.props.PROMPT_EVAL_APPROVED = 'yes';
  let fetches = 0;
  t.ctx.UrlFetchApp.fetchAll = reqs => { fetches += reqs.length; return reqs.map(() => ({ getContentText: () => JSON.stringify({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ ...require('./offline.test.cjs').BASE, store: 'New Lenox' }) }] }) })); };
  const realNow = Date.now; let clock = 0;
  t.ctx.Date.now = () => (clock += 3 * 60 * 1000); // the second batch starts past the 4-minute mark
  try {
    const first = t.ctx.runPromptEval_();
    assert.equal(first.done, 4); assert.equal(first.of, 6); assert.equal(t.props.PROMPT_EVAL_CURSOR, '4');
    assert.ok(t.props.PROMPT_EVAL_CASES && t.props.PROMPT_EVAL_APPROVED === 'yes', 'still approved mid-run');
    t.ss.tabs['New Lenox'].set(7, t.ctx.storeLayout_(t.ss.tabs['New Lenox']).screens.TICKET, '7777699'); // a fix now would put a corrected case first
    clock = 0;
    const second = t.ctx.runPromptEval_();
    assert.equal(second.done, 6); assert.equal(second.of, 6); assert.equal(fetches, 12, 'each photo read once per prompt');
  } finally { t.ctx.Date.now = realNow; }
  const logged = JSON.parse(files['prompt-eval-sevens.json']).rows.map(r => r.logged.ticket).sort();
  assert.deepEqual(logged, ['7777610', '7777611', '7777612', '7777613', '7777614', '7777615'], 'every scan once');
  assert.equal(t.props.PROMPT_EVAL_CURSOR, undefined);
});

const ok = (t, ticket) => ({ getResponseCode: () => 200, getContentText: () => JSON.stringify({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ ...require('./offline.test.cjs').BASE, store: 'New Lenox', ...(ticket ? { ticket_number: ticket } : {}) }) }] }) });
function scans(t, k) { for (let i = 0; i < k; i++) t.scan({ store: 'New Lenox', ticket_number: '777761' + i, width_in: 30 + i, billable_inches: 70 + i }); t.props.PROMPT_EVAL_APPROVED = 'yes'; }

test('round 2: a failed save loses no paid rows; the next run resumes from what was saved', () => {
  const { t, files, drive } = setup();
  scans(t, 6);
  let saves = 0;
  t.ctx.UrlFetchApp.fetchAll = reqs => reqs.map(() => ok(t));
  const origCreate = t.ctx.DriveApp.getFoldersByName().next().createFile;
  t.ctx.DriveApp.getFoldersByName().next().createFile = (a, c) => { const f = origCreate(a, c); if (typeof a === 'string') { const set = f.setContent; f.setContent = x => { if (++saves === 2) throw new Error('Drive save failed'); set(x); }; } return f; };
  assert.throws(() => t.ctx.runPromptEval_(), /Drive save failed/);
  assert.equal(JSON.parse(files['prompt-eval-sevens.json']).rows.length, 4, 'first batch kept');
  assert.equal(t.props.PROMPT_EVAL_CURSOR, '4'); assert.equal(t.props.PROMPT_EVAL_APPROVED, 'yes');
  const sum = t.ctx.runPromptEval_();
  assert.equal(sum.done, 6); assert.equal(sum.of, 6);
  const logged = JSON.parse(files['prompt-eval-sevens.json']).rows.map(r => r.logged.ticket).sort();
  assert.deepEqual(logged, ['7777610', '7777611', '7777612', '7777613', '7777614', '7777615']);
  assert.equal(drive.filter(f => f.name === 'prompt-eval-sevens.json').length, 1, 'one results file, updated in place');
});

test('round 2: a stop between saving and the cursor resumes from the saved rows; a missing file or list refuses', () => {
  const { t, files } = setup();
  scans(t, 6);
  let fetched = 0;
  t.ctx.UrlFetchApp.fetchAll = reqs => { fetched += reqs.length; return reqs.map(() => ok(t)); };
  const realNow = t.ctx.Date.now; let clock = 0; t.ctx.Date.now = () => (clock += 3 * 60 * 1000);
  try { t.ctx.runPromptEval_(); } finally { t.ctx.Date.now = realNow; }
  delete t.props.PROMPT_EVAL_CURSOR; // stopped before the first cursor write: the saved case list says a run is under way
  t.ctx.runPromptEval_();
  assert.equal(fetched, 12, 'no photo read twice');
  assert.equal(JSON.parse(files['prompt-eval-sevens.json']).rows.length, 6);
  t.props.PROMPT_EVAL_APPROVED = 'yes'; // a finished run, approved again, with the results still there
  assert.throws(() => t.ctx.runPromptEval_(), /already exists/, 'never starts over on top of results');
  const u = setup(); scans(u.t, 3); u.t.props.PROMPT_EVAL_CURSOR = '4';
  let paid = 0; u.t.ctx.UrlFetchApp.fetchAll = reqs => { paid += reqs.length; return []; };
  assert.throws(() => u.t.ctx.runPromptEval_(), /Cannot resume/); assert.equal(paid, 0);
});

test('round 2: a trashed results file does not block or feed a new approved run; the user lock stops a second run', () => {
  const { t, files, drive } = setup();
  scans(t, 2);
  t.ctx.UrlFetchApp.fetchAll = reqs => reqs.map(() => ok(t));
  t.ctx.runPromptEval_();
  drive.forEach(f => f.setTrashed(true));
  t.props.PROMPT_EVAL_APPROVED = 'yes';
  assert.equal(t.ctx.runPromptEval_().done, 2, 'a fresh run after trashing');
  t.props.PROMPT_EVAL_APPROVED = 'yes'; drive.forEach(f => f.setTrashed(true)); t.holdUserLock(true);
  let paid = 0; t.ctx.UrlFetchApp.fetchAll = reqs => { paid += reqs.length; return []; };
  assert.throws(() => t.ctx.runPromptEval_(), /already running/); assert.equal(paid, 0);
});

test('round 2: API errors are recorded with their code and left out of the scores; no cases or moved rows refuse or skip', () => {
  const { t, files } = setup();
  scans(t, 2);
  t.ctx.UrlFetchApp.fetchAll = reqs => reqs.map((r, k) => k === 1 ? { getResponseCode: () => 529, getContentText: () => '{}' } : ok(t, k < 2 ? '7777610' : '7777611'));
  const sum = t.ctx.runPromptEval_();
  const rows = JSON.parse(files['prompt-eval-sevens.json']).rows;
  assert.equal(rows[0].b.error, 'HTTP 529'); assert.equal(sum.errors, 1);
  assert.equal(sum.control.ticket.total, 1, 'the errored photo is not scored');
  assert.equal(sum.control.ticket.current, 1, 'nor its other side');
  const u = setup(); u.t.props.PROMPT_EVAL_APPROVED = 'yes';
  assert.throws(() => u.t.ctx.runPromptEval_(), /No scans with a saved photo/);
  assert.equal(u.t.props.PROMPT_EVAL_APPROVED, 'yes', 'approval kept: nothing ran');
  const w = setup(); scans(w.t, 2);
  const sh = w.t.ss.tabs['New Lenox'], c = w.t.ctx.storeLayout_(sh).screens;
  sh.set(2, c.NAME, 'Someone Else'); // the row was reused for another job since the scan
  w.t.ctx.UrlFetchApp.fetchAll = reqs => reqs.map(() => ok(w.t));
  assert.equal(w.t.ctx.runPromptEval_().of, 1, 'the moved row is not a case');
});

console.log(`${passed} prompt eval tests passed`);
