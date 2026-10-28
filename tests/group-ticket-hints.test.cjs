'use strict';
// Ticket suggestions from the group's other tickets, and 8-digit reads (Kirsten's 10/27 fixes). Synthetic data only.
const assert = require('node:assert/strict');
const { load } = require('./offline.test.cjs');
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS ' + name); }
function modern(t, tab = 'New Lenox') {
  const sh = t.ss.tabs[tab];
  sh.insertColumnAfter(15); sh.set(1, 16, 'Tag x of N'); sh.insertColumnAfter(3); sh.set(1, 4, 'Tag x of N');
  return { sh, c: t.ctx.storeLayout_(sh).screens };
}
const tag = (i, n, tk, x = {}) => ({ store: 'New Lenox', customer_name: 'Nick Synthpas', last_name: 'Synthpas', phone: '8155550190',
  ticket_number: tk, tag_index: i, tag_count: n, width_in: 20 + i, height_in: 30, billable_inches: 50 + i, ...x });
const ticketNote = (sh, c, seq) => { const r = [...Array(30).keys()].map(k => k + 2).find(k => sh.get(k, c.SEQUENCE) === seq); return sh.notes.get(sh.key(r, c.TICKET)) || ''; };

test('every other tag scanned and one gap: "likely" the ticket that fits (777764 -> 7777642)', () => {
  const t = load(), { sh, c } = modern(t);
  [[1, '7777640'], [2, '7777641'], [4, '7777643'], [5, '7777644'], [6, '7777645']].forEach(([i, tk]) => t.scan(tag(i, 6, tk)));
  t.scan(tag(3, 6, '777764'));
  assert.match(ticketNote(sh, c, '3 of 6'), /Ticket # 777764 is missing a digit: likely 7777642 \(fits this group's tickets\)/);
});

test('review: the one gap is "could be", not "likely", when tags are still missing', () => {
  const t = load(), { sh, c } = modern(t);
  [[1, '7777640'], [2, '7777641'], [4, '7777643'], [5, '7777644']].forEach(([i, tk]) => t.scan(tag(i, 7, tk)));
  t.scan(tag(3, 7, '777764'));
  const note = ticketNote(sh, c, '3 of 7');
  assert.doesNotMatch(note, /likely/); assert.match(note, /could be 7777642/);
});

test('review: a voided ticket inside the range is not "likely" when tickets rise with the tag number', () => {
  const t = load(), { sh, c } = modern(t);
  [[2, '7777641'], [3, '7777642'], [4, '7777644'], [5, '7777645'], [6, '7777646']].forEach(([i, tk]) => t.scan(tag(i, 6, tk)));
  t.scan(tag(1, 6, '777764'));
  assert.doesNotMatch(ticketNote(sh, c, '1 of 6'), /likely/);
});

test('review: one tag placed twice is not a one-ticket order; another group\'s same "k of N" blocks "likely"', () => {
  const t = load(), { sh, c } = modern(t);
  t.scan(tag(2, 3, '7777641')); t.scan(tag(2, 3, '7777641', { width_in: 35 }));
  t.scan(tag(1, 3, '777764'));
  assert.doesNotMatch(ticketNote(sh, c, '1 of 3'), /likely 7777641/);
  const u = load(), m = modern(u);
  u.scan(tag(2, 3, '7777643')); u.scan(tag(3, 3, '7777641'));
  u.scan(tag(1, 3, '7777648', { customer_name: null, last_name: null, phone: null, width_in: 33 })); // another job's 1 of 3
  u.scan(tag(1, 3, '777764'));
  const note = [...m.sh.notes.values()].find(v => v.includes('Ticket # 777764 is missing')) || '';
  assert.match(note, /could be 7777642/); assert.doesNotMatch(note, /likely/);
});

test('review: one candidate with a tag still unscanned is "could be", never "likely"', () => {
  const t = load(), { sh, c } = modern(t);
  [[1, '7777640'], [2, '7777641']].forEach(([i, tk]) => t.scan(tag(i, 4, tk)));
  t.scan(tag(3, 4, '777764'));
  const note = ticketNote(sh, c, '3 of 4');
  assert.match(note, /could be 7777642 \(from this group's tickets\)/); assert.doesNotMatch(note, /likely/);
});

test('two or three gaps: the candidates are listed (777763 -> 7777632, 7777634 or 7777635)', () => {
  const t = load(), { sh, c } = modern(t);
  [[2, '7777631'], [4, '7777633'], [5, '7777636'], [6, '7777637'], [3, '7777638']].forEach(([i, tk]) => t.scan(tag(i, 6, tk)));
  t.scan(tag(1, 6, '777763'));
  assert.match(ticketNote(sh, c, '1 of 6'), /could be 7777632, 7777634 or 7777635 \(from this group's tickets\)/);
});

test('review: with tags still unscanned there is no "likely"; the end of the range is a choice too', () => {
  const t = load(), { sh, c } = modern(t);
  [[2, '7777641'], [4, '7777643'], [5, '7777644']].forEach(([i, tk]) => t.scan(tag(i, 5, tk)));
  t.scan(tag(1, 5, '777764'));
  const note = ticketNote(sh, c, '1 of 5');
  assert.doesNotMatch(note, /likely 7777642/); assert.match(note, /could be 7777640, 7777642 or 7777645/);
});

test("another customer's tickets never narrow it; with one sibling the store hint is kept", () => {
  const t = load(), { sh, c } = modern(t);
  [[1, '7777640'], [2, '7777642']].forEach(([i, tk]) => t.scan(tag(i, 3, tk, { customer_name: 'Ann Synthwick', last_name: 'Synthwick' })));
  t.scan(tag(3, 3, '777764'));
  assert.doesNotMatch(ticketNote(sh, c, '3 of 3'), /fits this group|gaps in this group/);
});

test("an 8-digit read: one digit dropped into the store's series (77792855 -> 7779255)", () => {
  const t = load(), sh = t.ss.tabs['18559-(500)'];
  const one = (tk, i) => ({ store: 'Downers Grove', customer_name: 'Synth ' + i, last_name: 'Synth' + i, ticket_number: tk, tag_index: 1, tag_count: 1, width_in: 20 + i, height_in: 30, billable_inches: 50 + i });
  t.scan(one('7779250', 1)); t.scan(one('7779260', 2));
  t.scan(one('77792855', 3));
  const note = [...sh.notes.values()].find(v => v.includes('77792855')) || '';
  assert.match(note, /Ticket # 77792855 has 8 digits: could be 7779255 or 7779285/, 'two readings fit the series: both listed');
});

test('one ticket for the whole order (Homer Glen style): "likely" that ticket even though it is on the tab', () => {
  const t = load(), { sh, c } = modern(t);
  [1, 2, 3, 4].forEach(i => t.scan(tag(i, 5, '7777956')));
  t.scan(tag(5, 5, '777795'));
  assert.match(ticketNote(sh, c, '5 of 5'), /likely 7777956 \(the group's other tags all read it\)/);
});

test('gaps inside the range first when they can hold every unscanned tag (replay: 9-tag group over two books)', () => {
  const t = load(), { sh, c } = modern(t);
  t.scan(tag(1, 1, '7777604', { customer_name: 'Sam Synthson', last_name: 'Synthson', phone: '8155550777' })); // another job's ticket: not a choice
  [[1, '7777601'], [2, '7777609'], [3, '7777640'], [4, '7777642'], [5, '7777645']].forEach(([i, tk]) => t.scan(tag(i, 9, tk)));
  t.scan(tag(6, 9, '777764'));
  const note = ticketNote(sh, c, '6 of 9');
  assert.match(note, /could be 7777641, 7777643 or 7777644 \(from this group's tickets\)/); assert.doesNotMatch(note, /likely/);
  const u = load(), m = modern(u); // without that job, 7777604 is a fourth choice: no group hint, the store hint stays
  [[1, '7777601'], [2, '7777609'], [3, '7777640'], [4, '7777642'], [5, '7777645']].forEach(([i, tk]) => u.scan(tag(i, 9, tk)));
  u.scan(tag(6, 9, '777764'));
  assert.doesNotMatch(ticketNote(m.sh, m.c, '6 of 9'), /from this group|likely/);
});

console.log(`${passed} group ticket hint tests passed`);
