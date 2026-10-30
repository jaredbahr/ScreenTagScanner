'use strict';
// A bare "ticket_number" doubt on a ticket that fits the store's series stays in the Scans log only (Jared, 2026-10-30).
const assert = require('node:assert/strict');
const { load } = require('./offline.test.cjs');
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS ' + name); }
const tag = (tk, x = {}) => ({ store: 'New Lenox', customer_name: 'Ann Synthwell', last_name: 'Synth' + tk.slice(-3), ticket_number: tk,
  tag_index: null, tag_count: null, width_in: 20 + Number(tk.slice(-2)) % 30, height_in: 30, billable_inches: 50 + Number(tk.slice(-2)) % 30, ...x });
function setup() { const t = load(), sh = t.ss.tabs['New Lenox'], c = t.ctx.storeLayout_(sh).screens; return { t, sh, c }; }
const noteOf = (sh, c, tk) => { const r = [...Array(40).keys()].map(k => k + 2).find(r => String(sh.get(r, c.TICKET)) === tk); return sh.notes.get(sh.key(r, c.TICKET)) || ''; };
const logReason = (t, tk) => { const h = t.ctx.HEADERS, rows = t.ss.tabs.Scans.getDataRange().getValues(); return String(rows.find(r => String(r[h.indexOf('Ticket #')]) === tk)[h.indexOf('Review Reason')]); };

test('a bare doubt on a ticket in the series: no sheet note, still in the Scans log', () => {
  const { t, sh, c } = setup();
  t.scan(tag('7779101')); t.scan(tag('7779102'));
  t.scan(tag('7779110', { unclear: ['ticket_number'] }));
  assert.doesNotMatch(noteOf(sh, c, '7779110'), /ticket_number/);
  assert.match(logReason(t, '7779110'), /ticket_number/);
});

test('kept on the sheet: a doubt with detail, a ticket outside the series, or too few tickets to know the series', () => {
  const { t, sh, c } = setup();
  t.scan(tag('7779101')); t.scan(tag('7779102'));
  t.scan(tag('7779111', { unclear: ['ticket_number: last digit 1 or 7'] }));
  assert.match(noteOf(sh, c, '7779111'), /ticket_number: last digit 1 or 7/);
  t.scan(tag('7779901', { unclear: ['ticket_number'] }));
  assert.match(noteOf(sh, c, '7779901'), /ticket_number/);
  const u = setup();
  u.t.scan(tag('7779101', { unclear: ['ticket_number'] }));
  assert.match(noteOf(u.sh, u.c, '7779101'), /ticket_number/, 'first ticket on the tab: no series yet');
});

test('review: a quieted scan keeps its other flags in the Scans log, Needs Review and the phone warning', () => {
  const { t, sh, c } = setup();
  t.scan(tag('7779101')); t.scan(tag('7779102'));
  const r = t.scan(tag('7779110', { unclear: ['ticket_number'], billable_inches: null }));
  const h = t.ctx.HEADERS, row = t.ss.tabs.Scans.getDataRange().getValues().find(v => String(v[h.indexOf('Ticket #')]) === '7779110');
  assert.match(String(row[h.indexOf('Review Reason')]), /Inches calculated from measurements/);
  assert.equal(row[h.indexOf('Needs Review')], 'YES');
  assert.match(r.message, /Check on the sheet: inches/);
  assert.doesNotMatch(noteOf(sh, c, '7779110'), /ticket_number/);
});

test('review: a ticket never fits the series by matching itself', () => {
  const { t, sh, c } = setup();
  t.scan(tag('7779110')); t.scan(tag('7779901'));
  t.scan(tag('7779110', { unclear: ['ticket_number'], width_in: 41 }));
  const notes = [...Array(10).keys()].map(k => k + 2).filter(r => String(sh.get(r, c.TICKET)) === '7779110').map(r => sh.notes.get(sh.key(r, c.TICKET)) || '');
  assert.ok(notes.some(n => /ticket_number/.test(n)));
});

console.log(`${passed} quiet ticket note tests passed`);
