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

test('one gap in the group: "likely" the ticket that fits (770764 -> 7707641)', () => {
  const t = load(), { sh, c } = modern(t);
  [[1, '7777640'], [4, '7777642'], [5, '7777643'], [6, '7777644'], [8, '7777645']].forEach(([i, tk]) => t.scan(tag(i, 9, tk)));
  t.scan(tag(3, 9, '777764'));
  assert.match(ticketNote(sh, c, '3 of 9'), /Ticket # 777764 is missing a digit: likely 7777641 \(fits this group's tickets\)/);
});

test('two or three gaps: the candidates are listed (770763 -> 7707632, 7707634 or 7707635)', () => {
  const t = load(), { sh, c } = modern(t);
  [[2, '7777631'], [4, '7777633'], [5, '7777636'], [7, '7777637'], [8, '7777638']].forEach(([i, tk]) => t.scan(tag(i, 8, tk)));
  t.scan(tag(1, 8, '777763'));
  assert.match(ticketNote(sh, c, '1 of 8'), /could be 7777632, 7777634 or 7777635 \(gaps in this group's tickets\)/);
});

test("another customer's tickets never narrow it; with one sibling the store hint is kept", () => {
  const t = load(), { sh, c } = modern(t);
  [[1, '7777640'], [2, '7777642']].forEach(([i, tk]) => t.scan(tag(i, 3, tk, { customer_name: 'Ann Synthwick', last_name: 'Synthwick' })));
  t.scan(tag(3, 3, '777764'));
  assert.doesNotMatch(ticketNote(sh, c, '3 of 3'), /fits this group|gaps in this group/);
});

test("an 8-digit read: one digit dropped into the store's series (81592855 -> 8159255)", () => {
  const t = load(), sh = t.ss.tabs['18559-(500)'];
  const one = (tk, i) => ({ store: 'Downers Grove', customer_name: 'Synth ' + i, last_name: 'Synth' + i, ticket_number: tk, tag_index: 1, tag_count: 1, width_in: 20 + i, height_in: 30, billable_inches: 50 + i });
  t.scan(one('7779250', 1)); t.scan(one('7779260', 2));
  t.scan(one('77792855', 3));
  const note = [...sh.notes.values()].find(v => v.includes('77792855')) || '';
  assert.match(note, /Ticket # 77792855 has 8 digits: likely 7779255/);
});

console.log(`${passed} group ticket hint tests passed`);
