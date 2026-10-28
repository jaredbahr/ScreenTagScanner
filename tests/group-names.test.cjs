'use strict';
// Names from the group (Kirsten, 2026-10-27: 8 of 9 tags of one group had no name; she typed it on each).
// Synthetic data only.
const assert = require('node:assert/strict');
const { load } = require('./offline.test.cjs');
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS ' + name); }
function modern(t, tab = 'New Lenox') {
  const sh = t.ss.tabs[tab];
  sh.insertColumnAfter(15); sh.set(1, 16, 'Tag x of N'); sh.insertColumnAfter(3); sh.set(1, 4, 'Tag x of N');
  return { sh, c: t.ctx.storeLayout_(sh).screens };
}
const blank = (i, n, tk) => ({ store: 'New Lenox', customer_name: null, last_name: null, phone: null, ticket_number: tk, tag_index: i, tag_count: n,
  width_in: 20 + i, height_in: 30, billable_inches: 50 + i });
const named = (i, n, tk, name = 'Synthanson') => ({ ...blank(i, n, tk), customer_name: 'Bill ' + name, last_name: name, phone: '8155550123' });
const rowOf = (sh, c, seq) => [...Array(30).keys()].map(k => k + 2).find(r => sh.get(r, c.SEQUENCE) === seq);
const nameOf = (sh, c, seq) => sh.get(rowOf(sh, c, seq), c.NAME);

test('Kirsten\'s pattern: blank tags before the named one are filled when it arrives, blank tags after take its name', () => {
  const t = load(), { sh, c } = modern(t);
  [[9, '7770609'], [8, '7770645'], [2, '7770601'], [1, '7770640'], [4, '7770642'], [3, '7770641']].forEach(([i, tk]) => t.scan(blank(i, 9, tk)));
  t.scan(named(7, 9, '7770608'));
  for (const i of [9, 8, 2, 1, 4, 3]) assert.equal(nameOf(sh, c, i + ' of 9'), 'Synthanson (?)', 'before: ' + i);
  t.scan(blank(6, 9, '7770644')); t.scan(blank(5, 9, '7770643'));
  for (const i of [6, 5]) assert.equal(nameOf(sh, c, i + ' of 9'), 'Synthanson (?)', 'after: ' + i);
  assert.equal(nameOf(sh, c, '7 of 9'), 'Synthanson');
  assert.match(sh.notes.get(sh.key(rowOf(sh, c, '9 of 9'), c.NAME)) || '', /no name on this tag; filled from row \d+ of the same group \("Synthanson"\)/);
  assert.match(sh.notes.get(sh.key(rowOf(sh, c, '6 of 9'), c.NAME)) || '', /no name on this tag; filled from the group's other tags \("Synthanson"\)/);
});

test('only blank names are filled; a typed-in or different name is never replaced', () => {
  const t = load(), { sh, c } = modern(t);
  t.scan(blank(1, 3, '7770601')); t.scan(blank(2, 3, '7770602'));
  sh.set(rowOf(sh, c, '2 of 3'), c.NAME, 'Typed');
  t.scan(named(3, 3, '7770603'));
  assert.equal(nameOf(sh, c, '1 of 3'), 'Synthanson (?)'); assert.equal(nameOf(sh, c, '2 of 3'), 'Typed');
});

test('not the same group: another count, a ticket more than 50 away, or another day (each alone)', () => {
  const t = load({ now: new Date('2026-10-27T15:00:00Z') }), { sh, c } = modern(t);
  t.scan(blank(1, 4, '7770601')); t.scan(blank(1, 3, '7770900'));
  t.scan(named(2, 3, '7770602'));
  assert.equal(nameOf(sh, c, '1 of 4'), '', 'another count'); assert.equal(nameOf(sh, c, '1 of 3'), '', 'a far ticket, same day');
  const u = load({ now: new Date('2026-10-26T15:00:00Z') }), m = modern(u);
  u.scan(blank(1, 3, '7770601'));
  u.setNow(new Date('2026-10-27T15:00:00Z')); u.scan(named(2, 3, '7770602'));
  assert.equal(nameOf(m.sh, m.c, '1 of 3'), '', 'a near ticket, yesterday');
});

test("review: another customer's unnamed tags never borrow a name or take its saved row", () => {
  const t = load(), { sh, c } = modern(t);
  t.scan(named(1, 2, '7770600', 'Synthers'));
  t.scan({ ...blank(1, 2, '7770620'), phone: '8155550999' }); t.scan({ ...blank(2, 2, '7770621'), phone: '8155550999' });
  const rows = [...Array(10).keys()].map(k => k + 2).filter(r => sh.get(r, c.TICKET) === '7770620' || sh.get(r, c.TICKET) === '7770621');
  for (const r of rows) assert.equal(sh.get(r, c.NAME), '', 'row ' + r);
  const u = load(), m = modern(u);
  u.scan(blank(1, 2, '7770620')); u.scan(named(1, 2, '7770600', 'Synthers'));
  assert.equal(m.sh.get(2, m.c.NAME), '', 'a named "1 of 2" never fills another blank "1 of 2"');
});

test('when the named tags disagree, a blank tag is left for her', () => {
  const t = load(), { sh, c } = modern(t);
  t.scan(named(1, 3, '7770601', 'Synthanson')); t.scan(named(2, 3, '7770602', 'Synthwick'));
  t.scan(blank(3, 3, '7770603'));
  assert.equal(nameOf(sh, c, '3 of 3'), '');
});

test('a close misread among the named tags still fills, with the most common reading', () => {
  const t = load(), { sh, c } = modern(t);
  t.scan(named(1, 4, '7770601', 'Synthanson')); t.scan(named(2, 4, '7770602', 'Synthanson')); t.scan(named(3, 4, '7770603', 'Synthansen'));
  t.scan(blank(4, 4, '7770604'));
  assert.equal(nameOf(sh, c, '4 of 4'), 'Synthanson (?)');
});

test('review: with no phones, two rows with one "k of N" mean two groups: nothing is borrowed or filled', () => {
  const t = load(), { sh, c } = modern(t);
  t.scan(named(1, 2, '7770600', 'Synthers'));
  t.scan(blank(1, 2, '7770620')); t.scan(blank(2, 2, '7770621'));
  t.scan(named(2, 2, '7770601', 'Synthers'));
  assert.equal(sh.get(2, c.NAME), 'Synthers');
  const other = [...Array(10).keys()].map(k => k + 2).filter(r => ['7770620', '7770621'].includes(sh.get(r, c.TICKET)));
  assert.equal(other.length, 2); for (const r of other) assert.equal(sh.get(r, c.NAME), '', 'row ' + r);
  assert.equal(sh.get(3, c.TICKET), '7770601', "Synthers' 2 of 2 keeps its saved row");
  const u = load(), m = modern(u); // two blank "2 of 2" before the named "1 of 2": neither is filled
  u.scan(blank(2, 2, '7770630')); u.scan(blank(2, 2, '7770602')); u.scan(named(1, 2, '7770600', 'Synthers'));
  assert.equal(m.sh.get(2, m.c.NAME), ''); assert.equal(m.sh.get(3, m.c.NAME), '');
});

test('a borrowed name drops the "No customer name" flag; far in the book (over 10) it fills the name but takes no saved row', () => {
  const t = load(), { sh, c } = modern(t);
  t.scan(named(1, 3, '7770600'));
  t.scan(blank(2, 3, '7770601'));
  const r = rowOf(sh, c, '2 of 3'), notes = [...sh.notes.entries()].filter(([k]) => k.startsWith(r + ',')).map(([, v]) => v).join('\n');
  assert.equal(r, 3, 'near: takes the saved row'); assert.doesNotMatch(notes, /No customer name/);
  t.scan(blank(3, 3, '7770640'));
  const f = rowOf(sh, c, '3 of 3');
  assert.equal(sh.get(f, c.NAME), 'Synthanson (?)'); assert.notEqual(f, 4, 'far: the saved row stays for the group');
});

test('review: a name the scanner filled never lets another tag take the saved row (no chain of fills)', () => {
  const t = load(), { sh, c } = modern(t);
  t.scan(blank(2, 3, '7770640'));
  t.scan(named(1, 3, '7770600', 'Synthers'));
  assert.equal(nameOf(sh, c, '2 of 3'), 'Synthers (?)');
  const held = [...Array(10).keys()].map(k => k + 2).filter(r => /Saved for the rest/.test(sh.notes.get(sh.key(r, 1)) || ''));
  t.scan(blank(3, 3, '7770641'));
  assert.ok(held.length >= 1); assert.notEqual(rowOf(sh, c, '3 of 3'), held[0], 'the saved row stays for the named group');
});

console.log(`${passed} group name tests passed`);
