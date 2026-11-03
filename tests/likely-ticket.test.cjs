'use strict';
// The one likely ticket a ticket hint names is written; the reading stays in the note and the Scans log
// (Jared, 2026-11-03: October's hints matched Kirsten's typed fix 23 times in 24). Synthetic data only.
const assert = require('node:assert/strict');
const { load, BASE } = require('./offline.test.cjs');
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS ' + name); }
const write = (t, x) => { const r = t.ctx.saveScan_({ ...BASE, ...x }, 'Synthetic', [], '', 'synthetic'); assert.equal(r.ok, true, JSON.stringify(r).slice(0, 200)); return r; };
const one = (tk, i, x = {}) => ({ store: 'New Lenox', customer_name: 'Ann Synth' + i, last_name: 'Synth' + i, phone: '81555501' + String(i).padStart(2, '0'),
  ticket_number: tk, tag_index: 1, tag_count: 1, width_in: 20 + i, height_in: 30, billable_inches: 50 + i, ...x });
const rowsWith = (sh, col, v) => { const out = []; for (let r = 2; r <= sh.getMaxRows(); r++) if (String(sh.get(r, col)) === v) out.push(r); return out; };
function newLenox() {
  const t = load(), sh = t.ss.tabs['New Lenox'], c = t.ctx.storeLayout_(sh).screens;
  write(t, one('7708101', 1)); write(t, one('7708150', 2));
  return { t, sh, c, log: t.ss.tabs.Scans, col: name => t.ctx.HEADERS.indexOf(name) + 1 };
}

test('7s read as 2s: the store-series ticket is written, the reading kept in the note and the Scans log', () => {
  const { t, sh, c, log, col } = newLenox();
  write(t, one('2208120', 3));
  const [r] = rowsWith(sh, c.TICKET, '7708120');
  assert.ok(r, 'written as the likely ticket'); assert.equal(rowsWith(sh, c.TICKET, '2208120').length, 0);
  const n = sh.notes.get(r + ',' + c.TICKET) || '';
  assert.match(n, /likely 7708120 \(2\/7 look alike\)/); assert.match(n, /written as 7708120 \(read as 2208120\)/);
  assert.equal(String(log.get(log.getLastRow(), col('Ticket #'))), '2208120', 'the log keeps the reading');
  assert.match(String(log.get(log.getLastRow(), col('Review Reason'))), /written as 7708120/);
});

test('a missing digit with one clear fit is written; an unclear one stays as read (the 10/31 New Lenox pattern)', () => {
  const { t, sh, c } = newLenox();
  write(t, one('7708140', 3)); write(t, one('7708160', 4));
  write(t, one('708155', 5)); // the first 7 of "77" lost
  assert.equal(rowsWith(sh, c.TICKET, '7708155').length, 1, 'written'); assert.equal(rowsWith(sh, c.TICKET, '708155').length, 0);
  write(t, one('770815', 6)); // a digit missing at the end: ten tickets fit
  assert.equal(rowsWith(sh, c.TICKET, '770815').length, 1, 'no single fit: the reading stays');
});

test('never: several candidates, a short handwritten tail, a ticket already on the tab, parts or labor, or a window', () => {
  const { t, sh, c } = newLenox();
  write(t, one('7708120', 3));
  write(t, one('2208120', 4)); // its likely ticket is another customer's: left as read
  assert.equal(rowsWith(sh, c.TICKET, '2208120').length, 1); assert.equal(rowsWith(sh, c.TICKET, '7708120').length, 1);
  const p = newLenox(); // its own tab: the kept 2208120 above would make 2208130 look like a series
  write(p.t, one('2208130', 5, { extras: '2 580404 rollers', parts: [{ sku: '580404', quantity: 2, unit: 'each', group_wide: false, raw: '2 580404 rollers' }] }));
  assert.match([...p.sh.notes.values()].join('\n'), /likely 7708130/, 'the hint is still there');
  assert.equal(rowsWith(p.sh, p.c.TICKET, '2208130').length, 1, 'parts receipts carry the read ticket');
  write(t, one('8120', 6));
  assert.equal(rowsWith(sh, c.TICKET, '8120').length, 1, 'a 4-digit tail is only a note');
  const ctx = t.ctx;
  assert.equal(ctx.hintTicket_('Ticket # 23499911 has 8 digits: could be 2349911 or 2349991, check the tag', '23499911'), '');
  assert.equal(ctx.hintTicket_('Ticket # 777764 is missing a digit: could be 7777643, 7777644 or 7777645 (from this group\'s tickets), check the tag', '777764'), '');
  assert.equal(ctx.hintTicket_('Ticket # 777764 is missing a digit: could be 7777643 (from this group\'s tickets), check the tag', '777764'), '7777643');
  assert.equal(ctx.hintTicket_('Ticket # 815901 is missing a digit; this store\'s tickets look like 8159xxx, check the tag', '815901'), '');
  assert.equal(ctx.hintTicket_('Ticket # 7580 looks like only the last 4 digits: likely 6567580, check the tag', '7580'), '');
  assert.equal(ctx.likelyTicketFix_(sh, ctx.storeLayout_(sh), { item_type: 'window', ticket_number: '2208190' }, 'Ticket # 2208190 looks off for this store (7708xxx): likely 7708190 (2/7 look alike), check the tag'), '');
});

console.log(`${passed} likely ticket tests passed`);
