'use strict';
const assert=require('node:assert/strict');const {load,workbook,BASE}=require('./offline.test.cjs');let passed=0;
function test(name,fn){fn();passed++;console.log('PASS '+name);}
function fixture(options={}){
  const t=load();t.props.MONTH_FOLDER_ID='F';t.ctx.pauseTagSequenceScans_();const plan=t.ctx.previewTagSequenceMigration_();
  t.props.TAG_SEQUENCE_APPROVED_PLAN=plan.approvalCode;t.props.TAG_SEQUENCE_DRAIN_CONFIRMED=plan.approvalCode;
  t.ctx.applyTagSequenceMigration_();t.ctx.resumeTagSequenceScans_();
  const sheets=new Map([['S',t.ss],['T',t.template]]),files=new Map(),operations={copies:0,reads:0};
  const controls={};
  function clone(source,id){const ss=workbook();ss.id=id;Object.keys(ss.tabs).forEach(name=>delete ss.tabs[name]);
    for(const [name,original] of Object.entries(source.tabs)){
      const sh=ss.tabs[name]||ss.insertSheet(name);
      for(const key of ['cells','notes','bg','validations','formats','widths'])sh[key]=new Map(original[key]);
      sh.maxRows=original.maxRows;sh.maxColumns=original.maxColumns;sh.frozenColumns=original.frozenColumns;sh.frozenRows=original.frozenRows;sh.merges=original.merges.map(x=>({...x}));sh.ss=ss;
    }return ss;
  }
  function file(id,name){return {id,name,editors:[],viewers:[],access:'private',getId(){return this.id;},getName(){return this.name;},
    getUrl(){return 'https://docs.google.com/spreadsheets/d/'+this.id+'/edit';},setName(n){this.name=n;},
    getOwner:()=>({getEmail:()=> 'synthetic-owner@example.invalid'}),getEditors(){return this.editors;},
    addEditor(e){operations.shares=(operations.shares||0)+1;if(controls.shareFail)throw Error('Synthetic sharing failure');this.editors.push({getEmail:()=>e});return this;},getViewers(){return this.viewers;},getSharingAccess(){return this.access;},
    makeCopy(n,destination){operations.copies++;assert.ok(destination===root||destination===monthFolder);if(controls.createFail)throw Error('Synthetic copy failure');
      const id='C'+operations.copies,copy=file(id,n),ss=clone(sheets.get(this.id),id);files.set(id,copy);sheets.set(id,ss);copy.parent=destination;
      if(destination===monthFolder)copy.editors.push(...monthFolder.editors);
      if(controls.copiedDirty)ss.tabs['Homer Glen'].set(2,3,'Synthetic dirty copy');
      if(controls.sharedCopy)copy.editors.push({getEmail:()=> 'synthetic-editor@example.invalid'});
      if(controls.afterCreateThrow)throw Error('Synthetic uncertain copy result');return copy;
    }};}
  files.set('S',file('S','Screens 2026-10'));files.set('T',file('T','Screens TEMPLATE (do not edit)'));
  const lookup=parent=>n=>{const found=[...files.values()].filter(f=>f.name===n&&(f.parent||root)===parent);let i=0;return {hasNext:()=>i<found.length,next:()=>found[i++]};};
  const root={getFilesByName:lookup(null)};root.getFilesByName=lookup(root);
  const monthFolder={access:'private',editors:[],viewers:[],getName:()=>'Screens',getSharingAccess(){return this.access;},getEditors(){return this.editors;},getViewers(){return this.viewers;}};
  monthFolder.getFilesByName=lookup(monthFolder);
  t.ctx.DriveApp={Access:{PRIVATE:'private'},getRootFolder:()=>root,getFolderById:id=>{if(id!=='F')throw Error('Missing synthetic folder');return monthFolder;},getFileById:id=>{operations.reads++;if(!files.has(id))throw Error('Missing synthetic file');return files.get(id);}};
  t.ctx.SpreadsheetApp.openById=id=>{if(!sheets.has(id))throw Error('Missing synthetic workbook');return sheets.get(id);};
  // These regression cases isolate existing workbook rollover. Full real archive helper coverage
  // lives in month-archive.test.cjs, using the same fixture with archive:true.
  if(!options.archive)t.ctx.archiveMonthTotals_=(p,pending)=>{pending.archive={pdfId:'synthetic-pdf'};};
  // Existing rollover/archive suites isolate the PDF path. Full backup integration has its own suite.
  if(!options.backup)t.ctx.backupBeforeMonthSwitch_=()=>({status:'synthetic-backup-complete'});
  return Object.assign(t,{sheets,files,operations,controls,clone,file,monthFolder,root});
}
const req=overrides=>({token:'t',year:2026,month:11,expectedSheetId:'S',...overrides});
if(require.main===module){
test('wrong/missing token rejects all settings/rollover paths before file access',()=>{
  const t=fixture();for(const token of ['',null,undefined,'wrong',{},7]){
    assert.equal(t.ctx.getMonthSettings({token}).status,'error');assert.equal(t.ctx.startMonth(req({token})).status,'error');
  }assert.equal(t.operations.reads,0);assert.equal(t.operations.copies,0);assert.equal(t.props.SHEET_ID,'S');
});
test('settings returns current workbook/month with no creation or secret properties',()=>{
  const t=fixture(),r=t.ctx.getMonthSettings({token:'t'});assert.equal(r.status,'ok');assert.equal(r.currentName,'Screens 2026-10');assert.equal(r.currentId,'S');
  assert.equal(r.defaultMonth,11);assert.equal(r.defaultYear,2026);assert.equal(t.operations.copies,0);
  assert.doesNotMatch(JSON.stringify(r),/SHARED_TOKEN|ANTHROPIC_API_KEY/);
});
test('rollover copies the clean migrated template, verifies private access, preserves old files and switches only after success',()=>{
  const t=fixture();t.ss.tabs['Homer Glen'].set(2,3,'Existing synthetic job');const old=new Map(t.ss.tabs['Homer Glen'].cells);
  const r=t.ctx.startMonth(req());assert.equal(r.status,'ok');assert.equal(t.props.SHEET_ID,'C1');assert.equal(t.props.TEMPLATE_ID,'T');
  assert.equal(t.files.get('C1').name,'November 2026');assert.equal(t.files.size,3);assert.deepEqual(t.ss.tabs['Homer Glen'].cells,old);
  assert.equal(t.sheets.get('C1').tabs['Homer Glen'].get(2,3),'');assert.equal(t.sheets.get('C1').tabs['Homer Glen'].get(1,4),'Tag x of N');
  assert.equal(t.props.ROLLOVER_PENDING,undefined);assert.equal(t.mails.length,0);assert.equal(t.fetches(),0);
});
test('MONTH_EDITORS: the new month is shared with exactly the approved editors before it becomes active',()=>{
  const t=fixture();t.props.MONTH_EDITORS='Kirsten.Synthetic@Example.invalid, paul.synthetic@example.invalid';
  const settings=t.ctx.getMonthSettings({token:'t'});
  assert.match(settings.access,/shared \(Editor\) with: ki\*\*\*@example\.invalid, pa\*\*\*@example\.invalid/);
  assert.doesNotMatch(JSON.stringify(settings),/kirsten\.synthetic|paul\.synthetic/i,'full addresses never sent to the phone');
  const r=t.ctx.startMonth(req());assert.equal(r.status,'ok');assert.match(r.message,/Shared with 2 editors/);assert.equal(t.props.SHEET_ID,'C1');
  assert.deepEqual(t.files.get('C1').editors.map(u=>u.getEmail()),['kirsten.synthetic@example.invalid','paul.synthetic@example.invalid']);
  assert.equal(t.files.get('S').editors.length,0,'old workbook sharing untouched');assert.equal(t.files.get('T').editors.length,0,'template untouched');
  assert.equal(t.mails.length,0);
});
test('MONTH_EDITORS: a sharing failure never activates the copy; a retry finishes without a second copy or duplicate share',()=>{
  const t=fixture();t.props.MONTH_EDITORS='kirsten.synthetic@example.invalid';t.controls.shareFail=true;
  const r=t.ctx.startMonth(req());assert.equal(r.status,'error');assert.match(r.message,/Sharing the new workbook did not complete|Synthetic sharing failure/);
  assert.equal(t.props.SHEET_ID,'S');assert.ok(t.props.ROLLOVER_PENDING);
  t.controls.shareFail=false;const again=t.ctx.startMonth(req());assert.equal(again.status,'ok');assert.equal(t.props.SHEET_ID,'C1');
  assert.equal(t.operations.copies,1);assert.equal(t.files.get('C1').editors.length,1);
  t.ctx.startMonth(req());assert.equal(t.files.get('C1').editors.length,1,'repeat is a no-op');
});
test('MONTH_EDITORS: bad lists stop before any copy; unapproved access on a copy still blocks activation',()=>{
  for(const list of ['not-an-email','a@x.io,b@x.io,c@x.io,d@x.io,e@x.io,f@x.io']){
    const t=fixture();t.props.MONTH_EDITORS=list;assert.equal(t.ctx.startMonth(req()).status,'error',list);assert.equal(t.operations.copies,0);assert.equal(t.props.SHEET_ID,'S');
    assert.match(t.ctx.getMonthSettings({token:'t'}).access,/needs review/);
  }
  const t=fixture();t.props.MONTH_EDITORS='kirsten.synthetic@example.invalid';t.controls.sharedCopy=true;
  assert.equal(t.ctx.startMonth(req()).status,'error');assert.equal(t.props.SHEET_ID,'S');
});
test('MONTH_FOLDER_ID: new months are created in the shared folder and inherit its people',()=>{
  const t=fixture();t.props.MONTH_FOLDER_ID='F';t.monthFolder.editors.push({getEmail:()=> 'Kirsten.Synthetic@example.invalid'});
  assert.match(t.ctx.getMonthSettings({token:'t'}).access,/goes in the "Screens" folder/);
  const r=t.ctx.startMonth(req());assert.equal(r.status,'ok',r.message);assert.equal(t.props.SHEET_ID,'C1');
  assert.equal(t.files.get('C1').parent,t.monthFolder);assert.equal(t.files.get('C1').name,'November 2026');
  assert.deepEqual(t.files.get('C1').editors.map(u=>u.getEmail()),['Kirsten.Synthetic@example.invalid']);assert.equal(t.operations.shares||0,0,'no per-file share needed');
  // MONTH_EDITORS as a backstop: already inherited, so nothing is added twice.
  const u=fixture();u.props.MONTH_FOLDER_ID='F';u.props.MONTH_EDITORS='kirsten.synthetic@example.invalid';u.monthFolder.editors.push({getEmail:()=> 'kirsten.synthetic@example.invalid'});
  assert.equal(u.ctx.startMonth(req()).status,'ok');assert.equal(u.files.get('C1').editors.length,1);assert.equal(u.operations.shares||0,0);
});
test('MONTH_FOLDER_ID: a link-shared or missing folder stops before any copy',()=>{
  const t=fixture();t.props.MONTH_FOLDER_ID='F';t.monthFolder.access='anyone_with_link';
  const r=t.ctx.startMonth(req());assert.equal(r.status,'error');assert.match(r.message,/shared by link/);assert.equal(t.operations.copies,0);assert.equal(t.props.SHEET_ID,'S');
  const u=fixture();u.props.MONTH_FOLDER_ID='missing';assert.match(u.ctx.startMonth(req()).message,/could not be opened/);assert.equal(u.operations.copies,0);
  assert.match(u.ctx.getMonthSettings({token:'t'}).access,/folder needs review/);
});
test('no MONTH_EDITORS: new months stay private and the phone says so',()=>{
  const t=fixture();assert.match(t.ctx.getMonthSettings({token:'t'}).access,/goes in/);
  const r=t.ctx.startMonth(req());assert.match(r.message,/Not shared/);assert.equal(t.files.get('C1').editors.length,0);assert.equal(t.operations.shares||0,0);
});
test('same-month double submit/retry is idempotent, but archived months are never silently reactivated',()=>{
  const t=fixture();assert.equal(t.ctx.startMonth(req()).status,'ok');assert.equal(t.ctx.startMonth(req()).alreadyActive,true);assert.equal(t.operations.copies,1);
  assert.equal(t.ctx.startMonth(req({month:12,expectedSheetId:'C1'})).status,'ok');assert.equal(t.props.SHEET_ID,'C2');
  assert.equal(t.ctx.startMonth(req({expectedSheetId:'C2'})).status,'error');assert.equal(t.props.SHEET_ID,'C2');assert.equal(t.operations.copies,2);
});
test('malformed/unsupported months and stale active workbook reject without making copies',()=>{
  const t=fixture();for(const extra of [{year:'2026'},{year:1999},{year:2101},{month:0},{month:13},{month:'11'},
    {expectedSheetId:''},{expectedSheetId:'wrong'},{extra:'not supported'}])assert.equal(t.ctx.startMonth(req(extra)).status,'error');
  assert.equal(t.operations.copies,0);assert.equal(t.props.SHEET_ID,'S');
});
test('migration pause/journal/in-progress and concurrent lock prevent rollover without mutation',()=>{
  const t=fixture();for(const key of ['TAG_SEQUENCE_MIGRATION_ACTIVE','TAG_SEQUENCE_SCAN_PAUSE','TAG_SEQUENCE_JOURNAL']){
    t.props[key]='true';assert.equal(t.ctx.startMonth(req()).status,'error');delete t.props[key];
  }t.setLocked(true);assert.equal(t.ctx.startMonth(req()).status,'error');t.setLocked(false);assert.equal(t.operations.copies,0);
});
test('dirty/legacy/unsupported template rejects before copy; known Joliet formula is allowed',()=>{
  for(const kind of ['dirty','legacy','unknown','unsafeFormula','notes']){
    const t=fixture();if(kind==='dirty')t.template.tabs['Homer Glen'].set(2,3,'Synthetic template job');
    if(kind==='legacy')t.template.tabs['Homer Glen'].set(1,4,'Unknown header');
    if(kind==='unknown')t.template.insertSheet('Unsupported lookup');
    if(kind==='unsafeFormula')t.template.tabs['Homer Glen'].set(2,10,'=IMPORTRANGE("synthetic","A1")');
    if(kind==='notes')t.template.tabs['Homer Glen'].notes.set('2,3','Synthetic previous-job note');
    assert.equal(t.ctx.startMonth(req()).status,'error');assert.equal(t.operations.copies,0);
  }
  const t=fixture();t.template.tabs['18650 (60)'].set(101,24,'=SUM(V2:V100)+SUM(W2:W100)+SUM(Y2:Y100)');assert.equal(t.ctx.startMonth(req()).status,'ok');
});
test('copy failure is fail-closed: no blind duplicate retry; owner no-copy reconciliation is explicit and deletes no files',()=>{
  const t=fixture();t.controls.createFail=true;assert.equal(t.ctx.startMonth(req()).status,'error');assert.equal(t.props.SHEET_ID,'S');
  assert.equal(t.ctx.startMonth(req()).status,'error');assert.equal(t.operations.copies,1);assert.ok(t.props.ROLLOVER_PENDING);
  assert.throws(()=>t.ctx.abandonUncreatedRollover_(),/Owner must verify/);
  t.props.ROLLOVER_NO_COPY_CONFIRMED=JSON.parse(t.props.ROLLOVER_PENDING).operationId;
  assert.equal(t.ctx.abandonUncreatedRollover_().status,'uncreated-operation-reconciled');assert.equal(t.files.size,2);assert.equal(t.props.ROLLOVER_PENDING,undefined);
});
test('uncertain creation recovers the same staged copy; different-month retry does not create a second file',()=>{
  const t=fixture();t.controls.afterCreateThrow=true;assert.equal(t.ctx.startMonth(req()).status,'error');assert.equal(t.files.size,3);
  assert.equal(t.ctx.startMonth(req({month:12})).status,'error');assert.equal(t.operations.copies,1);
  t.controls.afterCreateThrow=false;assert.equal(t.ctx.startMonth(req()).status,'ok');assert.equal(t.operations.copies,1);assert.equal(t.props.SHEET_ID,'C1');
});
test('dirty or broadly shared copied workbook is retained but never activated or granted new access',()=>{
  for(const control of ['copiedDirty','sharedCopy']){
    const t=fixture();t.controls[control]=true;assert.equal(t.ctx.startMonth(req()).status,'error');assert.equal(t.props.SHEET_ID,'S');assert.equal(t.files.size,3);
    assert.equal(t.ctx.startMonth(req()).status,'error');assert.equal(t.operations.copies,1);assert.ok(t.props.ROLLOVER_PENDING);
  }
});
test('switch failure and post-switch bookkeeping failure recover without losing existing/new user data or duplicating files',()=>{
  for(const failKey of ['SHEET_ID','CURRENT_WORKBOOK_MONTH']){
    const t=fixture();let once=true;
    t.ctx.PropertiesService.getScriptProperties=()=>({getProperty:k=>t.props[k]??null,setProperty:(k,v)=>{if(k===failKey&&once){once=false;throw Error('Synthetic property failure');}t.props[k]=v;},deleteProperty:k=>{delete t.props[k];}});
    assert.equal(t.ctx.startMonth(req()).status,'error');assert.equal(t.operations.copies,1);assert.ok(t.props.ROLLOVER_PENDING);
    if(failKey==='CURRENT_WORKBOOK_MONTH')t.sheets.get('C1').tabs['Homer Glen'].set(2,3,'Manual post-switch edit');
    assert.equal(t.ctx.startMonth(req()).status,'ok');assert.equal(t.operations.copies,1);assert.equal(t.props.SHEET_ID,'C1');
    if(failKey==='CURRENT_WORKBOOK_MONTH')assert.equal(t.sheets.get('C1').tabs['Homer Glen'].get(2,3),'Manual post-switch edit');
  }
});
test('pending cleanup failure is recovered by idempotent completed-operation retry',()=>{
  const t=fixture();let once=true;t.ctx.PropertiesService.getScriptProperties=()=>({getProperty:k=>t.props[k]??null,setProperty:(k,v)=>{t.props[k]=v;},deleteProperty:k=>{if(k==='ROLLOVER_PENDING'&&once){once=false;throw Error('Synthetic cleanup failure');}delete t.props[k];}});
  assert.equal(t.ctx.startMonth(req()).status,'error');assert.equal(t.props.SHEET_ID,'C1');assert.ok(t.props.ROLLOVER_PENDING);
  assert.equal(t.ctx.startMonth(req()).alreadyActive,true);assert.equal(t.props.ROLLOVER_PENDING,undefined);assert.equal(t.operations.copies,1);
});
test('pending operation blocks new paid scans and rejects unrelated active-workbook changes on recovery',()=>{
  const t=fixture();t.controls.createFail=true;t.ctx.startMonth(req());
  assert.match(t.ctx.scanTag({token:'t',image:'/9j/AP/Z'}).message,/pending/);assert.equal(t.fetches(),0);
  t.props.SHEET_ID='MANUAL';assert.equal(t.ctx.startMonth(req({expectedSheetId:'MANUAL'})).status,'error');assert.equal(t.props.SHEET_ID,'MANUAL');
});
test('daily copy cap counts failed starts, stays bounded, and does not charge recovery retries',()=>{
  const t=fixture();t.props.MAX_MONTH_COPIES_PER_DAY='1';assert.equal(t.ctx.startMonth(req()).status,'ok');
  assert.equal(t.ctx.startMonth(req()).alreadyActive,true);assert.equal(t.ctx.startMonth(req({month:12,expectedSheetId:'C1'})).status,'error');assert.equal(t.operations.copies,1);
});
test('unregistered month-name collision refuses a duplicate without adopting someone else\'s file',()=>{
  const t=fixture();t.files.set('OTHER',Object.assign(t.file('OTHER','Screens 2026-11'),{parent:t.monthFolder}));assert.equal(t.ctx.startMonth(req()).status,'error');assert.equal(t.operations.copies,0);
});
test('admitted scans pin the previous workbook despite a switch during extraction',()=>{
  const t=fixture();const newSS=t.clone(t.template,'C1');t.sheets.set('C1',newSS);t.files.set('C1',t.file('C1','Screens 2026-11'));
  t.ctx.extractTag_=()=>{t.props.SHEET_ID='C1';return {...BASE};};
  const result=t.ctx.scanTag({token:'t',user:'Synthetic',image:'/9j/AP/Z'});assert.equal(result.status,'ok');
  assert.equal(t.ss.tabs['Homer Glen'].get(2,6),BASE.ticket_number);assert.equal(newSS.tabs['Homer Glen'].get(2,6),'');
});
test('full English month-year names preserve internal keys and recognize legacy/current labels',()=>{
  const t=fixture();assert.equal(t.ctx.monthFromWorkbookName_('Screens 2026-10'),'2026-10');
  assert.equal(t.ctx.monthFromWorkbookName_('October 2026'),'2026-10');assert.equal(t.ctx.monthFromWorkbookName_('January 2027'),'2027-01');
  for(const bad of ['Oct 2026','Screens October 2026','2026-10','October2026','October 26','Screens 2026-13'])assert.equal(t.ctx.monthFromWorkbookName_(bad),'',bad);
  for(let m=1;m<=12;m++){const key='2026-'+String(m).padStart(2,'0');assert.equal(t.ctx.monthFromWorkbookName_(t.ctx.monthWorkbookName_(key)),key);}
  t.files.get('S').name='October 2026';const info=t.ctx.getMonthSettings({token:'t'});assert.equal(info.currentMonth,'2026-10');assert.equal(info.currentName,'October 2026');
  const result=t.ctx.startMonth(req());assert.equal(result.status,'ok',result.message);assert.equal(t.files.get('C1').name,'November 2026');
  assert.equal(t.props.CURRENT_WORKBOOK_MONTH,'2026-11');assert.equal(JSON.parse(t.props.MONTH_ROLLOVER_2026_11).month,'2026-11');
  assert.equal(t.ctx.startMonth(req()).alreadyActive,true);assert.equal(t.operations.copies,1);
});
test('full-name and legacy-name collisions both block duplicate month creation',()=>{
  for(const name of ['November 2026','Screens 2026-11']){const t=fixture();t.files.set('OTHER',Object.assign(t.file('OTHER',name),{parent:t.monthFolder}));
    assert.equal(t.ctx.startMonth(req()).status,'error',name);assert.equal(t.operations.copies,0);assert.equal(t.props.SHEET_ID,'S');}
});
test('new full-name staging recovers uncertain creation and ID-bound metadata survives manual renaming',()=>{
  const t=fixture();t.controls.afterCreateThrow=true;assert.equal(t.ctx.startMonth(req()).status,'error');
  assert.match(t.files.get('C1').name,/^November 2026 \[pending rollover /);assert.equal(JSON.parse(t.props.ROLLOVER_PENDING).month,'2026-11');
  t.controls.afterCreateThrow=false;assert.equal(t.ctx.startMonth(req()).status,'ok');assert.equal(t.files.get('C1').name,'November 2026');assert.equal(t.operations.copies,1);
  t.files.get('C1').name='November 2026 reviewed';assert.equal(t.ctx.getMonthSettings({token:'t'}).currentMonth,'2026-11');
});
console.log(`${passed} monthly-rollover tests passed`);

}
module.exports={fixture,req};
