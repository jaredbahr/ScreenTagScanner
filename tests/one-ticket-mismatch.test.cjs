'use strict';
// One ticket per order (Homer-style tabs): an order's tags whose tickets differ in one digit get notes on both rows
// (Jared, 2026-10-30). Synthetic data only.
const assert = require('node:assert/strict');
const { load } = require('./offline.test.cjs');
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS ' + name); }
function modern(t, tab) { const sh = t.ss.tabs[tab]; sh.insertColumnAfter(15); sh.set(1, 16, 'Tag x of N'); sh.insertColumnAfter(3); sh.set(1, 4, 'Tag x of N'); return { sh, c: t.ctx.storeLayout_(sh).screens }; }
const tag = (store, name, tk, i, n, w = 20) => ({ store, customer_name: 'Ann ' + name, last_name: name, phone: null, ticket_number: tk,
  tag_index: i, tag_count: n, width_in: w + i, height_in: 30, billable_inches: w + 30 + i });
const rowOf = (sh, c, seq, tk) => [...Array(60).keys()].map(k => k + 2).find(r => sh.get(r, c.SEQUENCE) === seq && String(sh.get(r, c.TICKET)) === tk);
const note = (sh, c, r) => sh.notes.get(sh.key(r, c.TICKET)) || '';
function homer() { // earlier orders on the tab share one ticket each: a one-ticket store
  const t = load(), m = modern(t, 'Homer Glen');
  [1, 2, 3].forEach(i => t.scan(tag('HOMER', 'Synthalpha', '8339100', i, 3, 40)));
  [1, 2, 3].forEach(i => t.scan(tag('HOMER', 'Synthbeta', '8339200', i, 3, 50)));
  return { t, ...m };
}

test('two tags of an order one digit apart: both rows get a note (the 10/30 case)', () => {
  const { t, sh, c } = homer();
  t.scan(tag('HOMER', 'Synthgamma', '8339944', 3, 7));
  t.scan(tag('HOMER', 'Synthgamma', '8339994', 6, 7));
  assert.match(note(sh, c, rowOf(sh, c, '6 of 7', '8339994')), /reads 8339994; row \d+ reads 8339944 \(one digit apart; one ticket per order\): one of them is misread/);
  assert.match(note(sh, c, rowOf(sh, c, '3 of 7', '8339944')), /reads 8339944; a later tag of this order reads 8339994/);
});

test('once more tags agree, the odd earlier tag gets "likely" the shared ticket', () => {
  const { t, sh, c } = homer();
  t.scan(tag('HOMER', 'Synthgamma', '8339944', 3, 7));
  t.scan(tag('HOMER', 'Synthgamma', '8339994', 6, 7));
  t.scan(tag('HOMER', 'Synthgamma', '8339994', 1, 7));
  assert.match(note(sh, c, rowOf(sh, c, '3 of 7', '8339944')), /2 tags of this order read 8339994 \(one ticket per order\): likely 8339994/);
  assert.doesNotMatch(note(sh, c, rowOf(sh, c, '1 of 7', '8339994')), /misread|likely/);
});

test('not on a tab where each tag has its own ticket (sequential books), and never for another customer', () => {
  const t = load(), { sh, c } = modern(t, 'New Lenox');
  [[1, '7777601'], [2, '7777602'], [3, '7777603']].forEach(([i, tk]) => t.scan(tag('New Lenox', 'Synthdelta', tk, i, 3, 40)));
  t.scan(tag('New Lenox', 'Synthgamma', '7777614', 1, 3)); t.scan(tag('New Lenox', 'Synthgamma', '7777624', 2, 3));
  for (let r = 2; r < 12; r++) assert.doesNotMatch(note(sh, c, r), /one ticket per order/, 'row ' + r);
  const h = homer();
  h.t.scan(tag('HOMER', 'Synthgamma', '8339944', 3, 7)); h.t.scan(tag('HOMER', 'Synthomega', '8339994', 6, 7));
  for (let r = 2; r < 20; r++) assert.doesNotMatch(note(h.sh, h.c, r), /one ticket per order/, 'another customer, row ' + r);
});

console.log(`${passed} one-ticket mismatch tests passed`);
