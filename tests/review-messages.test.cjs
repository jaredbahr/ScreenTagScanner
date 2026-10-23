'use strict';
// Review levels and phone topics from the independent review of 0.13.23-0.13.25 (2026-10-23). Synthetic data only.
const assert = require('node:assert/strict');
const { load } = require('./offline.test.cjs');
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS ' + name); }
const t = load(), T = t.ctx.reviewTier_;

test('a ticket doubt that also raises a store, slip, window, quantity or group question keeps the yellow row', () => {
  for (const s of ['ticket_number: two tickets on the form; the Pay Cashier slip ticket is for a second screen of 80 inches',
    'ticket_number: printed label is for a different store (Lockport) than the written HOMER',
    'ticket_number: slip ticket differs; slip charges balance due for 20 more', 'ticket_number: may be a window tag ticket',
    'ticket_number unclear; the qty column also shows 95', 'ticket_number: red sticker means Lockport',
    'ticket_number read from a group tag; tag 2 of 3 bill separately', 'ticket_number: could be a Pay Cashier slip, not a tag',
    'ticket_number: refund slip ticket, $5 credit']) assert.equal(T(s).tier, 'row', s);
});

test('a plain ticket-reading doubt, price-gun label included, stays one cell', () => {
  for (const s of ['ticket_number: price label 1234567 vs handwritten 7654321', 'ticket_number: price-gun label partly covers the last digit',
    'ticket_number: number appears on the Ace price sticker, Tag # line is blank; partly covered by sticker',
    'ticket_number: handwritten tag number has an extra leading digit overwritten', 'ticket_number: last digit could be 1 or 7']) {
    const r = T(s); assert.deepEqual([r.tier, r.field], ['cell', 'TICKET'], s);
  }
});

test('phone topics: "crediting" is not a correction, "extra inches" is not parts, store must be a word', () => {
  assert.deepEqual([...t.ctx.reviewTopics_(['Existing additional labor receipt is pending or changed: reconcile before crediting'])], ['prices']);
  assert.deepEqual([...t.ctx.reviewTopics_(['Inches disagree: Tag 75; slip charges extra 20 inches'])], ['inches']);
  assert.deepEqual([...t.ctx.reviewTopics_(['Refund of $5 credit'])], ['a correction on the tag']);
  assert.deepEqual([...t.ctx.reviewTopics_(['3 pins, 2 corners on extras'])], ['parts']);
  assert.deepEqual([...t.ctx.reviewTopics_(['Store says Homer Glen but red sticker means Lockport'])], ['store']);
  assert.deepEqual([...t.ctx.reviewTopics_(['Customer name Storey looks unclear'])], ['details in the Scans tab']);
});

console.log(`${passed} review message tests passed`);
