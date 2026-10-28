'use strict';
// Group pins split per frame (Kirsten, 2026-10-27: "16 pins" on 1 of 8 tags; "I wanted to see it on each frame").
// Synthetic data only.
const assert = require('node:assert/strict');
const { load, BASE } = require('./offline.test.cjs');
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS ' + name); }
function modern(t, tab = 'New Lenox') {
  const sh = t.ss.tabs[tab];
  sh.insertColumnAfter(15); sh.set(1, 16, 'Tag x of N'); sh.insertColumnAfter(3); sh.set(1, 4, 'Tag x of N');
  return { sh, c: t.ctx.storeLayout_(sh).screens };
}
const pins = (q, group_wide = false) => ({ sku: '580602', quantity: q, unit: 'each', group_wide, raw: q + ' 580602 pins' });
const tag = (i, n, x = {}) => ({ ...BASE, store: 'New Lenox', customer_name: 'Nick Synthpas', last_name: 'Synthpas', phone: '8155550190',
  ticket_number: String(7770630 + i), tag_index: i, tag_count: n, width_in: 20 + i, height_in: 30, billable_inches: 50 + i, extras: '', parts: [], ...x });
const write = (t, x) => t.ctx.saveScan_(x, 'Synthetic', [], '', 'synthetic');
const earningBy = (sh, c) => { const out = {}; for (let r = 2; r < 20; r++) { const s = sh.get(r, c.SEQUENCE); if (s) out[s] = sh.get(r, c.EARNING); } return out; };

test('Kirsten\'s pattern: 16 pins on tag 4 of 8: $1.00 on every frame, before and after, in any order', () => {
  const t = load(), { sh, c } = modern(t);
  write(t, tag(7, 8)); write(t, tag(8, 8));
  write(t, tag(4, 8, { extras: '16 580602 pins', parts: [pins(16)] }));
  for (const i of [1, 2, 3, 5, 6]) write(t, tag(i, 8));
  const e = earningBy(sh, c);
  for (let i = 1; i <= 8; i++) assert.equal(e[i + ' of 8'], 1, 'frame ' + i);
  const row4 = [...Array(18).keys()].map(k => k + 2).find(r => sh.get(r, c.SEQUENCE) === '4 of 8');
  assert.match(sh.notes.get(sh.key(row4, c.EARNING)), /2 each × \$0\.50 = \$1\.00 for this frame \(16 written on tag 4 of 8, split per frame\); credit once/);
});

test('rescans of the pins tag or of a frame never add a second share', () => {
  const t = load(), { sh, c } = modern(t);
  write(t, tag(4, 8, { extras: '16 580602 pins', parts: [pins(16)] })); write(t, tag(7, 8));
  write(t, tag(4, 8, { extras: '16 580602 pins', parts: [pins(16)], notes: 'again' }));
  write(t, tag(7, 8, { notes: 'again' }));
  const e = earningBy(sh, c); assert.equal(e['4 of 8'], 1); assert.equal(e['7 of 8'], 1);
  const total = Object.values(e).reduce((a, b) => a + (Number(b) || 0), 0); assert.equal(total, 2);
});

test('a frame credited when the pins tag was scanned, rescanned later, gets no warning and no second share', () => {
  const t = load(), { sh, c } = modern(t);
  write(t, tag(7, 8)); write(t, tag(4, 8, { extras: '16 580602 pins', parts: [pins(16)] }));
  const r = write(t, tag(7, 8, { notes: 'again', width_in: 27.5 }));
  const r7 = [2, 3, 4, 5, 6, 7, 8, 9].filter(k => sh.get(k, c.SEQUENCE) === '7 of 8');
  assert.equal(r7.map(k => Number(sh.get(k, c.EARNING)) || 0).reduce((a, b) => a + b, 0), 1);
  assert.doesNotMatch(JSON.stringify(r.flags || []), /identity differs/);
});

test('her own Earning entry on a frame is never overwritten; the row gets a note', () => {
  const t = load(), { sh, c } = modern(t);
  write(t, tag(7, 8)); const r7 = [2, 3, 4, 5, 6, 7, 8, 9, 10].find(r => sh.get(r, c.SEQUENCE) === '7 of 8');
  sh.set(r7, c.EARNING, 3);
  write(t, tag(4, 8, { extras: '16 580602 pins', parts: [pins(16)] }));
  assert.equal(sh.get(r7, c.EARNING), 3);
  assert.match(sh.notes.get(sh.key(r7, c.EARNING)) || '', /Pins for this frame not added \(\$1\.00, split from tag 4 of 8\): Earning already has an entry/);
});

test('not split: an uneven count (credited once for the group) and a small per-tag count (that tag only)', () => {
  const t = load(), { sh, c } = modern(t);
  write(t, tag(1, 2, { extras: '5 580602 pins all frames', parts: [pins(5, true)] })); write(t, tag(2, 2));
  let e = earningBy(sh, c); assert.equal(e['1 of 2'], 2.5); assert.equal(e['2 of 2'] || '', '');
  const u = load(), m = modern(u);
  write(u, tag(1, 2, { extras: '4 580602 pins', parts: [pins(4)] })); write(u, tag(2, 2));
  e = earningBy(m.sh, m.c); assert.equal(e['1 of 2'], 2); assert.equal(e['2 of 2'] || '', '');
});

test('a group marked group-wide splits even with a small count (4 pins over 2 frames = $1.00 each)', () => {
  const t = load(), { sh, c } = modern(t);
  write(t, tag(1, 2, { extras: '4 580602 pins all frames', parts: [pins(4, true)] })); write(t, tag(2, 2));
  const e = earningBy(sh, c); assert.equal(e['1 of 2'], 1); assert.equal(e['2 of 2'], 1);
});

test('another customer with the same count and near tickets never gets the share', () => {
  const t = load(), { sh, c } = modern(t);
  write(t, tag(4, 8, { extras: '16 580602 pins', parts: [pins(16)] }));
  write(t, tag(5, 8, { customer_name: 'Ann Synthother', last_name: 'Synthother', phone: '8155550111' }));
  const e = earningBy(sh, c); assert.equal(e['5 of 8'] || '', '');
});

test('a hand-edited share holds that frame only', () => {
  const t = load(), { sh, c } = modern(t);
  write(t, tag(4, 8, { extras: '16 580602 pins', parts: [pins(16)] })); write(t, tag(5, 8));
  const r5 = [2, 3, 4, 5, 6, 7, 8, 9].find(r => sh.get(r, c.SEQUENCE) === '5 of 8'); sh.set(r5, c.EARNING, 7);
  write(t, tag(5, 8, { notes: 'again' })); write(t, tag(6, 8));
  const e = earningBy(sh, c); assert.equal(e['5 of 8'], 7); assert.equal(e['6 of 8'], 1);
});

console.log(`${passed} pins per frame tests passed`);
