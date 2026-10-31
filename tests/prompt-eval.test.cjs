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
  assert.equal(sum.done, 2); assert.equal(sum.ticket.current, 1); assert.equal(sum.ticket.variant, 2);
  const res = JSON.parse(files['prompt-eval-sevens.json']);
  assert.equal(res.rows[0].kind, 'corrected'); assert.equal(res.rows[1].kind, 'control');
  assert.doesNotMatch(JSON.stringify(res), /Person|630-555|synthphotoid/, 'no names, phones or photo ids in the results');
  assert.equal(JSON.stringify([...sh.cells]), before, 'the workbook is never written');
});

console.log(`${passed} prompt eval tests passed`);
