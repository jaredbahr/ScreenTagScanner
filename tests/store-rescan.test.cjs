'use strict';
const assert=require('node:assert/strict');const {load,BASE}=require('./offline.test.cjs');let passed=0;
function test(name,fn){fn();passed++;console.log('PASS rescan: '+name);}
function scan(t,store,sticker_color='',over={}){return t.scan({...BASE,store,sticker_color,ticket_number:'SYN-ALIAS',...over});}
test('numeric to city and city to numeric aliases do not add another base charge',()=>{
 for(const [first,second] of [['18559','Downers Grove'],['Downers Grove','18559'],['500','DG'],['18563','Lockport'],['Plainfield','18556'],['18650','Joliet']]){
  const t=load();assert.equal(scan(t,first).status,'ok');const st=t.ctx.matchStore_(first),sh=t.ss.tabs[st.tab],c=t.ctx.storeLayout_(sh).screens;const amount=sh.get(2,c.LB_EARN);
  assert.match(scan(t,second).message,/Already scanned/);assert.equal(sh.get(2,c.LB_EARN),amount);assert.equal(sh.get(3,c.LB_EARN),'');
 }
});
test('written to sticker and sticker to written resolve the same placed store',()=>{
 for(const [a,b] of [[['18559',''],['','yellow']],[['','yellow'],['Downers Grove','']],[['unreadable','yellow'],['18559','']]]){
  const t=load();assert.equal(scan(t,...a).status,'ok');assert.match(scan(t,...b).message,/Already scanned/);assert.equal(t.ss.tabs['18559-(500)'].get(3,8),'');
 }
});
test('different resolved stores with the same tag identity remain separate',()=>{
 const t=load();assert.equal(scan(t,'18559').status,'ok');assert.equal(scan(t,'Lockport').status,'ok');assert.notEqual(t.ss.tabs['18563 (37)'].get(2,8),'');
});
test('known written store remains authoritative over conflicting sticker evidence',()=>{
 const t=load();scan(t,'18559');assert.match(scan(t,'Downers Grove','red').message,/Already scanned/);assert.equal(t.ss.tabs['18563 (37)'].get(2,8),'');
});
test('unknown interrupted placement is held even when retry resolves a store',()=>{
 const t=load();scan(t,'','yellow');const log=t.ss.tabs.Scans;log.set(2,t.ctx.COL.WRITTEN_TO,'INTERRUPTED');
 assert.match(scan(t,'18559').message,/Already scanned|interrupted/);assert.equal(t.ss.tabs['18559-(500)'].get(3,8),'');
});
test('NOT PLACED can be corrected and different dimensions remain new tags',()=>{
 const t=load();scan(t,'unknown');assert.equal(scan(t,'18559').status,'ok');assert.equal(scan(t,'Downers Grove','',{width_in:22,billable_inches:42}).status,'ok');assert.equal(t.ss.tabs['18559-(500)'].get(3,5),'SYN-ALIAS');
});
console.log(passed+' store-rescan tests passed');
