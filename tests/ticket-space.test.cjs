'use strict';
// A ticket read with a space inside ("777763 4") is written as the 7 digits (Jared, 2026-10-30). Synthetic data only.
const assert = require('node:assert/strict');
const { load, BASE } = require('./offline.test.cjs');
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS ' + name); }
const tag = (tk) => ({ ...BASE, store: 'New Lenox', customer_name: 'Ann Synthwell', last_name: 'Synthwell', ticket_number: tk, width_in: 30, height_in: 40, billable_inches: 70 });
const norm = (t, tk) => t.ctx.normalizeJobInput_(tag(tk));

test('a space inside a 7-digit read is removed, and the reading is kept in a note', () => {
  const t = load();
  for (const tk of ['777763 4', '777 7634', '7 777634', ' 777763 4 ']) {
    const x = norm(t, tk);
    assert.equal(x.ticket_number, '7777634', tk);
    assert.ok(x.routing_review.some(r => r.startsWith('Ticket # 7777634 was read with a space ("' + tk.trim() + '")')), tk);
  }
});

test('anything else is left exactly as read: not 7 digits, letters, or no space', () => {
  const t = load();
  for (const tk of ['77776 34 1', '77776 3', '7777634', '77776A 4', 'ACE 7777634', '', '777 76 34', '7777\t634']) {
    const x = norm(t, tk);
    assert.equal(x.ticket_number, tk, JSON.stringify(tk));
    assert.ok(!x.routing_review.some(r => /read with a space/.test(r)), JSON.stringify(tk));
  }
});

test('end to end: the sheet gets the 7 digits and the ticket cell carries the note', () => {
  const t = load(), sh = t.ss.tabs['New Lenox'];
  const r = t.scan({ ...tag('777763 4') });
  assert.equal(r.status, 'ok'); assert.match(r.message, /#7777634/);
  const c = t.ctx.storeLayout_(sh).screens, row = 2;
  assert.equal(String(sh.get(row, c.TICKET)), '7777634');
  assert.match(sh.notes.get(sh.key(row, c.TICKET)) || '', /read with a space \("777763 4"\)/);
});

test('windows: a plain window row is not flagged for review; a missing glass price still is', () => {
  const t = load(), sh = t.ss.tabs['New Lenox'];
  const win = (x) => ({ ...tag('7779001'), item_type: 'window', form_type: 'repair', panes: 1, glass_price: 20, job_evidence: 'window pane glass', ...x });
  const a = t.scan(win({ ticket_number: '7779001' }));
  assert.equal(a.status, 'ok'); assert.doesNotMatch(a.message, /window details|Check on the sheet/i);
  const b = t.scan(win({ ticket_number: '7779002', glass_price: null, width_in: 31 }));
  assert.match(JSON.stringify(b), /Check|glass/i);
  const log = t.ss.tabs.Scans, h = t.ctx.HEADERS, rows = log.getDataRange().getValues();
  const reason = rows.find(r => String(r[h.indexOf('Ticket #')]) === '7779002')[h.indexOf('Review Reason')];
  assert.match(String(reason), /Window Glass not filled/);
  const plain = rows.find(r => String(r[h.indexOf('Ticket #')]) === '7779001');
  assert.doesNotMatch(String(plain[h.indexOf('Review Reason')]), /new to the scanner/);
});

console.log(`${passed} ticket space tests passed`);
