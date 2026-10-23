'use strict';
// Money fixes from the independent review of 0.13.23-0.13.25 (2026-10-23). Synthetic data only.
const assert = require('node:assert/strict');
const { load, BASE } = require('./offline.test.cjs');
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS ' + name); }
const job = x => ({ ticket_number: '7708201', material: 'fiberglass', width_in: 34, height_in: 41, billable_inches: 75, qty_rows: '75, 75, 75', ...x });

test('a balance-due slip on a multi-frame build is never added to every frame', () => {
  const t = load(), sh = t.ss.tabs['Homer Glen'];
  const r = t.scan(job({ form_type: 'new_build', screens_on_tag: 2, balance_due_qty: '20' }));
  for (const row of [2, 3]) {
    assert.equal(sh.get(row, 6), 75, 'row ' + row);
    assert.match(sh.notes.get(row + ',3') || '', /balance-due slip adds 20 inches on a 2-frame form, not added; add it to the right frame by hand/);
  }
  assert.match(r.message, /Check on the sheet:.*inches/);
});

test('a single-frame build with a slip still adds it once', () => {
  const t = load(), sh = t.ss.tabs['Homer Glen'];
  t.scan(job({ form_type: 'new_build', screens_on_tag: 1, balance_due_qty: '20' }));
  assert.equal(sh.get(2, 6), 95); assert.equal(sh.get(3, 6), '');
});

test('slip labor copied into extras is not credited on top of the slip inches', () => {
  for (const extras of ['LB $3.40 balance due', 'additional labor $3.40']) {
    const t = load(), sh = t.ss.tabs['Homer Glen'];
    const r = t.scan(job({ ...BASE, ticket_number: '7708201', width_in: 34, height_in: 41, billable_inches: 75, qty_rows: '75, 75, 75', extras, parts: [], balance_due_qty: '20' }));
    assert.equal(sh.get(2, 6), 95, extras); assert.equal(sh.get(2, 8), 16.15, extras + ': labor for 95" only');
    assert.match(r.message, /Check on the sheet/, extras);
  }
  const plan = load().ctx.calculateExtraLabor_({ ...BASE, extras: 'additional labor $3.40', parts: [], balance_due_qty: '20' });
  assert.equal(plan.items.length, 0); assert.match(plan.flags[0], /balance-due slip may be the slip's own charge/);
  const ok = load().ctx.calculateExtraLabor_({ ...BASE, extras: 'additional labor $3.40', parts: [], balance_due_qty: '' });
  assert.equal(ok.items.length, 1, 'no slip: extra labor still credited');
});

test('slip prompt: a balance-due slip is not copied into extras', () => {
  assert.match(load().ctx.SYSTEM_PROMPT, /Most other slips \(not a balance-due slip; see balance_due_qty\) just ADD parts/);
});

test('a missing-inches tag with a slip says the inches are missing, not held', () => {
  const t = load(), sh = t.ss.tabs['Homer Glen'];
  t.scan(job({ billable_inches: null, width_in: null, height_in: null, qty_rows: '', balance_due_qty: '20' }));
  assert.match(sh.notes.get('2,3') || '', /not added because the tag's inches are missing/);
});

test('a window tag with a slip gets a note instead of silence', () => {
  const t = load(), sh = t.ss.tabs['Homer Glen'];
  t.scan({ item_type: 'window', panes: 1, width_in: null, height_in: null, billable_inches: null, ticket_number: '1000099', balance_due_qty: '20' });
  assert.match([...sh.notes.values()].join('\n'), /Balance-due slip on a window tag: not added; enter it by hand/);
});

test('a unanimous tag does not override a conflict that names a slip, another screen or a correction', () => {
  const base = { ticket_number: '7708301', material: 'aluminum', width_in: 27, height_in: 73, billable_inches: 100, qty_rows: '100, 100, 100', line_totals: '19.00, 7.00, 20.00', quantity_conflict: true };
  for (const d of ['Tag: 27x73 = 100 in. Slip: two 28x37 = 130 in.', 'Pay Cashier lists another screen', 'corrected size 28 x 73', 'second screen 80 in']) {
    const t = load(), sh = t.ss.tabs['Homer Glen']; t.scan({ ...base, quantity_conflict_details: d });
    assert.equal(sh.get(2, 6), '', d); assert.doesNotMatch(sh.notes.get('2,3') || '', /billed: the tag's size/, d);
  }
  const t = load(), sh = t.ss.tabs['Homer Glen']; t.scan({ ...base, quantity_conflict_details: '100 x .19 = 19.00.' });
  assert.equal(sh.get(2, 6), 100, 'price arithmetic still bills');
  assert.doesNotMatch(sh.notes.get('2,3') || '', /\.\. Check/, 'no double period');
});

test('short last name: extra-labor receipt stays valid and later credits on the tab still post', () => {
  const t = load(), sh = t.ss.tabs['Homer Glen'], c = t.ctx.storeLayout_(sh).screens;
  const j = more => ({ ...BASE, extras: 'Cleaned rollers; additional labor $8.00', parts: [], tag_index: 1, tag_count: 1, ...more });
  t.scan(j({ customer_name: 'Amy Li', last_name: 'Li', ticket_number: '1000001' }));
  assert.equal(sh.get(2, c.NAME), 'Amy Li');
  const receipts = t.ctx.extraLaborReceipts_(sh.notes.get(sh.key(2, c.LB_EARN)));
  assert.equal(receipts.length, 1); assert.equal(receipts[0].invalid, undefined); assert.equal(receipts[0].customer, 'amy li');
  t.scan(j({ customer_name: 'Bob Jones', last_name: 'Jones', ticket_number: '1000050', phone: '6305550111', width_in: 30, height_in: 40, billable_inches: 70 }));
  assert.equal(sh.get(3, c.LB_EARN), 19.9, 'next customer on the tab still gets the credit');
  assert.doesNotMatch(sh.notes.get(sh.key(3, c.LB_EARN)) || '', /pending or changed/);
});

test('receipt customer check: last name normally, full name only for a 1-2 letter last name', () => {
  const ok = load().ctx.receiptCustomerOk_;
  assert.equal(ok('jones', ['bob jones', 'jones', '1']), true);
  assert.equal(ok('bob jones', ['bob jones', 'jones', '1']), false);
  assert.equal(ok('amy li', ['amy li', 'li', '1']), true);
  assert.equal(ok('li', ['amy li', 'li', '1']), true, 'receipts written before 0.13.26 still read');
  assert.equal(ok('amy  li', ['amy li', 'li', '1']), false);
  assert.equal(ok('ann b', ['ann  b', 'b', '1']), true, 'spaces collapsed like the Name cell');
});

test('short last name: tag 2 of a group-wide part is not held as edited by hand', () => {
  const t = load(), sh = t.ss.tabs['Homer Glen'];
  const pj = i => ({ ...BASE, customer_name: 'Amy Li', last_name: 'Li', ticket_number: '1000001', tag_index: i, tag_count: 2, extras: '3 580602 spring pins $6', parts: [{ sku: '580602', quantity: 3, unit: 'each', group_wide: true, raw: '3 580602 spring pins $6' }] });
  t.scan(pj(1)); const r = t.scan(pj(2));
  assert.doesNotMatch([...sh.notes.values()].join('\n') + r.message, /edited by hand|changed by hand/);
});

console.log(`${passed} review money tests passed`);
