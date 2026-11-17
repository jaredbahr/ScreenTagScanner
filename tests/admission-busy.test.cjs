'use strict';
// Kirsten, 2026-11-14: a rescan while the previous scan was still saving got "Scan limits could not be checked …
// Contact Jared." The save holds the script lock; admission now says plainly that the last scan is still saving.
const assert = require('node:assert/strict');
const { load } = require('./offline.test.cjs');
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS ' + name); }

test('a busy lock says the last scan is still saving, uses no quota and sends no photo', () => {
  const t = load(), p = t.ctx.PropertiesService.getScriptProperties(), held = t.ctx.LockService.getScriptLock();
  held.waitLock(1);                                   // a save in progress holds the script lock
  const msg = t.ctx.admitScan_(p, {});
  assert.match(msg, /^The last scan is still saving\. Wait a minute and scan again; it clears by itself within 6 minutes\. No photo was sent\.$/);
  assert.equal(t.props.SCAN_LIMIT_STATE, undefined, 'no quota used'); assert.equal(t.props.MONTH_SCAN_LEASES, undefined, 'no lease');
  const second = {};                                  // a failed wait never releases the other holder's lock
  assert.match(t.ctx.admitScan_(p, second), /^The last scan is still saving/); assert.equal(second.leaseId, undefined);
  held.releaseLock();
  assert.equal(t.ctx.admitScan_(p, {}), '', 'admitted once the save finishes');
});

test('any other admission failure keeps the owner message and logs its reason', () => {
  const logged = [], t = load({ props: { SCAN_LIMIT_STATE: '{broken-SECRETTEXT' } }); t.ctx.console.error = m => logged.push(m);
  assert.match(t.ctx.admitScan_(t.ctx.PropertiesService.getScriptProperties(), {}), /^Scan limits could not be checked/);
  assert.deepEqual(logged, ['Scanner event: admission-failed; SyntaxError'], 'error name only, never stored text');
  assert.equal(t.props.SCAN_LIMIT_STATE, '{broken-SECRETTEXT', 'nothing written'); assert.equal(t.props.MONTH_SCAN_LEASES, undefined);
  const u = load({ props: { MAX_SCANS_PER_DAY: 'x' } }), log2 = []; u.ctx.console.error = m => log2.push(m);
  u.ctx.admitScan_(u.ctx.PropertiesService.getScriptProperties(), {});
  assert.deepEqual(log2, ['Scanner event: admission-failed; Invalid limit'], 'fixed messages are logged as text');
  assert.equal(t.ctx.ADMIT_LOCK_WAIT_MS, 15000);
});

console.log(`${passed} admission-busy tests passed`);
