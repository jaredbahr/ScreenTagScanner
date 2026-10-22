'use strict';
// Invented identifiers, mock sheets and post-extraction fixtures only. No network or paid OCR.
const assert=require('node:assert/strict');
const {load,BASE}=require('./offline.test.cjs');
let passed=0;
function test(name,fn){fn();passed++;console.log('PASS '+name);}
function pin(raw,quantity=0){return {sku:'580602',quantity,unit:'each',group_wide:false,raw};}
function job(raw,overrides={}){return {...BASE,ticket_number:'4270101',last_name:'Invented',customer_name:'Invented Example',extras:raw,
  parts:[pin(raw)],unclear:['580602 line has no quantity written'],...overrides};}
function held(raw,overrides={}){const p=load().ctx.calculateParts_(job(raw,overrides));assert.equal(p.items.length,0,raw);assert.ok(p.flags.length,raw);}

test('exact negative and refund reproducers keep uncertain pin earnings on hold',()=>{
  for(const raw of ['580602 -$2.00','580602 refund $2.00'])held(raw,{unclear:['pins quantity']});
});
test('negative signs before or after currency and accounting parentheses never become positive totals',()=>{
  for(const raw of ['580602 -2.00','580602 $-2.00','580602 − $2.00','580602 –2.00','580602 —$2.00','580602 $2.00-','580602 ($2.00)','580602 (2.00)'])held(raw);
});
test('credit, cancellation, return and discount wording is insufficient for a positive inferred quantity',()=>{
  for(const word of ['credit','CR','cancelled','return','discount','no charge','minus','negative'])held('580602 '+word+' $2.00');
});
test('multiple price columns stay manual, including the exact two-price reproducer',()=>{
  for(const raw of ['580602 $2.00 $4.00','580602 pins 2.00 4.00','580602 $2.00 $2.00'])held(raw);
});
test('conflicting raw and literal prices cannot silently prefer either source',()=>{
  held('580602 $2.00',{extras:'580602 $4.00'});
  held('580602 $4.00',{extras:'580602 $2.00'});
  held('580602 $2.00',{extras:'580602 $2.00\n580602 refund $2.00'});
});
test('malformed money, extra numeric fields and partial dollar amounts do not establish a total',()=>{
  for(const raw of ['580602 $1,002.00','580602 $2.000','580602 $2.00 $4','580602 $2.00 note 123','580602 $0.00','580602 $2.01','580602 $102.00','580602 $2.00?','580602 maybe $2.00'])held(raw);
});
test('known unit price and a written quantity are not missing-quantity evidence',()=>{
  for(const raw of ['580602 $2.00 each','580602 EA $2.00','580602 unit price $2.00','580602 $2.00/ea','580602 PK $2.00','580602 earnings $2.00','1 580602 $2.00','580602 Qty 0 $2.00'])held(raw);
});
test('invalid structured quantities are held rather than replaced by price inference',()=>{
  for(const quantity of [-1,1.5,null,'0'])held('580602 $2.00',{parts:[pin('580602 $2.00',quantity)]});
});
test('only a missing-quantity warning is resolved; genuine uncertainty and conflicts remain held',()=>{
  for(const reason of ['pins quantity','pins quantity unclear','pins quantity missing or unclear','580602 quantity missing but conflicting','580602 quantity missing; digits unclear','pins quantity missing; price unclear'])held('580602 $2.00',{unclear:[reason]});
});
test('a single consistent positive price retains existing approved pin earnings and bounds',()=>{
  for(const [raw,quantity] of [['580602 $2.00',1],['580602 pins 2.00',1],['580602 Spring pins $6.00',3],['580602 $100.00',50]]){
    const p=load().ctx.calculateParts_(job(raw));assert.equal(p.items.length,1,raw);assert.equal(p.items[0].quantity,quantity);assert.equal(p.items[0].amount,quantity*0.5);
  }
});
test('literal explicit quantities retain their existing calculation despite price columns',()=>{
  const raw='580602 Qty 3 $2.00 $6.00',p=load().ctx.calculateParts_(job(raw,{parts:[pin(raw,3)],unclear:[]}));
  assert.equal(p.items.length,1);assert.equal(p.items[0].quantity,3);assert.equal(p.items[0].amount,1.5);
});
test('price-derived whole-group pins still credit once across sibling tags',()=>{
  const t=load(),raw='580602 pins $70.00 on all frames',x=job(raw,{extras:'',group_extras:raw,tag_index:1,tag_count:3,parts:[{...pin(raw),group_wide:true}]});
  t.ctx.saveScan_(x,'Synthetic',[],'','one');t.ctx.saveScan_({...x,tag_index:2,width_in:20,height_in:30,billable_inches:50},'Synthetic',[],'','two');
  const sh=t.ss.tabs['Homer Glen'],c=t.ctx.storeLayout_(sh).screens;assert.equal(sh.get(2,c.EARNING),17.5);assert.equal(sh.get(3,c.EARNING),'');
});
test('an enriched exact rescan never retroactively pays the held original row',()=>{
  const t=load(),raw='580602 -$2.00',x=job(raw);t.ctx.saveScan_(x,'Synthetic',[],'','one');
  const next=job('580602 $2.00'),r=t.ctx.saveScan_(next,'Synthetic',[],'','two'),sh=t.ss.tabs['Homer Glen'],c=t.ctx.storeLayout_(sh).screens;
  assert.equal(r.rescan,true);assert.equal(r.needsReview,true);assert.equal(sh.get(2,c.EARNING),'');assert.equal(sh.get(3,c.TICKET),'');
});
test('price inference requires the exact literal pin SKU and rejects unrelated SKU amounts',()=>{
  const c=load().ctx;for(const raw of ['$2.00','580603 $2.00','580602 580603 $2.00','580602 580602 $2.00'])assert.equal(c.pinQuantityFromPrice_(raw,''),null);
});
console.log(passed+' pin-price-evidence tests passed');
