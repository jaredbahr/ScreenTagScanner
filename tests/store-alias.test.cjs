'use strict';
const assert=require('node:assert/strict');
const {load,BASE}=require('./offline.test.cjs');
const {fixture,req}=require('./month-rollover.test.cjs');
let passed=0;function test(name,fn){fn();passed++;console.log('PASS aliases: '+name);}
// Model title-only rename and native direct-reference adjustment; live Sheets validation remains separate.
function rename(ss,st){const sh=ss.tabs[st.tab];delete ss.tabs[st.tab];ss.tabs[st.name]=sh;sh.name=st.name;
  for(const sheet of ss.getSheets())for(const [key,v] of sheet.cells)if(typeof v==='string'&&v.startsWith('='))sheet.cells.set(key,v.split("'"+st.tab+"'!").join("'"+st.name+"'!"));return sh;}
function write(t,x){return t.ctx.saveScan_({...BASE,...x},'Synthetic',[],'','synthetic');}
function approve(t){t.ctx.pauseTagSequenceScans_();const p=t.ctx.previewTagSequenceMigration_();t.props.TAG_SEQUENCE_APPROVED_PLAN=p.approvalCode;t.props.TAG_SEQUENCE_DRAIN_CONFIRMED=p.approvalCode;}
const part={sku:'580602',quantity:5,unit:'each',group_wide:true,raw:'Synthetic pins 5 total for group'}; // 5 does not split evenly over 2 frames: credited once for the group
test('all four renamed stores route screens and windows with both numeric and city inputs',()=>{
  const t=load();for(const st of t.ctx.STORES.slice(0,4)){
    const sh=rename(t.ss,st);const before=t.ctx.STORES.map(s=>s.tab).join();
    for(const [i,store] of [st.keys[0],st.name].entries()){
      assert.equal(write(t,{store,sticker_color:'',ticket_number:st.keys[0]+'S'+i}).ok,true);
      assert.equal(write(t,{store,sticker_color:'',ticket_number:st.keys[0]+'W'+i,item_type:'window',job_evidence:'window pane glass'}).ok,true);
    }
    const l=t.ctx.storeLayout_(sh);assert.notEqual(sh.get(2,l.screens.TICKET),'');assert.notEqual(sh.get(2,l.windows.TICKET),'');assert.equal(t.ctx.STORES.map(s=>s.tab).join(),before);
  }
});
test('mixed and fully renamed blank templates are accepted and copied without duplicate tabs',()=>{
  for(const count of [2,4]){const t=fixture();for(const st of t.ctx.STORES.slice(0,count))rename(t.template,st);
    const total=t.template.tabs.Totals;total.set(1,1,"='Downers Grove'!I754");const formulas=total.getDataRange().getFormulas();
    assert.doesNotThrow(()=>t.ctx.monthlyTemplateCheck_(t.template));const r=t.ctx.startMonth(req());assert.equal(r.status,'ok',r.message);
    const ss=t.sheets.get(t.props.SHEET_ID);for(const st of t.ctx.STORES.slice(0,count)){assert.ok(ss.tabs[st.name]);assert.equal(ss.tabs[st.tab],undefined);}
    assert.deepEqual(total.getDataRange().getFormulas(),formulas);assert.equal(t.ctx.formulaAudit_(t.template).errors.length,0);
  }
});
test('ambiguous alias tabs reject writes and template acceptance, without choosing a sheet',()=>{
  const t=load(),st=t.ctx.STORES[0],sh=t.ss.tabs[st.tab];t.ss.insertSheet(st.name);const before=[...sh.cells];
  assert.throws(()=>t.ctx.writeToStoreTab_(t.ss,{...BASE,store:st.name,sticker_color:''},[]),/Both old and city-named/);assert.deepEqual([...sh.cells],before);
  assert.throws(()=>t.ctx.preparePartsEarnings_(t.ss,{...BASE,store:st.name,sticker_color:'',parts:[part],tag_count:2,tag_index:1}),/Both old and city-named/);
  const u=fixture();u.template.insertSheet(st.name);assert.throws(()=>u.ctx.monthlyTemplateCheck_(u.template),/Both old and city-named/);
});
test('posted and reserved historical earnings stay canonical and cannot duplicate after rename',()=>{
  for(const status of ['posted','reserved']){const t=load(),st=t.ctx.STORES[0],x={store:st.name,sticker_color:'',ticket_number:'GROUP',tag_count:2,tag_index:1,parts:[part]};
    assert.equal(write(t,x).ok,true);const sh=rename(t.ss,st),c=t.ctx.storeLayout_(sh).screens.EARNING;
    if(status==='reserved'){sh.notes.set('2,'+c,sh.notes.get('2,'+c).replace('"status":"posted"','"status":"reserved"'));sh.set(2,c,'');}
    assert.equal(write(t,{...x,tag_index:2,width_in:20}).ok,true);assert.equal(sh.get(3,c),'');
    assert.equal(sh.get(2,c),status==='posted'?2.5:'');
    const receipts=t.ctx.partsReceipts_(sh.notes.get('2,'+c));assert.equal(receipts[0].tab,st.tab);assert.equal(receipts[0].invalid,undefined);
  }
});
test('new earnings on city-named sheet roundtrip with stable canonical receipt and group scope',()=>{
  const t=load(),st=t.ctx.STORES[1],sh=rename(t.ss,st),x={store:st.name,sticker_color:'',ticket_number:'NEWGROUP',tag_count:2,tag_index:1,parts:[part]};
  assert.equal(write(t,x).ok,true);const c=t.ctx.storeLayout_(sh).screens.EARNING,r=t.ctx.partsReceipts_(sh.notes.get('2,'+c))[0];assert.equal(r.invalid,undefined);assert.equal(r.tab,st.tab);assert.equal(JSON.parse(r.scope)[0],st.tab);
  assert.equal(write(t,{...x,tag_index:2,width_in:20}).ok,true);assert.equal(sh.get(2,c),2.5);assert.equal(sh.get(3,c),'');
});
test('old interrupted migration journal resumes on renamed tab without duplicate insertion',()=>{
  const t=load(),st=t.ctx.STORES[0],sh=t.ss.tabs[st.tab];approve(t);sh.failAfterInsert=true;assert.throws(()=>t.ctx.applyTagSequenceMigration_(),/interruption/);
  assert.equal(JSON.parse(t.props.TAG_SEQUENCE_JOURNAL).tab,st.tab);rename(t.ss,st);
  assert.equal(t.ctx.journalBlank_(t.ss,Object.create(sh),JSON.parse(t.props.TAG_SEQUENCE_JOURNAL)),16,'different service wrappers for the same sheet retain journal identity');
  assert.equal(t.ctx.applyTagSequenceMigration_().status,'migrated');assert.deepEqual(sh.insertions,[15,3]);assert.equal(t.props.TAG_SEQUENCE_JOURNAL,undefined);
});
test('sequence backfill resolves historical city log to renamed sheet',()=>{
  const t=load(),st=t.ctx.STORES[2];write(t,{store:st.name,sticker_color:'',tag_count:3,tag_index:2});const sh=rename(t.ss,st);
  approve(t);assert.equal(t.ctx.applyTagSequenceMigration_().status,'migrated');assert.equal(sh.get(2,t.ctx.storeLayout_(sh).screens.SEQUENCE),'2 of 3');
});
test('historical glass preview resolves renamed sheet without changing any cells',()=>{
  const t=load(),st=t.ctx.STORES[3];write(t,{store:st.name,sticker_color:'',ticket_number:'HISTORICAL',notes:null});
  const sh=rename(t.ss,st),log=t.ss.tabs.Scans;log.set(2,t.ctx.HEADERS.indexOf('Notes')+1,'Tempered Glass');const before=[...sh.cells];
  const report=t.ctx.previewMisroutedGlassRepairs_();assert.equal(report.length,1);assert.equal(report[0].identityMatches,true);assert.deepEqual([...sh.cells],before);assert.equal(t.fetches(),0);
});
console.log(passed+' store-alias tests passed');
