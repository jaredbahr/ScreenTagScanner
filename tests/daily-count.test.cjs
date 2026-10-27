'use strict';
// Daily count (Kirsten, 2026-10-27): tags placed today, from the Scans log. Synthetic data only.
const assert = require('node:assert/strict');
const { load } = require('./offline.test.cjs');
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS ' + name); }
const tag = (tk, x = {}) => ({ ticket_number: tk, width_in: 30, height_in: 40, billable_inches: 70, ...x });
// The phone page's call (the Shortcut's JSON reply stays unchanged).
const page = t => ({ ...t, scan: x => { t.setOutput(x); return t.ctx.scanTag({ token: 't', image: '/9j/AP/Z' }); } });

test('each saved scan returns the number of tags placed today', () => {
  const t = page(load({ now: new Date('2026-10-27T15:00:00Z') }));
  assert.equal(t.scan(tag('7770901')).today, 1);
  assert.equal(t.scan(tag('7770902', { width_in: 31, billable_inches: 71 })).today, 2);
  assert.equal(t.scan(tag('7770903', { width_in: 32, billable_inches: 72 })).today, 3);
});

test('rescans and scans that were not placed are not counted; the reply still carries the count', () => {
  const t = page(load({ now: new Date('2026-10-27T15:00:00Z') }));
  t.scan(tag('7770901'));
  const again = t.scan(tag('7770901'));
  assert.match(again.message, /Already scanned/); assert.equal(again.today, 1);
  const lost = t.scan(tag('7770904', { store: 'Nowhere', sticker_color: 'none', width_in: 33, billable_inches: 73 }));
  assert.match(lost.message, /Not added to the sheet/); assert.equal(lost.today, 1);
});

test('the count starts again each Chicago day', () => {
  const t = page(load({ now: new Date('2026-10-27T15:00:00Z') }));
  t.scan(tag('7770901')); t.scan(tag('7770902', { width_in: 31, billable_inches: 71 }));
  t.setNow(new Date('2026-10-28T04:30:00Z')); // 11:30 pm Oct 27 in Chicago: still the same day
  assert.equal(t.scan(tag('7770905', { width_in: 34, billable_inches: 74 })).today, 3);
  t.setNow(new Date('2026-10-28T13:00:00Z')); // 8 am Oct 28
  assert.equal(t.scan(tag('7770906', { width_in: 35, billable_inches: 75 })).today, 1);
});

test('a failure reading the count never fails a saved scan', () => {
  const t = page(load({ now: new Date('2026-10-27T15:00:00Z') }));
  t.ctx.todayPlacedCount_ = () => { throw Error('synthetic'); };
  const r = t.scan(tag('7770907'));
  assert.equal(r.status, 'ok'); assert.equal(r.today, undefined);
});

test('the Shortcut reply keeps its four fields', () => {
  const t = load({ now: new Date('2026-10-27T15:00:00Z') });
  assert.deepEqual(Object.keys(t.scan(tag('7770908'))).sort(), ['message', 'scanId', 'speak', 'status']);
});

console.log(`${passed} daily count tests passed`);
