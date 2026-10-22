'use strict';
// Synthetic post-extraction evidence only. No real tags, paid model calls or Google services.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {load, BASE} = require('./offline.test.cjs');
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS qty-evidence: ' + name); }
const job = (overrides = {}) => ({...BASE, ticket_number:'9700001', width_in:36, height_in:42,
  billable_inches:79, qty_rows:'78, 78, 78', line_totals:'', ...overrides});
function totals(t, inches, material = 'fiberglass', count = 3) {
  const r = t.ctx.RATES[material];
  return [r.material, 0.07, r.labor].slice(0, count).map(rate => (inches * rate).toFixed(2)).join(', ');
}
function fixture(modern = false) {
  const t = load(), sh = t.ss.tabs['Homer Glen'];
  if (modern) {
    sh.insertColumnAfter(15);sh.set(1,16,'Tag x of N');
    sh.insertColumnAfter(3);sh.set(1,4,'Tag x of N');
  }
  return {t, sh, c:t.ctx.storeLayout_(sh).screens};
}

test('schema uses two plain-string evidence fields without adding nullable unions or request spend', () => {
  const t = load(), p = t.ctx.SYSTEM_PROMPT, req = t.ctx.buildRequest_('claude-sonnet-5-5','synthetic-image');
  for (const key of ['qty_rows','line_totals']) {
    assert.ok(t.ctx.TAG_SCHEMA.required.includes(key));assert.equal(t.ctx.TAG_SCHEMA.properties[key].type,'string');
  }
  assert.match(p,/never change a number just to make it match/);
  assert.match(p,/missing\/unreadable internal row/);
  assert.match(p,/never shift into another rate position/);
  assert.equal(req.body.max_tokens,4000);assert.equal(req.body.output_config.effort,'low');assert.equal(t.fetches(),0);
});

test('agreeing written totals that match rounded size settle a misread billed QTY', () => {
  const t = load(), x = job({width_in:40,height_in:47,billable_inches:37,qty_rows:'?, ?, ?',line_totals:totals(t,87)});
  const result = t.ctx.settleInches_(x);assert.equal(result.inches,87);assert.match(result.note,/written \$ totals/);
  assert.match(result.note,/Original billed QTY: 37/);assert.equal(x.billable_inches,37);
});

test('totals may support a clear QTY majority when the literal dimensions disagree', () => {
  const t = load(), result = t.ctx.settleInches_(job({height_in:80,line_totals:totals(t,78)}));
  assert.equal(result.inches,78);assert.match(result.note,/QTY-row majority/);
});

test('two known leading total rows are supported without shifting a missing internal row', () => {
  const t = load();assert.equal(t.ctx.settleInches_(job({line_totals:totals(t,78,'fiberglass',2)})).inches,78);
  const r = t.ctx.RATES.fiberglass;
  assert.equal(t.ctx.settleInches_(job({line_totals:(78*r.material).toFixed(2)+', ?, '+(78*r.labor).toFixed(2)})),null);
});

test('with no totals a strict majority of at least two literal QTY rows may settle', () => {
  const t = load();for(const qty_rows of ['78,78','78,7?,78','78; 78; 79']) {
    assert.equal(t.ctx.settleInches_(job({qty_rows})).inches,78);
  }
});

test('a lone reading, a split vote or unreadable majority stays manual', () => {
  const t = load();for(const qty_rows of ['', '78', '78,79', '78,?,?', '78,79,80']) {
    assert.equal(t.ctx.settleInches_(job({qty_rows})),null,qty_rows);
  }
});

test('contradictory, unreadable or nonpositive written totals block the majority fallback', () => {
  const t = load(), valid = totals(t,78).split(', ');
  for(const line_totals of [valid[0]+', '+valid[1]+', 1.00', '?', ', ; ', '0,0,0', '-1,-1,-1',
    '1e2,7,17', '1.234,2.345', valid[0]]) {
    assert.equal(t.ctx.settleInches_(job({line_totals})),null,line_totals);
  }
});

test('a one-cent disagreement cannot manufacture agreement between written totals', () => {
  const t = load(), amounts = totals(t,78).split(', ');amounts[1]=(Number(amounts[1])+0.01).toFixed(2);
  assert.equal(t.ctx.settleInches_(job({line_totals:amounts.join(', ')})),null);
});

test('mutually agreeing totals still need the size or a QTY majority as independent support', () => {
  const t = load();assert.equal(t.ctx.settleInches_(job({line_totals:totals(t,90)})),null);
});

test('explicit size/slip conflicts and actual corrections always hold billing', () => {
  const t = load();for(const extra of [{quantity_conflict:true,quantity_conflict_details:'Invented alternate size'},
    {has_corrections:true,correction_details:'Invented credit'}]) {
    assert.equal(t.ctx.settleInches_(job({...extra,line_totals:totals(t,78)})),null);
  }
});

test('zero, negative, fractional and implausible QTY majorities cannot auto-fill amounts', () => {
  const t = load();for(const qty_rows of ['0,0,0','-78,-78,-78','1,1,1','11,11,11','241,241,241',
    '9999,9999,9999','78.5,78.5,78.5','99999999999999999999,99999999999999999999']) {
    assert.equal(t.ctx.settleInches_(job({qty_rows})),null,qty_rows);
  }
});

test('missing, nonfinite and already unusual dimensions remain manual', () => {
  const t = load();for(const extra of [{width_in:null},{height_in:NaN},{width_in:Infinity},{width_in:5.9},{height_in:120.1}]) {
    assert.equal(t.ctx.settleInches_(job(extra)),null);
  }
});

test('existing dimension-review envelope boundaries are supported', () => {
  const t = load();for(const [side, inches] of [[6,12],[120,240]]) {
    assert.equal(t.ctx.settleInches_(job({width_in:side,height_in:side,qty_rows:inches+','+inches})).inches,inches);
  }
});

test('unknown materials, malformed evidence types and extra rows never infer billing', () => {
  const t = load();for(const extra of [{material:'unknown'},{material:'constructor'},{material:'toString'},
    {qty_rows:[78,78]},{line_totals:{}},{qty_rows:'78 of 78'},{qty_rows:'78,78,78,78'},{qty_rows:'78,'.repeat(200)}]) {
    assert.equal(t.ctx.settleInches_(job(extra)),null);
  }
});

test('legacy payloads without row evidence retain the original disagreement hold', () => {
  const t = load();assert.equal(t.ctx.settleInches_({...BASE,billable_inches:114}),null);
});

test('settled rows use existing rates, keep original readings and remain flagged in both layouts', () => {
  for(const modern of [false,true]) {
    const {t,sh,c} = fixture(modern), x = job(), r = t.scan(x);
    assert.equal(r.status,'ok');assert.match(r.message,/Flagged/);
    assert.equal(sh.get(2,c.UNI_IN),78);
    assert.equal(sh.get(2,c.SCREENING),t.ctx.cents_(78*t.ctx.RATES.fiberglass.material));
    assert.equal(sh.get(2,c.LB_EARN),t.ctx.cents_(78*t.ctx.RATES.fiberglass.labor));
    assert.match(sh.notes.get('2,'+c.NAME),/QTY-row majority/);
    assert.match(sh.notes.get('2,'+c.NAME),/Original billed QTY: 79/);
    assert.equal(x.billable_inches,79);assert.equal(x.width_in,36);assert.equal(x.height_in,42);
    const log=t.ss.tabs.Scans;assert.equal(log.get(2,t.ctx.COL.WIDTH),36);assert.equal(log.get(2,t.ctx.COL.HEIGHT),42);
    assert.equal(log.get(2,t.ctx.HEADERS.indexOf('Billable in')+1),79);
    assert.match(sh.notes.get('2,'+c.NAME),/Literal QTY rows: 78, 78, 78/);
  }
});

test('upstream zero and huge-QTY reproductions now keep all billing blank', () => {
  for(const qty_rows of ['0,0,0','9999,9999,9999']) {
    const {t,sh,c} = fixture();assert.match(t.scan(job({qty_rows})).message,/Flagged/);
    assert.deepEqual([sh.get(2,c.UNI_IN),sh.get(2,c.SCREENING),sh.get(2,c.LB_EARN)],['','','']);
  }
});

test('explicit conflicts and multi-screen repair forms retain blank billing', () => {
  for(const extra of [{quantity_conflict:true,quantity_conflict_details:'Invented alternate size'}, {screens_on_tag:2}]) {
    const {t,sh,c} = fixture();t.scan(job(extra));assert.equal(sh.get(2,c.UNI_IN),'');
    assert.equal(sh.get(2,c.SCREENING),'');assert.equal(sh.get(2,c.LB_EARN),'');
  }
});
test('a held disagreement preserves literal evidence in the review note without a schema migration', () => {
  const {t,sh,c}=fixture(), line_totals='1.00, 2.00, 3.00';t.scan(job({line_totals}));
  assert.equal(sh.get(2,c.UNI_IN),'');assert.match(sh.notes.get('2,'+c.NAME),/Literal row totals: 1.00, 2.00, 3.00/);
  assert.equal(t.ctx.HEADERS.length,24);
});

test('multi-frame builds retain existing per-frame bases with an independently settled QTY', () => {
  const {t,sh,c} = fixture();t.scan(job({form_type:'new_build',screens_on_tag:2}));
  for(const row of [2,3]) {
    assert.equal(sh.get(row,c.UNI_IN),78);assert.equal(sh.get(row,c.EARNING),t.ctx.NEW_BUILD.earningBase);
    assert.equal(sh.get(row,c.LB_EARN),t.ctx.cents_(78*t.ctx.RATES.fiberglass.labor+t.ctx.NEW_BUILD.laborAdd));
  }
});

test('a store alias rescan still cannot add a second settled row', () => {
  const {t,sh,c} = fixture();t.scan(job());assert.match(t.scan(job({store:'Homer Glen'})).message,/Already scanned/);
  assert.equal(sh.get(2,c.UNI_IN),78);assert.equal(sh.get(3,c.TICKET),'');
});
test('new row evidence on an exact rescan never rewrites a previously held store row', () => {
  const {t,sh,c}=fixture();t.scan(job({qty_rows:'',line_totals:''}));assert.equal(sh.get(2,c.UNI_IN),'');
  assert.match(t.scan(job()).message,/Already scanned/);
  assert.deepEqual([sh.get(2,c.UNI_IN),sh.get(2,c.SCREENING),sh.get(2,c.LB_EARN)],['','','']);
  assert.equal(sh.get(3,c.TICKET),'');
});

test('settled base billing does not duplicate whole-group parts or release uncertain parts', () => {
  const {t,sh,c} = fixture(), raw='35 580602 Spring pins for the whole group';
  const x=job({tag_count:2,extras:raw,group_extras:raw,parts:[{sku:'580602',quantity:35,unit:'each',group_wide:true,raw}]});
  t.scan({...x,tag_index:1});t.scan({...x,tag_index:2,width_in:35,height_in:43});
  assert.equal(sh.get(2,c.EARNING),17.5);assert.equal(sh.get(3,c.EARNING),'');
  const u=fixture();u.t.scan(job({extras:'4 580401 Corners',unclear:['parts quantity unclear'],
    parts:[{sku:'580401',quantity:4,unit:'each',group_wide:false,raw:'4 580401 Corners'}]}));
  assert.equal(u.sh.get(2,u.c.UNI_IN),78);assert.equal(u.sh.get(2,u.c.EARNING),'');
});

test('the twelve-file runtime and deployed backup/lease hooks remain present', () => {
  const dir=path.resolve(__dirname,'../apps-script');assert.equal(fs.readdirSync(dir).length,12);
  for(const file of ['Backup.gs','ExtraLabor.gs','MonthArchive.gs'])assert.ok(fs.existsSync(path.join(dir,file)));
  assert.match(fs.readFileSync(path.join(dir,'Month.gs'),'utf8'),/backupBeforeMonthSwitch_\(p,pending\)/);
  assert.match(fs.readFileSync(path.join(dir,'Code.gs'),'utf8'),/releaseMonthScan_\(props, admitted.leaseId\)/);
});
console.log(passed+' qty-evidence tests passed');
