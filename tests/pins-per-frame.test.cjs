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

const total = (sh, c) => { let n = 0; for (let r = 2; r < 25; r++) n += Number(sh.get(r, c.EARNING)) || 0; return Math.round(n * 100) / 100; };

test('review of #31: the pins line on two tags pays each frame once (one split per group)', () => {
  const t = load(), { sh, c } = modern(t);
  write(t, tag(4, 8, { extras: '16 580602 pins', parts: [pins(16)] }));
  write(t, tag(1, 8, { extras: '16 580602 pins', parts: [pins(16)] }));
  write(t, tag(6, 8));
  const e = earningBy(sh, c); assert.equal(e['4 of 8'], 1); assert.equal(e['1 of 8'], 1); assert.equal(e['6 of 8'], 1);
  assert.equal(total(sh, c), 3);
});

test('review of #31: a rescan of the pins tag with another ticket reading pays nothing more', () => {
  const t = load(), { sh, c } = modern(t);
  write(t, tag(4, 8, { extras: '16 580602 pins', parts: [pins(16)] }));
  write(t, tag(4, 8, { extras: '16 580602 pins', parts: [pins(16)], ticket_number: '7770684', notes: 'again' }));
  write(t, tag(5, 8));
  assert.equal(total(sh, c), 2, 'frame 4 once, frame 5 once');
});

test('review of #31: a group paid whole before 0.13.31 is never split on top', () => {
  const t = load(), { sh, c } = modern(t);
  write(t, tag(1, 2, { extras: '5 580602 pins all frames', parts: [pins(5, true)] })); // whole-group receipt, $2.50
  write(t, tag(2, 2, { extras: '4 580602 pins all frames', parts: [pins(4, true)] }));
  assert.equal(total(sh, c), 2.5);
});

test('review of #31: another customer (close name, near ticket, same N, other phone) is never paid, before or after', () => {
  const t = load(), { sh, c } = modern(t), other = { customer_name: 'Ann Synthpaz', last_name: 'Synthpaz', phone: '8155551234' };
  write(t, tag(2, 8, { ...other, ticket_number: '7770659' }));
  write(t, tag(4, 8, { extras: '16 580602 pins', parts: [pins(16)] }));
  write(t, tag(5, 8, { ...other, ticket_number: '7770660' }));
  const rows = [...Array(20).keys()].map(k => k + 2).filter(r => /synthpaz/i.test(String(sh.get(r, c.NAME))));
  assert.equal(rows.length, 2); for (const r of rows) assert.equal(sh.get(r, c.EARNING) || '', '', 'row ' + r);
});

test('review of #31: a plain group tag with nothing to pay gets no review flag from an edited receipt', () => {
  const t = load(), { sh, c } = modern(t);
  write(t, tag(1, 3, { extras: '4 580602 pins', parts: [pins(4)] })); sh.notes.set(sh.key(2, c.EARNING), 'PARTS_EARNINGS_V1: [{"broken":true}]');
  const r = write(t, tag(2, 3, { ticket_number: '7770631' }));
  assert.doesNotMatch(JSON.stringify(r.flags || []), /changed by hand/);
});

test('review of #31: a new-build frame gets its share on top of the $1.50 base; the pins row lists paid and owed frames', () => {
  const t = load(), { sh, c } = modern(t);
  write(t, tag(7, 8, { form_type: 'new_build' }));
  write(t, tag(4, 8, { extras: '16 580602 pins', parts: [pins(16)] }));
  const e = earningBy(sh, c); assert.equal(e['7 of 8'], 2.5);
  const r4 = [...Array(20).keys()].map(k => k + 2).find(r => sh.get(r, c.SEQUENCE) === '4 of 8');
  assert.match(sh.notes.get(sh.key(r4, c.EARNING)), /Split per frame: paid on frames 4, 7; frames 1, 2, 3, 5, 6, 8 get their share when scanned\./);
});

test('review of #31: an unmarked 6 pins on a 2-frame group stays on its tag (only 2 per frame splits unmarked)', () => {
  const t = load(), { sh, c } = modern(t);
  write(t, tag(1, 2, { extras: '6 580602 pins', parts: [pins(6)] })); write(t, tag(2, 2));
  const e = earningBy(sh, c); assert.equal(e['1 of 2'], 3); assert.equal(e['2 of 2'] || '', '');
});

test('review of #31 round 2: a pins tag paid on 0.13.30 (16 pins on one row, $8) is never split on top when rescanned', () => {
  const t = load(), { sh, c } = modern(t), keep = t.ctx.splitPerFrame_;
  t.ctx.splitPerFrame_ = () => null; // the deployed 0.13.30 behaviour: the whole count on the pins tag
  write(t, tag(4, 8, { extras: '16 580602 pins', parts: [pins(16)] })); t.ctx.splitPerFrame_ = keep;
  write(t, tag(7, 8));
  write(t, tag(4, 8, { extras: '16 580602 pins', parts: [pins(16)], notes: 'again', width_in: 24.5 }));
  write(t, tag(2, 8));
  assert.equal(total(sh, c), 8);
});

test('review of #31 round 2: a rescan that reads another count on a split group is flagged, never paid', () => {
  const t = load(), { sh, c } = modern(t);
  write(t, tag(4, 8, { extras: '16 580602 pins', parts: [pins(16)] }));
  const r = write(t, tag(4, 8, { extras: '24 580602 pins', parts: [pins(24)], ticket_number: '7770674', notes: 'again' })); // one digit misread
  assert.equal(total(sh, c), 1); assert.match(JSON.stringify(r.flags), /pins were already split per frame/);
});

test('review of #31 round 2: a split reused from another ticket asks her to check it is the same group', () => {
  const t = load(), { sh, c } = modern(t);
  write(t, tag(4, 8, { extras: '16 580602 pins', parts: [pins(16)] }));
  const r = write(t, tag(1, 8, { extras: '16 580602 pins', parts: [pins(16)] }));
  assert.match(JSON.stringify(r.flags), /pins split reused from row \d+ \(ticket 7770634\); check it is the same group/);
});

test('review of #31 round 2: unmarked splits only at exactly 2 per frame (6 pins on 1 of 6 stays on its tag)', () => {
  const t = load(), { sh, c } = modern(t);
  write(t, tag(1, 6, { extras: '6 580602 pins', parts: [pins(6)] })); write(t, tag(2, 6));
  const e = earningBy(sh, c); assert.equal(e['1 of 6'], 3); assert.equal(e['2 of 6'] || '', '');
});

test('review of #31 round 2: an old group receipt of another size or another customer does not block a split', () => {
  const ctx = load().ctx, x = { ...tag(4, 8), item_type: 'screen' };
  const old = (scope, customer, extra = {}) => ({ sku: '580602', group: true, scope: JSON.stringify(scope), customer, ...extra });
  assert.equal(ctx.oldGroupPaid_(old(['New Lenox', '7770634', 'group', 8], 'synthpas'), '580602', x, 16), true);
  assert.equal(ctx.oldGroupPaid_(old(['New Lenox', '7770634', 'group', 3], 'synthpas'), '580602', x, 16), false, 'another N');
  assert.equal(ctx.oldGroupPaid_(old(['New Lenox', '7770634', 'group', 8], 'synthwick'), '580602', x, 16), false, 'another customer');
  assert.equal(ctx.oldGroupPaid_(old(['New Lenox', '7770634', 'tag', '4 of 8'], 'synthpas', { group: false, quantity: 16 }), '580602', x, 16), true, '0.13.30 per-tag');
  assert.equal(ctx.oldGroupPaid_(old(['New Lenox', '7770634', 'tag', '4 of 8'], 'synthpas', { group: false, quantity: 2 }), '580602', x, 16), false, 'a frame\'s own 2 pins');
});

test('review of #31 round 2: a $1.50 she typed (no "New build:" note) is her entry: skipped, flagged on the pins row', () => {
  const t = load(), { sh, c } = modern(t);
  write(t, tag(7, 8)); const r7 = [...Array(20).keys()].map(k => k + 2).find(r => sh.get(r, c.SEQUENCE) === '7 of 8');
  sh.set(r7, c.EARNING, 1.5);
  const r = write(t, tag(4, 8, { extras: '16 580602 pins', parts: [pins(16)] }));
  assert.equal(sh.get(r7, c.EARNING), 1.5);
  assert.match(JSON.stringify(r.flags), /Pins split per frame: frame 7 not added automatically/);
});

test('October replay: frames with misread tickets scanned the same day still get their share', () => {
  const t = load(), { sh, c } = modern(t);
  write(t, tag(7, 8)); write(t, tag(4, 8, { extras: '16 580602 pins', parts: [pins(16)] }));
  write(t, tag(3, 8, { ticket_number: '777063 4' })); write(t, tag(6, 8, { ticket_number: '1770635' })); write(t, tag(1, 8, { ticket_number: '777063' }));
  const e = earningBy(sh, c); for (const i of [7, 4, 3, 6, 1]) assert.equal(e[i + ' of 8'], 1, 'frame ' + i);
  const u = load({ now: new Date('2026-10-27T15:00:00Z') }), m = modern(u);
  write(u, tag(4, 8, { extras: '16 580602 pins', parts: [pins(16)] }));
  u.setNow(new Date('2026-10-30T15:00:00Z')); write(u, tag(1, 8, { ticket_number: '777063' }));
  assert.equal(earningBy(m.sh, m.c)['1 of 8'] || '', '', 'days later with a misread ticket: not matched');
});

test('review of #31 round 4: a close name (Ward / Wood) the same day with a clean far ticket and no phone is never paid', () => {
  const t = load(), { sh, c } = modern(t), ward = { customer_name: 'Synthward', last_name: 'Synthward', phone: null };
  const wood = { customer_name: 'Synthwood', last_name: 'Synthwood', phone: null };
  write(t, tag(2, 2, { ...wood, ticket_number: '7790000' })); // already on the tab
  write(t, tag(1, 2, { ...ward, ticket_number: '7770631', extras: '4 580602 pins all frames', parts: [pins(4, true)] }));
  write(t, tag(2, 2, { ...wood, ticket_number: '7790001', width_in: 40 })); // scanned later
  const woodRows = [...Array(20).keys()].map(k => k + 2).filter(r => /synthwood/i.test(String(sh.get(r, c.NAME))));
  for (const r of woodRows) assert.equal(sh.get(r, c.EARNING) || '', '', 'Wood row ' + r);
});

test('review of #31 round 4: a frame already on the tab with a misread ticket (same day, same name) gets its share', () => {
  const t = load(), { sh, c } = modern(t);
  write(t, tag(3, 8, { ticket_number: '777063 4' }));
  write(t, tag(4, 8, { extras: '16 580602 pins', parts: [pins(16)] }));
  assert.equal(earningBy(sh, c)['3 of 8'], 1);
});

test('review of #31 round 4: an older row with the same frame number never blocks the current frame', () => {
  const t = load({ now: new Date('2026-10-01T15:00:00Z') }), { sh, c } = modern(t);
  write(t, tag(7, 8, { ticket_number: '7770601' }));
  t.setNow(new Date('2026-10-27T15:00:00Z'));
  write(t, tag(7, 8, { width_in: 99 })); write(t, tag(4, 8, { extras: '16 580602 pins', parts: [pins(16)] }));
  const rows = [...Array(20).keys()].map(k => k + 2).filter(r => sh.get(r, c.SEQUENCE) === '7 of 8');
  assert.equal(rows.length, 2); assert.equal(sh.get(rows[0], c.EARNING) || '', '', 'the old row'); assert.equal(sh.get(rows[1], c.EARNING), 1, 'today\'s row');
});

test('review of #31 round 5: each same-day guard alone blocks a wrong match', () => {
  const ctx = load({ now: new Date('2026-10-27T15:00:00Z') }).ctx, day = ctx.scanDateSerial_();
  const split = { of: 2, name: 'synthward', ticket: '7770631', phone: '', day };
  const x = (name, tk, phone = null) => ({ store: 'New Lenox', customer_name: name, last_name: name, ticket_number: tk, phone, tag_index: 2, tag_count: 2 });
  assert.equal(ctx.splitMatches_(split, x('Synthwood', '777063 1')), false, 'misread ticket, close name, no phone: name/phone guard');
  assert.equal(ctx.splitMatches_(split, x('Synthward', '7790000')), false, 'exact name, clean far ticket: ticket guard');
  assert.equal(ctx.splitMatches_(split, x('Synthward', '777063 1')), true, 'exact name and a misread ticket the same day');
  assert.equal(ctx.splitMatches_({ ...split, day: day - 3 }, x('Synthward', '777063 1')), false, 'three days later');
});

test('review of #31 round 5: a misread-ticket frame on the tab from another day is not paid by the same-day path', () => {
  // A 6-digit read stays a misread; a read with a space is now written as one 7-digit number (0.13.32), see below.
  const t = load({ now: new Date('2026-10-20T15:00:00Z') }), { sh, c } = modern(t);
  write(t, tag(3, 8, { ticket_number: '777063' }));
  t.setNow(new Date('2026-10-27T15:00:00Z'));
  write(t, tag(4, 8, { extras: '16 580602 pins', parts: [pins(16)] }));
  assert.equal(earningBy(sh, c)['3 of 8'] || '', '');
});

test('0.13.32: a ticket read with a space is written as 7 digits, so that frame matches its group like any clean read', () => {
  const t = load({ now: new Date('2026-10-20T15:00:00Z') }), { sh, c } = modern(t);
  write(t, tag(3, 8, { ticket_number: '777063 3' }));
  t.setNow(new Date('2026-10-27T15:00:00Z'));
  write(t, tag(4, 8, { extras: '16 580602 pins', parts: [pins(16)] }));
  assert.equal(earningBy(sh, c)['3 of 8'], 1);
});

console.log(`${passed} pins per frame tests passed`);
