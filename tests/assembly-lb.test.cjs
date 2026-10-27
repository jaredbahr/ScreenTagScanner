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

test('with written-in additional labor, assembly stays in Earning (old behavior) and LB Earn keeps one receipt', () => {
  const t = load(); write(t, { extras: '2 580625 cuts 3.00 = 6.00\nLB $8' });
  const { sh, c } = sheet(t);
  assert.equal(sh.get(2, c.LB_EARN), 18.54, 'the written-in $8 only');
  assert.equal(sh.get(2, c.EARNING), 4.5, 'assembly in Earning, as before');
  assert.match(sh.notes.get(sh.key(2, c.NAME)) || '', /assembly kept in Earning because this tag also has additional labor/);
  assert.doesNotMatch(sh.notes.get(sh.key(2, c.NAME)) || '', /enter LB Earn by hand/, 'never sends her into LB Earn');
});

test('review of #27: whole-group cuts + whole-group labor: the second tag never adds the cuts again', () => {
  const t = load(), g = { sku: '580625', quantity: 2, unit: 'side', group_wide: true, raw: '2 580625 cuts all frames' };
  const x = i => ({ ticket_number: '7770810', tag_index: i, tag_count: 2, width_in: 29 + i, billable_inches: 62 + i, extras: '',
    group_extras: '2 580625 cuts all frames\nLB $8 both', parts: [g] });
  write(t, x(1)); write(t, x(2)); const { sh, c } = sheet(t);
  const lb = [2, 3].map(r => sh.get(r, c.LB_EARN)), earn = [2, 3].map(r => sh.get(r, c.EARNING) || 0);
  assert.equal(earn[0] + earn[1], 4.5, 'the $4.50 once, in Earning');
  assert.equal(lb[0], cents(63 * 0.17 + 8)); assert.equal(lb[1], cents(64 * 0.17), 'no cuts or labor added on tag 2');
});

test('review of #27: whole-group cuts alone: once on tag 1 in LB Earn, a reference on tag 2', () => {
  const t = load(), g = { sku: '580625', quantity: 2, unit: 'side', group_wide: true, raw: '2 580625 cuts all frames' };
  const x = i => ({ ticket_number: '7770811', tag_index: i, tag_count: 2, width_in: 29 + i, billable_inches: 62 + i, extras: '', group_extras: '2 580625 cuts all frames', parts: [g] });
  write(t, x(1)); write(t, x(2)); const { sh, c } = sheet(t);
  assert.equal(sh.get(2, c.LB_EARN), cents(63 * 0.17 + 4.5)); assert.equal(sh.get(3, c.LB_EARN), cents(64 * 0.17));
  assert.match(sh.notes.get(sh.key(3, c.EARNING)) || '', /already recorded on Homer Glen screens row 2 \(LB Earn\)/);
});

test('review of #27: the Earning note says the cuts went to LB Earn, so they are not entered twice', () => {
  const t = load(); write(t); const { sh, c } = sheet(t);
  assert.match(sh.notes.get(sh.key(2, c.EARNING)) || '', /SKU 580625 Assembly: \$4\.50 added to LB Earn on this row; do not enter it here/);
});

test('review of #27: a later (non-exact) scan of the same ticket finds the LB receipt: no second credit', () => {
  const t = load(); write(t);
  const plan = t.ctx.preparePartsEarnings_(t.ss, t.ctx.normalizeJobInput_(tag({ notes: 'different photo' })));
  assert.equal(plan.items.length, 0); assert.equal(plan.references.length, 1); assert.equal(plan.references[0].prior.column, 'lb');
});

test('review of #27: an interrupted save (receipt reserved, value not yet written) holds, never adds', () => {
  const t = load(); write(t); const { sh, c } = sheet(t);
  sh.notes.set(sh.key(2, c.LB_EARN), sh.notes.get(sh.key(2, c.LB_EARN)).replace('"status":"posted"', '"status":"reserved"'));
  sh.set(2, c.LB_EARN, 10.54);
  const plan = t.ctx.preparePartsEarnings_(t.ss, t.ctx.normalizeJobInput_(tag()));
  assert.equal(plan.items.length, 0);
});

test('a receipt moved by hand from LB Earn to Earning holds the ticket (no second credit)', () => {
  const t = load(); write(t); const { sh, c } = sheet(t);
  sh.notes.set(sh.key(2, c.EARNING), sh.notes.get(sh.key(2, c.LB_EARN))); sh.notes.set(sh.key(2, c.LB_EARN), '');
  const plan = t.ctx.preparePartsEarnings_(t.ss, t.ctx.normalizeJobInput_(tag()));
  assert.equal(plan.items.length, 0); assert.match(plan.flags.join('\n'), /changed by hand/);
});

test('review of #27 round 2: a held labor line (two LB lines) still keeps assembly in Earning', () => {
  const t = load(); write(t, { extras: '2 580625 cuts 3.00 = 6.00\nLB $8\nLB $5' }); const { sh, c } = sheet(t);
  assert.equal(sh.get(2, c.LB_EARN), 10.54, 'no labor credited and no assembly added'); assert.equal(sh.get(2, c.EARNING), 4.5);
});

test('review of #27 round 2: the LB receipt is reserved in the note before the value is written', () => {
  const t = load(), seen = [];
  const sh = t.ss.tabs['Homer Glen'], c = t.ctx.storeLayout_(sh).screens, orig = sh.getRange.bind(sh);
  sh.getRange = function (r, col, ...rest) {
    const range = orig(r, col, ...rest);
    if (col === c.LB_EARN && rest.length === 0) {
      const set = range.setValue.bind(range);
      range.setValue = v => { if (v === 15.04) seen.push(sh.notes.get(sh.key(r, col)) || ''); return set(v); };
    }
    return range;
  };
  write(t);
  assert.equal(seen.length, 1); assert.match(seen[0], /"column":"lb".*"status":"reserved"/);
});

test('review of #27 round 2: a hand-edited LB Earn on the earlier row says the assembly may already be in it', () => {
  const t = load(), g = { sku: '580625', quantity: 2, unit: 'side', group_wide: true, raw: '2 580625 cuts all frames' };
  const x = i => ({ ticket_number: '7770812', tag_index: i, tag_count: 2, width_in: 29 + i, billable_inches: 62 + i, extras: '', group_extras: '2 580625 cuts all frames', parts: [g] });
  write(t, x(1)); const { sh, c } = sheet(t); sh.set(2, c.LB_EARN, 20);
  write(t, x(2));
  assert.equal(sh.get(3, c.LB_EARN), cents(64 * 0.17));
  assert.match(sh.notes.get(sh.key(3, c.NAME)) || '', /Earlier LB Earn for this part was edited by hand \(screens row 2\): check that row; the assembly may already be included/);
});

test('windows keep assembly in Other Earn (unchanged)', () => {
  const ctx = load().ctx, plan = ctx.calculateParts_({ ...tag(), item_type: 'window' });
  assert.equal(plan.items.find(i => i.sku === '580625').column, undefined);
});

console.log(`${passed} assembly LB tests passed`);
