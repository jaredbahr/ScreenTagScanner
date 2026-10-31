'use strict';
// One-ticket orders (Homer style): the order's agreed ticket is written for a one-digit misread with the same phone;
// a look-alike tag count gets a "likely x of N" note (Jared, 2026-10-31). Synthetic data only.
const assert = require('node:assert/strict');
const { load, BASE } = require('./offline.test.cjs');
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS ' + name); }
function modern(t, tab) { const sh = t.ss.tabs[tab]; sh.insertColumnAfter(15); sh.set(1, 16, 'Tag x of N'); sh.insertColumnAfter(3); sh.set(1, 4, 'Tag x of N'); return { sh, c: t.ctx.storeLayout_(sh).screens }; }
const write = (t, x) => { const r = t.ctx.saveScan_({ ...BASE, ...x }, 'Synthetic', [], '', 'synthetic'); assert.equal(r.ok, true, JSON.stringify(r).slice(0, 200)); return r; };
const P = '8155550142';
const tag = (store, name, tk, i, n, x = {}) => ({ store, customer_name: 'Ann ' + name, last_name: name, phone: P, ticket_number: tk,
  tag_index: i, tag_count: n, width_in: 20 + i, height_in: 30, billable_inches: 50 + i, ...x });
const rowOf = (sh, c, seq, tk) => [...Array(60).keys()].map(k => k + 2).find(r => sh.get(r, c.SEQUENCE) === seq && (!tk || String(sh.get(r, c.TICKET)) === tk));
const note = (sh, col, r) => sh.notes.get(sh.key(r, col)) || '';
function homer() {
  const t = load(), m = modern(t, 'Homer Glen');
  [1, 2, 3].forEach(i => write(t, tag('HOMER', 'Synthalpha', '8339100', i, 3, { phone: '8155550001', width_in: 40 + i })));
  [1, 2, 3].forEach(i => write(t, tag('HOMER', 'Synthbeta', '8339200', i, 3, { phone: '8155550002', width_in: 50 + i })));
  return { t, ...m };
}

test("a one-digit misread takes the order's ticket when 2+ tags with the same phone agree (the 10/31 case)", () => {
  const { t, sh, c } = homer();
  write(t, tag('HOMER', 'Synthgamma', '8339994', 3, 7)); write(t, tag('HOMER', 'Synthgamma', '8339994', 6, 7));
  write(t, tag('HOMER', 'Synthgamma', '8339944', 2, 7));
  const r = rowOf(sh, c, '2 of 7');
  assert.equal(String(sh.get(r, c.TICKET)), '8339994');
  assert.match(note(sh, c.TICKET, r), /read as 8339944; 2 tags of this order with the same phone read 8339994/);
  const h = t.ctx.HEADERS, log = t.ss.tabs.Scans.getDataRange().getValues().pop();
  assert.equal(String(log[h.indexOf('Ticket #')]), '8339944', 'the Scans log keeps the reading');
});

test('never: another phone, only one agreeing tag, a disagreeing order, a second order, or a ticket-per-tag tab', () => {
  const a = homer(); // another phone
  write(a.t, tag('HOMER', 'Synthgamma', '8339994', 3, 7)); write(a.t, tag('HOMER', 'Synthgamma', '8339994', 6, 7));
  write(a.t, tag('HOMER', 'Synthgamma', '8339944', 2, 7, { phone: '8155550999' }));
  assert.equal(String(a.sh.get(rowOf(a.sh, a.c, '2 of 7'), a.c.TICKET)), '8339944', 'another phone');
  const b = homer(); // one agreeing tag
  write(b.t, tag('HOMER', 'Synthgamma', '8339994', 3, 7)); write(b.t, tag('HOMER', 'Synthgamma', '8339944', 2, 7));
  assert.equal(String(b.sh.get(rowOf(b.sh, b.c, '2 of 7'), b.c.TICKET)), '8339944', 'one tag');
  const d = homer(); // the order disagrees with itself
  write(d.t, tag('HOMER', 'Synthgamma', '8339994', 3, 7)); write(d.t, tag('HOMER', 'Synthgamma', '8339994', 6, 7)); write(d.t, tag('HOMER', 'Synthgamma', '8339945', 5, 7)); // two digits from the order's, one from this read
  write(d.t, tag('HOMER', 'Synthgamma', '8339944', 2, 7));
  assert.equal(String(d.sh.get(rowOf(d.sh, d.c, '2 of 7'), d.c.TICKET)), '8339944', 'disagreeing order');
  const e = homer(); // this tag's own "x of N" is already on the tab
  write(e.t, tag('HOMER', 'Synthgamma', '8339994', 3, 7)); write(e.t, tag('HOMER', 'Synthgamma', '8339994', 2, 7));
  write(e.t, tag('HOMER', 'Synthgamma', '8339944', 2, 7, { width_in: 44 }));
  assert.ok(rowOf(e.sh, e.c, '2 of 7', '8339944'), 'a second order');
  const t = load(), m = modern(t, 'New Lenox'); // each tag its own ticket
  write(t, tag('New Lenox', 'Synthgamma', '7777694', 3, 7)); write(t, tag('New Lenox', 'Synthgamma', '7777694', 6, 7));
  write(t, tag('New Lenox', 'Synthgamma', '7777644', 2, 7));
  assert.equal(String(m.sh.get(rowOf(m.sh, m.c, '2 of 7'), m.c.TICKET)), '7777644', 'ticket-per-tag tab');
});

test('a look-alike tag count names the likely "x of N" (the 10/31 cases)', () => {
  const { t, sh, c } = homer(); // Homer: 1-6 of 7 on the tab, then "2 of 2"
  [1, 2, 3, 4, 5, 6].forEach(i => write(t, tag('HOMER', 'Synthgamma', '8339994', i, 7)));
  write(t, tag('HOMER', 'Synthgamma', '8339944', 2, 2, { width_in: 33 }));
  assert.match(note(sh, c.SEQUENCE, rowOf(sh, c, '2 of 2')), /this tag says 2 of 2, but this customer's order on rows [\d, ]+ is "of 7" \(2 and 7 look alike\): likely 7 of 7, check/);
  const u = load(), m = modern(u, 'New Lenox'); // New Lenox: 6, 4, 5 of 7, then "2 of 2" and "1 of 2"
  [[6, '7777610'], [4, '7777619'], [5, '7777618']].forEach(([i, tk]) => write(u, tag('New Lenox', 'Synthdelta', tk, i, 7)));
  write(u, tag('New Lenox', 'Synthdelta', '7777621', 2, 2));
  assert.match(note(m.sh, m.c.SEQUENCE, rowOf(m.sh, m.c, '2 of 2')), /likely 2 of 7 or 7 of 7, check/);
  write(u, tag('New Lenox', 'Synthdelta', '7777620', 1, 2));
  assert.match(note(m.sh, m.c.SEQUENCE, rowOf(m.sh, m.c, '1 of 2')), /likely 1 of 7 or 7 of 7, check/);
});

test("the order's tags may carry misread tickets: the same phone ties them (New Lenox, 10/31)", () => {
  const t = load(), { sh, c } = modern(t, 'New Lenox');
  write(t, tag('New Lenox', 'Synthdelta', '9777610', 6, 7)); write(t, tag('New Lenox', 'Synthdelta', '777619', 4, 7));
  write(t, tag('New Lenox', 'Synthdelta', '7777621', 2, 2));
  assert.match(note(sh, c.SEQUENCE, rowOf(sh, c, '2 of 2')), /is "of 7" \(2 and 7 look alike\): likely 2 of 7 or 7 of 7/);
  const u = load(), m = modern(u, 'New Lenox'); // the same misread tickets but another phone: no note
  write(u, tag('New Lenox', 'Synthdelta', '9777610', 6, 7)); write(u, tag('New Lenox', 'Synthdelta', '777619', 4, 7));
  write(u, tag('New Lenox', 'Synthdelta', '7777621', 2, 2, { phone: '8155550999' }));
  assert.doesNotMatch(note(m.sh, m.c.SEQUENCE, rowOf(m.sh, m.c, '2 of 2')), /look alike/);
});

test('no count note for another customer, a far ticket, or a real 2-tag order', () => {
  const t = load(), { sh, c } = modern(t, 'New Lenox');
  [[6, '7777610'], [4, '7777619']].forEach(([i, tk]) => write(t, tag('New Lenox', 'Synthdelta', tk, i, 7)));
  write(t, tag('New Lenox', 'Synthomega', '7777621', 2, 2, { phone: '8155550999' }));
  write(t, tag('New Lenox', 'Synthdelta', '7779621', 1, 2, { width_in: 41, phone: '8155550997' }));
  write(t, tag('New Lenox', 'Synthkappa', '7777631', 1, 2, { phone: '8155550998' })); write(t, tag('New Lenox', 'Synthkappa', '7777632', 2, 2, { phone: '8155550998' }));
  for (let r = 2; r < 14; r++) assert.doesNotMatch(note(sh, c.SEQUENCE, r), /look alike/, 'row ' + r);
  const u = load(), m = modern(u, 'New Lenox'); // only one tag of the other count on the tab: not yet an order
  write(u, tag('New Lenox', 'Synthsigma', '7777710', 6, 7)); write(u, tag('New Lenox', 'Synthsigma', '7777711', 2, 2));
  for (let r = 2; r < 8; r++) assert.doesNotMatch(note(m.sh, m.c.SEQUENCE, r), /look alike/, 'one tag, row ' + r);
  const v = load(), w = modern(v, 'New Lenox'); // "of 21" is not a look-alike of "of 7" (single digits only)
  [1, 2].forEach(i => write(v, tag('New Lenox', 'Synthtau', '77777' + (10 + i), i, 21)));
  write(v, tag('New Lenox', 'Synthtau', '7777715', 3, 7));
  for (let r = 2; r < 8; r++) assert.doesNotMatch(note(w.sh, w.c.SEQUENCE, r), /look alike/, 'of 21, row ' + r);
});

test('review: tags with parts or additional labor keep their reading (earnings receipts carry the read ticket)', () => {
  const { t, sh, c } = homer();
  write(t, tag('HOMER', 'Synthgamma', '8339994', 3, 7)); write(t, tag('HOMER', 'Synthgamma', '8339994', 6, 7));
  write(t, tag('HOMER', 'Synthgamma', '8339944', 2, 7, { extras: '2 580404 rollers', parts: [{ sku: '580404', quantity: 2, unit: 'each', group_wide: false, raw: '2 580404 rollers' }] }));
  assert.equal(String(sh.get(rowOf(sh, c, '2 of 7'), c.TICKET)), '8339944');
});

test('review: only a look-alike digit (consecutive tickets of two orders are left), and never on a patio form', () => {
  const a = homer();
  write(a.t, tag('HOMER', 'Synthgamma', '8339994', 1, 4)); write(a.t, tag('HOMER', 'Synthgamma', '8339994', 3, 4));
  write(a.t, tag('HOMER', 'Synthgamma', '8339995', 2, 4));
  assert.equal(String(a.sh.get(rowOf(a.sh, a.c, '2 of 4'), a.c.TICKET)), '8339995', '4/5 are not look-alikes');
  const b = homer();
  write(b.t, tag('HOMER', 'Synthgamma', '8339994', 3, 7)); write(b.t, tag('HOMER', 'Synthgamma', '8339994', 6, 7));
  write(b.t, tag('HOMER', 'Synthgamma', '8339944', 2, 7, { form_type: 'patio_door', width_in: 48, height_in: 75.5, billable_inches: null, material: null }));
  assert.equal(String(b.sh.get(rowOf(b.sh, b.c, '2 of 7'), b.c.TICKET)), '8339944', 'patio form');
});

test('review: a misread scanned first can overwrite at most one correct reading; a hand-confirmed order keeps fixing', () => {
  const { t, sh, c } = homer(); // misreads first: tags 3 and 6 read 944, then 2 and 1 read the true 994
  write(t, tag('HOMER', 'Synthgamma', '8339944', 3, 7)); write(t, tag('HOMER', 'Synthgamma', '8339944', 6, 7));
  write(t, tag('HOMER', 'Synthgamma', '8339994', 2, 7)); write(t, tag('HOMER', 'Synthgamma', '8339994', 1, 7));
  assert.equal(String(sh.get(rowOf(sh, c, '1 of 7'), c.TICKET)), '8339994', 'the second correct read is kept');
  const v = homer(); // review round 2: the overwritten row's cell note is cleared; the Scans log still knows the rule wrote it
  write(v.t, tag('HOMER', 'Synthgamma', '8339944', 3, 7)); write(v.t, tag('HOMER', 'Synthgamma', '8339944', 6, 7));
  write(v.t, tag('HOMER', 'Synthgamma', '8339994', 2, 7));
  const r2 = rowOf(v.sh, v.c, '2 of 7');
  assert.equal(String(v.sh.get(r2, v.c.TICKET)), '8339944'); assert.match(note(v.sh, v.c.TICKET, r2), /written as theirs/);
  v.sh.notes.delete(v.sh.key(r2, v.c.TICKET));
  for (const i of [1, 4, 5]) write(v.t, tag('HOMER', 'Synthgamma', '8339994', i, 7));
  for (const i of [1, 4, 5]) assert.equal(String(v.sh.get(rowOf(v.sh, v.c, i + ' of 7'), v.c.TICKET)), '8339994', 'cleared note: tag ' + i + ' kept');
  const u = homer(); // the 10/31 order: tag 3 read 944 and fixed by hand to 994; tag 6 read 994; then 2, 4, 5 read 944
  write(u.t, tag('HOMER', 'Synthgamma', '8339944', 3, 7)); u.sh.set(rowOf(u.sh, u.c, '3 of 7'), u.c.TICKET, '8339994');
  write(u.t, tag('HOMER', 'Synthgamma', '8339994', 6, 7));
  for (const i of [2, 4, 5]) write(u.t, tag('HOMER', 'Synthgamma', '8339944', i, 7));
  for (const i of [2, 4, 5]) assert.equal(String(u.sh.get(rowOf(u.sh, u.c, i + ' of 7'), u.c.TICKET)), '8339994', 'tag ' + i);
});

console.log(`${passed} order ticket/count tests passed`);
