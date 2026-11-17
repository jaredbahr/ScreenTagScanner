'use strict';
// Kirsten, 2026-11-16: a 9 read as a 4 on a tag with corners kept the misread. The likely ticket was named but not
// written, because parts and labor receipts were planned with the ticket as read. 0.13.45 settles the ticket first
// and plans the receipts for it. Synthetic data only.
const assert = require('node:assert/strict');
const { load, BASE } = require('./offline.test.cjs');
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS ' + name); }
const part = (sku, quantity) => ({ sku, quantity, unit: 'each', group_wide: false, raw: 'Synthetic filled SKU ' + sku + ' Qty ' + quantity });
const one = (tk, i, x = {}) => ({ ...BASE, store: 'New Lenox', customer_name: 'Ann Synth' + i, last_name: 'Synth' + i,
  phone: '81555502' + String(i).padStart(2, '0'), ticket_number: tk, tag_index: 1, tag_count: 1, width_in: 20 + i, height_in: 30, billable_inches: 50 + i, ...x });
function series() {
  const t = load(), sh = t.ss.tabs['New Lenox'], c = t.ctx.storeLayout_(sh).screens;
  for (let i = 0; i < 6; i++) t.ctx.saveScan_(one(String(7779940 + i), i + 1), 'S', [], '', 'synthetic');
  return { t, sh, c, save: x => t.ctx.saveScan_(x, 'S', [], '', 'synthetic'), log: t.ss.tabs.Scans, col: n => t.ctx.HEADERS.indexOf(n) + 1 };
}
const notesOf = (sh, row) => [...sh.notes.entries()].filter(([k]) => +k.split(',')[0] === row).map(([, v]) => v).join('\n');

test('a tag with parts gets the likely ticket, and its receipt names that ticket (the 11/16 DG case)', () => {
  const { sh, c, save, log, col } = series();
  const r = save(one('7774948', 20, { tag_index: 2, tag_count: 2, parts: [part('580401', 2)] }));
  assert.equal(r.ok, true); const row = +r.row;
  assert.equal(String(sh.get(row, c.TICKET)), '7779948', 'written as the likely ticket');
  assert.equal(sh.get(row, c.EARNING), 4, 'the corners are still earned');
  const n = notesOf(sh, row);
  assert.match(n, /written as 7779948 \(read as 7774948 on \d\d\/\d\d\)/);
  assert.ok(/7779948/.test(n) && !/"ticket":"7774948"/.test(n), 'the receipt names the written ticket');
  assert.equal(String(log.get(log.getLastRow(), col('Ticket #'))), '7774948', 'the log keeps the reading');
  assert.doesNotMatch(String(log.get(log.getLastRow(), col('Review Reason'))), /planned for ticket/);
});

test('additional labor is planned for the written ticket too', () => {
  const { sh, c, save } = series();
  const r = save(one('7774949', 21, { extras: 'Cleaned rollers; additional labor $8.00', parts: [] }));
  assert.equal(String(sh.get(+r.row, c.TICKET)), '7779949');
  assert.match(notesOf(sh, +r.row), /7779949/);
});

test('unchanged: a clean reading with parts, and a likely ticket already on the tab for a single tag', () => {
  const { sh, c, save } = series();
  const a = save(one('7779950', 22, { parts: [part('580401', 2)] }));
  assert.equal(String(sh.get(+a.row, c.TICKET)), '7779950'); assert.equal(sh.get(+a.row, c.EARNING), 4);
  const b = save(one('7774941', 23, { parts: [part('580401', 2)] })); // 7779941 is another customer's ticket on the tab
  assert.equal(String(sh.get(+b.row, c.TICKET)), '7774941', 'another job\'s ticket is never borrowed');
});

test('the dry run matches the store write and writes nothing', () => {
  const { t, sh, save } = series(), before = new Map(sh.cells);
  const x = t.ctx.normalizeJobInput_(one('7774948', 24, { parts: [part('580401', 2)] }));
  assert.equal(t.ctx.receiptTicket_(t.ss, x), '7779948'); assert.deepEqual(new Map(sh.cells), before, 'nothing written');
  assert.equal(t.ctx.receiptTicket_(t.ss, t.ctx.normalizeJobInput_(one('7779951', 25))), '', 'a clean reading needs nothing');
  assert.equal(t.ctx.receiptTicket_(t.ss, t.ctx.normalizeJobInput_(one('7774948', 26, { item_type: 'window' }))), '', 'windows are never rewritten');
  save(one('7779952', 27));
});

console.log(`${passed} receipt-ticket tests passed`);
