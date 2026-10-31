'use strict';
// The one-time prompt A/B test (runPromptEval_): gated, read-only on the workbook, results to a Drive file.
// Synthetic data only.
const assert = require('node:assert/strict');
const { load } = require('./offline.test.cjs');
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS ' + name); }

function setup() {
  const t = load({ props: { SAVE_IMAGES: 'true' } }), files = {}, made = [];
  let n = 0;
  const folder = {
    createFile: (a, content) => { if (typeof a === 'string') { files[a] = content; made.push(a); return {}; }
      const id = 'synthphotoid' + String(++n).padStart(21, '0'); return { getUrl: () => 'https://drive.example/file/d/' + id + '/view' }; },
    getFiles: () => ({ hasNext: () => false }),
    getFilesByName: name => { let done = !(name in files); return { hasNext: () => !done, next: () => { done = true; return { getBlob: () => ({ getDataAsString: () => files[name] }), setTrashed() { delete files[name]; } }; } }; },
  };
  t.ctx.DriveApp = { getFoldersByName: () => { let done = false; return { hasNext: () => !done, next: () => { done = true; return folder; } }; },
    getFileById: () => ({ getBlob: () => ({ getBytes: () => [255, 216, 1, 2] }) }) };
  t.ctx.Utilities.newBlob = (bytes, type, name) => ({ name });
  t.ctx.Utilities.base64Encode = bytes => Buffer.from(bytes).toString('base64');
  return { t, files, made };
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

console.log(`${passed} prompt eval tests passed`);
