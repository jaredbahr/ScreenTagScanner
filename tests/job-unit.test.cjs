'use strict';
// Synthetic output fixtures and prompt assertions; no photo/OCR accuracy claim.
const assert=require('node:assert/strict');
const {load,BASE}=require('./offline.test.cjs');
const p=(overrides={})=>({sku:'580301',quantity:1,unit:'job',group_wide:false,raw:'580301 Xtra labor 1 $15.00',...overrides});
const x=(overrides={})=>({...BASE,tag_index:1,tag_count:2,extras:'580301 Xtra labor 1 $15.00',parts:[p()],...overrides});
let passed=0;function test(n,f){f();passed++;console.log('PASS '+n);}
test('prompt explicitly specifies job units without inferring quantities or SKU digits',()=>{
 const text=load().ctx.SYSTEM_PROMPT;
 assert.match(text,/Service SKUs 580301[\s\S]*580408[\s\S]*use unit job/);
 assert.match(text,/Preserve uncertain SKU digits in unclear/);
});
test('one known wood-frame labor job credits $11 Earning and preserves base labor',()=>{
 const t=load(),j=x();assert.equal(t.scan(j).status,'ok');
 const sh=t.ss.tabs['Homer Glen'],c=t.ctx.storeLayout_(sh).screens;
 assert.equal(sh.get(2,c.EARNING),11);assert.equal(sh.get(2,c.LB_EARN),19.55);
 assert.notEqual(sh.get(2,c.EARNING),15);
});
test('uncertain SKU digits still hold the job despite explicit quantity',()=>{
 const plan=load().ctx.calculateParts_(x({unclear:['SKU 580301 digits could be read differently']}));
 assert.equal(plan.items.length,0);assert.match(plan.flags.join(';'),/flagged unclear/);
});
test('wrong unit and absent quantity still hold rather than silently coercing',()=>{
 for(const part of [p({unit:'each'}),p({unit:'side'}),p({quantity:0})]){
  const plan=load().ctx.calculateParts_(x({parts:[part]}));assert.equal(plan.items.length,0);
 }
});
test('same job rescan does not duplicate credit',()=>{
 const t=load(),j=x();t.scan(j);assert.match(t.scan(j).message,/Already scanned/);
 const sh=t.ss.tabs['Homer Glen'],c=t.ctx.storeLayout_(sh).screens;
 assert.equal(sh.get(2,c.EARNING),11);assert.equal(sh.get(3,c.EARNING),'');
});
test('whole-group job is credited only once across sibling tags',()=>{
 const t=load(),j=x({group_extras:'580301 extra labor for all frames',parts:[p({group_wide:true})]});
 t.scan(j);t.scan({...j,tag_index:2,width_in:35,billable_inches:114});
 const sh=t.ss.tabs['Homer Glen'],c=t.ctx.storeLayout_(sh).screens;
 assert.equal(sh.get(2,c.EARNING),11);assert.equal(sh.get(3,c.EARNING),'');
});
test('different ticket numbers never imply a shared group credit',()=>{
 const t=load(),j=x();t.scan(j);t.scan({...j,ticket_number:'1000002',tag_index:2});
 const sh=t.ss.tabs['Homer Glen'],c=t.ctx.storeLayout_(sh).screens;
 assert.equal(sh.get(2,c.EARNING),11);assert.equal(sh.get(3,c.EARNING),11);
});
console.log(passed+' job-unit tests passed');
