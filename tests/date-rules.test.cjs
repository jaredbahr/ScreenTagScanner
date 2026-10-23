'use strict';const assert=require('node:assert/strict');const {load,BASE}=require('./offline.test.cjs');let passed=0;
const serial=s=>{const [y,m,d]=s.split('-').map(Number);return Date.UTC(y,m-1,d)/86400000+25569;};
function test(name,fn){fn();passed++;console.log('PASS '+name);}
test('Date in uses written tag date while Date out uses scan day, on screens and windows',()=>{
  for(const item_type of ['screen','window']){const t=load();t.scan({item_type,panes:1,date:'9/21/2024'});const sh=t.ss.tabs['Homer Glen'];
    assert.equal(sh.get(2,item_type==='screen'?2:14),serial('2024-09-21'));assert.equal(sh.get(2,item_type==='screen'?4:16),serial('2026-10-12'));
    assert.equal(t.ss.tabs.Scans.get(2,t.ctx.COL.DATE),'9/21/2024','raw tag text preserved');
  }
});
test('missing year is the admission Chicago calendar year, including UTC New Year boundary',()=>{
  const t=load({now:new Date('2027-01-01T05:30:00Z')});t.scan({date:'12/30'});
  assert.equal(t.ss.tabs['Homer Glen'].get(2,2),serial('2026-12-30'));assert.equal(t.ss.tabs['Homer Glen'].get(2,4),serial('2026-12-31'));
});
test('missing year always stays the current scan year even when month/day is later, numeric or named',()=>{
  for(const date of ['12/31','Dec 31']){const t=load({now:new Date('2027-01-01T06:30:00Z')});t.scan({date});const sh=t.ss.tabs['Homer Glen'];
    assert.equal(sh.get(2,2),serial('2027-12-31'));assert.equal(sh.get(2,4),serial('2027-01-01'));assert.match(sh.notes.get('2,2'),/after the scan date/);assert.doesNotMatch(sh.notes.get('2,2'),/used 2026/);}
  const u=load({now:new Date('2027-01-04T18:00:00Z')});u.scan({date:'10/8'});assert.equal(u.ss.tabs['Homer Glen'].get(2,2),serial('2027-10-08'));
  const v=load();v.scan({date:'10/8'});assert.equal(v.ss.tabs['Homer Glen'].get(2,2),serial('2026-10-08'),'same-year date unchanged');
});
test('an explicit future year is kept and flagged, never changed',()=>{
  const t=load();t.scan({date:'12/1/2026'});const sh=t.ss.tabs['Homer Glen'];
  assert.equal(sh.get(2,2),serial('2026-12-01'));assert.match(sh.notes.get('2,2'),/after the scan date/);
});
test('two-digit year for this year or last year is accepted without a flag',()=>{
  for(const date of ['10/8/26','12/30/25']){const t=load();t.scan({date});const sh=t.ss.tabs['Homer Glen'];
    assert.equal(sh.get(2,2),serial(date==='10/8/26'?'2026-10-08':'2025-12-30'),date);assert.equal(sh.notes.get('2,2'),undefined,date);}
});
test('written month names are read (Oct 8, Sept 21, October 7 2026)',()=>{
  for(const [date,want] of [['Oct 8','2026-10-08'],['Sept 21','2026-09-21'],['October 7, 2026','2026-10-07'],['oct-8','2026-10-08']]){
    const t=load();t.scan({date});assert.equal(t.ss.tabs['Homer Glen'].get(2,2),serial(want),date);
  }
  const t=load();t.scan({date:'Octember 8'});assert.equal(t.ss.tabs['Homer Glen'].get(2,2),'');
});
test('explicit year is retained across a year boundary; ISO dates also work',()=>{
  for(const date of ['12/31/2024','2024-12-31']){const t=load({now:new Date('2027-01-01T06:30:00Z')});t.scan({date});assert.equal(t.ss.tabs['Homer Glen'].get(2,2),serial('2024-12-31'));}
});
test('valid leap date works only in its actual year',()=>{
  const t=load();t.scan({date:'2/29/2024'});assert.equal(t.ss.tabs['Homer Glen'].get(2,2),serial('2024-02-29'));
  const u=load({now:new Date('2025-03-01T18:00:00Z')});u.scan({date:'2/29'});assert.equal(u.ss.tabs['Homer Glen'].get(2,2),'');assert.match(u.ss.tabs['Homer Glen'].notes.get('2,2'),/invalid/);
});
test('a missing-year leap date uses the current leap year, never an invalid previous year',()=>{
  for(const item_type of ['screen','window']){const t=load({now:new Date('2028-01-04T18:00:00Z')});t.scan({item_type,panes:1,date:'2/29'});const sh=t.ss.tabs['Homer Glen'],c=t.ctx.storeLayout_(sh)[item_type==='screen'?'screens':'windows'];
    assert.equal(sh.get(2,c.DATE_IN),serial('2028-02-29'));assert.equal(sh.get(2,c.DATE_OUT),serial('2028-01-04'));assert.match(sh.notes.get('2,'+c.DATE_IN),/after the scan date/);
  }
});
test('missing, invalid and unsupported dates stay blank with review instead of becoming scan date',()=>{
  for(const date of [null,'','2/29/2025','4/31/2026','13/1','0/10','10/0','31/10/2026','unreadable','2026-02-30']){
    const t=load();const r=t.scan({date});const sh=t.ss.tabs['Homer Glen'];assert.equal(sh.get(2,2),'',String(date));assert.equal(sh.get(2,4),serial('2026-10-12'));assert.match(sh.notes.get('2,2'),/Date in left blank/);assert.doesNotMatch(r.message,/Check on the sheet:/);assert.equal(sh.bg.get('2,2'),t.ctx.HINT_COLOR);
  }
});
test('a two-digit year older than last year keeps 20YY but flags a century check',()=>{
  const t=load();t.scan({date:'10/8/24'});assert.equal(t.ss.tabs['Homer Glen'].get(2,2),serial('2024-10-08'));assert.match(t.ss.tabs['Homer Glen'].notes.get('2,2'),/verify the century/);
});
test('date serials do not move when spreadsheet timezone differs',()=>{
  const t=load();t.ss.tz='America/Los_Angeles';t.scan({date:'10/8/2024'});assert.equal(t.ss.tabs['Homer Glen'].get(2,2),serial('2024-10-08'));assert.equal(t.ss.tabs['Homer Glen'].get(2,4),serial('2026-10-12'));
});
test('an extraction that finishes after midnight still uses the admitted scan day/year',()=>{
  const t=load({now:new Date('2027-01-01T05:59:59Z')});t.ctx.extractTag_=()=>{t.setNow(new Date('2027-01-01T06:00:01Z'));return {...BASE,date:'12/30'};};
  t.ctx.scanTag({token:'t',image:'/9j/AP/Z'});assert.equal(t.ss.tabs['Homer Glen'].get(2,2),serial('2026-12-30'));assert.equal(t.ss.tabs['Homer Glen'].get(2,4),serial('2026-12-31'));
});
test('multi-frame build rows share the same preserved tag-in and scan-out dates',()=>{
  const t=load();t.scan({date:'8/30/2024',form_type:'new_build',screens_on_tag:2});const sh=t.ss.tabs['Homer Glen'];for(const r of [2,3]){assert.equal(sh.get(r,2),serial('2024-08-30'));assert.equal(sh.get(r,4),serial('2026-10-12'));}
});
console.log(`${passed} date-policy tests passed`);
