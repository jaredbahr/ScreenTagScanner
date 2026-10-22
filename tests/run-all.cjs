'use strict';
// Runs every test suite in its own process and fails if any suite fails.
// Offline only: no network, no Google, no Anthropic API, no customer data.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const dir = __dirname;
const suites = fs.readdirSync(dir).filter(f => f.endsWith('.test.cjs')).sort();
let failed = 0;
for (const file of suites) {
  const started = Date.now();
  const r = spawnSync(process.execPath, [path.join(dir, file)], { encoding: 'utf8' });
  const out = (r.stdout || '') + (r.stderr || '');
  const summary = out.trim().split('\n').filter(l => /passed/.test(l)).pop() || '(no summary)';
  const ok = r.status === 0;
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${file.padEnd(28)} ${summary.trim()}  (${((Date.now() - started) / 1000).toFixed(1)}s)`);
  if (!ok) console.log(out.split('\n').filter(l => !/^PASS/.test(l)).slice(0, 40).join('\n'));
}
console.log(`\n${suites.length - failed}/${suites.length} suites passed`);
process.exit(failed ? 1 : 0);
