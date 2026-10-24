'use strict';
// Group rows (Kirsten, 2026-10-22): later tags of an "x of N" group fill rows held right after the first one.
// Synthetic data only.
const assert = require('node:assert/strict');
const { load } = require('./offline.test.cjs');
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS ' + name); }

// The live workbook layout: a "Tag x of N" column after Name in both blocks.
function modern(t, tab = 'New Lenox') {
  const sh = t.ss.tabs[tab];
  sh.insertColumnAfter(15); sh.set(1, 16, 'Tag x of N'); sh.insertColumnAfter(3); sh.set(1, 4, 'Tag x of N');
  return { sh, c: t.ctx.storeLayout_(sh).screens };
}
// Each synthetic customer has their own phone (same name, same phone), as on real tags; holds match on it (0.13.27).
const phoneFor = name => '630555' + String([...name].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 10000, 7)).padStart(4, '0');
const job = (name, ticket, i, n, extra = {}) => ({ store: 'New Lenox', last_name: name, customer_name: name, phone: phoneFor(name), ticket_number: ticket,
  tag_index: i, tag_count: n, width_in: 20 + i, height_in: 30, billable_inches: 50 + i + (extra.bump || 0), ...extra });
const nameAt = (sh, c, r) => sh.get(r, c.NAME), seqAt = (sh, c, r) => sh.get(r, c.SEQUENCE);
const held = (t, sh, r) => !!t.ctx.holdAt_(sh.notes.get(r + ',1') || '', t.ctx.groupHoldMeta_(sh), r);

test('real pattern: 3 of 3 first, other jobs in between, then 2 of 3 and 1 of 3 land together', () => {
  const t = load(), { sh, c } = modern(t);
  t.scan(job('Synthmol', '7707981', 3, 3));
  assert.equal(nameAt(sh, c, 2), 'Synthmol'); assert.ok(held(t, sh, 3)); assert.ok(held(t, sh, 4)); assert.ok(!held(t, sh, 5));
  assert.equal(sh.bg.get('3,' + c.NAME), t.ctx.HOLD_COLOR);
  assert.match(sh.notes.get('3,1'), /Saved for the rest of the Synthmol group \(3 tags\)/);
  t.scan(job('Synthowak', '7707983', 1, 1));
  t.scan(job('Synthola', '7707976', 1, 1, { bump: 5 }));
  assert.equal(nameAt(sh, c, 5), 'Synthowak', 'other jobs skip held rows'); assert.equal(nameAt(sh, c, 6), 'Synthola');
  t.scan(job('Synthmol', '7707982', 2, 3));
  t.scan(job('Synthmol', '7707980', 1, 3));
  assert.deepEqual([2, 3, 4].map(r => seqAt(sh, c, r)), ['3 of 3', '2 of 3', '1 of 3']);
  for (const r of [3, 4]) { assert.ok(!held(t, sh, r)); assert.notEqual(sh.bg.get(r + ',' + c.NAME), t.ctx.HOLD_COLOR); }
});

test('same-ticket groups (Homer style) fill holds in any order; a different customer does not', () => {
  const t = load(), { sh, c } = modern(t);
  t.scan(job('Synthgrp', '8169901', 2, 4));
  t.scan(job('Synthelse', '9999999', 3, 4, { bump: 3 })); // a different customer with the same N: not the group
  assert.equal(seqAt(sh, c, 6), '3 of 4', 'goes past the 3 held rows (3–5)'); assert.equal(sh.get(6, c.NAME), 'Synthelse');
  t.scan(job('Synthgrp', '8169901', 4, 4)); t.scan(job('Synthgrp', '8169901', 1, 4, { bump: 1 }));
  assert.deepEqual([2, 3, 4].map(r => seqAt(sh, c, r)), ['2 of 4', '4 of 4', '1 of 4']);
});

test('a misprinted ticket still fills the group when name and N match exactly and the tag fills a gap (Lockport case)', () => {
  const t = load(), { sh, c } = modern(t);
  t.scan(job('Synthmcn', '7041933', 1, 2));
  t.scan(job('Synthmcn', '1041934', 2, 2, { bump: 2 })); // the tag itself was printed wrong
  assert.equal(seqAt(sh, c, 3), '2 of 2', 'lands in the held row'); assert.ok(!held(t, sh, 3));
  assert.match(sh.notes.get('3,' + c.TICKET) || '', /Group check \(ticket\): 1041934 is far from the rest of this group \(7041933, rows 2\)/);
  const u = load(), m = modern(u);
  u.scan(job('Synthmcn', '7041933', 1, 3)); u.scan(job('Synthmcn', '1041934', 1, 3, { bump: 2, phone: null })); // "1 of 3" again, no phone read
  assert.equal(m.sh.get(3, m.c.TICKET), '', 'a repeated index does not take the held row'); assert.ok(held(u, m.sh, 3));
  // The same phone and the same last 6 digits confirm the customer (0.13.27): the row fills, like a misread index.
  const w = load(), n = modern(w);
  w.scan(job('Synthmcn', '7041933', 1, 3)); w.scan(job('Synthmcn', '1041934', 1, 3, { bump: 2 }));
  assert.equal(n.sh.get(3, n.c.TICKET), '1041934'); assert.match(n.sh.notes.get('3,' + n.c.TICKET) || '', /Group check \(ticket\): 1041934 is far from the rest of this group/);
});

test('holds expire after 14 days and the row is used normally', () => {
  const t = load({ now: new Date('2026-10-01T17:00:00Z') }), { sh, c } = modern(t);
  t.scan(job('Synthold', '7707901', 1, 2));
  assert.ok(held(t, sh, 3));
  t.setNow(new Date('2026-10-20T17:00:00Z'));
  t.scan(job('Synthnew', '7707950', 1, 1));
  assert.equal(nameAt(sh, c, 3), 'Synthnew'); assert.ok(!held(t, sh, 3));
});

test('a held row Kirsten typed into is left alone; the tag goes to the next empty row', () => {
  const t = load(), { sh, c } = modern(t);
  t.scan(job('Synthtyp', '7707901', 1, 2));
  sh.set(3, c.NAME, 'Typed by hand');
  t.scan(job('Synthtyp', '7707902', 2, 2));
  assert.equal(sh.get(3, c.NAME), 'Typed by hand'); assert.equal(nameAt(sh, c, 4), 'Synthtyp'); assert.ok(!held(t, sh, 3));
});

test('no holds for single tags, unverified or large N, windows, multi-frame builds, or the old layout', () => {
  const t = load(), { sh } = modern(t);
  t.scan(job('Synthone', '7707901', 1, 1));
  t.scan(job('Synthbig', '7707902', 1, 40, { bump: 1 }));
  t.scan(job('Synthbad', '7707903', 5, 3, { bump: 2 }));
  t.scan(job('Synthbld', '7707904', 1, 2, { form_type: 'new_build', screens_on_tag: 2, bump: 3 }));
  for (let r = 2; r <= 12; r++) assert.ok(!held(t, sh, r), 'row ' + r);
  const u = load(); u.scan(job('Synthleg', '7707905', 1, 3));
  assert.ok(!held(u, u.ss.tabs['New Lenox'], 3), 'tabs without a Tag x of N column keep the old behavior');
});

test('a group already on the tab (scanned before holds existed) gets no new holds', () => {
  const t = load(), { sh, c } = modern(t);
  sh.set(2, c.NAME, 'Synthpre'); sh.set(2, c.SEQUENCE, '1 of 3'); sh.set(2, c.TICKET, '7707901'); sh.set(2, c.DATE_IN, 46300);
  t.scan(job('Synthpre', '7707902', 2, 3));
  assert.equal(nameAt(sh, c, 3), 'Synthpre'); assert.ok(!held(t, sh, 4));
});

test('only rows right after the first tag are held, never past a filled row', () => {
  const t = load(), { sh, c } = modern(t);
  sh.set(4, c.NAME, 'Existing'); sh.set(4, c.DATE_IN, 46300);
  t.scan(job('Synthgap', '7707901', 1, 4));
  assert.ok(held(t, sh, 3)); assert.ok(!held(t, sh, 5), 'stops at the filled row');
});

test('hold data is hidden: the note is plain text, the data sits in row metadata, deleting the note frees the row', () => {
  const t = load(), { sh, c } = modern(t);
  t.scan(job('Synthmeta', '7707901', 1, 3));
  const note = sh.notes.get('3,1');
  assert.match(note, /^Saved for the rest of the Synthmeta group \(3 tags\)\./); assert.doesNotMatch(note, /GROUP_HOLD|\{/);
  assert.deepEqual(sh.devMeta.map(m => [m.key, m.row]), [['GROUP_HOLD_V2', 3], ['GROUP_HOLD_V2', 4]]);
  sh.notes.set('3,1', ''); // Kirsten deletes the note
  t.scan(job('Synthother', '7707950', 1, 1));
  assert.equal(nameAt(sh, c, 3), 'Synthother', 'the freed row is used'); assert.ok(held(t, sh, 4), 'the other hold stays');
  t.scan(job('Synthmeta', '7707902', 2, 3, { bump: 1 }));
  assert.equal(nameAt(sh, c, 4), 'Synthmeta'); assert.deepEqual(sh.devMeta.map(m => m.row), [3], 'used holds remove their metadata');
});

test('notes written by 0.13.21 (visible data) still work', () => {
  const t = load(), { sh, c } = modern(t);
  sh.set(2, c.NAME, 'Synthold'); sh.set(2, c.SEQUENCE, '1 of 2'); sh.set(2, c.TICKET, '7707901'); sh.set(2, c.DATE_IN, 46310);
  sh.notes.set('3,1', 'Saved for the rest of the Synthold group (2 tags).\nGROUP_HOLD_V1: ' + JSON.stringify({ name: 'synthold', of: 2, ticket: '7707901', day: t.ctx.scanDateSerial_() }));
  t.scan(job('Synthold', '7707902', 2, 2));
  assert.equal(nameAt(sh, c, 3), 'Synthold'); assert.equal(sh.notes.get('3,1'), '');
});

test('if Google rejects the hidden metadata, the old visible note is written and holds still work', () => {
  const t = load(), { sh, c } = modern(t);
  sh.failMetadata = true;
  t.scan(job('Synthfall', '7707901', 1, 2));
  assert.match(sh.notes.get('3,1'), /GROUP_HOLD_V1: /); assert.equal(sh.devMeta.length, 0);
  t.scan(job('Synthelse', '7707950', 1, 1)); t.scan(job('Synthfall', '7707902', 2, 2, { bump: 1 }));
  assert.equal(nameAt(sh, c, 3), 'Synthfall'); assert.equal(nameAt(sh, c, 4), 'Synthelse');
  const u = load(), m = modern(u); m.sh.failMetadataRead = true;
  const r = u.scan(job('Synthread', '7707903', 1, 2)); assert.equal(r.status, 'ok', 'a metadata read failure never stops a scan');
});

console.log(`${passed} group-hold tests passed`);
