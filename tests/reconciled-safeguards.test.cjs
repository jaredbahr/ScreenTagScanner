'use strict';
// Invented identifiers and post-extraction fixtures only; no photos, network or Google.
const assert = require('node:assert/strict');
const {load} = require('./offline.test.cjs');
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS ' + name); }
function fixture(modern = false) {
  const t = load(), sh = t.ss.tabs['Homer Glen'];
  if (modern) {
    sh.insertColumnAfter(15); sh.set(1, 16, 'Tag x of N');
    sh.insertColumnAfter(3); sh.set(1, 4, 'Tag x of N');
  }
  return {t, sh, c: t.ctx.storeLayout_(sh).screens};
}
const raw = '4 580401 Corners 4.00 16';
const corners = (overrides = {}) => ({sku:'580401', quantity:4, unit:'each', group_wide:false, raw, ...overrides});

test('prompt includes highlighted handwritten rows in literal and structured evidence, with no guessed ticket digits', () => {
  const p = load().ctx.SYSTEM_PROMPT;
  assert.match(p, /blank rows under the printed SKU list[\s\S]*highlighted[\s\S]*extras AND in parts/);
  assert.match(p, /ticket_number:[\s\S]*staple,[\s\S]*hole or fold[\s\S]*leading digit/);
  assert.match(p, /judge ticket length; the script checks it separately/);
  assert.match(p, /preserve exactly the digits you can read, never guess or pad/);
  assert.match(p, /list "ticket_number" in unclear when any digit is obscured or uncertain/);
  assert.match(p, /PK[\s\S]*EARNINGS, not a package count/);
  assert.match(p, /Standalone additional LB\/labor charges remain literal extras/);
});

test('short and long numeric tickets get one-cell hints and remain exactly as read in both layouts', () => {
  for (const modern of [false, true]) for (const ticket of ['920046', '92000046', '0']) {
    const {t, sh, c} = fixture(modern), r = t.scan({ticket_number:ticket});
    assert.equal(r.status, 'ok'); assert.doesNotMatch(r.message, /Check on the sheet:/);
    assert.equal(sh.get(2, c.TICKET), ticket);
    assert.match(sh.notes.get('2,' + c.TICKET), new RegExp('Ticket # has ' + ticket.length + ' digits'));
    assert.equal(sh.bg.get('2,' + c.TICKET),t.ctx.HINT_COLOR);
    assert.equal(t.ss.tabs.Scans.get(2, t.ctx.COL.TICKET), ticket);
    assert.match(t.scan({ticket_number:ticket}).message, /Already scanned/);
    assert.equal(sh.get(3, c.TICKET), '', 'warning must not bypass duplicate prevention');
  }
});

test('seven digits including leading zeroes stay literal and do not trigger a length warning', () => {
  for (const ticket of ['9200046', '0000046']) {
    const {t, sh, c} = fixture();
    assert.doesNotMatch(t.scan({ticket_number:ticket}).message, /Check on the sheet:/);
    assert.equal(sh.get(2, c.TICKET), ticket);
  }
});

test('missing and nonnumeric ticket handling stays distinct from numeric length warning', () => {
  const t = load();
  assert.match(t.scan({ticket_number:null}).message, /no ticket number/i);
  for (const ticket of [null, 'SYNTH-A']) {
    const reasons = t.ctx.reviewReasons_({...require('./offline.test.cjs').BASE, ticket_number:ticket});
    assert.doesNotMatch(reasons.join(';'), /Ticket # has/);
  }
});

test('a seven-digit uncertain reading remains visibly hinted without digit repair', () => {
  const {t, sh, c} = fixture();
  assert.doesNotMatch(t.scan({ticket_number:'9200046', unclear:['ticket_number: leading digit obscured']}).message, /Check on the sheet:/);
  assert.equal(sh.get(2, c.TICKET), '9200046');
  assert.match(sh.notes.get('2,' + c.TICKET), /leading digit obscured/);
  assert.equal(sh.bg.get('2,' + c.TICKET),t.ctx.HINT_COLOR);
});

test('clear handwritten corners use existing PK earnings once, never their retail total', () => {
  for (const modern of [false, true]) {
    const {t, sh, c} = fixture(modern), x = {ticket_number:'9200047', extras:raw, parts:[corners()]};
    assert.equal(t.scan(x).status, 'ok');
    assert.equal(sh.get(2, c.EARNING), 8, 'four corners at the existing $2 PK rate');
    assert.equal(t.ss.tabs.Scans.get(2, t.ctx.HEADERS.indexOf('Extras / Fees') + 1), raw);
    assert.match(t.scan(x).message, /Already scanned/);
    assert.equal(sh.get(2, c.EARNING), 8); assert.equal(sh.get(3, c.EARNING), '');
  }
});

test('handwritten parts with missing structured evidence or uncertainty still hold earnings for review', () => {
  for (const extra of [{parts:[]}, {parts:[corners()], unclear:['parts quantity unclear']},
    {parts:[corners({quantity:0})]}, {parts:[corners(), corners()]}]) {
    const {t, sh, c} = fixture();
    assert.match(t.scan({ticket_number:'9200048', extras:raw, ...extra}).message, /Check on the sheet:/);
    assert.equal(sh.get(2, c.EARNING), '');
  }
});

test('whole-group handwritten corners credit only once across siblings', () => {
  const {t, sh, c} = fixture(), x = {ticket_number:'9200049', extras:raw,
    group_extras:'580401 corners for the whole group', parts:[corners({group_wide:true})], tag_count:2};
  t.scan({...x, tag_index:1});
  t.scan({...x, tag_index:2, width_in:35, billable_inches:114});
  assert.equal(sh.get(2, c.EARNING), 8); assert.equal(sh.get(3, c.EARNING), '');
});

console.log(passed + ' reconciled-safeguards tests passed');
