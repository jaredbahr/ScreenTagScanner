'use strict';
// Kirsten, 2026-11-10: new tags landed in old empty rows among October's rows (an expired group hold, a cleared
// row), so she missed them; and a "Van der …" surname was not matched to its last word. Synthetic data only.
const assert = require('node:assert/strict');
const { load } = require('./offline.test.cjs');
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS ' + name); }
function modern(t, tab = 'New Lenox') {
  const sh = t.ss.tabs[tab];
  sh.insertColumnAfter(15); sh.set(1, 16, 'Tag x of N'); sh.insertColumnAfter(3); sh.set(1, 4, 'Tag x of N');
  return { sh, c: t.ctx.storeLayout_(sh).screens };
}
const job = (name, ticket, i, n, phone, extra = {}) => ({ store: 'New Lenox', last_name: name, customer_name: name, phone, ticket_number: ticket,
  tag_index: i, tag_count: n, width_in: 20 + i, height_in: 30, billable_inches: 50 + i, ...extra });
const rowOf = (sh, c, name) => [...Array(60).keys()].map(k => k + 2).filter(r => sh.get(r, c.NAME) === name);

test('a new tag goes below the last filled row, not into an empty row higher up', () => {
  const t = load(), { sh, c } = modern(t);
  t.scan(job('Synthone', '7777901', 1, 1, '6305550101')); t.scan(job('Synthtwo', '7777903', 1, 1, '6305550102'));
  t.scan(job('Synththree', '7777905', 1, 1, '6305550103'));
  for (const col of [c.DATE_IN, c.NAME, c.SEQUENCE, c.DATE_OUT, c.TICKET, c.UNI_IN, c.SCREENING, c.LB_EARN]) sh.set(3, col, ''); // Kirsten cleared row 3
  t.scan(job('Synthfour', '7777907', 1, 1, '6305550104'));
  assert.deepEqual(rowOf(sh, c, 'Synthfour'), [5], 'below the last filled row'); assert.equal(sh.get(3, c.NAME), '', 'the cleared row stays empty');
});

test('an expired group hold high up is not reused once rows below are filled', () => {
  const t = load({ now: new Date('2026-10-01T17:00:00Z') }), { sh, c } = modern(t);
  t.scan(job('Synthold', '7777901', 1, 2, '6305550201')); // holds row 3 for 2 of 2
  t.setNow(new Date('2026-10-20T17:00:00Z'));
  t.scan(job('Synthmid', '7777920', 1, 1, '6305550202')); // the expired hold right after is the bottom: used
  t.scan(job('Synthlate', '7777922', 1, 1, '6305550203'));
  assert.deepEqual(rowOf(sh, c, 'Synthlate'), [4]);
});

test('when the bottom of the tab is full, an empty row higher up is used and noted', () => {
  const t = load(), { sh, c } = modern(t), end = t.ctx.screenBlockEnd_(sh);
  sh.set(end, c.NAME, 'Last row'); sh.set(end, c.DATE_IN, 46300);
  const r = t.scan(job('Synthfull', '7777931', 1, 1, '6305550301'));
  assert.deepEqual(rowOf(sh, c, 'Synthfull'), [2]);
  const h = t.ctx.HEADERS, log = t.ss.tabs.Scans.getDataRange().getValues().find(v => String(v[h.indexOf('Ticket #')]) === '7777931');
  assert.match(String(log[h.indexOf('Review Reason')]), /Placed in an empty row higher up: the rows at the bottom of the New Lenox tab are full/);
});

test('a surname with a particle matches its last word ("Van der Synthwal" / "Synthwal"), and nothing looser', () => {
  const c = load().ctx;
  for (const [a, b] of [['Van der Synthwal', 'Synthwal'], ['Vander Synthwal', 'synthwal'], ['Della Synthora', 'Synthora'], ['McSynthold', 'Synthold'], ['St Synthier', 'Synthier']])
    assert.equal(c.namesClose_(a, b), true, a + ' / ' + b);
  for (const [a, b] of [['Synthson', 'Son'], ['Abersynth', 'Synth'], ['Synthane', 'Gorbank']])
    assert.equal(c.namesClose_(a, b), false, a + ' / ' + b);
});

console.log(`${passed} placement tests passed`);
