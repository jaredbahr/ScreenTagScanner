'use strict';
// Patio screen doors (Kirsten, 2026-10-24): fiberglass, width + height each rounded up, no build labor or earning
// base, the handle height never billed. Synthetic data only.
const assert = require('node:assert/strict');
const { load } = require('./offline.test.cjs');
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS ' + name); }
const patio = (x = {}) => ({ form_type: 'patio_door', item_type: 'unknown', store: 'HOMER', ticket_number: '7770601',
  width_in: 48, height_in: 75.5, billable_inches: null, material: null, qty_rows: '', line_totals: '', ...x });
const sheet = t => { const sh = t.ss.tabs['Homer Glen']; return { sh, c: t.ctx.storeLayout_(sh).screens }; };
const notes = (sh, r) => [...sh.notes].filter(([k]) => k.startsWith(r + ',')).map(([, v]) => v).join('\n');

test('Kirsten\'s example: 75.5 x 48 is 76 + 48 = 124", billed at fiberglass rates with no build labor or earning', () => {
  const t = load(), r = t.scan(patio()), { sh, c } = sheet(t);
  assert.equal(r.status, 'ok');
  assert.equal(sh.get(2, c.UNI_IN), 124);
  assert.equal(sh.get(2, c.SCREENING), 18.6); assert.equal(sh.get(2, c.LB_EARN), 21.08, '124 x 0.17, no $9 build labor');
  assert.equal(sh.get(2, c.EARNING) || '', '', 'no $1.50 build base');
  assert.match(notes(sh, 2), /Patio door: inches = width \+ height, each rounded up \(48 \+ 76 = 124"\); no build labor or earning added/);
  assert.notEqual(sh.bg.get('2,' + c.DATE_IN), t.ctx.FLAG_COLOR, 'a note on the inches cell, not a yellow row');
});

test('review of #25: a conflict Claude reported is never dropped: inches worked out, row yellow with its words', () => {
  const t = load(); t.scan(patio({ billable_inches: 123, quantity_conflict: true, quantity_conflict_details: 'second door 36x80 also listed' }));
  const { sh, c } = sheet(t); assert.equal(sh.get(2, c.UNI_IN), 124);
  assert.match(notes(sh, 2), /Claude also noted: second door 36x80 also listed; check the inches/);
  assert.match(notes(sh, 2), /a QTY of 123 was read; billed 124 from the size/);
  assert.equal(sh.bg.get('2,' + c.DATE_IN), t.ctx.FLAG_COLOR);
});

test('review of #25: QTY rows on a "patio door" are a sign of a repair tag: row yellow, asked', () => {
  const t = load(); t.scan(patio({ width_in: 36, height_in: 80, billable_inches: 130, qty_rows: '130, 130, 130', material: 'pet' }));
  const { sh, c } = sheet(t);
  assert.match(notes(sh, 2), /the form has QTY or total rows \(130, 130, 130\); patio door order forms have none\. Is this a repair tag/);
  assert.equal(sh.bg.get('2,' + c.DATE_IN), t.ctx.FLAG_COLOR);
});

test('review of #25: width and height read the other way round still bill (W + H is the same)', () => {
  const t = load(); t.scan(patio({ width_in: 75.5, height_in: 48 }));
  const { sh, c } = sheet(t); assert.equal(sh.get(2, c.UNI_IN), 124);
});

test('review of #25: "Quantity this size 2" is one held row for her, with no "inches =" note', () => {
  const t = load(); t.scan(patio({ screens_on_tag: 2 }));
  const { sh, c } = sheet(t);
  assert.equal(sh.get(2, c.UNI_IN) || '', ''); assert.equal(sh.bg.get('2,' + c.DATE_IN), t.ctx.FLAG_COLOR);
  assert.doesNotMatch(notes(sh, 2), /inches = width/); assert.match(notes(sh, 2), /Form lists 2 screens/);
});

test('review of #25: two customers with the same number and door size are two rows; the same tag again is a rescan', () => {
  const t = load(), { sh, c } = sheet(t);
  t.scan(patio({ customer_name: 'Pat Synthone', last_name: 'Synthone' }));
  const r2 = t.scan(patio({ customer_name: 'Lee Synthtwo', last_name: 'Synthtwo' }));
  assert.equal(r2.status, 'ok'); assert.equal(sh.get(3, c.UNI_IN), 124);
  const r3 = t.scan(patio({ customer_name: 'Lee Synthtwo', last_name: 'Synthtwo' }));
  assert.match(r3.message, /Already scanned/);
});

test('review of #25: a glass SKU on a patio door form is noted; the phone never keys a patio group', () => {
  const t = load(); t.scan(patio({ job_evidence: '1 11562 Glass $37.99' }));
  const { sh } = sheet(t); assert.match(notes(sh, 2), /Patio door form lists a glass SKU/);
  const ctx = load().ctx, c = { SEQUENCE: 4 };
  const x = { form_type: 'patio_door', phone: '6305550142', tag_index: 1, tag_count: 2, customer_name: 'Pat Synthone', last_name: 'Synthone', ticket_number: '7770601' };
  const key = ctx.groupKey_(x, c); assert.ok(key); assert.equal(key.phone, undefined);
  assert.equal(ctx.groupKey_({ ...x, form_type: 'repair' }, c).phone, '5550142', 'other tags still match on the phone');
});

test('a handle height read as the door height leaves the inches blank and turns the row yellow', () => {
  const t = load(); t.scan(patio({ height_in: 37.5 }));
  const { sh, c } = sheet(t);
  assert.equal(sh.get(2, c.UNI_IN) || '', ''); assert.equal(sh.get(2, c.SCREENING) || '', '');
  assert.equal(sh.bg.get('2,' + c.DATE_IN), t.ctx.FLAG_COLOR);
  assert.match(notes(sh, 2), /Patio door: size 48 x 37 1\/2 looks off \(the handle height is never billed\)/);
});

test('always fiberglass: another material read is billed as fiberglass with a note', () => {
  const t = load(); t.scan(patio({ material: 'aluminum' }));
  const { sh, c } = sheet(t);
  assert.equal(sh.get(2, c.SCREENING), 18.6);
  assert.match(notes(sh, 2), /tag was read as aluminum; billed as fiberglass/);
});

test('"Glass" in the supplier\'s name never routes a patio door to the windows block', () => {
  const t = load(); t.scan(patio({ item_type: 'window', job_evidence: 'Circle Glass Co custom patio screen door' }));
  const { sh, c } = sheet(t);
  assert.equal(sh.get(2, c.UNI_IN), 124);
  assert.doesNotMatch(notes(sh, 2), /routed to windows/);
});

test('normalizing twice (a rescan) gives the same result and no repeated notes', () => {
  const ctx = load().ctx, once = ctx.normalizeJobInput_(patio()), twice = ctx.normalizeJobInput_(once);
  assert.equal(twice.billable_inches, 124); assert.equal(twice.material, 'fiberglass'); assert.equal(twice.item_type, 'screen');
  assert.deepEqual(twice.routing_review, once.routing_review);
});

test('a regular screen build still gets its build labor and earning base', () => {
  const t = load(); t.scan({ form_type: 'new_build', store: 'HOMER', ticket_number: '7770602', width_in: 36, height_in: 79, billable_inches: 115 });
  const { sh, c } = sheet(t);
  assert.equal(sh.get(2, c.LB_EARN), 28.55); assert.equal(sh.get(2, c.EARNING), 1.5);
});

test('the prompt and schema know the patio door form and the handle-height rule', () => {
  const ctx = load().ctx, req = JSON.stringify(ctx.buildRequest_('m', 'AAAA', 'image/jpeg'));
  assert.match(req, /patio_door/); assert.match(req, /Height to bottom of handle/); assert.match(req, /Circle Glass[^.]*not a tag: is_tag false/);
});

test('review of #25 round 2: rescans match a misread name; unnamed doors are never dropped; "none" is not a conflict', () => {
  const t = load(), { sh, c } = sheet(t);
  t.scan(patio({ customer_name: 'Pat Synthone', last_name: 'Synthone' }));
  assert.match(t.scan(patio({ customer_name: 'Pat Synthome', last_name: 'Synthome' })).message, /Already scanned/, 'one letter misread is the same tag');
  const u = load(), m = sheet(u);
  u.scan(patio({ customer_name: '', last_name: '' })); const r = u.scan(patio({ customer_name: '', last_name: '' }));
  assert.equal(r.status, 'ok'); assert.equal(m.sh.get(3, m.c.UNI_IN), 124, 'second unnamed door written, not dropped');
  const v = load(); v.scan(patio({ quantity_conflict: false, quantity_conflict_details: 'none' }));
  const n = sheet(v); assert.doesNotMatch(notes(n.sh, 2), /Claude also noted/); assert.notEqual(n.sh.bg.get('2,' + n.c.DATE_IN), v.ctx.FLAG_COLOR);
});

console.log(`${passed} patio door tests passed`);
