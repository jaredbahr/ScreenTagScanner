'use strict';
// Balance-due slips, shop re-measurements, and prompt notes from the October 23 audit. Synthetic data only.
const assert = require('node:assert/strict');
const { load } = require('./offline.test.cjs');
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS ' + name); }
const job = x => ({ ticket_number: '7708201', material: 'fiberglass', width_in: 34, height_in: 41, billable_inches: 75, qty_rows: '75, 75, 75', ...x });

test('a "measured wrong / balance due" slip adds its QTY to the tag QTY (Kirsten 2026-10-23: 75 + 20 = 95)', () => {
  const t = load(), sh = t.ss.tabs['Homer Glen'];
  const r = t.scan(job({ balance_due_qty: '20' }));
  assert.equal(sh.get(2, 6), 95); assert.equal(sh.get(2, 7), 14.25); assert.equal(sh.get(2, 8), 16.15);
  assert.match(sh.notes.get('2,3') || '', /Inches include a balance-due slip: tag QTY 75 \+ slip QTY 20 = 95"; check the slip/);
  assert.match(r.message, /Check on the sheet: inches/, 'a billing change from a slip is a yellow row');
});

test('no slip: the tag QTY is billed as charged, whatever the shop re-measured', () => {
  const t = load(), sh = t.ss.tabs['Homer Glen'];
  t.scan(job({ balance_due_qty: '' })); assert.equal(sh.get(2, 6), 75);
  assert.match(t.ctx.SYSTEM_PROMPT, /shop's own\s+re-measurement, not what the customer was charged/);
  assert.match(t.ctx.SYSTEM_PROMPT, /balance_due_qty/);
});

test('a slip on a tag whose inches are held is not added; the note says to enter the total by hand', () => {
  const t = load(), sh = t.ss.tabs['Homer Glen'];
  t.scan(job({ balance_due_qty: '20', quantity_conflict: true, quantity_conflict_details: 'Tag 75 vs other 80', qty_rows: '' }));
  assert.equal(sh.get(2, 6), ''); assert.match(sh.notes.get('2,3') || '', /Balance-due slip adds 20 inches, not added because the inches are held/);
});

test('nonsense balance-due values are ignored', () => {
  for (const v of ['abc', '-5', '999', '2.5']) { const t = load(); t.scan(job({ balance_due_qty: v })); assert.equal(t.ss.tabs['Homer Glen'].get(2, 6), 75, v); }
});

test('prompt: thin 1s, 4/6 in years', () => {
  const p = load().ctx.SYSTEM_PROMPT;
  assert.match(p, /thin handwritten 1 between other digits is easy to skip/); assert.match(p, /4\/6 in years/);
});

console.log(`${passed} audit-fix tests passed`);
