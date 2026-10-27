'use strict';
// Assembly / cuts (SKU 580625) is added to LB Earn, not Earning (Kirsten, 2026-10-27). Synthetic data only.
const assert = require('node:assert/strict');
const { load, BASE } = require('./offline.test.cjs');
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS ' + name); }
const cuts = (q = 2) => ({ sku: '580625', quantity: q, unit: 'side', group_wide: false, raw: q + ' 580625 cuts 3.00 = 6.00' });
const frame = { sku: '54398', quantity: 1, unit: 'each', group_wide: false, raw: '54398 14.99' };
// Kirsten's example shape: 29 x 33 fiberglass, QTY 62, a pay-cashier slip with a frame and 2 cuts.
const tag = (x = {}) => ({ ...BASE, ticket_number: '7770801', width_in: 29, height_in: 33, billable_inches: 62,
  extras: '54398 14.99\n2 580625 cuts 3.00 = 6.00', parts: [frame, cuts()], ...x });
const write = (t, x) => t.ctx.saveScan_(tag(x), 'Synthetic', [], '', 'synthetic');
const cents = n => Math.round(n * 100) / 100;
const sheet = t => { const sh = t.ss.tabs['Homer Glen']; return { sh, c: t.ctx.storeLayout_(sh).screens }; };

test('2 cuts add $4.50 to LB Earn (10.54 + 4.50 = 15.04); Earning gets nothing', () => {
  const t = load(); write(t); const { sh, c } = sheet(t);
  assert.equal(sh.get(2, c.LB_EARN), 15.04);
  assert.equal(sh.get(2, c.EARNING) || '', '');
  const note = sh.notes.get(sh.key(2, c.LB_EARN));
  assert.match(note, /SKU 580625 Assembly: 2 side × \$2\.25 = \$4\.50\nAdded to LB Earn: \$10\.54 \+ \$4\.50 = \$15\.04; credit once/);
  const r = t.ctx.partsReceipts_(note)[0];
  assert.equal(r.column, 'lb'); assert.equal(r.status, 'posted'); assert.equal(r.expectedTotal, 15.04);
});

test('the same tag scanned again adds nothing more', () => {
  const t = load(); write(t); write(t); const { sh, c } = sheet(t);
  assert.equal(sh.get(2, c.LB_EARN), 15.04); assert.equal(sh.get(3, c.NAME) || '', '');
});

test('other parts still go to Earning; assembly on a build still adds nothing (covered by the build labor)', () => {
  const t = load(); write(t, { parts: [cuts(), { sku: '580602', quantity: 4, unit: 'each', group_wide: false, raw: '4 580602 pins' }],
    extras: '4 580602 pins\n2 580625 cuts 3.00 = 6.00' });
  const { sh, c } = sheet(t);
  assert.equal(sh.get(2, c.EARNING), 2); assert.equal(sh.get(2, c.LB_EARN), 15.04);
  const u = load(); write(u, { form_type: 'new_build' }); const b = sheet(u);
  assert.equal(b.sh.get(2, b.c.LB_EARN), cents(62 * 0.17 + 9)); assert.equal(b.sh.get(2, b.c.EARNING), 1.5);
});

test('assembly with written-in additional labor on the same tag is left for her, never stacked', () => {
  const t = load(); write(t, { extras: '2 580625 cuts 3.00 = 6.00\nLB $8' });
  const { sh, c } = sheet(t);
  assert.equal(sh.get(2, c.LB_EARN), 18.54, 'the written-in $8 is credited; the assembly is not stacked on it');
  assert.match(sh.notes.get(sh.key(2, c.NAME)) || '', /assembly and additional labor on one tag: enter LB Earn by hand/);
});

test('a hand-moved receipt (LB receipt found in Earning) is treated as edited, so nothing is double-credited', () => {
  const t = load(); write(t); const { sh, c } = sheet(t);
  sh.notes.set(sh.key(2, c.EARNING), sh.notes.get(sh.key(2, c.LB_EARN))); // copied by hand into Earning
  const plan = t.ctx.preparePartsEarnings_(t.ss, { ...tag(), item_type: 'screen' });
  assert.equal(plan.items.length, 0);
});

test('windows keep assembly in Other Earn (unchanged)', () => {
  const ctx = load().ctx, plan = ctx.calculateParts_({ ...tag(), item_type: 'window' });
  assert.equal(plan.items.find(i => i.sku === '580625').column, undefined);
});

console.log(`${passed} assembly LB tests passed`);
