'use strict';const assert=require('node:assert/strict');const {load,BASE}=require('./offline.test.cjs');let passed=0;
function test(name,fn){fn();passed++;console.log('PASS '+name);}
const part=(sku,quantity,unit='each',group_wide=false)=>({sku,quantity,unit,group_wide,raw:'Synthetic filled SKU '+sku+' Qty '+quantity+(group_wide?' on all frames':'')});
function write(t,x){return t.ctx.saveScan_({...BASE,...x},'Synthetic',[],'','synthetic');}
function rpc(t,x){t.setOutput(x);return t.ctx.scanTag({token:'t',user:'Synthetic',image:'/9j/AP/Z'});}
function earning(t,row=2){const sh=t.ss.tabs['Homer Glen'];return sh.get(row,t.ctx.storeLayout_(sh).screens.EARNING);}
function modern(t){const sh=t.ss.tabs['Homer Glen'];sh.insertColumnAfter(15);sh.set(1,16,'Tag x of N');sh.insertColumnAfter(3);sh.set(1,4,'Tag x of N');}
test('confirmed spring pins are EACH: 35 earns 17.50, not a two-pack inference',()=>{
  const t=load();write(t,{parts:[part('580602',35)]});const sh=t.ss.tabs['Homer Glen'];assert.equal(sh.get(2,12),17.5);assert.match(sh.notes.get('2,12'),/35 each.*17.50/);
});
test('whole-group earnings are credited once and total/reference appears on every sibling',()=>{
  const t=load();write(t,{ticket_number:'GROUP',tag_index:2,tag_count:11,parts:[part('580602',35,'each',true)]});
  write(t,{ticket_number:'GROUP',tag_index:3,tag_count:11,width_in:20,height_in:30,billable_inches:50,parts:[part('580602',35,'each',true)]});
  const sh=t.ss.tabs['Homer Glen'];assert.equal(sh.get(2,12),17.5);assert.equal(sh.get(3,12),'');assert.match(sh.notes.get('3,12'),/17.50.*already recorded/);assert.match(sh.notes.get('3,12'),/row 2/);
});
test('group quantity changes and missing group identity are held for review, never billed on each sibling',()=>{
  const t=load();write(t,{tag_index:1,tag_count:11,parts:[part('580602',35,'each',true)]});
  write(t,{tag_index:2,tag_count:11,width_in:20,height_in:30,billable_inches:50,parts:[part('580602',40,'each',true)]});
  assert.equal(t.ss.tabs['Homer Glen'].get(3,12),'');assert.match(t.ss.tabs['Homer Glen'].notes.get('3,3'),/differs/);
  const u=load();write(u,{parts:[part('580602',35,'each',true)]});assert.equal(u.ss.tabs['Homer Glen'].get(2,12),'');
});
test('approved each rates calculate only literal positive integer quantity and known SKU',()=>{
  const t=load();for(const [sku,ref] of Object.entries(t.ctx.PART_EARNINGS).filter(([,r])=>r.unit==='each')){
    const plan=t.ctx.calculateParts_({...BASE,parts:[part(sku,2)]});assert.equal(plan.items[0].amount,2*ref.rate);
  }
  for(const p of [part('constructor',1),part('580602',0),part('580602',1.5),part('580602',1001),part('580999',35),part('',35)]){
    assert.equal(t.ctx.calculateParts_({...BASE,parts:[p]}).items.length,0);
  }
});
test('set-of-four, side/piece and job bases are explicit; build overlaps never double-count base earnings/labor',()=>{
  const t=load();assert.equal(t.ctx.calculateParts_({...BASE,parts:[part('580601',1,'set4')]}).items[0].amount,1.5);
  assert.equal(t.ctx.calculateParts_({...BASE,parts:[part('580601',4,'each')]}).items.length,0);
  assert.equal(t.ctx.calculateParts_({...BASE,parts:[part('580625',2,'side')]}).items[0].amount,4.5);
  assert.equal(t.ctx.calculateParts_({...BASE,parts:[part('580408',1,'job')]}).items[0].amount,8);
  assert.equal(t.ctx.calculateParts_({...BASE,parts:[part('580301',1,'job')]}).items[0].amount,11);
  for(const sku of ['580601','580625'])assert.equal(t.ctx.calculateParts_({...BASE,form_type:'new_build',parts:[part(sku,1,sku==='580601'?'set4':'side')]}).items.length,0);
});
test('material-zero PK, existing labor and glass prices never become duplicate extras; uncertain spline stays untouched',()=>{
  const t=load();for(const sku of [...t.ctx.ZERO_PK_MATERIALS,...t.ctx.STANDARD_SCREEN_LABOR,'580500','580503','13235'])assert.equal(t.ctx.calculateParts_({...BASE,parts:[part(sku,35)]}).items.length,0);
  write(t,{parts:[part('575005',35)]});const sh=t.ss.tabs['Homer Glen'];assert.equal(sh.get(2,9),'=F2*0.07');assert.equal(sh.get(2,10),'=F2*0.01');assert.equal(sh.get(2,12),'');
});
test('unclear/duplicate parts or per-frame quantities on multi-frame forms require manual review',()=>{
  const t=load();assert.equal(t.ctx.calculateParts_({...BASE,unclear:['parts_quantity'],parts:[part('580602',35)]}).items.length,0);
  assert.equal(t.ctx.calculateParts_({...BASE,parts:[part('580602',10),part(' 580602 ',25)]}).items.length,0);
  const p=part('580602',2);p.raw='2 spring pins per frame';assert.equal(t.ctx.calculateParts_({...BASE,screens_on_tag:2,parts:[p]}).items.length,0);
});
test('multi-frame build adds the total once to first row, preserving existing per-frame build bases',()=>{
  const t=load();write(t,{form_type:'new_build',screens_on_tag:2,parts:[part('580602',35,'each',true)]});const sh=t.ss.tabs['Homer Glen'];
  assert.equal(sh.get(2,12),19);assert.equal(sh.get(3,12),1.5);assert.match(sh.notes.get('3,12'),/no duplicate amount/);
});
test('window Other Earn gets approved parts earnings without changing standard window labor',()=>{
  const t=load();write(t,{item_type:'window',panes:1,glass_price:40,parts:[part('580402',2)]});const sh=t.ss.tabs['Homer Glen'];assert.equal(sh.get(2,20),18.5);assert.equal(sh.get(2,23),5);
});
test('reserved receipt prevents a second charge after interrupted value write; posted receipt also protects log failures',()=>{
  const t=load(),sh=t.ss.tabs['Homer Glen'],original=sh.getRange.bind(sh);let fail=true;
  sh.getRange=(r,c,n=1,m=1)=>{const range=original(r,c,n,m);if(r===2&&c===12){const set=range.setValue;range.setValue=v=>{if(v===17.5&&fail){fail=false;throw Error('Synthetic earnings write failure');}return set(v);};}return range;};
  assert.throws(()=>write(t,{tag_index:1,tag_count:11,parts:[part('580602',35,'each',true)]}));
  write(t,{tag_index:2,tag_count:11,width_in:20,height_in:30,billable_inches:50,parts:[part('580602',35,'each',true)]});
  assert.equal(sh.get(2,12),'');assert.equal(sh.get(3,12),'');assert.match(sh.notes.get('3,12'),/PENDING review/);
});
test('raw SKU/quantity evidence and posted receipt remain in Scans without changing its columns',()=>{
  const t=load();write(t,{extras:'580602 Spring pins Qty 35',parts:[part('580602',35)]});const log=t.ss.tabs.Scans;
  assert.equal(log.get(2,t.ctx.HEADERS.indexOf('Extras / Fees')+1),'580602 Spring pins Qty 35');assert.match(log.get(2,t.ctx.HEADERS.indexOf('Notes')+1),/PARTS_EARNINGS_V1/);assert.equal(t.fetches(),0);
});
test('raw provider payload uses supported schema keywords while local parts bounds still fail closed',()=>{
  const t=load();let body;const fetch=t.ctx.UrlFetchApp.fetch;
  t.ctx.UrlFetchApp.fetch=(url,options)=>{body=JSON.parse(options.payload);return fetch(url,options);};rpc(t,{parts:[]});
  const schema=body.output_config.format.schema;
  function check(v){if(!v||typeof v!=='object')return;for(const [k,x] of Object.entries(v)){assert.ok(!['minimum','maximum','maxItems','minItems','minLength','maxLength'].includes(k),'unsupported provider keyword '+k);check(x);}}
  check(schema);assert.equal(schema.properties.parts.type,'array');assert.equal(schema.properties.parts.items.properties.quantity.type,'integer');
  assert.match(body.system,/at most 30 parts lines/i);
  const tooMany=t.ctx.calculateParts_({...BASE,parts:Array.from({length:31},()=>part('580602',1))});assert.equal(tooMany.items.length,0);assert.match(tooMany.flags.join(';'),/More than 30/);
  for(const qty of [-1,0,1.5,1001]){const p=t.ctx.calculateParts_({...BASE,parts:[part('580602',qty)]});assert.equal(p.items.length,0);assert.ok(p.flags.length);}
  assert.equal(t.ctx.calculateParts_({...BASE,parts:[part('580602',1000)]}).items[0].amount,500);assert.equal(t.fetches(),1,'one inert fake-provider call only');
});
test('contradictory group text and per-tag structured flag never credit repeated sibling earnings',()=>{
  const t=load();for(const index of [2,3])write(t,{ticket_number:'GROUP-CONFLICT',tag_index:index,tag_count:11,width_in:20+index,height_in:30,billable_inches:50+index,group_extras:'580602 Spring pins Qty 35 on all frames',parts:[part('580602',35)]});
  const sh=t.ss.tabs['Homer Glen'];for(const row of [2,3]){assert.equal(sh.get(row,12),'');assert.match(sh.notes.get(row+',3'),/group\/per-tag evidence disagrees/);}
  const u=load(),p=part('580602',35);p.raw+=' on all frames';write(u,{tag_index:2,tag_count:11,parts:[p]});assert.equal(u.ss.tabs['Homer Glen'].get(2,12),'');
  const v=load();write(v,{group_extras:'pins on all frames',tag_index:2,tag_count:11,parts:[part('580602',35)]});assert.equal(v.ss.tabs['Homer Glen'].get(2,12),'');
});
test('unrelated explicit group SKU does not suppress legitimate per-tag earnings; matching group remains once only',()=>{
  const t=load();write(t,{group_extras:'580602 pins on all frames',tag_index:1,tag_count:2,parts:[part('580402',2)]});assert.equal(t.ss.tabs['Homer Glen'].get(2,12),5);
  const u=load();for(const index of [1,2])write(u,{group_extras:'580602 pins on all frames',tag_index:index,tag_count:2,width_in:index+20,height_in:30,billable_inches:index+50,parts:[part('580602',35,'each',true)]});
  assert.equal(u.ss.tabs['Homer Glen'].get(2,12),17.5);assert.equal(u.ss.tabs['Homer Glen'].get(3,12),'');
});
test('literal extras missing structured parts always need review, including an empty parts array',()=>{
  for(const parts of [[],undefined]){const t=load();const r=rpc(t,{extras:'580602 Spring pins Qty 35 PK .50',parts});assert.equal(earning(t),'');assert.equal(r.needsReview,true);assert.match(t.ss.tabs['Homer Glen'].notes.get('2,3'),/no structured parts evidence/);}
  const t=load();const r=rpc(t,{parts:[],extras:null,group_extras:''});assert.equal(r.needsReview,false);
  const u=load();write(u,{extras:'580602 Spring pins Qty 35 PK .50',parts:[part('580602',35)]});assert.equal(u.ss.tabs['Homer Glen'].get(2,12),17.5);
});
test('exact RPC omitted-parts reproduction and later enriched rescan retain review without changing original earnings',()=>{
  for(const migrated of [false,true]){const t=load();if(migrated)modern(t);
    const first=rpc(t,{extras:'580602 Spring pins Qty 35',parts:[]});assert.equal(first.status,'ok');assert.equal(first.needsReview,true);assert.equal(earning(t),'');
    const again=rpc(t,{extras:'580602 Spring pins Qty 35',parts:[part('580602',35)]});assert.match(again.message,/Already scanned/);assert.equal(again.needsReview,true);assert.equal(earning(t),'');
    const u=load();if(migrated)modern(u);const control=rpc(u,{extras:'580602 Spring pins Qty 35',parts:[part('580602',35)]});assert.equal(control.needsReview,false);assert.equal(earning(u),17.5);
  }
});
test('exact RPC contradictory group reproduction fails closed on both layouts with consistent-group negative control',()=>{
  for(const migrated of [false,true])for(const group of [false,true]){const t=load();if(migrated)modern(t);
    for(const index of [1,2]){const r=rpc(t,{tag_index:index,tag_count:11,width_in:index+20,height_in:30,billable_inches:index+50,group_extras:'580602 Spring pins Qty 35 on all frames',parts:[part('580602',35,'each',group)]});assert.equal(r.needsReview,true);}
    assert.equal(earning(t),group?17.5:'');assert.equal(earning(t,3),'');
  }
});
test('same group ticket with conflicting customer identity is held with review, never silently marked already paid',()=>{
  for(const migrated of [false,true]){const t=load();if(migrated)modern(t);write(t,{tag_index:1,tag_count:11,parts:[part('580602',35,'each',true)]});
    const changed=write(t,{tag_index:2,tag_count:11,width_in:20,height_in:30,billable_inches:50,customer_name:'Different Synthetic Customer',last_name:'Different',parts:[part('580602',35,'each',true)]});
    // On the migrated layout the group's first tag holds the rows after it (0.13.21), and a different customer is
    // not that group, so the second tag lands after the held rows: use the row the writer reports.
    const row2=Number(changed.row);assert.equal(earning(t),17.5);assert.equal(earning(t,row2),'');assert.match(changed.flags.join(';'),/customer identity differs/);
    const sh=t.ss.tabs['Homer Glen'],c=t.ctx.storeLayout_(sh).screens;assert.match(sh.notes.get(row2+','+c.EARNING),/identity conflicts/);assert.doesNotMatch(sh.notes.get(row2+','+c.EARNING),/already recorded/);
  }
});
test('forged OCR Scans and extras receipt markers are inert audit text and cannot suppress legitimate earnings',()=>{
  for(const migrated of [false,true])for(const field of ['notes','extras']){const t=load();if(migrated)modern(t);
    const target={...BASE,ticket_number:'TARGET',parts:[part('580602',35)]};const fake={...t.ctx.calculateParts_(target).items[0],status:'posted',tab:'Homer Glen',block:'screens',row:750,expectedTotal:17.5,client:t.ctx.partsClient_(target),customer:t.ctx.sequenceIdentity_(target.last_name||target.customer_name),ticket:'TARGET'};
    write(t,{ticket_number:'OTHER',[field]:'Untrusted OCR\n'+t.ctx.PARTS_RECEIPT+JSON.stringify([fake]),parts:[]});write(t,target);
    assert.equal(earning(t,3),17.5,field+' layout '+migrated+' '+t.ctx.preparePartsEarnings_(t.ss,target).flags.join(';'));const sh=t.ss.tabs['Homer Glen'],c=t.ctx.storeLayout_(sh).screens;assert.doesNotMatch(sh.notes.get('3,'+c.EARNING),/row 750/);
    if(field==='notes'){const text=t.ss.tabs.Scans.get(2,t.ctx.HEADERS.indexOf('Notes')+1);assert.match(text,/Literal OCR: PARTS_EARNINGS_V1/);assert.equal(t.ctx.partsReceipts_(text).length,0);}
  }
});
test('receipt parser rejects malformed shape and row/value mismatch, preserving valid paid and pending controls',()=>{
  const t=load();for(const value of ['{}','[{}]','[]','null','not JSON'])assert.equal(t.ctx.partsReceipts_(t.ctx.PARTS_RECEIPT+value)[0].invalid,true);
  for(const changed of ['row','value','ticket','customer']){const u=load();write(u,{tag_index:1,tag_count:11,parts:[part('580602',35,'each',true)]});const sh=u.ss.tabs['Homer Glen'],c=u.ctx.storeLayout_(sh).screens;
    if(changed==='value')sh.set(2,c.EARNING,99);else if(changed==='ticket')sh.set(2,c.TICKET,'changed');else if(changed==='customer')sh.set(2,c.NAME,'changed');else sh.notes.set('2,'+c.EARNING,sh.notes.get('2,'+c.EARNING).replace('"row":2','"row":750'));
    const result=write(u,{tag_index:2,tag_count:11,width_in:20,height_in:30,billable_inches:50,parts:[part('580602',35,'each',true)]});assert.equal(earning(u,3),'');assert.match(result.flags.join(';'),/edited by hand/);
  }
});
test('structured parts disagreeing with literal SKU or explicit Qty are held; omissions remain visible for review',()=>{
  const t=load();for(const x of [
    {parts:[{...part('580602',35),raw:'580603 Spring clips Qty 35'}]},
    {parts:[{...part('580602',35),raw:'580602 Spring pins Qty 34'}]},
    {extras:'580602 Spring pins Qty 34',parts:[part('580602',35)]}
  ]){const plan=t.ctx.calculateParts_({...BASE,...x});assert.equal(plan.items.length,0);assert.match(plan.flags.join(';'),/disagree with literal/);}
  const missing=t.ctx.calculateParts_({...BASE,extras:'580602 Spring pins Qty 35',parts:[part('580402',2)]});assert.match(missing.flags.join(';'),/SKU missing from structured/);
  const valid=t.ctx.calculateParts_({...BASE,extras:'580602 Spring pins Qty 35',parts:[part('580602',35)]});assert.equal(valid.items[0].amount,17.5);assert.equal(valid.flags.length,0);
});
test('initially clean exact rescan with any newly unposted parts requires review without altering the original row',()=>{
  for(const migrated of [false,true]){
    const t=load();if(migrated)modern(t);
    assert.equal(rpc(t,{parts:[],extras:null,group_extras:''}).needsReview,false);
    const r=rpc(t,{extras:'580602 Spring pins Qty 35',parts:[part('580602',35)]});
    assert.match(r.message,/Already scanned/);assert.equal(r.needsReview,true);assert.equal(earning(t),'');
    const log=t.ss.tabs.Scans;assert.match(log.get(3,t.ctx.HEADERS.indexOf('Review Reason')+1),/new unposted parts earnings/);
    const sh=t.ss.tabs['Homer Glen'],c=t.ctx.storeLayout_(sh).screens;
    assert.equal(sh.get(3,c.TICKET),'');assert.equal(sh.notes.get('2,'+c.EARNING),undefined,'no automatic correction to original earning note');
    const u=load();if(migrated)modern(u);rpc(u,{extras:'580602 Spring pins Qty 35',parts:[part('580602',35)]});
    const extra=rpc(u,{extras:'580602 Spring pins Qty 35\n580402 Latches Qty 2',parts:[part('580602',35),part('580402',2)]});
    assert.equal(extra.needsReview,true);assert.equal(earning(u),17.5,'new unposted SKU must not change already credited amount');
  }
});
test('ordinary exact rescans and fully credited parts rescans remain clean in both layouts',()=>{
  for(const migrated of [false,true])for(const paid of [false,true]){
    const t=load();if(migrated)modern(t);const x=paid?{extras:'580602 Spring pins Qty 35',parts:[part('580602',35)]}:{extras:null,group_extras:'',parts:[]};
    assert.equal(rpc(t,x).needsReview,false);const r=rpc(t,x);assert.match(r.message,/Already scanned/);assert.equal(r.needsReview,false);assert.equal(earning(t),paid?17.5:'');
  }
});
test('a one-screen comment in group_extras never holds the tag\'s own parts (real DG tag: missing frame spreader)',()=>{
  const t=load();write(t,{group_extras:'missing frame spreader',extras:'1 580605 frame spreader 6.95',parts:[part('580605',1)]});
  assert.equal(t.ss.tabs['Homer Glen'].get(2,12),2);
  const u=load();write(u,{group_extras:'spreaders on all frames',tag_index:2,tag_count:5,parts:[part('580605',1)]});
  assert.equal(u.ss.tabs['Homer Glen'].get(2,12),'','a real whole-group instruction about this part still holds');
  assert.match(t.ctx.SYSTEM_PROMPT,/attached Pay Cashier slip/);
});
test('Kirsten editing one paid row never blocks other tickets on the tab (real Downers Grove case, Oct 21)',()=>{
  const t=load();write(t,{ticket_number:'8159099',parts:[part('580401',2)]});const sh=t.ss.tabs['Homer Glen'],c=t.ctx.storeLayout_(sh).screens;
  assert.equal(sh.get(2,c.EARNING),4);sh.set(2,c.EARNING,8); // she corrected corners to $8
  write(t,{ticket_number:'8159068',width_in:32,height_in:74,billable_inches:106,parts:[part('580605',1)]});
  assert.equal(sh.get(3,c.EARNING),2,'frame spreader earns $2 on another ticket');
  assert.equal(sh.get(2,c.EARNING),8,'her edit is left alone');
  // A hand-edited note on another ticket's row is also ignored.
  sh.notes.set('2,'+c.EARNING,t.ctx.PARTS_RECEIPT+'not JSON');
  write(t,{ticket_number:'8159200',width_in:30,height_in:60,billable_inches:90,parts:[part('580402',2)]});
  assert.equal(sh.get(4,c.EARNING),5);
});
test('earnings receipts on tabs named by store ("Downers Grove") are recognised, so group pins still credit once',()=>{
  const t=load();const sh=t.ss.tabs['18559-(500)'];delete t.ss.tabs['18559-(500)'];sh.name='Downers Grove';t.ss.tabs['Downers Grove']=sh;const c=t.ctx.storeLayout_(sh).screens;
  for(const index of [1,2])write(t,{store:'DG',tag_index:index,tag_count:3,width_in:20+index,height_in:30,billable_inches:50+index,parts:[part('580602',35,'each',true)]});
  assert.equal(sh.get(2,c.EARNING),17.5);assert.equal(sh.get(3,c.EARNING),'');assert.match(sh.notes.get('3,'+c.EARNING),/already recorded/);
});
test('spring pins with no quantity are counted from the $2.00-each price (real Downers Grove case, Kirsten 2026-10-22)',()=>{
  const pin=(raw,extras=raw)=>{const t=load();const r=write(t,{extras,parts:[{sku:'580602',quantity:0,unit:'each',group_wide:false,raw}],
    unclear:['580602 line has no quantity written']});return {t,r,sh:t.ss.tabs['Homer Glen']};};
  let {sh}=pin('580602 $2.00');assert.equal(sh.get(2,12),0.5);assert.match(sh.notes.get('2,12'),/1 each \(from \$2\.00 at \$2\.00 each\)/);
  ({sh}=pin('580602 Spring pins $6.00'));assert.equal(sh.get(2,12),1.5);
  ({sh}=pin('580602 pins 2.00 4.00'));assert.equal(sh.get(2,12),'','multiple prices do not establish a line total');
  ({sh}=pin('580602 pins $2.50'));assert.equal(sh.get(2,12),'','not a multiple of $2.00: no guess');
  ({sh}=pin('580602 pins PK .50'));assert.equal(sh.get(2,12),'','no customer price: no guess');
  ({sh}=pin('Pay Cashier: 3rd pin 580602 $2.00'));assert.equal(sh.get(2,12),'','an ordinal means a running total: stays manual');
  const t=load();write(t,{parts:[part('580602',3)],extras:'580602 Qty 3 $6.00'});assert.equal(t.ss.tabs['Homer Glen'].get(2,12),1.5,'a written quantity is used as is');
  const u=load();write(u,{extras:'580602 $2.00',parts:[{sku:'580602',quantity:0,unit:'each',group_wide:false,raw:'580602 $2.00'}],unclear:['SKU 580602 digits unclear']});
  assert.equal(u.ss.tabs['Homer Glen'].get(2,12),'','an unclear SKU still holds earnings');
});
console.log(`${passed} parts-earnings tests passed`);
