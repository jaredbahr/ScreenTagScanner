'use strict';
// One ticket per order (Homer-style tabs): an order's tags whose tickets differ in one digit get notes on both rows
// (Jared, 2026-10-30). Synthetic data only.
const assert = require('node:assert/strict');
const { load, BASE } = require('./offline.test.cjs');
// Tags are written directly (saveScan_), as in other suites: the scan endpoint allows about ten scans a minute.
const write = (t, x) => { const r = t.ctx.saveScan_({ ...BASE, ...x }, 'Synthetic', [], '', 'synthetic'); assert.equal(r.ok, true, JSON.stringify(r).slice(0, 200)); return r; };
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS ' + name); }
function modern(t, tab) { const sh = t.ss.tabs[tab]; sh.insertColumnAfter(15); sh.set(1, 16, 'Tag x of N'); sh.insertColumnAfter(3); sh.set(1, 4, 'Tag x of N'); return { sh, c: t.ctx.storeLayout_(sh).screens }; }
const tag = (store, name, tk, i, n, w = 20) => ({ store, customer_name: 'Ann ' + name, last_name: name, phone: null, ticket_number: tk,
  tag_index: i, tag_count: n, width_in: w + i, height_in: 30, billable_inches: w + 30 + i });
const rowOf = (sh, c, seq, tk) => [...Array(60).keys()].map(k => k + 2).find(r => sh.get(r, c.SEQUENCE) === seq && String(sh.get(r, c.TICKET)) === tk);
const note = (sh, c, r) => sh.notes.get(sh.key(r, c.TICKET)) || '';
function homer() { // earlier orders on the tab share one ticket each: a one-ticket store
  const t = load(), m = modern(t, 'Homer Glen');
  [1, 2, 3].forEach(i => write(t, tag('HOMER', 'Synthalpha', '8339100', i, 3, 40)));
  [1, 2, 3].forEach(i => write(t, tag('HOMER', 'Synthbeta', '8339200', i, 3, 50)));
  return { t, ...m };
}

test('two tags of an order one digit apart: both rows get a note (the 10/30 case)', () => {
  const { t, sh, c } = homer();
  write(t, tag('HOMER', 'Synthgamma', '8339944', 3, 7));
  write(t, tag('HOMER', 'Synthgamma', '8339994', 6, 7));
  assert.match(note(sh, c, rowOf(sh, c, '6 of 7', '8339994')), /reads 8339994; row \d+ reads 8339944 \(one digit apart; one ticket per order\): one of them is misread/);
  assert.match(note(sh, c, rowOf(sh, c, '3 of 7', '8339944')), /reads 8339944; a later tag of this order reads 8339994/);
});

test('once more tags agree, the odd earlier tag gets "likely" the shared ticket', () => {
  const { t, sh, c } = homer();
  write(t, tag('HOMER', 'Synthgamma', '8339944', 3, 7));
  write(t, tag('HOMER', 'Synthgamma', '8339994', 6, 7));
  write(t, tag('HOMER', 'Synthgamma', '8339994', 1, 7));
  assert.match(note(sh, c, rowOf(sh, c, '3 of 7', '8339944')), /2 tags of this order read 8339994 \(one ticket per order\): likely 8339994/);
  assert.doesNotMatch(note(sh, c, rowOf(sh, c, '1 of 7', '8339994')), /misread|likely/);
});

test('not on a tab where each tag has its own ticket (sequential books), and never for another customer', () => {
  const t = load(), { sh, c } = modern(t, 'New Lenox');
  [[1, '7777601'], [2, '7777602'], [3, '7777603']].forEach(([i, tk]) => write(t, tag('New Lenox', 'Synthdelta', tk, i, 3, 40)));
  write(t, tag('New Lenox', 'Synthgamma', '7777614', 1, 3)); write(t, tag('New Lenox', 'Synthgamma', '7777624', 2, 3));
  for (let r = 2; r < 12; r++) assert.doesNotMatch(note(sh, c, r), /one ticket per order/, 'row ' + r);
  const h = homer();
  write(h.t, tag('HOMER', 'Synthgamma', '8339944', 3, 7)); write(h.t, tag('HOMER', 'Synthomega', '8339994', 6, 7));
  for (let r = 2; r < 20; r++) assert.doesNotMatch(note(h.sh, h.c, r), /one ticket per order/, 'another customer, row ' + r);
});

test('review: the "far from the rest" note still fires on a one-ticket tab', () => {
  const { t, sh, c } = homer();
  write(t, tag('HOMER', 'Synthgamma', '8339901', 1, 3)); write(t, tag('HOMER', 'Synthgamma', '8339311', 2, 3));
  assert.match(note(sh, c, rowOf(sh, c, '2 of 3', '8339311')), /8339311 is far from the rest of this group/);
});

test('review: no mismatch note for two digits apart, a second order (same "k of N"), or consecutive tickets', () => {
  const a = homer();
  write(a.t, tag('HOMER', 'Synthgamma', '8339944', 1, 3)); write(a.t, tag('HOMER', 'Synthgamma', '8339951', 2, 3));
  const b = homer();
  write(b.t, tag('HOMER', 'Synthgamma', '8339944', 1, 3)); write(b.t, tag('HOMER', 'Synthgamma', '8339954', 1, 3, 30));
  const d = homer();
  write(d.t, tag('HOMER', 'Synthgamma', '8339101', 1, 2)); write(d.t, tag('HOMER', 'Synthgamma', '8339102', 2, 2));
  for (const x of [a, b, d]) for (let r = 2; r < 20; r++) assert.doesNotMatch(note(x.sh, x.c, r), /one ticket per order/, 'row ' + r);
});

test('review: a tab with each tag on its own ticket (6+ group rows, one repeated order) is not a one-ticket tab', () => {
  const t = load(), { sh, c } = modern(t, 'New Lenox');
  [[1, '7777601'], [2, '7777602'], [3, '7777603']].forEach(([i, tk]) => write(t, tag('New Lenox', 'Synthdelta', tk, i, 3, 40)));
  [[1, '7777611'], [2, '7777611']].forEach(([i, tk]) => write(t, tag('New Lenox', 'Synthkappa', tk, i, 2, 50))); // two orders share a ticket,
  [[1, '7777621'], [2, '7777621']].forEach(([i, tk]) => write(t, tag('New Lenox', 'Synthlambda', tk, i, 2, 60))); // but most tags don't
  [[1, '7777631'], [2, '7777632']].forEach(([i, tk]) => write(t, tag('New Lenox', 'Synthmu', tk, i, 2, 70)));
  write(t, tag('New Lenox', 'Synthgamma', '7777644', 1, 3)); write(t, tag('New Lenox', 'Synthgamma', '7777694', 2, 3));
  for (let r = 2; r < 14; r++) assert.doesNotMatch(note(sh, c, r), /one ticket per order/, 'row ' + r);
});

test('review: one big order sharing a ticket, or too few tags yet, does not make a one-ticket tab', () => {
  const t = load(), { sh, c } = modern(t, 'New Lenox'); // 5 of 7 rows share one ticket, but it is a single order
  [1, 2, 3, 4, 5].forEach(i => write(t, tag('New Lenox', 'Synthkappa', '7777611', i, 5, 40)));
  write(t, tag('New Lenox', 'Synthgamma', '7777644', 1, 3)); write(t, tag('New Lenox', 'Synthgamma', '7777694', 2, 3));
  for (let r = 2; r < 14; r++) assert.doesNotMatch(note(sh, c, r), /one ticket per order/, 'one order: row ' + r);
  const u = load(), m = modern(u, 'Homer Glen'); // two shared orders of 2 tags: 5 group rows when the pair is checked
  [1, 2].forEach(i => write(u, tag('HOMER', 'Synthalpha', '8339100', i, 2, 40)));
  [1, 2].forEach(i => write(u, tag('HOMER', 'Synthbeta', '8339200', i, 2, 50)));
  write(u, tag('HOMER', 'Synthgamma', '8339944', 1, 3)); write(u, tag('HOMER', 'Synthgamma', '8339994', 2, 3));
  for (let r = 2; r < 14; r++) assert.doesNotMatch(note(m.sh, m.c, r), /one ticket per order/, 'too few: row ' + r);
});

console.log(`${passed} one-ticket mismatch tests passed`);
