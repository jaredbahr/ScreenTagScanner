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
const modern = t => { const sh = t.ss.tabs['Homer Glen']; sh.insertColumnAfter(15); sh.set(1, 16, 'Tag x of N'); sh.insertColumnAfter(3); sh.set(1, 4, 'Tag x of N'); return sh; };
const rowOf = (sh, name) => [...Array(40).keys()].map(k => k + 2).filter(r => String(sh.get(r, 3)).replace(' (?)', '') === name);

test('a tag with no date takes the date of its order\'s other tag, with a note on Date in', () => {
  const t = load({ now: at('2026-10-12') }), sh = t.ss.tabs['Homer Glen'];
  t.scan(tag());
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

test('a group tag with a close ticket, the same name, phone and N takes the order date (consecutive tickets)', () => {
  const t = load({ now: at('2026-10-12') }), sh = modern(t);
  t.scan(tag({ ticket_number: '7777961', date: '10/6' }));
  t.scan(tag({ ticket_number: '7777962', tag_index: 2, date: null, width_in: 24, billable_inches: 54 }));
  const rows = rowOf(sh, 'Synthorder'); assert.equal(sh.get(rows[1], 2), serial('2026-10-06'));
});

test('review of #72: never another customer\'s date, by a similar name or by a shared (misread) ticket', () => {
  const t = load({ now: at('2026-10-12') }), sh = t.ss.tabs['Homer Glen'];
  t.scan(tag({ last_name: 'Synthsmith', customer_name: 'Synthsmith', ticket_number: '7777101', phone: '6305550111', tag_count: 1, date: '10/1' }));
  t.scan(tag({ last_name: 'Synthsmyth', customer_name: 'Synthsmyth', ticket_number: '7777555', phone: '6305550999', date: null, width_in: 25, billable_inches: 55 }));
  assert.equal(sh.get(rowOf(sh, 'Synthsmyth')[0], 2), '', 'a similar name with another ticket and phone');
  t.scan(tag({ last_name: 'Synthalpha', customer_name: 'Synthalpha', ticket_number: '7777201', phone: '6305550222', tag_count: 2, date: '10/2' }));
  t.scan(tag({ last_name: 'Synthbeta', customer_name: 'Synthbeta', ticket_number: '7777201', phone: '6305550333', tag_count: 2, tag_index: 2, date: null, width_in: 26, billable_inches: 56 }));
  assert.equal(sh.get(rowOf(sh, 'Synthbeta')[0], 2), '', 'the same ticket under another name');
  t.scan(tag({ last_name: 'Synthdelta', customer_name: 'Synthdelta', ticket_number: '7777401', phone: null, tag_count: 2, date: '10/4' }));
  t.scan(tag({ last_name: 'Synthomega', customer_name: 'Synthomega', ticket_number: '7777401', phone: null, tag_count: 2, tag_index: 2, date: null, width_in: 28, billable_inches: 58 }));
  assert.equal(sh.get(rowOf(sh, 'Synthomega')[0], 2), '', 'the same ticket under another name, no phones to tell them apart');
  t.scan(tag({ last_name: 'Synthgamma', customer_name: 'Synthgamma', ticket_number: '7777301', phone: '6305551234', tag_count: 2, date: '10/3' }));
  t.scan(tag({ last_name: 'Synthgamma', customer_name: 'Synthgamma', ticket_number: '7777301', phone: '6305559876', tag_count: 2, tag_index: 2, date: null, width_in: 27, billable_inches: 57 }));
  assert.equal(sh.get(rowOf(sh, 'Synthgamma')[1], 2), '', 'the same name and ticket with a different phone');
  // A close ticket: the same customer's previous single-tag order, and two similar names with no phones, are other orders.
  // On a tab without "k of N", a close ticket never matches.
  { const u = load({ now: at('2026-10-12') }), plain = u.ss.tabs['Homer Glen'];
    u.scan(tag({ ticket_number: '7777961', phone: '6305551357', date: '10/6' }));
    u.scan(tag({ ticket_number: '7777962', phone: '6305551357', tag_index: 2, date: null, width_in: 24, billable_inches: 54 }));
    assert.equal(plain.get(rowOf(plain, 'Synthorder')[1], 2), '', 'no sequence column: same ticket only'); }
});

test('review of #72 (round 2): a close ticket is another order unless the phone and N match', () => {
  const t = load({ now: at('2026-10-12') }), sh = modern(t);
  t.scan(tag({ last_name: 'Synthrepeat', customer_name: 'Synthrepeat', ticket_number: '7777500', phone: '6305552468', tag_count: 1, date: '10/1' }));
  t.scan(tag({ last_name: 'Synthrepeat', customer_name: 'Synthrepeat', ticket_number: '7777520', phone: '6305552468', tag_count: 2, date: null, width_in: 29, billable_inches: 59 }));
  assert.equal(sh.get(rowOf(sh, 'Synthrepeat')[1], 2), '', 'the customer\'s previous order (another N)');
  t.scan(tag({ last_name: 'Synthkarl', customer_name: 'Synthkarl', ticket_number: '7777600', phone: null, date: '10/5' }));
  t.scan(tag({ last_name: 'Synthkarr', customer_name: 'Synthkarr', ticket_number: '7777630', phone: null, tag_index: 2, date: null, width_in: 31, billable_inches: 61 }));
  assert.equal(sh.get(rowOf(sh, 'Synthkarr')[0], 2), '', 'similar names, close tickets, no phones');
});

test('Date objects from the sheet (as real Sheets returns them) are read, and a date after the scan is never taken', () => {
  const t = load({ now: at('2026-10-12') }), sh = t.ss.tabs['Homer Glen'], c = t.ctx.storeLayout_(sh).screens;
  t.scan(tag());
  const r = rowOf(sh, 'Synthorder')[0];
  sh.set(r, c.DATE_IN, new t.ctx.Date(Date.UTC(2026, 9, 8, 5)));  // midnight Chicago, as a sandbox Date
  sh.set(r, c.DATE_OUT, new t.ctx.Date(Date.UTC(2026, 9, 12, 5)));
  const x = t.ctx.normalizeJobInput_({ ...require('./offline.test.cjs').BASE, ...tag({ tag_index: 2, date: null }) });
  const today = serial('2026-10-12');
  assert.equal(JSON.stringify(t.ctx.orderDateIn_(sh, c, x, t.ctx.screenBlockEnd_(sh), today)), JSON.stringify({ serial: serial('2026-10-08'), row: r }));
  sh.set(r, c.DATE_IN, serial('2026-10-20'));
  assert.equal(t.ctx.orderDateIn_(sh, c, x, t.ctx.screenBlockEnd_(sh), today), null, 'after the scan: not taken');
});

test('the new notes: order date on Date in, corrected year in the Scans log, non-local area code in the Scans log', () => {
  const t = load(), ctx = t.ctx;
  assert.equal(ctx.reviewTier_('Area code 830 is not local (misread?)').tier, 'log');
  assert.equal(ctx.reviewTier_('Tag year 2024 written as 2026 (the month and day are within 45 days of the scan)').tier, 'log');
  assert.equal(ctx.reviewTier_('Date in taken from row 5 (same order): no date on this tag').field, 'DATE_IN');
  const r = t.scan({ phone: '8305550199' }); const sh = t.ss.tabs['Homer Glen'];
  assert.doesNotMatch([...sh.notes.values()].join('\n'), /Area code/); assert.doesNotMatch(r.message, /Check on the sheet:/);
  const log = t.ss.tabs.Scans; assert.match(String(log.get(2, ctx.HEADERS.indexOf('Review Reason') + 1)), /Area code 830 is not local/);
});

console.log(`${passed} order-date tests passed`);
