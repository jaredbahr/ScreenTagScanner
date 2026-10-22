'use strict';
// Synthetic migration fixtures; native formula adjustment is simulated, not a Google integration test.
const assert=require('node:assert/strict');
const {load,BASE}=require('./offline.test.cjs');
let passed=0;
function test(name,fn){fn();passed++;console.log('PASS '+name);}
function approve(t){t.ctx.pauseTagSequenceScans_();const p=t.ctx.previewTagSequenceMigration_();t.props.TAG_SEQUENCE_APPROVED_PLAN=p.approvalCode;t.props.TAG_SEQUENCE_DRAIN_CONFIRMED=p.approvalCode;return p;}
function migrate(t){approve(t);return t.ctx.applyTagSequenceMigration_();}
function placed(t,x){return t.ctx.saveScan_({...BASE,...x},'Synthetic phone',[],'','synthetic-scan');}
const cell=(sh,c,row=2)=>sh.get(row,c);

test('dry run plans all eight stores in TEST and TEMPLATE, with no writes',()=>{
  const t=load(),before=t.ss.tabs['Homer Glen'].cells.size;const p=t.ctx.previewTagSequenceMigration_();
  assert.equal(p.plan.targets.length,2);for(const target of p.plan.targets)assert.equal(target.stores.length,8);
  assert.equal(t.ss.tabs['Homer Glen'].cells.size,before);assert.equal(t.ss.tabs['Homer Glen'].insertions.length,0);
  assert.equal(t.props.TAG_SEQUENCE_MIGRATION_ACTIVE,undefined);
});
test('legacy writer preserves positions and logs sequence without overwriting Date out or Ticket',()=>{
  const t=load();placed(t,{tag_index:2,tag_count:3});const sh=t.ss.tabs['Homer Glen'];
  assert.equal(cell(sh,3),'Person');assert.equal(cell(sh,5),'1000001');assert.equal(typeof cell(sh,4),'number');
  const log=t.ss.tabs.Scans;assert.equal(log.get(2,t.ctx.HEADERS.indexOf('Tag x of N')+1),'2 of 3');
  assert.equal(t.ctx.storeLayout_(sh).screens.SEQUENCE,0);
});
test('migration needs explicit approval, admission pause, and confirmed drained executions',()=>{
  const t=load();assert.throws(()=>t.ctx.applyTagSequenceMigration_(),/Review preview/);
  t.props.TAG_SEQUENCE_APPROVED_PLAN=t.ctx.previewTagSequenceMigration_().approvalCode;
  assert.throws(()=>t.ctx.applyTagSequenceMigration_(),/Pause admission/);
  t.ctx.pauseTagSequenceScans_();assert.throws(()=>t.ctx.applyTagSequenceMigration_(),/Pause admission/);
  assert.equal(t.ss.tabs['Homer Glen'].insertions.length,0);
});
test('all eight stores gain separate sequence columns after both Names, rightmost first',()=>{
  const t=load(),r=migrate(t);assert.equal(r.status,'migrated');
  for(const ss of [t.ss,t.template])for(const st of t.ctx.STORES){
    const sh=ss.tabs[st.tab],l=t.ctx.storeLayout_(sh);
    assert.deepEqual(sh.insertions,[15,3]);
    assert.equal(l.screens.NAME,3);assert.equal(l.screens.SEQUENCE,4);assert.equal(l.screens.DATE_OUT,5);assert.equal(l.screens.TICKET,6);
    assert.equal(l.windows.DATE_IN,15);assert.equal(l.windows.NAME,16);assert.equal(l.windows.SEQUENCE,17);assert.equal(l.windows.DATE_OUT,18);assert.equal(l.windows.TICKET,19);
    assert.equal(sh.get(1,4),'Tag x of N');assert.equal(sh.get(1,17),'Tag x of N');
    assert.equal(sh.get(2,1),1);assert.equal(sh.get(2,14),1);assert.equal(sh.get(2,20),'W');
  }
  assert.equal(t.props.TAG_SEQUENCE_MIGRATION_ACTIVE,undefined);assert.equal(t.props.TAG_SEQUENCE_SCAN_PAUSE,'true');
  assert.equal(t.ctx.resumeTagSequenceScans_().status,'admission-resumed');assert.equal(t.props.TAG_SEQUENCE_SCAN_PAUSE,undefined);
});
test('existing values, formulas, Totals references, notes, validations, widths, freezes and footer titles survive',()=>{
  const t=load(),sh=t.ss.tabs['Homer Glen'];sh.set(2,3,'Existing Synthetic');sh.set(2,4,123);sh.set(2,5,'OLD');
  sh.notes.set('2,3','manual note');sh.validations.set('2,4','date-validator');sh.widths.set(4,123);sh.frozenColumns=4;sh.frozenRows=1;
  sh.merges=[{row:1003,col:2,rows:1,cols:7}];t.ss.tabs.Totals.set(1,1,"='Homer Glen'!H1004");
  t.ss.tabs['18650 (60)'].set(101,22,'=SUM(T2:T100)+SUM(U2:U100)+SUM(W2:W100)');
  const oldCount=t.ctx.formulaAudit_(t.ss).count;migrate(t);
  assert.equal(sh.get(2,3),'Existing Synthetic');assert.equal(sh.get(2,5),123);assert.equal(sh.get(2,6),'OLD');
  assert.equal(sh.get(2,10),'=G2*0.07');assert.equal(sh.get(1004,9),'=SUM(I2:I1000)');
  assert.equal(t.ss.tabs.Totals.get(1,1),"='Homer Glen'!I1004");
  assert.equal(t.ss.tabs['18650 (60)'].get(101,24),'=SUM(V2:V100)+SUM(W2:W100)+SUM(Y2:Y100)');
  assert.equal(sh.notes.get('2,3'),'manual note');assert.equal(sh.validations.get('2,5'),'date-validator');assert.equal(sh.widths.get(5),123);
  assert.equal(sh.frozenColumns,5);assert.equal(sh.frozenRows,1);assert.deepEqual(sh.merges,[{row:1003,col:2,rows:1,cols:8}]);
  assert.equal(t.ctx.formulaAudit_(t.ss).count,oldCount);
});
test('rerun is idempotent, including preserved manual sequence and no extra columns',()=>{
  const t=load();migrate(t);const sh=t.ss.tabs['Homer Glen'];sh.set(2,4,'manual sequence');
  assert.equal(t.ctx.applyTagSequenceMigration_().status,'already-migrated');assert.deepEqual(sh.insertions,[15,3]);
  assert.equal(sh.get(2,4),'manual sequence');assert.equal(sh.getMaxColumns(),28);
});
test('new screen and window scans write sequence in the right block on every store',()=>{
  const t=load();migrate(t);
  for(const [i,st] of [...t.ctx.STORES].entries()){
    let x={...BASE,store:st.name,ticket_number:'SCREEN-'+i,tag_index:2,tag_count:3};
    const screen=t.ctx.writeToStoreTab_(t.ss,x,[]);assert.equal(screen.ok,true);
    const sh=t.ss.tabs[st.tab];assert.equal(sh.get(2,4),'2 of 3');assert.equal(sh.get(2,6),x.ticket_number);assert.equal(sh.get(2,7),115);assert.equal(sh.get(2,10),'=G2*0.07');
    x={...x,item_type:'window',ticket_number:'WINDOW-'+i,panes:1,glass_price:40};
    assert.equal(t.ctx.writeToStoreTab_(t.ss,x,[]).ok,true);assert.equal(sh.get(2,17),'2 of 3');assert.equal(sh.get(2,19),x.ticket_number);assert.equal(sh.get(2,22),18.5);assert.equal(sh.get(2,20),'W');
  }
});
test('partial layout is writable safely: windows migrated first, screens still legacy',()=>{
  const t=load(),sh=t.ss.tabs['Homer Glen'];sh.insertColumnAfter(15);sh.set(1,16,'Tag x of N');
  assert.equal(t.ctx.writeToStoreTab_(t.ss,{...BASE,item_type:'window',panes:1,tag_index:1,tag_count:2},[]).ok,true);
  assert.equal(sh.get(2,16),'1 of 2');assert.equal(sh.get(2,18),BASE.ticket_number);
  assert.equal(t.ctx.writeToStoreTab_(t.ss,{...BASE,ticket_number:'SCREEN'},[]).ok,true);assert.equal(sh.get(2,5),'SCREEN');
});
test('unknown/ambiguous headers fail closed without writing store cells',()=>{
  const t=load(),sh=t.ss.tabs['Homer Glen'];sh.set(1,5,'Customer custom column');const before=new Map(sh.cells);
  const r=t.ctx.writeToStoreTab_(t.ss,BASE,[]);assert.equal(r.ok,false);assert.deepEqual(sh.cells,before);
  assert.throws(()=>t.ctx.previewTagSequenceMigration_(),/headers/);
});
test('manual sequence-only or earning-only rows are not overwritten',()=>{
  const t=load();migrate(t);const sh=t.ss.tabs['Homer Glen'];sh.set(2,4,'manual');sh.set(3,13,9);
  t.ctx.writeToStoreTab_(t.ss,{...BASE,tag_index:1,tag_count:1},[]);assert.equal(sh.get(4,6),BASE.ticket_number);
  assert.equal(sh.get(2,4),'manual');assert.equal(sh.get(3,13),9);
});
test('stale reviewed metadata, missing targets, error formulas, or insertion-crossing merges reject before insert',()=>{
  const t=load();approve(t);t.ss.tabs['Homer Glen'].frozenRows=1;
  assert.throws(()=>t.ctx.applyTagSequenceMigration_(),/preconditions changed/);assert.equal(t.ss.tabs['Homer Glen'].insertions.length,0);
  for(const mode of ['missing','formula','dynamic','merge']){
    const u=load();if(mode==='missing')delete u.template.tabs.Manhattan;
    if(mode==='formula')u.ss.tabs.Totals.set(1,1,'#REF!');
    if(mode==='dynamic')u.ss.tabs.Totals.set(1,1,'=INDIRECT("Homer Glen!H1004")');
    if(mode==='merge')u.ss.tabs['Homer Glen'].merges=[{row:2,col:3,rows:1,cols:2}];
    assert.throws(()=>u.ctx.previewTagSequenceMigration_());assert.equal(u.ss.tabs['Homer Glen'].insertions.length,0);
  }
});
test('interruption after native insert is journaled and reruns without a duplicate insert',()=>{
  const t=load(),sh=t.ss.tabs['18559-(500)'];approve(t);sh.failAfterInsert=true;
  assert.throws(()=>t.ctx.applyTagSequenceMigration_(),/interruption/);assert.ok(t.props.TAG_SEQUENCE_MIGRATION_ACTIVE);assert.ok(t.props.TAG_SEQUENCE_JOURNAL);
  assert.equal(sh.getMaxColumns(),27);assert.equal(sh.get(1,16),'');
  const rejected=t.ctx.scanTag({token:'t',user:'Synthetic',image:'/9j/AP/Z'});assert.match(rejected.message,/upgrade/);assert.equal(t.fetches(),0);
  assert.equal(t.ctx.applyTagSequenceMigration_().status,'migrated');assert.deepEqual(sh.insertions,[15,3]);assert.equal(t.props.TAG_SEQUENCE_JOURNAL,undefined);
});
test('interrupted insertion with unexpected user header/data changes refuses to guess or overwrite',()=>{
  const t=load(),sh=t.ss.tabs['18559-(500)'];approve(t);sh.failAfterInsert=true;
  assert.throws(()=>t.ctx.applyTagSequenceMigration_());sh.set(1,16,'manual header');
  assert.throws(()=>t.ctx.applyTagSequenceMigration_(),/headers changed/);assert.equal(sh.get(1,16),'manual header');assert.equal(sh.insertions.length,1);
});
test('dry-run and execution backfill unique placed records, never NOT PLACED or manually changed identities',()=>{
  const t=load();placed(t,{store:'Manhattan',ticket_number:'M-1',tag_index:2,tag_count:3});
  placed(t,{store:'Homer',ticket_number:'H-1',tag_index:1,tag_count:1});
  placed(t,{store:'unknown',ticket_number:'NO',tag_index:1,tag_count:2});
  const p=approve(t);assert.equal(p.backfill[0].report.filter(r=>r.action==='fill').length,2);
  // A manually corrected ticket after the preview must never be reverted or assigned its old sequence.
  t.ss.tabs['Homer Glen'].set(2,5,'MANUAL-CORRECTION');
  const r=t.ctx.applyTagSequenceMigration_();assert.equal(t.ss.tabs.Manhattan.get(2,4),'2 of 3');
  const sh=t.ss.tabs['Homer Glen'];assert.equal(sh.get(2,6),'MANUAL-CORRECTION');assert.equal(sh.get(2,4),'');
  assert.match(sh.notes.get('2,4'),/needs review/);assert.ok(r.backfill[0].report.some(x=>x.action==='review'));
});
test('new scans that drained after preview are read fresh for backfill, without a rescan',()=>{
  const t=load();placed(t,{ticket_number:'BEFORE',tag_index:1,tag_count:2});approve(t);
  placed(t,{ticket_number:'DRAINED',tag_index:2,tag_count:2,width_in:20,height_in:30,billable_inches:50});
  t.ctx.applyTagSequenceMigration_();const sh=t.ss.tabs['Homer Glen'];assert.equal(sh.get(2,4),'1 of 2');assert.equal(sh.get(3,4),'2 of 2');assert.equal(t.fetches(),0);
});
test('ambiguous identical group identities are flagged, while manual sequence values are preserved',()=>{
  const t=load();placed(t,{tag_index:1,tag_count:2});placed(t,{tag_index:2,tag_count:2});
  const r=migrate(t),sh=t.ss.tabs['Homer Glen'];assert.equal(sh.get(2,4),'');assert.equal(sh.get(3,4),'');
  assert.ok(r.backfill[0].report.every(r=>r.action==='review'));assert.match(sh.notes.get('2,4'),/reordered/);
  sh.set(2,4,'manual');t.ctx.sequenceBackfill_(t.ss,true);assert.equal(sh.get(2,4),'manual');
});
test('backfill supports window rows and multi-frame placement but leaves unrelated log structure alone',()=>{
  const t=load();placed(t,{item_type:'window',ticket_number:'W',panes:1,glass_price:40,tag_index:3,tag_count:4});
  placed(t,{ticket_number:'B',form_type:'new_build',screens_on_tag:2,tag_index:1,tag_count:1});
  const log=t.ss.tabs.Scans,old=new Map(log.cells);migrate(t);const sh=t.ss.tabs['Homer Glen'];
  assert.equal(sh.get(2,17),'3 of 4');assert.equal(sh.get(2,4),'1 of 1');assert.equal(sh.get(3,4),'1 of 1');
  assert.deepEqual(log.cells,old);assert.equal(log.insertions.length,0);assert.equal(t.ss.tabs.Totals.insertions.length,0);
});
test('group duplicate handling survives migration; exact rescan creates no extra store row',()=>{
  const t=load();migrate(t);placed(t,{tag_index:1,tag_count:2});placed(t,{tag_index:2,tag_count:2,width_in:20,height_in:30,billable_inches:50});
  const r=placed(t,{tag_index:2,tag_count:2,width_in:20,height_in:30,billable_inches:50});assert.equal(r.rescan,true);
  const sh=t.ss.tabs['Homer Glen'];assert.equal(sh.get(2,4),'1 of 2');assert.equal(sh.get(3,4),'2 of 2');assert.equal(sh.get(4,6),'');
});
test('shared lock prevents migration during store writes and pause prevents paid admissions',()=>{
  const t=load();t.ctx.pauseTagSequenceScans_();const r=t.ctx.scanTag({token:'t',user:'Synthetic',image:'/9j/AP/Z'});
  assert.match(r.message,/upgrade/);assert.equal(t.fetches(),0);
  t.setLocked(true);assert.throws(()=>t.ctx.previewTagSequenceMigration_(),/Lock busy/);t.setLocked(false);
});
console.log(`${passed} sequence-migration tests passed`);
