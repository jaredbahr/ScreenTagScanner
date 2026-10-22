'use strict';
const assert=require('node:assert/strict');
const {fixture,req}=require('./month-rollover.test.cjs');
const {BASE}=require('./offline.test.cjs');
let passed=0;
function test(n,fn){fn();passed++;console.log('PASS archive: '+n);}
function archiveFixture(){
  const t=fixture({archive:true});
  t.files.get('S').name='Screens 2026-09';
  t.monthFolder.getId=()=> 'F';t.root.getId=()=> 'ROOT';
  t.controls.pdf='%PDF-1.4\n1 0 obj <</Type /Page /Parent 2 0 R>> endobj\n2 0 obj <</Type /Pages /Count 1>>endobj\n%%EOF';
  function decorate(f,parent,mime){Object.assign(f,{parent,mime,trashed:false,getParents(){let done=false;return {hasNext:()=>!done,next:()=>{done=true;return this.parent;}};},getMimeType(){return this.mime;},getSize:()=>100,isTrashed(){return this.trashed;},setTrashed(v){this.trashed=v;}});return f;}
  class ScratchSheet {
    constructor(ss,name){this.ss=ss;this.name=name;this.values=[];this.maxColumns=8;}
    getName(){return this.name;}setName(n){this.name=n;return this;}getSheetId(){return 77;}
    getMaxColumns(){return this.maxColumns;}insertColumnsAfter(c,n){this.maxColumns+=n;}
    insertRowBefore(n){assert.equal(n,1);this.inserted=true;}
    setRowHeight(r,h){this.height=h;}setFrozenRows(n){}setFrozenColumns(n){}
    getRange(r,c,rows,cols){const sh=this;const chain={getMergedRanges(){return t.controls.wideMerge?[{getLastColumn:()=>11,breakApart(){t.operations.unmerged=true;}}]:[];},setValues(v){sh.values=v;return chain;},breakApart(){return chain;},clearContent(){return chain;},merge(){return chain;},setValue(v){sh.heading=v;return chain;},setFontSize(){return chain;},setFontWeight(){return chain;},setHorizontalAlignment(){return chain;},setWrap(){return chain;}};return chain;}
  }
  const vals=[['P & K Window & Screen Repair OLD','','','','','','',''],['Synthetic labor',123.45,'=literal','','','','','']];
  const source=t.ss.tabs.Totals;
  t.totalsValues=vals;
  source.getDataRange=()=>({getValues:()=>vals.map(r=>r.slice()),getDisplayValues:()=>t.controls.formulaError?[['#REF!']]:vals.map(r=>r.map(String))});
  source.copyTo=ss=>{t.operations.snapshotCopies=(t.operations.snapshotCopies||0)+1;const sh=new ScratchSheet(ss,'Copy of Totals');ss.tabs.push(sh);return sh;};
  t.ctx.SpreadsheetApp.create=name=>{
    t.operations.tempCreates=(t.operations.tempCreates||0)+1;
    if(t.controls.tempFail)throw Error('Synthetic temporary create failure');
    const id='TEMP',ss={getId:()=>id,tabs:[],getSheets(){return this.tabs.slice();},getSheetByName(n){return this.tabs.find(s=>s.name===n);},deleteSheet(sh){this.tabs=this.tabs.filter(s=>s!==sh);}};
    ss.tabs.push(new ScratchSheet(ss,'Sheet1'));t.sheets.set(id,ss);t.files.set(id,decorate(t.file(id,name),t.root,'application/vnd.google-apps.spreadsheet'));
    if(t.controls.tempAfterThrow)throw Error('Synthetic uncertain temp response');return ss;
  };
  t.ctx.ScriptApp={getOAuthToken:()=> 'synthetic-ephemeral-token'};
  t.ctx.UrlFetchApp.fetch=(url,options)=>{t.operations.exports=(t.operations.exports||0)+1;t.exportUrl=url;
    assert.equal(t.props.SHEET_ID,'S','export must happen before switch');
    assert.match(options.headers.Authorization,/^Bearer /);
    const blob={name:'',getContentType:()=>t.controls.mime||'application/pdf',getDataAsString:()=>t.controls.pdf,setName(n){this.name=n;return this;}};
    return {getResponseCode:()=>t.controls.http||200,getBlob:()=>blob};
  };
  t.monthFolder.createFile=blob=>{
    t.operations.pdfCreates=(t.operations.pdfCreates||0)+1;
    if(t.controls.pdfFail)throw Error('Synthetic PDF create failure');
    const f=decorate(t.file('PDF',blob.name),t.monthFolder,'application/pdf');f.editors.push(...t.monthFolder.editors);f.viewers.push(...t.monthFolder.viewers);t.files.set('PDF',f);
    if(t.controls.pdfAfterThrow)throw Error('Synthetic uncertain PDF response');return f;
  };
  return t;
}
test('archives September heading, Totals only, one-page export, values not formulas; source retained',()=>{
  const t=archiveFixture(),old=new Map(t.ss.tabs.Totals.cells),r=t.ctx.startMonth(req());
  assert.equal(r.status,'ok',r.message);assert.equal(t.props.SHEET_ID,'C1');
  assert.equal(t.files.get('PDF').name,'P & K Window & Screen Repair September 2026 Totals.pdf');
  assert.equal(t.files.get('PDF').parent,t.monthFolder);
  const sh=t.sheets.get('TEMP').getSheetByName('Archive Totals');
  assert.equal(sh.heading,'P & K Window & Screen Repair September 2026');assert.equal(sh.values[1][1],123.45);assert.equal(sh.values[1][2],"'=literal");assert.equal(sh.inserted,undefined);
  const url=new URL(t.exportUrl);assert.equal(url.searchParams.get('gid'),'77');assert.equal(url.searchParams.get('scale'),'4');assert.equal(url.searchParams.get('r2'),'2');assert.equal(url.searchParams.get('sheetnames'),'false');
  assert.deepEqual(t.ss.tabs.Totals.cells,old);assert.equal(t.files.get('TEMP').trashed,true);assert.equal(t.files.get('S').name,'Screens 2026-09');
  assert.equal(t.ctx.startMonth(req()).alreadyActive,true);assert.equal(t.operations.pdfCreates,1);assert.equal(t.operations.copies,1);
  assert.equal(JSON.parse(t.props.MONTH_ROLLOVER_2026_11).archivedMonth,'2026-09');
});
test('year-boundary heading comes from actual archived month',()=>{const t=archiveFixture();assert.equal(t.ctx.monthArchiveHeading_('2026-12'),'P & K Window & Screen Repair December 2026');assert.throws(()=>t.ctx.monthArchiveHeading_('2026-13'));});
test('unknown prior month, backwards target, missing folder/Totals fail before copy',()=>{
  for(const mode of ['unknown','backwards','folder','totals']){const t=archiveFixture();if(mode==='unknown')t.files.get('S').name='Screens TEST';if(mode==='backwards')t.files.get('S').name='Screens 2026-12';if(mode==='folder')delete t.props.MONTH_FOLDER_ID;if(mode==='totals')delete t.ss.tabs.Totals;
    assert.equal(t.ctx.startMonth(req()).status,'error',mode);assert.equal(t.operations.copies,0);assert.equal(t.props.SHEET_ID,'S');}
});
test('in-flight scan blocks rollover immediately; finally releases on success and invalid image',()=>{
  const t=archiveFixture();const extract=t.ctx.extractTag_;
  t.ctx.extractTag_=(...args)=>{const r=t.ctx.startMonth(req());assert.equal(r.status,'error');assert.match(r.message,/still finishing/);assert.equal(t.operations.copies,0);return extract(...args);};
  t.ctx.scanTag({token:'t',image:'/9j/AP/Z'});assert.equal(Object.keys(JSON.parse(t.props.MONTH_SCAN_LEASES)).length,0);
  t.ctx.scanTag({token:'t',image:'invalid'});assert.equal(Object.keys(JSON.parse(t.props.MONTH_SCAN_LEASES)).length,0);
  assert.equal(t.ctx.startMonth(req()).status,'ok');
});
test('malformed scan leases fail closed',()=>{
  for(const raw of ['[]','{"bad":null}']){const t=archiveFixture();t.props.MONTH_SCAN_LEASES=raw;assert.equal(t.ctx.startMonth(req()).status,'error');assert.equal(t.operations.copies,0);}
});
test('export errors and multi-page PDFs never switch; retry reuses scratch/copy',()=>{
  for(const mode of ['http','mime','pages','formulaError']){const t=archiveFixture();if(mode==='http')t.controls.http=503;if(mode==='mime')t.controls.mime='text/html';if(mode==='pages')t.controls.pdf+='/Type /Page';if(mode==='formulaError')t.controls.formulaError=true;
    const r=t.ctx.startMonth(req());assert.equal(r.status,'error',mode);assert.equal(t.props.SHEET_ID,'S');assert.equal(t.operations.pdfCreates||0,0);assert.ok(t.props.ROLLOVER_PENDING);
    delete t.controls.http;delete t.controls.mime;delete t.controls.formulaError;t.controls.pdf='%PDF-1.4 /Type /Page';
    assert.equal(t.ctx.startMonth(req()).status,'ok');assert.equal(t.operations.copies,1);assert.equal(t.operations.tempCreates,1);assert.equal(t.operations.pdfCreates,1);}
});
test('uncertain scratch creation reuses named scratch, never blindly retries an absent result',()=>{
  for(const control of ['tempAfterThrow','tempFail']){const t=archiveFixture();t.controls[control]=true;assert.equal(t.ctx.startMonth(req()).status,'error');t.controls[control]=false;
    const r=t.ctx.startMonth(req());assert.equal(r.status,control==='tempAfterThrow'?'ok':'error',r.message);assert.equal(t.operations.tempCreates,1);assert.equal(t.operations.copies,1);}
});
test('uncertain PDF creation recovers same named PDF; absent result blocks duplicate',()=>{
  for(const control of ['pdfAfterThrow','pdfFail']){const t=archiveFixture();t.controls[control]=true;assert.equal(t.ctx.startMonth(req()).status,'error');assert.equal(t.props.SHEET_ID,'S');t.controls[control]=false;
    const r=t.ctx.startMonth(req());assert.equal(r.status,control==='pdfAfterThrow'?'ok':'error',r.message);assert.equal(t.operations.pdfCreates,1);assert.equal(t.operations.exports,1);assert.equal(t.operations.copies,1);}
});
test('archive name collision is never silently adopted',()=>{
  const t=archiveFixture();t.files.set('OTHER',Object.assign(t.file('OTHER','P & K Window & Screen Repair September 2026 Totals.pdf'),{parent:t.monthFolder}));
  assert.match(t.ctx.startMonth(req()).message,/already exists/);assert.equal(t.props.SHEET_ID,'S');assert.equal(t.operations.pdfCreates||0,0);
});
test('switch/bookkeeping failures recover without another PDF or losing manual new-month edits',()=>{
  for(const key of ['SHEET_ID','CURRENT_WORKBOOK_MONTH']){const t=archiveFixture();let once=true;
    t.ctx.PropertiesService.getScriptProperties=()=>({getProperty:k=>t.props[k]??null,setProperty:(k,v)=>{if(k===key&&once){once=false;throw Error('Synthetic write failure');}t.props[k]=v;},deleteProperty:k=>{delete t.props[k];}});
    assert.equal(t.ctx.startMonth(req()).status,'error');if(key==='CURRENT_WORKBOOK_MONTH')t.sheets.get('C1').tabs['Homer Glen'].set(2,3,'Manual new data');
    assert.equal(t.ctx.startMonth(req()).status,'ok');assert.equal(t.operations.pdfCreates,1);assert.equal(t.operations.exports,1);assert.equal(t.operations.copies,1);
    if(key==='CURRENT_WORKBOOK_MONTH')assert.equal(t.sheets.get('C1').tabs['Homer Glen'].get(2,3),'Manual new data');}
});
test('inserts missing heading and handles an existing title merged wider than populated data',()=>{
  const t=archiveFixture();t.totalsValues[0][0]='Synthetic first data row';t.controls.wideMerge=true;
  const r=t.ctx.startMonth(req());assert.equal(r.status,'ok',r.message);
  const sh=t.sheets.get('TEMP').getSheetByName('Archive Totals');assert.equal(sh.inserted,true);assert.equal(sh.values[0][0],'Synthetic first data row');assert.equal(t.operations.unmerged,true);
  assert.equal(new URL(t.exportUrl).searchParams.get('c2'),'11');assert.equal(new URL(t.exportUrl).searchParams.get('r2'),'3');
});
test('PDF ID receipt failure recovers the one staged PDF; unsafe access blocks retry',()=>{
  const t=archiveFixture();let once=true;
  t.ctx.PropertiesService.getScriptProperties=()=>({getProperty:k=>t.props[k]??null,setProperty:(k,v)=>{if(k==='ROLLOVER_PENDING'&&JSON.parse(v).archive?.pdfId&&once){once=false;throw Error('Synthetic receipt failure');}t.props[k]=v;},deleteProperty:k=>{delete t.props[k];}});
  assert.equal(t.ctx.startMonth(req()).status,'error');assert.equal(t.operations.pdfCreates,1);assert.equal(t.props.SHEET_ID,'S');
  t.files.get('PDF').access='anyone_with_link';assert.equal(t.ctx.startMonth(req()).status,'error');assert.equal(t.props.SHEET_ID,'S');
  t.files.get('PDF').access='private';assert.equal(t.ctx.startMonth(req()).status,'ok');assert.equal(t.operations.pdfCreates,1);
});
test('lease cleanup failure preserves scan result and blocks rollover only while lease is live',()=>{
  const t=archiveFixture();t.ctx.PropertiesService.getScriptProperties=()=>({getProperty:k=>t.props[k]??null,setProperty:(k,v)=>{if(k==='MONTH_SCAN_LEASES'&&v==='{}')throw Error('Synthetic lease cleanup failure');t.props[k]=v;},deleteProperty:k=>{delete t.props[k];}});
  const r=t.ctx.scanTag({token:'t',image:'invalid'});assert.equal(r.status,'error');assert.match(r.message,/JPEG/);
  assert.equal(Object.keys(JSON.parse(t.props.MONTH_SCAN_LEASES)).length,1);assert.match(t.ctx.startMonth(req()).message,/still finishing/);assert.equal(t.operations.copies,0);
});
test('independent in-flight leases release individually and protect against overlapping scans',()=>{
  const t=archiveFixture();let next=0;t.ctx.Utilities.getUuid=()=> 'synthetic-lease-'+(++next);const p=t.ctx.PropertiesService.getScriptProperties(),a={},b={};
  assert.equal(t.ctx.admitScan_(p,a),'');assert.equal(t.ctx.admitScan_(p,b),'');assert.notEqual(a.leaseId,b.leaseId);
  t.ctx.releaseMonthScan_(p,a.leaseId);assert.match(t.ctx.startMonth(req()).message,/still finishing/);assert.equal(t.operations.copies,0);
  t.ctx.releaseMonthScan_(p,b.leaseId);assert.equal(t.ctx.startMonth(req()).status,'ok');
});
test('forty orphan leases expire without blocking future scans or rollover',()=>{
  const t=archiveFixture(),old={};for(let i=0;i<40;i++)old['old-'+i]={sheetId:'S',started:t.ctx.Date.now()-600000};t.props.MONTH_SCAN_LEASES=JSON.stringify(old);
  assert.equal(t.ctx.scanTag({token:'t',image:'invalid'}).status,'error');assert.deepEqual(JSON.parse(t.props.MONTH_SCAN_LEASES),{});
  assert.equal(t.ctx.startMonth(req()).status,'ok');
});
test('an expired scan is fenced from old workbook after rollover, even if execution resumes',()=>{
  const t=archiveFixture(),p=t.ctx.PropertiesService.getScriptProperties(),admitted={};assert.equal(t.ctx.admitScan_(p,admitted),'');
  const sourceCells=new Map(t.ss.tabs['Homer Glen'].cells);
  t.setNow(new Date(t.ctx.Date.now()+600000));assert.equal(t.ctx.startMonth(req()).status,'ok');
  assert.throws(()=>t.ctx.saveScan_({},'Synthetic',[],'','late',admitted.sheetId,admitted.leaseId),/Expired scan admission/);
  assert.deepEqual(t.ss.tabs['Homer Glen'].cells,sourceCells);assert.equal(t.props.SHEET_ID,'C1');
});
test('unexpired lease with wrong workbook or missing ID cannot write; boundaries are exact',()=>{
  const t=archiveFixture(),p=t.ctx.PropertiesService.getScriptProperties(),admitted={};t.ctx.admitScan_(p,admitted);
  assert.throws(()=>t.ctx.saveScan_({},'Synthetic',[],'','wrong','T',admitted.leaseId),/Expired scan admission/);
  assert.throws(()=>t.ctx.saveScan_({},'Synthetic',[],'','missing','S'),/Expired scan admission/);
  t.setNow(new Date(t.ctx.Date.now()+599999));assert.match(t.ctx.startMonth(req()).message,/still finishing/);
  t.setNow(new Date(t.ctx.Date.now()+1));assert.equal(t.ctx.startMonth(req()).status,'ok');
});
test('uncertain admission-property write cleans only its own lease before returning',()=>{
  const t=archiveFixture();let once=true;t.props.MONTH_SCAN_LEASES=JSON.stringify({other:{sheetId:'S',started:t.ctx.Date.now()}});
  t.ctx.PropertiesService.getScriptProperties=()=>({getProperty:k=>t.props[k]??null,setProperty:(k,v)=>{t.props[k]=v;if(k==='MONTH_SCAN_LEASES'&&Object.keys(JSON.parse(v)).length===2&&once){once=false;throw Error('Synthetic persisted admission response loss');}},deleteProperty:k=>{delete t.props[k];}});
  const r=t.ctx.scanTag({token:'t',image:'/9j/AP/Z'});assert.equal(r.status,'error');assert.match(r.message,/limits/);assert.deepEqual(Object.keys(JSON.parse(t.props.MONTH_SCAN_LEASES)),['other']);assert.equal(t.fetches(),0);
});
test('scratch cleanup failure retains receipt ID and completed retry cleans it',()=>{
  const t=archiveFixture(),create=t.ctx.SpreadsheetApp.create;let once=true;
  t.ctx.SpreadsheetApp.create=(...args)=>{const ss=create(...args),file=t.files.get(ss.getId()),trash=file.setTrashed.bind(file);file.setTrashed=v=>{if(once){once=false;throw Error('Synthetic scratch cleanup failure');}trash(v);};return ss;};
  assert.equal(t.ctx.startMonth(req()).status,'ok');assert.equal(t.files.get('TEMP').trashed,false);assert.equal(JSON.parse(t.props.MONTH_ROLLOVER_2026_11).archiveTempId,'TEMP');
  assert.equal(t.ctx.startMonth(req()).alreadyActive,true);assert.equal(t.files.get('TEMP').trashed,true);assert.equal(t.operations.pdfCreates,1);
});
test('scan writes flush before releasing writer lock; flush failure cannot report success',()=>{
  for(const fail of [false,true]){const t=archiveFixture(),events=[],make=t.ctx.LockService.getScriptLock;t.ctx.extractTag_=()=>({...BASE});
    t.ctx.LockService.getScriptLock=()=>{const lock=make();return {waitLock(n){lock.waitLock(n);events.push('acquire');},releaseLock(){events.push('release');lock.releaseLock();}};};
    t.ctx.SpreadsheetApp.flush=()=>{events.push('flush');if(fail)throw Error('Synthetic flush failure');};
    const r=t.ctx.scanTag({token:'t',image:'/9j/AP/Z'});assert.equal(r.status,fail?'error':'ok',r.message);
    const index=events.indexOf('flush');assert.ok(index>=0);assert.equal(events[index-1],'acquire');assert.equal(events[index+1],'release');
    assert.equal(Object.keys(JSON.parse(t.props.MONTH_SCAN_LEASES)).length,0);
    if(fail)assert.match(r.message,/could not be confirmed/);
  }
});
console.log(`${passed} archive tests passed`);
