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
  assert.match(sh.notes.get('3,' + c.SEQUENCE) || '', /Group check \(tag\): this tag says 7 of 7; an earlier tag of this group says of 6\. Rows saved for the group now cover 7 tags/);
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

console.log(`${passed} group phone tests passed`);
