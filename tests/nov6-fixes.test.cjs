'use strict';
// Kirsten, 2026-11-06: a colour crossed out kept 71" unbilled; "11/5" read as 4/5 and "11/3" as "1/3"; a written
// ticket's note read as if the tag were missing a digit. Synthetic data only.
const assert = require('node:assert/strict');
const { load } = require('./offline.test.cjs');
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS ' + name); }
const day = (ctx, r) => r.dateIn === '' ? '' : new Date((r.dateIn - 25569) * 864e5).toISOString().slice(0, 10);

test('a correction outside the inches (a crossed-out colour, name or ticket digit) no longer blocks billing the agreed QTY', () => {
  const t = load(), sh = t.ss.tabs['Homer Glen'];
  t.scan({ ticket_number: '8339728', width_in: 71, height_in: 40, billable_inches: 71, qty_rows: '71, 71, 71', line_totals: '',
    has_corrections: true, correction_details: 'Black color circled but crossed out with X; Gray circled instead' });
  assert.equal(sh.get(2, 6), 71, 'billed from the three agreeing QTY rows');
  const u = load(), sh2 = u.ss.tabs['Homer Glen'];
  u.scan({ ticket_number: '8339729', width_in: 41, height_in: 54, billable_inches: 75, qty_rows: '75, 75, 75', line_totals: '',
    has_corrections: true, correction_details: 'Measured wrong: size changed from 34x41 to 41x54' });
  assert.equal(sh2.get(2, 6), '', 'a size correction still leaves the inches for Kirsten');
  const c = t.ctx;
  for (const d of ['Fiberglass rows crossed out', 'Refund 2 screens', 'QTY changed', 'total rewritten $12', 'Measured wrong',
    'Black screen crossed out, now 2 screens', 'Black crossed out, remade', 'Black crossed out, 36\u00d748', 'Black crossed out, 36" x 48"',
    'Gray crossed out, Black circled, quanity 3', 'Black crossed out, no charge', 'Black crossed out - warranty',
    'Name crossed out, second screen added', 'Black crossed out, written over 71', 'Ticket number overwritten; 2 tags', ''])
    assert.equal(c.correctionOutsideInches_({ has_corrections: true, correction_details: d }), false, d);
  for (const d of ['Phone number has a crossed-out first attempt', 'Ticket number has an overwritten digit', 'Gray crossed out, Black circled'])
    assert.equal(c.correctionOutsideInches_({ has_corrections: true, correction_details: d }), true, d);
});

test('a lost leading 1 in the month is written back when it lands within two weeks of the scan; other far months get a note', () => {
  const t = load({ now: new Date('2026-11-06T18:00:00Z') }), c = t.ctx;
  let r = c.storeDates_({ date: '1/3' });
  assert.equal(day(c, r), '2026-11-03'); assert.match(r.reason, /Tag date read as 1\/3; written as 11\/3/);
  r = c.storeDates_({ date: '01-03' }); assert.equal(day(c, r), '2026-11-03');
  r = c.storeDates_({ date: '4/5' });
  assert.equal(day(c, r), '2026-04-05', 'not written: no safe guess'); assert.match(r.reason, /4\/5 is 215 days before the scan: .* month is likely misread/);
  r = c.storeDates_({ date: '2/5' }); assert.equal(day(c, r), '2026-02-05', '12/5 would be after the scan'); assert.match(r.reason, /days before the scan/);
  for (const d of ['11/5', '10/20', '10/1']) assert.equal(c.storeDates_({ date: d }).reason, '', d + ': a recent date needs nothing');
  const jan = load({ now: new Date('2027-01-06T18:00:00Z') }).ctx;
  assert.equal(day(jan, jan.storeDates_({ date: '1/3' })), '2027-01-03', 'in January, 1/3 is just January');
  assert.match(load({ now: new Date('2026-11-06T18:00:00Z') }).ctx.storeDates_({ date: '10/29/24' }).reason, /Tag year 2024/, 'year notes unchanged');
});

test('a written ticket\'s sheet note says the reading was off, without the "staple may hide a digit" line', () => {
  const t = load(), sh = t.ss.tabs['Homer Glen'];
  for (const [i, tk] of ['8339712', '8339736', '8339740'].entries()) t.scan({ ticket_number: tk, width_in: 20 + i, billable_inches: 99 + i });
  t.scan({ ticket_number: '339725', width_in: 30, billable_inches: 109, unclear: ['ticket_number'] });
  const row = [...Array(10).keys()].map(k => k + 2).find(r => String(sh.get(r, 5)) === '8339725');
  const note = sh.notes.get(row + ',5') || '';
  assert.match(note, /written as 8339725 \(read as 339725 on \d\d\/\d\d\): the scanner's reading was off, not the tag/);
  assert.doesNotMatch(note, /a staple may hide a digit/); assert.doesNotMatch(note, /^- ticket_number$/m);
  const h = t.ctx.HEADERS, log = t.ss.tabs.Scans.getDataRange().getValues().find(v => String(v[h.indexOf('Ticket #')]) === '339725');
  assert.match(String(log[h.indexOf('Review Reason')]), /a staple may hide a digit/, 'kept in the Scans log');
});

console.log(`${passed} nov6 fix tests passed`);
