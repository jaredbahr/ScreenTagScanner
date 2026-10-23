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
  assert.equal(sh.get(2, 6), ''); assert.match(sh.notes.get('2,3') || '', /balance-due slip adds 20 inches, not added because the tag's inches are held/);
});

test('unreadable balance-due values are not added and are flagged, never dropped silently (review 0.13.26)', () => {
  for (const v of ['abc', '-5', '999', '2.5', '20 in', '+20', '20, 20']) {
    const t = load(), sh = t.ss.tabs['Homer Glen']; const r = t.scan(job({ balance_due_qty: v }));
    assert.equal(sh.get(2, 6), 75, v); assert.match(sh.notes.get('2,3') || '', /balance-due slip QTY ".*" unreadable, not added; enter the total by hand/, v);
    assert.match(r.message, /Check on the sheet: inches/, v);
  }
  for (const v of ['', '0', 'none', 'N/A', null, undefined]) { const t = load(); const r = t.scan(job({ balance_due_qty: v })); assert.doesNotMatch(r.message, /Check on the sheet/, String(v)); }
});

test('prompt: thin 1s, 4/6 in years', () => {
  const p = load().ctx.SYSTEM_PROMPT;
  assert.match(p, /thin handwritten 1 between other digits is easy to skip/); assert.match(p, /4\/6 in years/);
});

test('price arithmetic read as a second size: billed when size, QTY rows and $ totals all agree (New Lenox case)', () => {
  const base = { ticket_number: '7708301', material: 'aluminum', width_in: 10, height_in: 10, billable_inches: 20, qty_rows: '20, 20, 20',
    line_totals: '3.80, 1.40, 4.00', quantity_conflict: true, quantity_conflict_details: 'Screen size 10 x 10 = 20 in; calculation 20 x 19 = 3.80' };
  const t = load(), sh = t.ss.tabs['Homer Glen']; const r = t.scan(base);
  assert.equal(sh.get(2, 6), 20); assert.equal(sh.get(2, 7), 3.8); assert.equal(sh.get(2, 8), 4);
  assert.match(sh.notes.get('2,3') || '', /Inches 20" billed: the tag's size, QTY rows and \$ totals all agree; Claude also noted: Screen size 10 x 10/);
  assert.match(r.message, /Check on the sheet: inches/);
  for (const x of [{ line_totals: '3.80, 1.40, 4.10' }, { qty_rows: '20, 20' , line_totals: '3.80' }, { has_corrections: true }, { billable_inches: 21 }]) {
    const u = load(); u.scan({ ...base, ...x }); assert.equal(u.ss.tabs['Homer Glen'].get(2, 6), '', JSON.stringify(x) + ' still held');
  }
  assert.match(load().ctx.SYSTEM_PROMPT, /price calculation, not a\s+screen size/);
});

console.log(`${passed} audit-fix tests passed`);
