'use strict';
// Group holds that match on the phone and survive a changed tag count (0.13.27; Kirsten, 2026-10-24: a Joliet group
// whose tags spelled the name two ways, and a Downers Grove order that grew from 6 tags to 7). Synthetic data only.
const assert = require('node:assert/strict');
const { load } = require('./offline.test.cjs');
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS ' + name); }
function modern(t, tab) {
  const sh = t.ss.tabs[tab];
  sh.insertColumnAfter(15); sh.set(1, 16, 'Tag x of N'); sh.insertColumnAfter(3); sh.set(1, 4, 'Tag x of N');
  return { sh, c: t.ctx.storeLayout_(sh).screens };
}
const tag = (store, customer, last, phone, ticket, i, n, extra = {}) => ({ store, customer_name: customer, last_name: last, phone,
  ticket_number: ticket, tag_index: i, tag_count: n, width_in: 19 + i, height_in: 28, billable_inches: 47 + i, ...extra });
const held = (t, sh, r) => !!t.ctx.holdAt_(sh.notes.get(r + ',1') || '', t.ctx.groupHoldMeta_(sh), r);
const heldRows = (t, sh) => { const out = []; for (let r = 2; r < 40; r++) if (held(t, sh, r)) out.push(r); return out; };
const row = (sh, c, r) => [sh.get(r, c.NAME), sh.get(r, c.SEQUENCE), sh.get(r, c.TICKET)];

test('Joliet pattern: the name written two ways and a 6 read as 0, same phone: the last tag fills the saved row', () => {
  const t = load(), { sh, c } = modern(t, '18650 (60)');
  const j = (cust, last, tk, i) => tag('Joliet', cust, last, '815-555-0142', tk, i, 3);
  t.scan(j('Gary S', 'S', '771350', 2)); // a 6-digit read
  t.scan(j('Gary S', 'S', '7771353', 3));
  assert.deepEqual(heldRows(t, sh), [4], 'one row saved for tag 1');
  t.scan(j('Gary Synthmac', 'Synthmac', '0771349', 1));
  assert.deepEqual(row(sh, c, 4), ['Synthmac', '1 of 3', '0771349']);
  assert.deepEqual(heldRows(t, sh), [], 'no grey row left'); assert.equal(sh.get(5, c.NAME), '', 'no extra line');
  assert.match(sh.notes.get('4,' + c.NAME) || '', /Group check \(name\): this tag reads "synthmac"; the tag that saved this row reads "gary s"/);
  assert.notEqual(sh.bg.get('4,' + c.DATE_IN), t.ctx.FLAG_COLOR, 'a name note, not a yellow row');
});

test('a different phone does not fill the saved row, even with a near ticket', () => {
  const t = load(), { sh, c } = modern(t, '18650 (60)');
  t.scan(tag('Joliet', 'Gary S', 'S', '815-555-0142', '7771350', 2, 3)); t.scan(tag('Joliet', 'Gary S', 'S', '815-555-0142', '7771353', 3, 3));
  t.scan(tag('Joliet', 'Pat Synthel', 'Synthel', '815-555-0199', '7771349', 1, 3));
  assert.ok(held(t, sh, 4)); assert.equal(sh.get(5, c.NAME), 'Synthel');
});

test('the same phone with tickets far apart is a different order', () => {
  const r = load().ctx.groupHoldRank_;
  const h = { name: 's', of: 3, ticket: '7771350', day: 9, phone: '5550142' };
  assert.equal(r(h, { name: 'synthmac', of: 3, ticket: '0771349', phone: '5550142' }, 9), 2);
  assert.equal(r(h, { name: 'synthmac', of: 3, ticket: '7771449', phone: '5550142' }, 9), 0, '99 apart');
  assert.equal(r(h, { name: 'synthmac', of: 3, ticket: '0771349', phone: '' }, 9), 0, 'no phone read');
  assert.equal(r({ ...h, phone: undefined }, { name: 'synthmac', of: 3, ticket: '0771349', phone: '5550142' }, 9), 0, 'older holds have no phone');
});

test('Downers Grove pattern: "1 of 6", then the order grows to 7: the saved rows are reused and one more is saved', () => {
  const t = load(), { sh, c } = modern(t, '18559-(500)');
  const d = (tk, i, n, extra) => tag('Downers Grove', 'Synthani', 'Synthani', '773-555-0177', tk, i, n, extra);
  t.scan(d('7779122', 1, 6));
  assert.deepEqual(heldRows(t, sh), [3, 4, 5, 6, 7]);
  t.scan(d('7779128', 7, 7, { form_type: 'new_build' }));
  assert.deepEqual(row(sh, c, 3), ['Synthani', '7 of 7', '7779128'], 'fills the first saved row');
  assert.deepEqual(heldRows(t, sh), [4, 5, 6, 7, 8], 'still one row per missing tag (2-6)');
  assert.match(sh.notes.get('4,1'), /Synthani group \(7 tags\)/);
  assert.match(sh.notes.get('3,' + c.SEQUENCE) || '', /Group check \(tag\): this tag says 7 of 7; an earlier tag of this group says of 6\. 1 more row saved for the group\. Check the tag count/);
  t.scan(d('777913', 4, 7, { form_type: 'new_build' })); // a 6-digit read, same customer
  assert.deepEqual(row(sh, c, 4), ['Synthani', '4 of 7', '777913']);
  for (const [tk, i] of [['7779123', 2], ['7779124', 3], ['7779126', 5], ['7779127', 6]]) t.scan(d(tk, i, 7));
  assert.deepEqual(heldRows(t, sh), [], 'every saved row used'); assert.equal(sh.get(10, c.NAME), '', 'no extra lines');
  assert.deepEqual([2, 3, 4, 5, 6, 7, 8].map(r => sh.get(r, c.NAME)), Array(7).fill('Synthani'));
});

test('tags that still say the old count keep filling the group', () => {
  const t = load(), { sh, c } = modern(t, '18559-(500)');
  const d = (tk, i, n) => tag('Downers Grove', 'Synthani', 'Synthani', '773-555-0177', tk, i, n);
  t.scan(d('7779122', 1, 3)); t.scan(d('7779125', 4, 4)); t.scan(d('7779123', 2, 3)); t.scan(d('7779124', 3, 3));
  assert.deepEqual([2, 3, 4, 5].map(r => sh.get(r, c.SEQUENCE)), ['1 of 3', '4 of 4', '2 of 3', '3 of 3']);
  assert.deepEqual(heldRows(t, sh), []);
});

test('a smaller count never frees saved rows, and says so', () => {
  const t = load(), { sh, c } = modern(t, '18559-(500)');
  const d = (tk, i, n) => tag('Downers Grove', 'Synthani', 'Synthani', '773-555-0177', tk, i, n);
  t.scan(d('7779122', 1, 4)); t.scan(d('7779123', 2, 3));
  assert.equal(sh.get(3, c.SEQUENCE), '2 of 3'); assert.deepEqual(heldRows(t, sh), [4, 5]);
  assert.match(sh.notes.get('4,1'), /group \(4 tags\)/);
  const note = sh.notes.get('3,' + c.SEQUENCE) || '';
  assert.match(note, /this tag says 2 of 3; an earlier tag of this group says of 4\. Check the tag count/); assert.doesNotMatch(note, /now cover/);
});

test('a different count with only a loose match (same name, far ticket, no phone) starts its own group', () => {
  const t = load(), { sh, c } = modern(t, '18559-(500)');
  t.scan(tag('Downers Grove', 'Synthani', 'Synthani', null, '7779122', 1, 3));
  t.scan(tag('Downers Grove', 'Synthani', 'Synthani', null, '7770900', 1, 2));
  assert.equal(sh.get(5, c.SEQUENCE), '1 of 2'); assert.ok(held(t, sh, 3) && held(t, sh, 4) && held(t, sh, 6));
});

test('growing a group never saves a typed-in or noted row, and keeps Kirsten\'s own line on a saved row', () => {
  const t = load(), { sh, c } = modern(t, '18559-(500)');
  const d = (tk, i, n) => tag('Downers Grove', 'Synthani', 'Synthani', '773-555-0177', tk, i, n);
  t.scan(d('7779122', 1, 3));
  sh.notes.set('4,1', 'Kirsten: two more coming\n' + sh.notes.get('4,1'));
  sh.notes.set('5,1', 'Kirsten: keep');
  t.scan(d('7779126', 5, 5));
  assert.equal(sh.get(3, c.SEQUENCE), '5 of 5');
  assert.deepEqual(heldRows(t, sh), [4], 'row 5 has her note: not saved');
  assert.match(sh.notes.get('4,1'), /^Kirsten: two more coming\nSaved for the rest of the Synthani group \(5 tags\)/);
  assert.equal(sh.notes.get('5,1'), 'Kirsten: keep');
});

test('the phone stays in the hidden row data; the visible fallback note never shows it', () => {
  const t = load(), { sh } = modern(t, '18650 (60)');
  t.scan(tag('Joliet', 'Gary S', 'S', '815-555-0142', '7771350', 1, 2));
  assert.match(sh.devMeta[0].value, /"phone":"5550142"/); assert.doesNotMatch(sh.notes.get('3,1'), /555/);
  const u = load(), m = modern(u, '18650 (60)'); m.sh.failMetadata = true;
  u.scan(tag('Joliet', 'Gary S', 'S', '815-555-0142', '7771350', 1, 2));
  assert.match(m.sh.notes.get('3,1'), /GROUP_HOLD_V1/); assert.doesNotMatch(m.sh.notes.get('3,1'), /555/);
});

test('review of #23: growing a group never re-greys rows Kirsten typed into, and keeps her colours', () => {
  const t = load(), { sh, c } = modern(t, '18559-(500)');
  const d = (tk, i, n) => tag('Downers Grove', 'Synthani', 'Synthani', '773-555-0177', tk, i, n);
  t.scan(d('7779122', 1, 4)); // holds 3-5
  sh.set(3, c.NAME, 'Typed'); sh.bg.set('3,' + c.TICKET, t.ctx.HINT_COLOR);
  sh.set(5, c.NAME, 'Typed too'); sh.bg.set('5,' + c.TICKET, t.ctx.FLAG_COLOR);
  t.scan(d('7779126', 5, 5));
  assert.equal(sh.get(4, c.SEQUENCE), '5 of 5', 'the blank held row is used');
  assert.ok(!held(t, sh, 3) && !held(t, sh, 5), 'typed-in rows are released, not re-held');
  assert.equal(sh.bg.get('3,' + c.TICKET), t.ctx.HINT_COLOR); assert.equal(sh.bg.get('5,' + c.TICKET), t.ctx.FLAG_COLOR);
  assert.notEqual(sh.bg.get('3,' + c.NAME), t.ctx.HOLD_COLOR);
  assert.deepEqual(heldRows(t, sh), [], 'no row saved past a typed-in row');
  assert.match(sh.notes.get('4,' + c.SEQUENCE) || '', /No more rows could be saved right after the group/);
});

test('review of #23: close names with near tickets but different phones never cross a changed count', () => {
  const t = load(), { sh, c } = modern(t, '18559-(500)');
  t.scan(tag('Downers Grove', 'Ward', 'Ward', '773-555-0101', '7779100', 1, 3));
  t.scan(tag('Downers Grove', 'Wood', 'Wood', '773-555-0202', '7779110', 1, 2));
  assert.ok(held(t, sh, 3) && held(t, sh, 4), "Ward's rows stay saved"); assert.equal(sh.get(5, c.NAME), 'Wood');
  assert.match(sh.notes.get('3,1'), /Ward group \(3 tags\)/);
  const r = load().ctx; // one digit apart is a misread, not another customer
  assert.equal(r.phonesDiffer_('5550142', '5550742'), false); assert.equal(r.phonesDiffer_('5550142', '5551742'), true);
});

test('review of #23: a placeholder phone or an unrelated name does not match on the phone', () => {
  const r = load().ctx;
  assert.equal(r.phoneKey_('000-000-0000'), ''); assert.equal(r.phoneKey_('555-5555'), ''); assert.equal(r.phoneKey_('815-555-0142'), '5550142');
  const h = { name: 'ward', of: 3, ticket: '7779100', day: 9, phone: '5550142' };
  assert.equal(r.groupHoldRank_(h, { name: 'synthzel', of: 3, ticket: '7779110', phone: '5550142' }, 9), 0, 'same phone, unrelated name');
  assert.equal(r.groupHoldRank_(h, { name: 'synthzel', of: 3, ticket: '7779100', phone: '5550142' }, 9), 2, 'same phone and the same ticket');
  assert.equal(r.namesFit_('gary s', 'synthmac'), true); assert.equal(r.namesFit_('pat synthel', 'synthel'), true);
  assert.equal(r.namesFit_('ward', 'synthzel'), false);
});

test('review of #23: the same customer\'s next order gets its own saved rows', () => {
  const t = load(), { sh, c } = modern(t, '18559-(500)');
  const d = (tk, i, n) => tag('Downers Grove', 'Synthani', 'Synthani', '773-555-0177', tk, i, n);
  t.scan(d('7779122', 1, 2)); t.scan(d('7779123', 2, 2));
  t.scan(d('7779140', 1, 3));
  assert.equal(sh.get(4, c.SEQUENCE), '1 of 3'); assert.deepEqual(heldRows(t, sh), [5, 6]);
});

test('review of #23: a reprinted "of 7" tag after a finished "of 6" group gets rows and a note', () => {
  const t = load(), { sh, c } = modern(t, '18559-(500)');
  const d = (tk, i, n) => tag('Downers Grove', 'Synthani', 'Synthani', '773-555-0177', tk, i, n);
  for (let i = 1; i <= 6; i++) t.scan(d('777912' + i, i, 6));
  t.scan(d('7779128', 4, 7));
  assert.equal(sh.get(8, c.SEQUENCE), '4 of 7');
  assert.match(sh.notes.get('8,' + c.SEQUENCE) || '', /an earlier group of this customer says of 6\. If this tag belongs to that order, delete the grey rows' notes/);
});

test('review of #23: the count note says when there was no room to save every extra row', () => {
  const t = load(), { sh, c } = modern(t, '18559-(500)');
  const d = (tk, i, n) => tag('Downers Grove', 'Synthani', 'Synthani', '773-555-0177', tk, i, n);
  t.scan(d('7779122', 1, 2)); // holds row 3
  t.scan(tag('Downers Grove', 'Synthoth', 'Synthoth', '773-555-0300', '7779300', 1, 1)); // row 4
  t.scan(d('7779124', 3, 4));
  assert.equal(sh.get(3, c.SEQUENCE), '3 of 4');
  assert.match(sh.notes.get('3,' + c.SEQUENCE) || '', /No more rows could be saved right after the group/);
});

test('Plainfield pattern: first name only on three tags, full name on the fourth, same phone: fills the saved row', () => {
  const t = load(), { sh, c } = modern(t, '18556 (43)');
  const p = (cust, last, tk, i) => tag('Plainfield', cust, last, '815-555-0187', tk, i, 4);
  t.scan(p('Rob', 'Rob', '7772772', 3)); t.scan(p('Rob', 'Rob', '7772771', 2)); t.scan(p('Rob', 'Rob', '7772773', 4));
  assert.deepEqual(heldRows(t, sh), [5], 'one row saved for tag 1');
  t.scan(p('Rob Synthelder', 'Synthelder', '7772770', 1));
  assert.deepEqual(row(sh, c, 5), ['Synthelder', '1 of 4', '7772770']);
  assert.deepEqual(heldRows(t, sh), []); assert.equal(sh.get(6, c.NAME), '', 'no extra line');
  assert.match(sh.notes.get('5,' + c.NAME) || '', /Group check \(name\): this tag reads "synthelder"; the tag that saved this row reads "rob"/);
  // A different first name on the same phone (another person at the address) still needs the tickets and names to fit.
  const u = load(), m = modern(u, '18556 (43)');
  u.scan(tag('Plainfield', 'Rob', 'Rob', '815-555-0187', '7772772', 3, 4));
  u.scan(tag('Plainfield', 'Ann Synthelder', 'Synthelder', '815-555-0187', '7772770', 1, 4));
  assert.ok(held(u, m.sh, 3), 'not taken: no shared name'); assert.equal(m.sh.get(6, m.c.NAME), 'Synthelder');
});

test('review of #27: the first-name fit is exact; a full-name hold keeps its full name when the group grows', () => {
  const r = load().ctx.groupHoldRank_, ph = '5550187';
  const hold = (name, full) => ({ name, full, of: 4, ticket: '7772772', day: 9, phone: ph });
  const key = (name, full) => ({ name, full, of: 4, ticket: '7772770', phone: ph });
  assert.equal(r(hold('rob'), key('synthelder', 'rob synthelder'), 9), 2, 'Plainfield');
  assert.equal(r(hold('k', 'ann k'), key('synthmith', 'kaz synthmith'), 9), 0, 'an initial against a first name');
  assert.equal(r(hold('synthjones', 'rob synthjones'), key('synthmith', 'rob synthmith'), 9), 0, 'same first name, other surnames');
  assert.equal(r(hold('synthsmith', 'rob j synthsmith'), key('synthdoe', 'jane synthdoe'), 9), 0, 'a middle initial');
  assert.equal(r(hold('ed'), key('synthsmith', 'ed synthsmith'), 9), 0, 'two-letter first names never fit');
  const t = load(), { sh, c } = modern(t, '18556 (43)');
  const p = (cust, last, tk, i, n) => tag('Plainfield', cust, last, '815-555-0187', tk, i, n);
  t.scan(p('Rob Synthelder', 'Synthelder', '7772770', 1, 3));
  t.scan(p('Rob', 'Rob', '7772773', 4, 4)); // the order grew: the hold is resized and must keep its full name
  t.scan(p('Rob', 'Rob', '7772771', 2, 4));
  assert.deepEqual([2, 3, 4].map(rw => sh.get(rw, c.SEQUENCE)), ['1 of 3', '4 of 4', '2 of 4']);
});

console.log(`${passed} group phone tests passed`);
