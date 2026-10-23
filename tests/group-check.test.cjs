'use strict';
// Group check, looser group matching, short last names and review-level fixes (0.13.22).
// Patterns from the October 22 scans, with invented names and tickets.
const assert = require('node:assert/strict');
const { load } = require('./offline.test.cjs');
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS ' + name); }

function modern(t, tab) {
  const sh = t.ss.tabs[tab];
  sh.insertColumnAfter(15); sh.set(1, 16, 'Tag x of N'); sh.insertColumnAfter(3); sh.set(1, 4, 'Tag x of N');
  return { sh, c: t.ctx.storeLayout_(sh).screens };
}
let size = 0;
const tag = (store, name, ticket, i, n, extra = {}) => { size++;
  return { store, last_name: name, customer_name: name, ticket_number: ticket, tag_index: i, tag_count: n,
    width_in: 20 + size, height_in: 30, billable_inches: 50 + size, ...extra }; };
const note = (sh, r, col) => sh.notes.get(r + ',' + col) || '';
const rowOf = (sh, c, ticket) => [...Array(60).keys()].map(i => i + 2).find(r => sh.get(r, c.TICKET) === ticket);

test('same-ticket group (Homer style): a name or ticket read differently gets a note on that cell only', () => {
  const t = load(), { sh, c } = modern(t, 'Homer Glen');
  t.scan(tag('HOMER', 'Synthrus', '8169901', 4, 6));
  const r = t.scan(tag('HOMER', 'Synthbus', '8169601', 3, 6)); // one letter and one digit misread
  const row = 3;
  assert.equal(sh.get(row, c.NAME), 'Synthbus', 'values are never changed');
  assert.match(note(sh, row, c.NAME), /Group check \(name\): this tag reads "synthbus"; other tags in this group read "synthrus" \(rows 2\)/);
  assert.match(note(sh, row, c.TICKET), /Group check \(ticket\): 8169601 is far from the rest of this group \(8169901, rows 2\)/);
  t.scan(tag('HOMER', 'Synthrus', '8169901', 2, 6));
  t.scan(tag('HOMER', 'Synthrus', '8169501', 1, 6)); // two agreeing tags: the shared-ticket wording
  assert.match(note(sh, rowOf(sh, c, '8169501'), c.TICKET), /this tag reads 8169501; 2 other tags in this group read 8169901/);
  assert.doesNotMatch(r.message, /Flagged/, 'cell notes, not a yellow row');
  assert.notEqual(sh.bg.get(row + ',' + c.DATE_IN), t.ctx.FLAG_COLOR);
});

test('sequential-ticket group (Joliet style): a ticket far from the others and a misread name are noted', () => {
  const t = load(), { sh, c } = modern(t, '18650 (60)');
  t.scan(tag('Joliet', 'Synthsur', '6475356', 3, 4));
  t.scan(tag('Joliet', 'Synthsur', '6475357', 4, 4));
  t.scan(tag('Joliet', 'Synthsur', '6475450', 2, 4));
  assert.match(note(sh, rowOf(sh, c, '6475450'), c.TICKET), /Group check \(ticket\): 6475450 is far from the rest of this group \(6475356–6475357, rows 2, 3\)/);
  t.scan(tag('Joliet', 'Synthsurm', '6475358', 1, 4));
  assert.match(note(sh, rowOf(sh, c, '6475358'), c.NAME), /Group check \(name\): this tag reads "synthsurm"; other tags in this group read "synthsur"/);
});

test('the same "x of N" twice: noted with what is still missing', () => {
  const t = load(), { sh, c } = modern(t, 'New Lenox');
  [12, 11, 2, 6, 5, 4, 1, 3, 9].forEach((i, k) => t.scan(tag('New Lenox', 'Synthdoz', String(7708100 + k), i, 12)));
  t.scan(tag('New Lenox', 'Synthdoz', '7708118', 4, 12));
  const r = rowOf(sh, c, '7708118');
  assert.ok(r, 'written');
  assert.match(note(sh, r, c.SEQUENCE), /Group check \(tag\): 4 of 12 is already on row \d+; not yet on the tab: 7, 8, 10 of 12\./);
});

test('different customers with the same N are not treated as one group', () => {
  const t = load(), { sh, c } = modern(t, 'New Lenox');
  t.scan(tag('New Lenox', 'Synthalpha', '7707601', 1, 2));
  t.scan(tag('New Lenox', 'Synthomega', '7707950', 1, 2));
  for (let r = 2; r <= 6; r++) for (const col of [c.NAME, c.TICKET, c.SEQUENCE]) assert.doesNotMatch(note(sh, r, col), /Group check/);
});

test('grey rows are filled even when the name is misread by a letter (looser matching)', () => {
  const t = load(), { sh, c } = modern(t, '18650 (60)');
  t.scan(tag('Joliet', 'Synthsurm', '6475501', 1, 3));
  t.scan(tag('Joliet', 'Synthother', '6475900', 1, 1));
  t.scan(tag('Joliet', 'Synthsurim', '6475502', 2, 3));
  assert.equal(sh.get(3, c.TICKET), '6475502', 'the misread-name tag still fills the held row');
  assert.equal(sh.get(5, c.TICKET), '6475900');
});

test('a one- or two-letter last name keeps the name as written ("Ann B" pattern)', () => {
  const t = load();
  assert.equal(t.ctx.sheetName_({ last_name: 'S', customer_name: 'Synthsteve S' }), 'Synthsteve S');
  assert.equal(t.ctx.sheetName_({ last_name: 'Synthlast', customer_name: 'Ann Synthlast' }), 'Synthlast');
  assert.equal(t.ctx.sheetName_({ last_name: 'S', customer_name: 'Synthsteve S', name_unclear: true }), 'Synthsteve S (?)');
});

test('review levels: four October false alarms move off the yellow row; money stays yellow', () => {
  const tier = s => { const r = load().ctx.reviewTier_(s); return r.tier + (r.field ? ':' + r.field : ''); };
  assert.equal(tier("Correction/refund: Qty 'of N' total appears overwritten: a 4 written over/crossed and rewritten as 5"), 'cell:SEQUENCE');
  assert.equal(tier('ticket_number: second digit group could be 8159954 or 8154954 (handwriting 5/4 ambiguity)'), 'cell:TICKET');
  assert.equal(tier('height_in: could be 35 or 37; 30+35=65 matches QTY'), 'log');
  assert.equal(tier('Correction/refund: Date field has a crossed-out/overwritten middle portion (10/[crossed out]/19)'), 'cell:DATE_IN');
  // Still yellow:
  assert.equal(tier('Correction/refund: Pet screen rows circled/crossed out with handwritten refund'), 'row');
  assert.equal(tier('height_in: could be 35 or 37; QTY row reads 70 but totals disagree'), 'row');
  assert.equal(tier('Group extras need manual allocation; never multiply by tag/frame count'), 'row');
  assert.equal(tier('Correction/refund: A scribbled-out line above the spring pins row (crossed out, unreadable).'), 'row');
});

console.log(`${passed} group-check tests passed`);
