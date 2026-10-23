'use strict';
// Group placement fixes from the independent review of 0.13.22-0.13.25 (2026-10-23). Synthetic data only.
const assert = require('node:assert/strict');
const { load } = require('./offline.test.cjs');
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS ' + name); }
function modern(t, tab = 'New Lenox') {
  const sh = t.ss.tabs[tab];
  sh.insertColumnAfter(15); sh.set(1, 16, 'Tag x of N'); sh.insertColumnAfter(3); sh.set(1, 4, 'Tag x of N');
  return { sh, c: t.ctx.storeLayout_(sh).screens };
}
const job = (name, ticket, i, n, extra = {}) => ({ store: 'New Lenox', last_name: name, customer_name: name, ticket_number: ticket,
  tag_index: i, tag_count: n, width_in: 20 + i, height_in: 30, billable_inches: 50 + i + (extra.bump || 0), ...extra });
const row = (sh, c, r) => [sh.get(r, c.NAME), sh.get(r, c.SEQUENCE), sh.get(r, c.TICKET)];
const held = (t, sh, r) => !!t.ctx.holdAt_(sh.notes.get(r + ',1') || '', t.ctx.groupHoldMeta_(sh), r);
const cellNotes = (sh, r) => [...sh.notes].filter(([k]) => k.startsWith(r + ',') && k !== r + ',1').map(([, v]) => v).join('\n');

test('two customers with one surname: each group fills its own held row', () => {
  const t = load(), { sh, c } = modern(t);
  t.scan(job('Smith', '7707100', 1, 2)); t.scan(job('Smith', '7707468', 1, 2, { bump: 1 }));
  assert.ok(held(t, sh, 3)); assert.ok(held(t, sh, 5));
  t.scan(job('Smith', '7707468', 2, 2, { bump: 2 })); t.scan(job('Smith', '7707100', 2, 2, { bump: 3 }));
  assert.deepEqual(row(sh, c, 3), ['Smith', '2 of 2', '7707100']);
  assert.deepEqual(row(sh, c, 5), ['Smith', '2 of 2', '7707468']);
  assert.equal(sh.get(6, c.NAME), '', 'no stray row; no grey row left behind');
  assert.ok(!held(t, sh, 3) && !held(t, sh, 5));
});

test('exact-name misprint match needs the same day or the same ticket book', () => {
  const t = load({ now: new Date('2026-10-20T17:00:00Z') }), { sh, c } = modern(t);
  t.scan(job('Smith', '7708100', 1, 2));
  t.setNow(new Date('2026-10-22T17:00:00Z'));
  t.scan(job('Smith', '3308900', 2, 2, { bump: 1 }));
  assert.equal(sh.get(3, c.NAME), '', 'another day, another book: not this group'); assert.ok(held(t, sh, 3));
  t.scan(job('Smith', '7708133', 2, 2, { bump: 2 }));
  assert.deepEqual(row(sh, c, 3), ['Smith', '2 of 2', '7708133'], 'same book still fills it');
});

test('a misread "k of N" with its own ticket still fills the group (two "4 of 12", no 8 of 12), with a note', () => {
  const t = load(), { sh, c } = modern(t);
  t.scan(job('Synthkow', '7707100', 1, 3)); t.scan(job('Synthkow', '7707101', 1, 3, { bump: 4 }));
  assert.deepEqual(row(sh, c, 3), ['Synthkow', '1 of 3', '7707101']);
  assert.match(cellNotes(sh, 3), /Group check \(tag\): 1 of 3 is already on row 2; not yet on the tab: 2, 3 of 3/);
});

test('a loose match whose "k of N" is already on the tab does not take a hold', () => {
  const t = load(), { sh, c } = modern(t);
  t.scan(job('Smith', '7707100', 1, 2)); t.scan(job('Smith', '3307100', 1, 2, { bump: 4 }));
  assert.ok(held(t, sh, 3)); assert.equal(sh.get(4, c.NAME), 'Smith');
});

test('group check: the same surname three weeks later is not called a duplicate or a ticket mismatch', () => {
  const t = load({ now: new Date('2026-10-01T17:00:00Z') }), { sh, c } = modern(t, 'Homer Glen');
  const h = (n, tk, i) => ({ ...job(n, tk, i, 2), store: 'Homer Glen' });
  t.scan(h('Smith', '8169100', 1)); t.scan(h('Smith', '8169100', 2));
  t.setNow(new Date('2026-10-22T17:00:00Z'));
  t.scan(h('Smith', '8169730', 1)); t.scan(h('Smith', '8169730', 2));
  for (const r of [4, 5]) assert.doesNotMatch(cellNotes(sh, r), /Group check/, 'row ' + r);
});

test('group check: a loose sibling never triggers "already on row" or a shared-ticket note', () => {
  const t = load(), { sh } = modern(t);
  t.scan(job('Smith', '7707100', 1, 2)); t.scan(job('Smith', '7707468', 1, 2, { bump: 1 }));
  const notes = cellNotes(sh, 4);
  assert.doesNotMatch(notes, /already on row|other tags in this group read/);
});

test('Kirsten\'s own column-A note is never overwritten by a hold, and survives a release', () => {
  const t = load(), { sh, c } = modern(t);
  sh.notes.set('3,1', 'Kirsten: keep for the redo');
  t.scan(job('Synthk', '7707100', 1, 2));
  assert.equal(sh.notes.get('3,1'), 'Kirsten: keep for the redo'); assert.ok(!held(t, sh, 3));
  const u = load(), m = modern(u);
  u.scan(job('Synthk', '7707100', 1, 2));
  m.sh.notes.set('3,1', m.sh.notes.get('3,1') + '\nKirsten: customer called');
  u.scan(job('Synthk', '7707100', 2, 2));
  assert.equal(m.sh.get(3, m.c.NAME), 'Synthk'); assert.equal(m.sh.notes.get('3,1'), 'Kirsten: customer called');
});

test('if the hidden hold data cannot be read, held rows are not reused', () => {
  const t = load(), { sh, c } = modern(t);
  t.scan(job('Synthm', '7707100', 1, 2)); sh.failMetadataRead = true;
  t.scan(job('Synthz', '7707300', 1, 1));
  assert.equal(sh.get(3, c.NAME), ''); assert.equal(sh.get(4, c.NAME), 'Synthz');
  sh.failMetadataRead = false;
  t.scan(job('Synthm', '7707100', 2, 2));
  assert.deepEqual(row(sh, c, 3), ['Synthm', '2 of 2', '7707100'], 'it fills normally once readable');
});

test('re-holding a row and filling it leaves no hidden entries behind', () => {
  const t = load(), { sh } = modern(t);
  t.scan(job('Synthm', '7707100', 1, 2));
  sh.notes.set('3,1', ''); // Kirsten deletes the hold note by hand: the hidden entry stays
  assert.equal(sh.devMeta.length, 1);
  t.scan(job('Synthq', '7707500', 1, 1)); // row 3 is free again
  t.scan(job('Synthr', '7707900', 1, 2)); // holds row 5
  t.scan(job('Synthr', '7707900', 2, 2));
  assert.equal(sh.devMeta.length, 1, 'only the orphan from row 3 remains (cleared next time that row is held or freed)');
  const u = load(), m = modern(u);
  u.scan(job('Synthm', '7707100', 1, 2));
  m.sh.devMeta.push({ ...m.sh.devMeta[0], value: JSON.stringify({ name: 'old', of: 2, ticket: '1', day: 1 }) });
  u.scan(job('Synthm', '7707100', 2, 2));
  assert.equal(m.sh.devMeta.length, 0, 'release removes every entry on the row');
});

test('look-alike hint: no hint when the ticket\'s own book is already on the tab', () => {
  const t = load(), sh = t.ss.tabs['New Lenox'];
  const one = (name, tk) => ({ store: 'New Lenox', last_name: name, customer_name: name, ticket_number: tk, tag_index: 1, tag_count: 1, width_in: 20, height_in: 30, billable_inches: 50 });
  t.scan(one('Synthone', '7708101')); t.scan(one('Synthtwo', '7708150')); t.scan(one('Synthsix', '2208190'));
  t.scan(one('Synththree', '2208120'));
  assert.doesNotMatch([...sh.notes.values()].filter(v => /2208120/.test(v)).join('\n'), /look alike/);
});

test('hold ranking: same ticket beats one digit off beats a loose match', () => {
  const r = load().ctx.groupHoldRank_, key = { name: 'smith', of: 2, ticket: '7707100' };
  assert.equal(r({ name: 'smith', of: 2, ticket: '7707100', day: 5 }, key, 9), 1);
  assert.equal(r({ name: 'smith', of: 2, ticket: '7707130', day: 5 }, key, 9), 2);
  assert.equal(r({ name: 'smith', of: 2, ticket: '7707900', day: 5 }, key, 9), 3);
  assert.equal(r({ name: 'smith', of: 2, ticket: '7708900', day: 5 }, key, 9), 0, 'other day, other book');
  assert.equal(r({ name: 'smith', of: 2, ticket: '1707200', day: 9 }, key, 9), 4, 'same day misprint');
  assert.equal(r({ name: 'smyth', of: 2, ticket: '1234', day: 9 }, key, 9), 4, 'close name same day');
  assert.equal(r({ name: 'smyth', of: 2, ticket: '1234', day: 8 }, key, 9), 0);
});

console.log(`${passed} group review tests passed`);
