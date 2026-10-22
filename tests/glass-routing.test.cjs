'use strict';
const assert=require('node:assert/strict');const {load,BASE}=require('./offline.test.cjs');let passed=0;
function test(name,fn){fn();passed++;console.log('PASS '+name);}
function write(t,x){return t.ctx.saveScan_({...BASE,...x},'Synthetic',[],'','synthetic');}
test('classification reference has exactly 74 photo SKUs plus four separate labor SKUs, without prices',()=>{
  const t=load(),bank=t.ctx.GLASS_JOB_SKUS;
  const all=Object.keys(bank).filter(k=>k!=='windowLabor').flatMap(k=>[...bank[k]]);
  assert.equal(new Set(all).size,74);assert.equal(all.length,74);assert.equal(bank.windowLabor.length,4);
  for(const sku of all){assert.equal(typeof sku,'string');assert.match(sku,/^\d+$/);}
});
test('all exact reference SKUs route unknown jobs to windows without inventing a glass price',()=>{
  const t=load();for(const family of Object.keys(t.ctx.GLASS_JOB_SKUS))for(const sku of t.ctx.GLASS_JOB_SKUS[family]){
    const r=t.ctx.resolveJobRouting_({...BASE,item_type:'unknown',job_evidence:'Filled item SKU '+sku});assert.equal(r.type,'window',sku);
  }
  const r=write(t,{item_type:'unknown',job_evidence:'Filled SKU 12763 acrylic',panes:null,glass_price:null});
  assert.equal(r.block,'windows');const sh=t.ss.tabs['Homer Glen'];assert.equal(sh.get(2,19),'');
  assert.equal(sh.get(2,20),18.5,'one glass line = one pane (Kirsten 2026-10-22)');
});
test('SKU matches are exact, and an unlisted SKU needs independent written evidence',()=>{
  const t=load();assert.equal(t.ctx.resolveJobRouting_({item_type:'unknown',job_evidence:'SKU 13234'}).type,null);
  assert.equal(t.ctx.resolveJobRouting_({item_type:'unknown',job_evidence:'SKU 132350'}).type,null);
  assert.equal(t.ctx.resolveJobRouting_({item_type:'unknown',job_evidence:'SKU 13234 glass panel'}).type,'window');
  assert.equal(t.ctx.resolveJobRouting_({item_type:'screen',notes:'Ticket 11502; ordinary screen repair'}).type,'screen');
});
test('generic printed options and Screen/Window Repair headings are not filled-job evidence',()=>{
  const t=load();for(const text of ['Printed options: SKU 13235 glass','Preprinted glass SKU 13235','Unfilled SKU 580503 window labor','Screen/Window Repair']){
    assert.equal(t.ctx.resolveJobRouting_({item_type:'unknown',job_evidence:text}).type,null,text);
  }
});
test('fiberglass remains screens; tempered glass routes windows without implying thermopane',()=>{
  const t=load();for(const text of ['fiberglass','fibre glass','fiber glass'])assert.equal(t.ctx.resolveJobRouting_({item_type:'screen',notes:text}).type,'screen');
  const r=write(t,{item_type:'screen',notes:'Tempered Glass',job_evidence:'580503 window labor',thermopane:true,panes:1});
  assert.equal(r.block,'windows');assert.equal(t.ss.tabs['Homer Glen'].get(2,5),'');assert.equal(t.ss.tabs['Homer Glen'].get(2,20),18.5);
  assert.ok(r.flags.some(f=>/Tempered/.test(f)));
  assert.equal(t.ctx.resolveJobRouting_({item_type:'window',job_evidence:'Double-strength glass 1/8'}).thermopane,false);
  assert.equal(t.ctx.resolveJobRouting_({item_type:'window',job_evidence:'Filled labor SKU 580500 thermopane'}).thermopane,true);
});
test('unknown item types fail closed rather than becoming screens, with a retained NOT PLACED log',()=>{
  const t=load(),r=write(t,{item_type:'unknown',notes:null,job_evidence:''});assert.equal(r.ok,false);assert.match(r.problem,/item type is unknown/);
  const sh=t.ss.tabs['Homer Glen'];assert.equal(sh.get(2,5),'');assert.equal(sh.get(2,17),'');
  assert.equal(t.ss.tabs.Scans.get(2,t.ctx.COL.WRITTEN_TO),'NOT PLACED');assert.equal(t.fetches(),0);
});
test('standard glass/window labor is separated from extras; actual extra SKU/qty/PK stays literal and manual',()=>{
  const t=load();write(t,{job_evidence:'Filled glass job',item_type:'window',panes:1,glass_price:40,
    extras:'580503 window labor\n580602 spring pins 2PK .50'});
  const sh=t.ss.tabs['Homer Glen'];assert.equal(sh.get(2,20),18.5);assert.equal(sh.get(2,23),'');
  assert.match(sh.notes.get('2,23'),/580602 spring pins 2PK .50/);assert.doesNotMatch(sh.notes.get('2,23'),/580503/);
  assert.match(sh.notes.get('2,15'),/PK means earnings, not a pack count/);
});
test('pins on all frames are recorded once per recognized ticket/store/group, not each 3-of-11 sibling',()=>{
  const t=load(),group='580602 spring pins 2PK on all frames';
  write(t,{ticket_number:'GROUP',tag_index:2,tag_count:11,group_extras:group});
  write(t,{ticket_number:'GROUP',tag_index:3,tag_count:11,group_extras:'580602 Spring pins for all frames 2PK',width_in:20,height_in:30,billable_inches:50});
  const sh=t.ss.tabs['Homer Glen'];assert.match(sh.notes.get('2,12'),/whole group/);assert.equal(sh.notes.get('3,12'),undefined);
  assert.equal(sh.get(2,12),'');assert.equal(sh.get(3,12),'');
  const log=t.ss.tabs.Scans,notes=t.ctx.HEADERS.indexOf('Notes')+1;
  assert.match(log.get(2,notes),/Group extras recorded once/);assert.match(log.get(3,notes),/Group extras already recorded/);
});
test('a multi-frame build gets one group instruction, not duplicated instructions/extra amounts per row',()=>{
  const t=load();write(t,{form_type:'new_build',screens_on_tag:2,group_extras:'580602 pins for all frames 2PK'});
  const sh=t.ss.tabs['Homer Glen'];assert.match(sh.notes.get('2,12'),/whole group/);assert.doesNotMatch(sh.notes.get('3,12'),/whole group/);
  assert.equal(sh.get(2,12),1.5);assert.equal(sh.get(3,12),1.5,'existing build base unchanged, no new parts earnings');
});
test('screen tags that merely mention glass doors, mirrors or fiber-glass stay screens',()=>{
  const t=load();
  for(const notes of ['Patio screen for sliding glass door','Slider - glass door side','storm door, glass insert removed','Mirror side up','Glass door screen'])
    assert.equal(t.ctx.resolveJobRouting_({item_type:'screen',notes}).type,'screen',notes);
  for(const ev of ['fiber-glass mesh','Fibre-glass charcoal','fiber glass','Sliding glass door screen, fiberglass'])
    assert.equal(t.ctx.resolveJobRouting_({item_type:'screen',job_evidence:ev}).type,'screen',ev);
  assert.equal(t.ctx.resolveJobRouting_({item_type:'screen',job_evidence:'Tempered glass 24 x 30'}).type,'window','written glass material still routes');
  assert.equal(t.ctx.resolveJobRouting_({item_type:'screen',notes:'customer note',job_evidence:'SKU 12763 acrylic'}).type,'window');
  const r=write(t,{item_type:'screen',notes:'Patio screen for sliding glass door'});assert.equal(r.block,'screens');
});
test('historical misroute helper only previews identity-safe candidates and never changes cells',()=>{
  const t=load();write(t,{ticket_number:'HISTORICAL',notes:null});const log=t.ss.tabs.Scans;
  log.set(2,t.ctx.HEADERS.indexOf('Notes')+1,'Tempered Glass');const before=new Map(t.ss.tabs['Homer Glen'].cells);
  let report=t.ctx.previewMisroutedGlassRepairs_();assert.equal(report[0].action,'manual-review-only','existing billed row cannot be auto moved');
  const sh=t.ss.tabs['Homer Glen'];sh.set(2,7,'');sh.set(2,8,'');report=t.ctx.previewMisroutedGlassRepairs_();assert.equal(report[0].action,'review-window-placement');
  const snapshot=new Map(sh.cells);sh.set(2,5,'MANUAL');report=t.ctx.previewMisroutedGlassRepairs_();assert.equal(report[0].identityMatches,false);assert.equal(sh.get(2,5),'MANUAL');
  assert.equal(t.fetches(),0);assert.equal(before.get('2,5'),'HISTORICAL');assert.equal(snapshot.get('2,5'),'HISTORICAL');
});
test('window panes come from the labor line quantity or one glass line, at $18.50 / $27 per pane (Kirsten 2026-10-22)',()=>{
  const lb=(x)=>{const t=load();const r=write(t,{item_type:'window',panes:null,glass_price:37.99,...x});assert.equal(r.block,'windows');return t.ss.tabs['Homer Glen'].get(2,20);};
  // Real October shapes (synthetic values): labor line with a quantity, labor line without one.
  assert.equal(lb({job_evidence:'1 11562 Glass $37.99 = 37.99; 1 580503 Labor $24.99 = 24.99'}),18.5);
  assert.equal(lb({job_evidence:'13254 36 1/4 x 20 3/4 $42.99; 580503 Labor $24.99'}),18.5,'one glass line = one pane');
  assert.equal(lb({job_evidence:'2 11562 Glass $75.98\n2 580503 Labor $49.98'}),37,'multiple panes from the labor quantity');
  assert.equal(lb({job_evidence:'1 11562 Glass $37.99; 1 580500 Thermopane labor'}),27,'thermopane rate confirmed');
  assert.equal(lb({job_evidence:'11562 Glass $37.99; 11504 Glass $20.00; 580503 Labor $49.98'}),'','two glass lines and no quantity: left for Kirsten');
  assert.equal(lb({panes:3,job_evidence:'1 580503 Labor'}),55.5,'a written pane count wins');
  const t=load();const x=t.ctx.normalizeJobInput_({...BASE,item_type:'window',panes:null,job_evidence:'13254 glass $42.99; 580503 Labor $24.99'});
  assert.equal(x.panes,1);assert.match(x.routing_review.join('\n'),/Panes: 1 counted from the one glass line/);
  assert.equal(t.ctx.reviewReasons_(x).some(r=>/panes not found/.test(r)),false);
  const u=load();write(u,{item_type:'window',thermopane:true,panes:1,job_evidence:'1 580500 thermopane'});
  assert.doesNotMatch(u.ss.tabs['Homer Glen'].notes.get('2,15')||'',/not confirmed/);
});
console.log(`${passed} glass-routing tests passed`);
