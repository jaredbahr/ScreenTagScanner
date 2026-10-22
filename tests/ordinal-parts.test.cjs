'use strict';
// Synthetic post-extraction fixtures: these do not measure model/photo accuracy.
const assert = require('node:assert/strict');
const {load, BASE} = require('./offline.test.cjs');
const raw = '2 580602 Spring Pins $2 = $4\nPay Cashier: 3rd pin 580602 $2.00';
const part = (overrides={}) => ({sku:'580602',quantity:3,unit:'each',group_wide:false,raw,...overrides});
const job = (overrides={}) => ({...BASE,extras:raw,parts:[part()],tag_index:1,tag_count:1,...overrides});
let passed=0;
function test(name,fn){fn();passed++;console.log('PASS '+name);}
test('prompt limits ordinal consolidation to clear additive same-SKU evidence',()=>{
  const p=load().ctx.SYSTEM_PROMPT;
  assert.match(p,/THREE pins total, not three additional pins/);
  assert.match(p,/same exact SKU, same job\/scope, initial quantity 2/);
  assert.match(p,/third-pin label alone/);
  assert.match(p,/Customer prices[\s\S]*are NOT PK earnings/);
  assert.match(p,/Unlisted service prices alone are not evidence of PK earnings/);
});
test('clear consolidated three-pin fixture earns $1.50, never the $6 retail charge',()=>{
  const t=load(),p=t.ctx.calculateParts_(job());
  assert.equal(p.items.length,1);assert.equal(p.items[0].quantity,3);
  assert.equal(p.items[0].amount,1.5);assert.equal(p.items[0].rate,0.5);
});
test('uncertain third-pin quantity still holds all automatic parts earnings',()=>{
  const p=load().ctx.calculateParts_(job({unclear:['Pay Cashier 3rd pin quantity not explicit']}));
  assert.equal(p.items.length,0);assert.match(p.flags.join(';'),/flagged unclear/);
});
test('standalone ordinal with no confirmed quantity is held',()=>{
  const p=load().ctx.calculateParts_(job({extras:'3rd pin 580602 $2.00',parts:[part({quantity:0,raw:'3rd pin 580602 $2.00'})]}));
  assert.equal(p.items.length,0);assert.match(p.flags.join(';'),/quantity missing/);
});
test('unconsolidated duplicate SKU lines remain manual instead of double-crediting',()=>{
  const p=load().ctx.calculateParts_(job({parts:[part({quantity:2}),part({quantity:1})]}));
  assert.equal(p.items.length,0);assert.match(p.flags.join(';'),/Repeated SKU/);
});
test('literal conflicting quantity and SKU remain manual',()=>{
  for(const r of ['qty 2 580602 Spring Pins','3 580603 Spring Clips']){
    const p=load().ctx.calculateParts_(job({extras:r,parts:[part({raw:r})]}));
    assert.equal(p.items.length,0);assert.match(p.flags.join(';'),/disagree|missing from structured/);
  }
});
test('exact rescan does not credit consolidated pins again',()=>{
  const t=load(),x=job();assert.equal(t.scan(x).status,'ok');
  const sh=t.ss.tabs['Homer Glen'],c=t.ctx.storeLayout_(sh).screens;
  assert.equal(sh.get(2,c.EARNING),1.5);
  assert.match(t.scan(x).message,/Already scanned/);
  assert.equal(sh.get(2,c.EARNING),1.5);assert.equal(sh.get(3,c.EARNING),'');
});
test('whole-group consolidated pins credit once across sibling tags',()=>{
  const t=load(),group='Three spring pins total for the whole group: 580602';
  const x=job({tag_count:2,group_extras:group,parts:[part({group_wide:true})]});
  t.scan(x);t.scan({...x,tag_index:2,width_in:35,billable_inches:114});
  const sh=t.ss.tabs['Homer Glen'],c=t.ctx.storeLayout_(sh).screens;
  assert.equal(sh.get(2,c.EARNING),1.5);assert.equal(sh.get(3,c.EARNING),'');
});
test('tag sequence and miscellaneous dollar charges cannot invent parts earnings',()=>{
  for(const extras of ['Qty 3 of 3','Cleaned all rollers on both doors $8.00']){
    const p=load().ctx.calculateParts_(job({extras,parts:[]}));
    assert.equal(p.items.length,0);assert.match(p.flags.join(';'),/no structured parts evidence/);
  }
});
console.log(passed+' ordinal-parts tests passed');
