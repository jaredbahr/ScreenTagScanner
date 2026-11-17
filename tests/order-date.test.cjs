'use strict';
// Jared, 2026-11-17: a tag with no date takes its order's date (Kirsten typed the date of the order's other tags 26
// times of 44 in October-November). A non-local area code was already a Scans-log note only. Synthetic data only.
const assert = require('node:assert/strict');
const { load } = require('./offline.test.cjs');
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS ' + name); }
const serial = s => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d) / 86400000 + 25569; };
const tag = (x = {}) => ({ store: 'Homer Glen', last_name: 'Synthorder', customer_name: 'Synthorder', phone: '6305550301', ticket_number: '7777961',
  tag_index: 1, tag_count: 2, width_in: 22, height_in: 30, billable_inches: 52, date: '10/8', ...x });
const at = d => new Date(d + 'T17:00:00Z');
const rowOf = (sh, name) => [...Array(40).keys()].map(k => k + 2).filter(r => String(sh.get(r, 3)).replace(' (?)', '') === name);

test('a tag with no date takes the date of its order\'s other tag, with a note on Date in', () => {
  const t = load({ now: at('2026-10-12') }), sh = t.ss.tabs['Homer Glen'];
  t.scan(tag()); t.setNow(at('2026-10-12'));
  const r = t.scan(tag({ tag_index: 2, date: null, width_in: 24, billable_inches: 54 }));
  const [first, second] = rowOf(sh, 'Synthorder');
  assert.equal(sh.get(second, 2), serial('2026-10-08'), 'Date in from the order');
  assert.match(sh.notes.get(second + ',2') || '', /Date in taken from row \d+ \(same order\): no date on this tag/);
  assert.doesNotMatch(r.message, /Check on the sheet:/, 'a cell note, not a yellow row');
  assert.equal(sh.get(first, 2), serial('2026-10-08'));
});

test('no order date: a single tag, tags that disagree, or an old order of the same name stays blank', () => {
  const t = load({ now: at('2026-10-12') }), sh = t.ss.tabs['Homer Glen'];
  t.scan(tag({ ticket_number: '7777970', tag_count: 1, date: null, last_name: 'Synthsolo', customer_name: 'Synthsolo' }));
  assert.equal(sh.get(rowOf(sh, 'Synthsolo')[0], 2), '', 'nothing to take it from');
  t.scan(tag({ ticket_number: '7777980', tag_count: 3, last_name: 'Synthsplit', customer_name: 'Synthsplit', date: '10/1' }));
  t.scan(tag({ ticket_number: '7777980', tag_count: 3, tag_index: 2, last_name: 'Synthsplit', customer_name: 'Synthsplit', date: '10/5', width_in: 25 }));
  t.scan(tag({ ticket_number: '7777980', tag_count: 3, tag_index: 3, last_name: 'Synthsplit', customer_name: 'Synthsplit', date: null, width_in: 26 }));
  const split = rowOf(sh, 'Synthsplit'); assert.equal(sh.get(split[2], 2), '', 'the order\'s tags disagree: left for Kirsten');
  t.scan(tag({ ticket_number: '7777990', last_name: 'Synthrepeat', customer_name: 'Synthrepeat', date: '9/1', tag_count: 2 }));
  t.setNow(at('2026-10-30'));
  t.scan(tag({ ticket_number: '7777995', last_name: 'Synthrepeat', customer_name: 'Synthrepeat', date: null, tag_count: 2, width_in: 30 }));
  const rep = rowOf(sh, 'Synthrepeat'); assert.equal(sh.get(rep[1], 2), '', 'same name, another ticket, filled over 14 days ago: not this order');
});

test('a non-local area code stays in the Scans log, off her sheet (already so; locked here)', () => {
  const t = load(), ctx = t.ctx;
  assert.equal(ctx.reviewTier_('Area code 830 is not local (misread?)').tier, 'log');
  assert.equal(ctx.reviewTier_('Tag year 2024 written as 2026 (the month and day are within 60 days of the scan)').tier, 'log');
  assert.equal(ctx.reviewTier_('Date in taken from row 5 (same order): no date on this tag').field, 'DATE_IN');
  const r = t.scan({ phone: '8305550199' }); const sh = t.ss.tabs['Homer Glen'];
  assert.doesNotMatch([...sh.notes.values()].join('\n'), /Area code/); assert.doesNotMatch(r.message, /Check on the sheet:/);
  const log = t.ss.tabs.Scans; assert.match(String(log.get(2, ctx.HEADERS.indexOf('Review Reason') + 1)), /Area code 830 is not local/);
});

console.log(`${passed} order-date tests passed`);
