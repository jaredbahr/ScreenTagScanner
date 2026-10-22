'use strict';
const assert=require('node:assert/strict');
const {load,BASE}=require('./offline.test.cjs');
let passed=0;function test(name,fn){fn();passed++;console.log('PASS '+name);}
const job=(more={})=>({...BASE,extras:'Cleaned rollers; additional labor $8.00',parts:[],tag_index:1,tag_count:1,...more});
function sheet(t){const sh=t.ss.tabs['Homer Glen'];return {sh,c:t.ctx.storeLayout_(sh).screens};}
function receipt(t){const {sh,c}=sheet(t);return t.ctx.extraLaborReceipts_(sh.notes.get(sh.key(2,c.LB_EARN)))[0];}
test('explicit standalone labor adds to base; no false missing-parts warning',()=>{
 const t=load(),r=t.scan(job()),{sh,c}=sheet(t);assert.equal(r.status,'ok');assert.equal(sh.get(2,c.LB_EARN),27.55);assert.equal(sh.get(2,c.EARNING),'');assert.equal(receipt(t).status,'posted');
 assert.doesNotMatch(t.ss.tabs.Scans.get(2,t.ctx.HEADERS.indexOf('Review Reason')+1),/no structured parts/);
});
test('known SKU labor goes to PK Earning, not LB Earn',()=>{
 const t=load();t.scan(job({extras:'580301 extra labor 1 $15',parts:[{sku:'580301',quantity:1,unit:'job',group_wide:false,raw:'580301 extra labor 1 $15'}]}));
 const {sh,c}=sheet(t);assert.equal(sh.get(2,c.LB_EARN),19.55);assert.equal(sh.get(2,c.EARNING),11);
});
test('explicit labor and cost-sheet parts can coexist without paying a line twice',()=>{
 const t=load();t.scan(job({extras:'LB $8 cleaning\n3 580602 spring pins $6',parts:[{sku:'580602',quantity:3,unit:'each',group_wide:false,raw:'3 580602 spring pins $6'}]}));const {sh,c}=sheet(t);assert.equal(sh.get(2,c.LB_EARN),27.55);assert.equal(sh.get(2,c.EARNING),1.5);
});
test('uncertain amount, corrections and names hold labor',()=>{
 for(const more of [{unclear:['LB amount $8 vs $10']},{has_corrections:true},{name_unclear:true},{quantity_conflict:true}]){const t=load();t.scan(job(more));const {sh,c}=sheet(t);assert.notEqual(sh.get(2,c.LB_EARN),27.55);}
});
test('ambiguous, total, retail, per-unit and malformed amounts never become additions',()=>{
 for(const text of ['Cleaned rollers $8','Total LB $8','base LB $8','LB $8 or $10','LB $8 or 10','LB $1,000','LB $8.001','LB -8','LB $0','LB $1001','LB $8 each','LB $8 retail','LB $8?','LB $8 for 2 doors','LB $8 EUR']){const t=load(),plan=t.ctx.calculateExtraLabor_(job({extras:text}));assert.equal(plan.items.length,0,text);}
});
test('standard screen labor SKU never becomes added labor',()=>{
 const t=load(),p=t.ctx.calculateExtraLabor_(job({extras:'575011 additional labor $19.55'}));assert.equal(p.items.length,0);
});
test('duplicate slip/tag LB lines require review',()=>{
 const t=load(),p=t.ctx.calculateExtraLabor_(job({extras:'LB $8 cleaning\nLB $8 cleaning'}));assert.equal(p.items.length,0);assert.match(p.flags.join(';'),/Multiple/);
});
test('exact rescan does not re-add labor',()=>{
 const t=load(),x=job();t.scan(x);assert.match(t.scan(x).message,/Already scanned/);const {sh,c}=sheet(t);assert.equal(sh.get(2,c.LB_EARN),27.55);assert.equal(sh.get(3,c.LB_EARN),'');
});
test('new labor on an older exact scan is not a retroactive write',()=>{
 const t=load();t.scan(job({extras:''}));const r=t.scan(job());const {sh,c}=sheet(t);assert.match(r.message,/Already scanned/);assert.equal(sh.get(2,c.LB_EARN),19.55);assert.match(t.ss.tabs.Scans.get(3,t.ctx.HEADERS.indexOf('Review Reason')+1),/unposted additional labor/);
});
test('whole group labor credits once across sibling tags',()=>{
 const t=load(),x=job({extras:'LB $8 cleaning for both doors',tag_count:2});t.scan(x);t.scan({...x,tag_index:2,width_in:35,billable_inches:114});const {sh,c}=sheet(t);assert.equal(sh.get(2,c.LB_EARN),27.55);assert.equal(sh.get(3,c.LB_EARN),19.38);
});
test('different-ticket group sibling stays uncredited and flags reconciliation',()=>{
 const t=load(),x=job({extras:'LB $8 cleaning for both doors',tag_count:2});t.scan(x);t.scan({...x,ticket_number:'1000002',tag_index:2,width_in:35,billable_inches:114});const {sh,c}=sheet(t);assert.equal(sh.get(3,c.LB_EARN),19.38);assert.match(sh.notes.get(sh.key(3,c.NAME)),/group\/amount differs/);
});
test('changed group amount stays uncredited and flags review',()=>{
 const t=load(),x=job({extras:'LB $8 cleaning for both doors',tag_count:2});t.scan(x);t.scan({...x,extras:'LB $10 cleaning for both doors',tag_index:2,width_in:35,billable_inches:114});const {sh,c}=sheet(t);assert.equal(sh.get(3,c.LB_EARN),19.38);assert.match(sh.notes.get(sh.key(3,c.NAME)),/differs/);
});
test('incomplete group or date identity holds labor',()=>{
 for(const more of [{extras:'LB $8 for both doors',tag_count:1},{date:null},{phone:null}]){assert.equal(load().ctx.calculateExtraLabor_(job(more)).items.length,0);}
});
test('held base billing never gets replaced by only the extra',()=>{
 const t=load();t.scan(job({material:'unknown'}));const {sh,c}=sheet(t);assert.equal(sh.get(2,c.LB_EARN),'');assert.match(sh.notes.get(sh.key(2,c.NAME)),/base is blank/);
});
test('new build retains base labor and fixed earning; form charge credits once',()=>{
 const t=load();t.scan(job({form_type:'new_build',screens_on_tag:2,extras:'LB $8 for all frames',tag_index:null,tag_count:null}));const {sh,c}=sheet(t);assert.equal(sh.get(2,c.LB_EARN),36.55);assert.equal(sh.get(3,c.LB_EARN),28.55);assert.equal(sh.get(2,c.EARNING),1.5);assert.equal(sh.get(3,c.EARNING),1.5);
});
test('manual edit to a prior credited labor cell blocks later group credit',()=>{
 const t=load(),x=job({extras:'LB $8 cleaning for both doors',tag_count:2});t.scan(x);const {sh,c}=sheet(t);sh.set(2,c.LB_EARN,99);t.scan({...x,tag_index:2,width_in:35,billable_inches:114});assert.equal(sh.get(2,c.LB_EARN),99);assert.equal(sh.get(3,c.LB_EARN),19.38);assert.match(sh.notes.get(sh.key(3,c.NAME)),/receipt is pending or changed/);
});
test('formula/unexpected target value is never overwritten by addition',()=>{
 const t=load(),x=job(),{sh,c}=sheet(t);x._extra_labor_plan=t.ctx.calculateExtraLabor_(x);sh.set(2,c.LB_EARN,'=1+2');const flags=[];t.ctx.applyExtraLabor_(sh,2,c,x,true,19.55,flags);assert.equal(sh.get(2,c.LB_EARN),'=1+2');assert.match(flags.join(';'),/blank, formula-backed or changed/);
});
test('write interruption leaves reservation; retry cannot double-credit',()=>{
 for(const stage of ['before-value','after-value','after-posted']){
  const t=load(),x=job(),{sh,c}=sheet(t),original=sh.getRange.bind(sh);let fired=false;
  sh.getRange=(r,col,n=1,m=1)=>{const range=original(r,col,n,m);if(r===2&&col===c.LB_EARN){const set=range.setValue,note=range.setNote;range.setValue=v=>{if(!fired&&stage==='before-value'){fired=true;throw Error('synthetic interruption');}const out=set(v);if(!fired&&stage==='after-value'){fired=true;throw Error('synthetic interruption');}return out;};range.setNote=v=>{const out=note(v);if(!fired&&stage==='after-posted'&&v.includes('"status":"posted"')){fired=true;throw Error('synthetic interruption');}return out;};}return range;};
  assert.equal(t.scan(x).status,'error',stage);sh.getRange=original;assert.match(t.scan(x).message,/Already scanned/);assert.equal(sh.get(2,c.LB_EARN),stage==='before-value'?19.55:27.55);assert.equal(sh.get(3,c.LB_EARN),'');
 }
});
test('malformed labor receipt fails closed',()=>{
 const t=load(),{sh,c}=sheet(t);sh.getRange(2,c.LB_EARN).setNote('EXTRA_LABOR_V1: {broken');const p=t.ctx.prepareExtraLabor_(t.ss,job());assert.equal(p.items.length,0);assert.match(p.flags.join(';'),/pending or changed/);
});
test('labor receipts survive canonical-to-city tab rename',()=>{
 const t=load(),x=job({store:'DG',extras:'LB $8 for both doors',tag_count:2});t.scan(x);const sh=t.ss.tabs['18559-(500)'];delete t.ss.tabs['18559-(500)'];sh.name='Downers Grove';t.ss.tabs['Downers Grove']=sh;t.scan({...x,tag_index:2,width_in:35,billable_inches:114});const c=t.ctx.storeLayout_(sh).screens;assert.equal(sh.get(2,c.LB_EARN),27.55);assert.equal(sh.get(3,c.LB_EARN),19.38);
});
test('same literal charge in structured parts and labor does not receive a second labor credit',()=>{
 const t=load(),x=job({extras:'LB $8 cleaning',parts:[{sku:'580301',quantity:1,unit:'job',group_wide:false,raw:'LB $8 cleaning'}]});
 const plan=t.ctx.calculateExtraLabor_(x);assert.equal(plan.items.length,0);assert.match(plan.flags.join(';'),/both parts/);
});
test('changed client on same ticket group is held rather than paid again',()=>{
 const t=load(),x=job({extras:'LB $8 for both doors',tag_count:2});t.scan(x);t.scan({...x,phone:'6305550101',tag_index:2,width_in:35,billable_inches:114});const {sh,c}=sheet(t);assert.equal(sh.get(3,c.LB_EARN),19.38);assert.match(sh.notes.get(sh.key(3,c.NAME)),/differs/);
});
test('labor addition follows migrated screen header positions',()=>{
 const t=load(),{sh}=sheet(t);sh.insertColumnAfter(15);sh.set(1,16,'Tag x of N');sh.insertColumnAfter(3);sh.set(1,4,'Tag x of N');t.scan(job());const c=t.ctx.storeLayout_(sh).screens;assert.equal(sh.get(2,c.LB_EARN),27.55);assert.equal(sh.get(2,c.EARNING),'');
});
test('window additional labor preserves existing per-pane base and glass cost',()=>{
 const t=load();t.scan(job({item_type:'window',panes:1,glass_price:20,job_evidence:'glass',extras:'LB $8 cleaning'}));const sh=t.ss.tabs['Homer Glen'],c=t.ctx.storeLayout_(sh).windows;assert.equal(sh.get(2,c.LB_EARN),26.5);assert.equal(sh.get(2,c.GLASS),20);assert.equal(sh.get(2,c.OTHER_EARN),'');
});
test('different-ticket sibling with changed name but same phone remains held',()=>{
 const t=load(),x=job({extras:'LB $8 for both doors',tag_count:2});t.scan(x);t.scan({...x,ticket_number:'1000002',last_name:'Other',customer_name:'Test Other',tag_index:2,width_in:35,billable_inches:114});const {sh,c}=sheet(t);assert.equal(sh.get(3,c.LB_EARN),19.38);assert.match(sh.notes.get(sh.key(3,c.NAME)),/differs/);
});
test('negated, already-included, waived and total labor never becomes an addition',()=>{
 for(const text of ['No additional labor $8','LB $8 already included','LB $8 total','LB $8 waived','LB $8 do not charge','LB $8 included in invoice','LB $8 paid','LB $8 less discount'])assert.equal(load().ctx.calculateExtraLabor_(job({extras:text})).items.length,0,text);
});
test('a formula evaluating to the base amount is still never overwritten',()=>{
 const t=load(),x=job(),{sh,c}=sheet(t);x._extra_labor_plan=t.ctx.calculateExtraLabor_(x);sh.set(2,c.LB_EARN,'=19.55');const original=sh.getRange.bind(sh);
 sh.getRange=(r,col,...rest)=>{const range=original(r,col,...rest);if(r===2&&col===c.LB_EARN){range.getValues=()=>[[19.55]];range.getFormulas=()=>[['=19.55']];}return range;};
 const flags=[];t.ctx.applyExtraLabor_(sh,2,c,x,true,19.55,flags);assert.equal(sh.get(2,c.LB_EARN),'=19.55');assert.match(flags.join(';'),/formula-backed/);
});
test('a prior receipt whose cell became an equivalent formula blocks additional allocation',()=>{
 const t=load(),x=job({extras:'LB $8 for both doors',tag_count:2});t.scan(x);const {sh,c}=sheet(t);sh.set(2,c.LB_EARN,'=27.55');const original=sh.getRange.bind(sh);
 sh.getRange=(r,col,...rest)=>{const range=original(r,col,...rest);if(r===2&&col===c.LB_EARN){range.getValues=()=>[[27.55]];range.getFormulas=()=>[['=27.55']];}return range;};
 const p=t.ctx.prepareExtraLabor_(t.ss,{...x,tag_index:2,width_in:35,billable_inches:114});assert.equal(p.items.length,0);assert.match(p.flags.join(';'),/pending or changed/);
});
test('credited labor does not leave a misleading enter-your-earning note',()=>{
 const t=load();t.scan(job());const {sh,c}=sheet(t);assert.equal(sh.getRange(2,c.EARNING).getNote(),'');assert.match(sh.getRange(2,c.LB_EARN).getNote(),/Additional labor: \$8.00/);
});
test('same phone/date with conflicting group count and new ticket is held',()=>{
 const t=load(),x=job({extras:'LB $8 for all frames',tag_count:2});t.scan(x);t.scan({...x,ticket_number:'1000002',tag_count:3,tag_index:2,width_in:35,billable_inches:114});const {sh,c}=sheet(t);assert.equal(sh.get(3,c.LB_EARN),19.38);assert.match(sh.notes.get(sh.key(3,c.NAME)),/differs/);
});
test('multi-frame new build with tag count one creates a valid group receipt',()=>{
 const t=load(),x=job({form_type:'new_build',screens_on_tag:2,tag_count:1,tag_index:1,extras:'LB $8 for all frames'});assert.equal(t.scan(x).status,'ok');assert.equal(receipt(t).invalid,undefined);assert.equal(JSON.parse(receipt(t).groupKey)[3],2);assert.match(t.scan(x).message,/Already scanned/);const {sh,c}=sheet(t);assert.equal(sh.get(2,c.LB_EARN),36.55);assert.equal(sh.get(3,c.LB_EARN),28.55);
});
test('group warning remains when unrelated group-wide parts remain in the note',()=>{
 const t=load(),x=job();x._extra_labor_plan=t.ctx.calculateExtraLabor_(x);const prefix='Group extras (whole group; do not multiply by tag/frame count):';
 assert.equal(t.ctx.extraLaborPartsNote_(x,prefix+'\n'+x.extras+'\n580602 spring pins for all frames'),prefix+'\n580602 spring pins for all frames');
 assert.equal(t.ctx.extraLaborPartsNote_(x,prefix+'\n'+x.extras),'');
});
console.log(passed+' additive-labor tests passed');
