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

test('the inches are worked out from the size even when a QTY or a conflict was read', () => {
  const t = load(); t.scan(patio({ billable_inches: 123, quantity_conflict: true, quantity_conflict_details: 'two sizes' }));
  const { sh, c } = sheet(t); assert.equal(sh.get(2, c.UNI_IN), 124);
  assert.doesNotMatch(notes(sh, 2), /Inches disagree|left blank/);
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
  assert.match(req, /patio_door/); assert.match(req, /Height to bottom of handle/); assert.match(req, /shop\\?'s own order to the supplier/);
});

console.log(`${passed} patio door tests passed`);
