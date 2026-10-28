'use strict';
// Parts shorthand in Extras ("2 pins", "3 rollers"), the way Kirsten types it (10/27 audit). Synthetic data only.
const assert = require('node:assert/strict');
const { load, BASE } = require('./offline.test.cjs');
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS ' + name); }
function modern(t, tab = 'New Lenox') {
  const sh = t.ss.tabs[tab];
  sh.insertColumnAfter(15); sh.set(1, 16, 'Tag x of N'); sh.insertColumnAfter(3); sh.set(1, 4, 'Tag x of N');
  return { sh, c: t.ctx.storeLayout_(sh).screens };
}
const part = (sku, quantity, unit = 'each', group_wide = false) => ({ sku, quantity, unit, group_wide, raw: quantity + ' ' + sku });
const tag = (x = {}) => ({ ...BASE, store: 'New Lenox', ticket_number: '7770701', width_in: 30, height_in: 40, billable_inches: 70, extras: '', parts: [], ...x });
const write = (t, x) => t.ctx.saveScan_(x, 'Synthetic', [], '', 'synthetic');

test('credited parts are written in Extras as short text', () => {
  const t = load(), { sh, c } = modern(t);
  write(t, tag({ extras: '2 580602 pins\n3 580404 rollers', parts: [part('580602', 2), part('580404', 3)] }));
  assert.equal(sh.get(2, c.EXTRAS), '2 pins, 3 rollers');
  const u = load(), m = modern(u);
  write(u, tag({ extras: '1 580401 corner', parts: [part('580401', 1)] }));
  assert.equal(m.sh.get(2, m.c.EXTRAS), '1 corner', 'singular');
});

test('no known parts, nothing written; parts held for review are not listed', () => {
  const t = load(), { sh, c } = modern(t);
  write(t, tag()); assert.equal(sh.get(2, c.EXTRAS) || '', '');
  const u = load(), m = modern(u);
  write(u, tag({ extras: '2 580602 pins', parts: [part('580602', 2)], unclear: ['extras: pins quantity unclear'] }));
  assert.equal(m.sh.get(2, m.c.EXTRAS) || '', '');
});

test("split pins: every frame's Extras says its own share", () => {
  const t = load(), { sh, c } = modern(t);
  const g = (i, x = {}) => tag({ customer_name: 'Nick Synthpas', last_name: 'Synthpas', phone: '8155550190', ticket_number: String(7770630 + i), tag_index: i, tag_count: 8, width_in: 20 + i, billable_inches: 50 + i, ...x });
  write(t, g(7)); write(t, g(4, { extras: '16 580602 pins', parts: [part('580602', 16)] })); write(t, g(5));
  for (let r = 2; r < 6; r++) if (sh.get(r, c.SEQUENCE)) assert.equal(sh.get(r, c.EXTRAS), '2 pins', 'row ' + r);
});

test('an unsplit whole-group count says so; a patio door keeps its text first', () => {
  const t = load(), { sh, c } = modern(t);
  write(t, tag({ tag_index: 1, tag_count: 2, extras: '5 580602 pins all frames', parts: [part('580602', 5, 'each', true)] }));
  assert.equal(sh.get(2, c.EXTRAS), '5 pins (whole group)');
  const u = load(), m = modern(u);
  write(u, tag({ form_type: 'patio_door', width_in: 48, height_in: 75.5, billable_inches: null, material: null, extras: '2 580602 pins', parts: [part('580602', 2)] }));
  assert.equal(m.sh.get(2, m.c.EXTRAS), 'new patio door 48 x 75 1/2, 2 pins');
});

console.log(`${passed} parts shorthand tests passed`);
