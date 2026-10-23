'use strict';
// Invented reasons/identifiers, in-memory workbooks and inert provider calls only.
const assert=require('node:assert/strict');
const {load}=require('./offline.test.cjs');
let passed=0;function test(name,fn){fn();passed++;console.log('PASS review-tiers: '+name);}
function fixture(modern=false){const t=load(),sh=t.ss.tabs['Homer Glen'];if(modern){sh.insertColumnAfter(15);sh.set(1,16,'Tag x of N');sh.insertColumnAfter(3);sh.set(1,4,'Tag x of N');}return {t,sh,c:t.ctx.storeLayout_(sh).screens};}
function rpc(t,x={}){t.setOutput({ticket_number:'9800001',...x});return t.ctx.scanTag({token:'t',image:'/9j/AP/Z'});}
function reason(t,row=2){return t.ss.tabs.Scans.get(row,t.ctx.HEADERS.indexOf('Review Reason')+1);}
function marked(t,row=2){return t.ss.tabs.Scans.get(row,t.ctx.HEADERS.indexOf('Needs Review')+1);}

test('the three display tiers classify representative synthetic reasons',()=>{
  const t=load(),cases={
    'Inches left blank, values disagree':'row','Parts quantity was flagged unclear: earnings held':'row',
    'Window: panes unknown':'row','Store disagreement':'row','Ticket already on the same tab':'row',
    'Unrecognized invented warning':'row','ticket_number: first digit obscured':'cell:TICKET',
    'Tag date missing: Date in left blank':'cell:DATE_IN','tag_count could be 2 or 3':'cell:SEQUENCE',
    'Qty 1 of 2 box is unclear':'cell:SEQUENCE','No customer name':'cell:NAME',
    'Area code 202 is not local':'log','phone: digits unclear':'log','height_in: second digit unclear':'log',
    'Tag x of N is in Scans only until the sequence-column migration':'log',
    'Correction/refund: phone number rewritten':'log','Correction/refund: name crossed out':'log',
    'Correction/refund: Ticket number and phone rewritten':'cell:TICKET',
    'Correction/refund: Qty box rewritten as 2 of 2':'cell:SEQUENCE',
    'Correction/refund: refund on slip':'row'};
  for(const [r,want]of Object.entries(cases)){const x=t.ctx.reviewTier_(r);assert.equal(x.tier+(x.field?':'+x.field:''),want,r);}
});
test('money, placement and receipt language outrank metadata keywords',()=>{
  const t=load();for(const r of ['tag_count unclear: group earnings need allocation','Phone and parts quantity unclear',
    'date uncertain; additional labor currency unclear','date amount unclear','phone fee unconfirmed','Correction/refund: Qty box 1 of 2; price $3',
    'Ticket receipt is reserved','name unclear; earlier save interrupted','Literal QTY rows: 78 of 78'])assert.equal(t.ctx.reviewTier_(r).tier,'row',r);
});
test('unresolved states need review even with zero or metadata-only reasons',()=>{
  const t=load();for(const state of ['PENDING','INTERRUPTED','NOT PLACED','invented-state',''])for(const reasons of [[],['phone unclear'],['ticket unclear']])assert.equal(t.ctx.needsReview_(reasons,state),true);
  assert.equal(t.ctx.needsReview_([], 'Homer Glen screens row 2'),false);
  assert.equal(t.ctx.needsReview_(['phone unclear'],'RESCAN'),false);
  assert.equal(t.ctx.needsReview_(['unposted additional labor'],'RESCAN'),true);
  assert.equal(t.ctx.needsReview_(null,'Homer Glen screens row 2'),true);
});
test('ticket hints stay literal and tint only the ticket in both layouts',()=>{
  for(const modern of [false,true]){const {t,sh,c}=fixture(modern),r=rpc(t,{ticket_number:'980001'});
    assert.equal(r.needsReview,false);assert.doesNotMatch(r.message,/Check on the sheet:/);assert.equal(sh.get(2,c.TICKET),'980001');
    assert.equal(sh.bg.get('2,'+c.TICKET),t.ctx.HINT_COLOR);assert.notEqual(sh.bg.get('2,'+c.DATE_IN),t.ctx.FLAG_COLOR);
    assert.match(sh.notes.get('2,'+c.TICKET),/6 digits/);assert.equal(marked(t),'');assert.match(reason(t),/6 digits/);
  }
});
test('invalid dates remain blank with a visible Date in hint rather than a row warning',()=>{
  const {t,sh,c}=fixture(),r=rpc(t,{date:'2/30/2026'});assert.equal(sh.get(2,c.DATE_IN),'');
  assert.equal(sh.bg.get('2,'+c.DATE_IN),t.ctx.HINT_COLOR);assert.match(sh.notes.get('2,'+c.DATE_IN),/invalid/);
  assert.equal(r.needsReview,false);assert.equal(marked(t),'');assert.equal(t.ss.tabs.Scans.get(2,t.ctx.COL.DATE),'2/30/2026');
});
test('a missing name is a visible name-cell hint without inventing an identity',()=>{
  const {t,sh,c}=fixture(),r=rpc(t,{customer_name:null,last_name:null});assert.equal(sh.get(2,c.NAME),'');
  assert.equal(sh.bg.get('2,'+c.NAME),t.ctx.HINT_COLOR);assert.match(sh.notes.get('2,'+c.NAME),/No customer name/);assert.equal(r.needsReview,false);
});
test('unverified sequence hints use the sequence column and preserve Date out and Ticket',()=>{
  const {t,sh,c}=fixture(true),r=rpc(t,{tag_index:4,tag_count:3});assert.equal(sh.get(2,c.SEQUENCE),'');
  assert.equal(sh.bg.get('2,'+c.SEQUENCE),t.ctx.HINT_COLOR);assert.match(sh.notes.get('2,'+c.SEQUENCE),/could not be verified/);
  assert.equal(typeof sh.get(2,c.DATE_OUT),'number');assert.equal(sh.get(2,c.TICKET),'9800001');assert.equal(r.needsReview,false);
});
test('phone-only uncertainty is retained in Scans without store paint or phone warning',()=>{
  const {t,sh,c}=fixture(),r=rpc(t,{phone:'2025550100'});assert.equal(r.needsReview,false);assert.equal(marked(t),'');
  assert.match(reason(t),/Area code 202/);assert.equal(sh.notes.get('2,'+c.NAME),undefined);assert.equal(sh.bg.get('2,'+c.DATE_IN),undefined);
  assert.equal(t.ss.tabs.Scans.bg.get('2,1'),null);
});
test('a money issue plus phone uncertainty retains the row warning and full log reasons',()=>{
  const {t,sh,c}=fixture(),r=rpc(t,{phone:'2025550100',billable_inches:114});assert.equal(r.needsReview,true);
  assert.match(r.message,/Check on the sheet:/);assert.equal(marked(t),'YES');assert.equal(sh.get(2,c.UNI_IN),'');
  assert.equal(sh.bg.get('2,'+c.DATE_IN),t.ctx.FLAG_COLOR);assert.match(sh.notes.get('2,'+c.NAME),/Inches/);
  assert.match(reason(t),/Area code 202/);assert.match(reason(t),/Inches/);
});
test('a cell hint cannot make an existing money-row tint paler',()=>{
  const {t,sh,c}=fixture();rpc(t,{ticket_number:'980001',billable_inches:114});
  assert.equal(sh.bg.get('2,'+c.TICKET),t.ctx.FLAG_COLOR);assert.match(sh.notes.get('2,'+c.TICKET),/6 digits/);
  assert.match(sh.notes.get('2,'+c.NAME),/Inches/);assert.equal(marked(t),'YES');
});
test('unknown reasons fail closed to row review',()=>{
  const {t,sh,c}=fixture(),r=rpc(t,{unclear:['Invented wholly unrecognized warning']});assert.equal(r.needsReview,true);
  assert.equal(sh.bg.get('2,'+c.DATE_IN),t.ctx.FLAG_COLOR);assert.equal(marked(t),'YES');
});
test('SKU handwriting details cannot suppress the actual uncertain-parts hold',()=>{
  const {t,sh,c}=fixture(),r=rpc(t,{extras:'4 580401 Corners',unclear:['sku handwriting unclear'],
    parts:[{sku:'580401',quantity:4,unit:'each',group_wide:false,raw:'4 580401 Corners'}]});
  assert.equal(r.needsReview,true);assert.equal(sh.get(2,c.EARNING),'');assert.equal(marked(t),'YES');assert.match(reason(t),/earnings need manual review/);
});
test('a metadata-only exact rescan stays quiet and does not change the original store row',()=>{
  const {t,sh}=fixture();rpc(t,{ticket_number:'980001'});const cells=new Map(sh.cells),notes=new Map(sh.notes),bg=new Map(sh.bg);
  const r=rpc(t,{ticket_number:'980001'});assert.match(r.message,/Already scanned/);assert.equal(r.needsReview,false);assert.equal(marked(t,3),'');
  assert.deepEqual(sh.cells,cells);assert.deepEqual(sh.notes,notes);assert.deepEqual(sh.bg,bg);assert.match(reason(t,3),/this exact tag was already scanned/);
});
test('a prior legacy review flag is not silently reinterpreted or cleared on a rescan',()=>{
  const {t,sh}=fixture();rpc(t);const log=t.ss.tabs.Scans;log.set(2,t.ctx.HEADERS.indexOf('Needs Review')+1,'YES');
  const before=new Map(sh.cells),r=rpc(t);assert.equal(r.needsReview,true);assert.equal(marked(t),'YES');
  assert.match(reason(t,3),/Earlier placed scan remains marked/);assert.deepEqual(sh.cells,before);
});
test('unposted parts on an enriched rescan still require row-level reconciliation',()=>{
  const {t,sh,c}=fixture();rpc(t);const r=rpc(t,{extras:'4 580401 Corners',parts:[{sku:'580401',quantity:4,unit:'each',group_wide:false,raw:'4 580401 Corners'}]});
  assert.equal(r.needsReview,true);assert.match(r.message,/still needs checking/);assert.equal(marked(t,3),'YES');assert.equal(sh.get(2,c.EARNING),'');assert.equal(sh.get(3,c.TICKET),'');
});
test('unplaced scans remain orange and counted even if their original doubt was metadata',()=>{
  const {t}=fixture(),r=rpc(t,{store:'Invented unknown store',phone:'2025550100'});assert.equal(r.needsReview,true);assert.equal(marked(t),'YES');
  assert.equal(t.ss.tabs.Scans.bg.get('2,1'),t.ctx.UNPLACED_COLOR);assert.match(rpc(t,{ticket_number:'9800002'}).message,/1 earlier tag/);
});
test('pending/interrupted saves retain their review journal and reconciliation count',()=>{
  const {t}=fixture(),write=t.ctx.writeToStoreTab_;t.ctx.writeToStoreTab_=(...args)=>{
    assert.equal(marked(t),'YES');assert.equal(t.ss.tabs.Scans.get(2,t.ctx.COL.WRITTEN_TO),'PENDING');write(...args);throw Error('Invented interrupted save');};
  assert.equal(rpc(t).status,'error');assert.equal(marked(t),'YES');assert.equal(t.ss.tabs.Scans.get(2,t.ctx.COL.WRITTEN_TO),'INTERRUPTED');
  t.ctx.writeToStoreTab_=write;assert.match(rpc(t,{ticket_number:'9800002'}).message,/1 earlier tag/);
});
test('new hints never repaint or rewrite pre-existing store history',()=>{
  const {t,sh,c}=fixture();sh.set(2,c.TICKET,'OLD-SYNTHETIC');sh.set(2,c.NAME,'Invented history');sh.bg.set('2,'+c.NAME,'#abcabc');sh.notes.set('2,'+c.NAME,'Existing manual note');
  sh.notes.set('3,'+c.TICKET,'Manual note on the next blank row');
  rpc(t,{ticket_number:'980001'});assert.equal(sh.get(2,c.NAME),'Invented history');assert.equal(sh.bg.get('2,'+c.NAME),'#abcabc');assert.equal(sh.notes.get('2,'+c.NAME),'Existing manual note');
  assert.equal(sh.get(3,c.TICKET),'980001');
  assert.match(sh.notes.get('3,'+c.TICKET),/^Manual note on the next blank row\n\nGlance at this value:/);
});
test('settled QTY evidence stays a money-row warning under the new display tiers',()=>{
  const {t,sh,c}=fixture(),r=rpc(t,{width_in:36,height_in:42,billable_inches:79,qty_rows:'78,78,78',line_totals:''});
  assert.equal(sh.get(2,c.UNI_IN),78);assert.equal(r.needsReview,true);assert.equal(marked(t),'YES');assert.equal(sh.bg.get('2,'+c.DATE_IN),t.ctx.FLAG_COLOR);
});
console.log(passed+' review-tier tests passed');
