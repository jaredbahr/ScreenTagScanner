'use strict';
// Repeat customers (Jared, 2026-10-30): a spelling Kirsten typed for this phone replaces a close misread. Synthetic data.
const assert = require('node:assert/strict');
const { load } = require('./offline.test.cjs');
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS ' + name); }
const P = '8155550142';
const tag = (name, tk, x = {}) => ({ store: 'New Lenox', customer_name: name, last_name: name, phone: P, ticket_number: tk,
  tag_index: null, tag_count: null, width_in: 20 + Number(tk.slice(-2)), height_in: 30, billable_inches: 50 + Number(tk.slice(-2)), ...x });
function setup() { const t = load(), sh = t.ss.tabs['New Lenox'], c = t.ctx.storeLayout_(sh).screens; return { t, sh, c }; }
const rowOfTicket = (sh, c, tk) => [...Array(40).keys()].map(k => k + 2).find(r => String(sh.get(r, c.TICKET)) === tk);
const nameOf = (sh, c, tk) => sh.get(rowOfTicket(sh, c, tk), c.NAME);
const noteOf = (sh, c, tk) => sh.notes.get(sh.key(rowOfTicket(sh, c, tk), c.NAME)) || '';

test('a spelling she typed for this phone replaces a close misread, with a note naming the reading and the row', () => {
  const { t, sh, c } = setup();
  t.scan(tag('Bynthe', '7779101'));
  sh.set(rowOfTicket(sh, c, '7779101'), c.NAME, 'Rynthe'); // Kirsten fixes it by hand
  t.scan(tag('Bynthe', '7779155'));
  assert.equal(nameOf(sh, c, '7779155'), 'Rynthe');
  assert.match(noteOf(sh, c, '7779155'), /Repeat customer \(name\): read as "Bynthe"; same phone as row 2, where the name was typed "Rynthe"/);
});

test('never without a matching phone, and never from another tab', () => {
  const { t, sh, c } = setup();
  t.scan(tag('Bynthe', '7779101'));
  sh.set(rowOfTicket(sh, c, '7779101'), c.NAME, 'Rynthe');
  t.scan(tag('Bynthe', '7779155', { phone: null }));
  t.scan(tag('Bynthe', '7779156', { phone: '8155550999' }));
  assert.equal(nameOf(sh, c, '7779155'), 'Bynthe'); assert.equal(nameOf(sh, c, '7779156'), 'Bynthe');
  const u = load(), j = u.ss.tabs['18650 (60)'], jc = u.ctx.storeLayout_(j).screens;
  const nl0 = u.ss.tabs['New Lenox'], nc0 = u.ctx.storeLayout_(nl0).screens;
  u.scan(tag('Qwynth', '7779001', { phone: '8155550777' })); nl0.set(2, nc0.NAME, 'Rynthe'); // same row number, other customer
  u.scan(tag('Bynthe', '7779001', { store: 'Joliet' })); // same row number and ticket as the New Lenox row: only the tab differs
  const r = [...Array(10).keys()].map(k => k + 2).find(k => String(j.get(k, jc.TICKET)) === '7779001'); j.set(r, jc.NAME, 'Rynthe');
  u.scan(tag('Bynthe', '7779155'));
  const nl = u.ss.tabs['New Lenox'], nc = u.ctx.storeLayout_(nl).screens;
  assert.equal(nameOf(nl, nc, '7779155'), 'Bynthe', 'a spelling typed on another store tab is not used');
});

test("never from a name the scanner wrote, a \"(?)\" name, or when her spellings for the phone disagree", () => {
  const a = setup();
  a.t.scan(tag('Rynthe', '7779101')); // the scanner wrote it; nobody checked it
  a.t.scan(tag('Bynthe', '7779155'));
  assert.equal(nameOf(a.sh, a.c, '7779155'), 'Bynthe');
  const b = setup();
  b.t.scan(tag('Bynthe', '7779101'));
  b.sh.set(rowOfTicket(b.sh, b.c, '7779101'), b.c.NAME, 'Rynthe (?)');
  b.t.scan(tag('Bynthe', '7779155'));
  assert.equal(nameOf(b.sh, b.c, '7779155'), 'Bynthe');
  const d = setup();
  d.t.scan(tag('Bynthe', '7779101')); d.t.scan(tag('Bynthe', '7779102'));
  d.sh.set(rowOfTicket(d.sh, d.c, '7779101'), d.c.NAME, 'Rynthe'); d.sh.set(rowOfTicket(d.sh, d.c, '7779102'), d.c.NAME, 'Kynthe');
  d.t.scan(tag('Bynthe', '7779155'));
  assert.equal(nameOf(d.sh, d.c, '7779155'), 'Bynthe');
});

test('a different name on the same phone (another person) and an exact read are left alone', () => {
  const { t, sh, c } = setup();
  t.scan(tag('Bynthe', '7779101'));
  sh.set(rowOfTicket(sh, c, '7779101'), c.NAME, 'Rynthe');
  t.scan(tag('Synthkowski', '7779155'));
  t.scan(tag('Rynthe', '7779156'));
  assert.equal(nameOf(sh, c, '7779155'), 'Synthkowski'); assert.equal(nameOf(sh, c, '7779156'), 'Rynthe');
  assert.doesNotMatch(noteOf(sh, c, '7779156'), /Repeat customer/);
});

test('a window row she corrected also counts, and an unsure read "(?)" takes her spelling', () => {
  const { t, sh } = setup(), l = t.ctx.storeLayout_(sh);
  t.scan(tag('Bynthe', '7779101', { item_type: 'window', panes: 1, glass_price: 20, job_evidence: 'window pane glass' }));
  const wr = [...Array(10).keys()].map(k => k + 2).find(r => String(sh.get(r, l.windows.TICKET)) === '7779101');
  sh.set(wr, l.windows.NAME, 'Rynthe');
  t.scan(tag('Bynthe', '7779155', { name_unclear: true }));
  assert.equal(nameOf(sh, l.screens, '7779155'), 'Rynthe');
});

test('review: an unchanged scanner-written name for the phone counts against it (two people on one phone)', () => {
  const { t, sh, c } = setup();
  t.scan(tag('Synthwood', '7779101'));            // right as read; nobody touched it
  t.scan(tag('Synthwood', '7779102'));
  sh.set(rowOfTicket(sh, c, '7779102'), c.NAME, 'Synthward'); // she typed another person's name on the same phone
  t.scan(tag('Synthwood', '7779155'));
  assert.equal(nameOf(sh, c, '7779155'), 'Synthwood');
});

test('review: a row that moved or was reused (its ticket no longer matches the log) is not evidence', () => {
  const { t, sh, c } = setup();
  t.scan(tag('Bynthe', '7779101'));
  const r = rowOfTicket(sh, c, '7779101');
  sh.set(r, c.NAME, 'Rynthe'); sh.set(r, c.TICKET, '7779888'); // she inserted a row: another job now sits here
  t.scan(tag('Bynthe', '7779155'));
  assert.equal(nameOf(sh, c, '7779155'), 'Bynthe');
});

test('review: stores on numbered tabs (Joliet) match too', () => {
  const t = load(), j = t.ss.tabs['18650 (60)'], jc = t.ctx.storeLayout_(j).screens;
  t.scan(tag('Bynthe', '6479101', { store: 'Joliet' }));
  j.set(rowOfTicket(j, jc, '6479101'), jc.NAME, 'Rynthe');
  t.scan(tag('Bynthe', '6479155', { store: 'Joliet' }));
  assert.equal(nameOf(j, jc, '6479155'), 'Rynthe');
});

test('review: a patio form row is not evidence (it may carry the shop phone); short names are never changed', () => {
  const { t, sh, c } = setup();
  t.scan(tag('Bynthe', '7779101', { form_type: 'patio_door', width_in: 48, height_in: 75.5, billable_inches: null, material: null }));
  const r = [...Array(40).keys()].map(k => k + 2).find(k => String(sh.get(k, c.TICKET)) === '7779101');
  sh.set(r, c.NAME, 'Rynthe');
  t.scan(tag('Bynthe', '7779155'));
  assert.equal(nameOf(sh, c, '7779155'), 'Bynthe');
  const u = setup();
  u.t.scan(tag('Hurt', '7779101')); u.sh.set(rowOfTicket(u.sh, u.c, '7779101'), u.c.NAME, 'Hart');
  u.t.scan(tag('Hurt', '7779155'));
  assert.equal(nameOf(u.sh, u.c, '7779155'), 'Hurt', 'four letters: too short to trust');
  const v = setup();
  v.t.scan(tag('Bynthe', '7779101')); v.sh.set(rowOfTicket(v.sh, v.c, '7779101'), v.c.NAME, 'Rynthe');
  v.t.scan(tag('Bynthe', '7779155', { form_type: 'patio_door', width_in: 48, height_in: 75.5, billable_inches: null, material: null }));
  assert.equal(nameOf(v.sh, v.c, '7779155'), 'Bynthe', 'a patio form itself is never changed');
});

console.log(`${passed} repeat customer tests passed`);
