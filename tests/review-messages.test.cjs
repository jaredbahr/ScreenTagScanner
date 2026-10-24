'use strict';
// Review levels and phone topics from the independent review of 0.13.23-0.13.25 (2026-10-23). Synthetic data only.
const assert = require('node:assert/strict');
const { load } = require('./offline.test.cjs');
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS ' + name); }
const t = load(), H = t.ctx.STORES.find(s => s.name === 'Homer Glen'), T = r => t.ctx.reviewTier_(r, H); // routed to Homer Glen

test('a ticket doubt that also raises a store, slip, window, quantity or group question keeps the yellow row', () => {
  for (const s of ['ticket_number: two tickets on the form; the Pay Cashier slip ticket is for a second screen of 80 inches',
    'ticket_number: printed label is for a different store (Lockport) than the written HOMER',
    'ticket_number: slip ticket differs; slip charges balance due for 20 more', 'ticket_number: may be a window tag ticket',
    'ticket_number unclear; the qty column also shows 95', 'ticket_number: red sticker means Lockport',
    'ticket_number read from a group tag; tag 2 of 3 bill separately', 'ticket_number: could be a Pay Cashier slip, not a tag',
    'ticket_number: refund slip ticket, $5 credit', 'ticket_number: Pay Cashier ticket number differs from the tag',
    'ticket_number: second screen on the form has its own ticket', 'ticket_number: written ticket and the 80 inch total disagree',
    'ticket_number: tag 2 of 3; other tags have a different ticket', 'ticket_number: multiple tags share this number',
    'ticket_number: two ticket numbers on the tag; may be two jobs', 'ticket_number: same ticket as the previous tag',
    'ticket_number: may be a rescan of an earlier ticket', 'ticket_number: may match a tag scanned earlier today',
    'ticket_number: balance due ticket 12.50 owed', 'ticket_number: may belong to Downers Grove', 'ticket_number: printed label says Lockport',
    'ticket_number: label from another Ace location (New Lenox)', 'ticket_number: ACE PRICE label reads 14.99, not a ticket number',
    'ticket_number: covered by a red sticker', 'ticket_number: Pay-Cashier ticket', 'ticket_number: ticket matches another customer',
    'ticket_number: ticket from the work order, not the tag', 'ticket_number: number on both tags',
    'ticket_number: Store # HOMER but the label is from a different store', 'ticket_number: Lockport ticket on a Homer form',
    'ticket_number: Downers Grove label on a Homer Glen tag', 'ticket_number: Store # DG on a Lockport ticket',
    'ticket_number: Store # HOMER; label printed at Lockport', 'ticket_number: sticker over the number is red (Lockport?)',
    'ticket_number: ticket from Lockport book']) assert.equal(T(s).tier, 'row', s);
});

test('a plain ticket-reading doubt, price-gun label included, stays one cell', () => {
  for (const s of ['ticket_number: price label 1234567 vs handwritten 7654321', 'ticket_number: price-gun label partly covers the last digit',
    'ticket_number: number appears on the Ace price sticker, Tag # line is blank; partly covered by sticker',
    'ticket_number: handwritten tag number has an extra leading digit overwritten', 'ticket_number: last digit could be 1 or 7',
    'ticket_number: read from the price tag sticker', 'ticket_number: price tag partly covers digits', 'ticket_number: a sticker over the number hides digit 3',
    'ticket_number: stickered over', 'ticket_number: the Ace sticker obscures digits', 'ticket_number: pricing label', 'ticket_number: barcode label',
    'ticket_number: label covers the last digit', 'ticket_number: two digits unclear',
    'ticket_number: HOMER tag uses an ACE PRICE label; last digit smudged', 'ticket_number: Store # HOMER; ticket digits faint',
    'ticket_number: Homer Glen tag; first digit obscured by staple',
    'ticket_number: digit 6 of 7 is smudged', 'ticket_number: last digit repeated or overwritten', 'ticket_number: digits share a stroke',
    'ticket_number: scanned at an angle, last digit unclear', 'ticket_number: second number faded',
    'ticket_number: Homer label from the price gun; last digit faint', 'ticket_number: HOMER tag; number read from the price-gun label',
    'ticket_number: Homer tag, digit 3 not clear', 'ticket_number: Homer Glen tag; the 4 vs 9 is unclear',
    'ticket_number: Homer tag, last digit could be 1 or 7 but likely 1']) {
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

test('the tag year alone goes to the Scans log only (Kirsten: she does not use the year); a date after the scan stays on the cell', () => {
  assert.equal(T('Tag year 2024 looks off for a scan in 2026 (4/6 and 0/6 look alike); check the date on the tag').tier, 'log');
  assert.equal(T('Two-digit tag year treated as 20YY; verify the century').tier, 'log');
  assert.equal(T('Two-digit tag year treated as 20YY; verify the century; Tag date is after the scan date; verify it').tier, 'cell');
  assert.equal(T('Tag date is invalid: Date in left blank; verify the written date').tier, 'cell');
  assert.deepEqual([...t.ctx.reviewTopics_(['Credits on the slip'])], ['a correction on the tag']);
  assert.deepEqual([...t.ctx.reviewTopics_(['Extra charge on slip'])], ['prices']);
});

test('a ticket doubt naming a store other than the one the tag went to is a yellow row; its own store is not (end to end)', () => {
  for (const s of ['ticket_number: may be a Lockport ticket', 'ticket_number: looks like a Plainfield number', 'ticket_number: Joilet ticket?',
    'ticket_number: Store # 37 on a HOMER tag']) assert.equal(T(s).tier, 'row', s);
  for (const s of ['ticket_number: the Homer tag is creased; another digit may be hidden', 'ticket_number: Homer tag, first digit could be 8 instead of 3',
    'ticket_number: HOMER tag; ticket book number partly hidden', 'ticket_number: from the HOMER tag, digit 3 unclear',
    'ticket_number: Store # box says HOMER; ticket digits faint']) assert.equal(T(s).tier, 'cell', s);
  assert.equal(t.ctx.reviewTier_('ticket_number: Homer tag, digit faint').tier, 'row', 'no routed store: fail closed');
  for (const [u, flagged] of [['ticket_number: HOMER tag uses an ACE PRICE label; last digit smudged', false], ['ticket_number: may be a Lockport ticket', true]]) {
    const v = load(), r = v.scan({ store: 'Homer Glen', unclear: [u] }), log = v.ss.tabs.Scans, h = v.ctx.HEADERS;
    assert.equal(/Check on the sheet/.test(r.message), flagged, u); assert.equal(log.get(2, h.indexOf('Needs Review') + 1) === 'YES', flagged, u);
    const again = v.scan({ store: 'Homer Glen', unclear: [u] });
    assert.match(again.message, /Already scanned/, u);
    assert.equal(/still needs/.test(again.message), flagged, u + ': a rescan agrees with the first scan');
  }
});

console.log(`${passed} review message tests passed`);
