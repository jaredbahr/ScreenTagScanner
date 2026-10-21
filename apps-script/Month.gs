/** Manual rollover only. No secret logging, emails, triggers or deletion. Sharing only to MONTH_EDITORS. */
function monthReply_(ok, message, data, authenticated) {
  return Object.assign({status:ok?'ok':'error',message:message,authenticated:authenticated===true},data||{});
}
function monthAuth_(req, allowed) {
  if (!req || typeof req!=='object' || Array.isArray(req) || typeof req.token!=='string' ||
      !req.token || req.token.length>512 || Object.keys(req).some(function(k){return allowed.indexOf(k)<0;})) return false;
  var expected=PropertiesService.getScriptProperties().getProperty('SHARED_TOKEN');
  return !!expected && req.token===expected;
}
function monthKey_(year, month) {
  if (!Number.isInteger(year) || year<2000 || year>2100 || !Number.isInteger(month) || month<1 || month>12) {
    throw new Error('Choose a supported year (2000–2100) and month (1–12).');
  }
  return year+'-'+('0'+month).slice(-2);
}
/** Human-readable file names; persisted month keys remain YYYY-MM. */
function monthWorkbookName_(month) {
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month||''))throw new Error('Workbook month needs review.');
  var names=['January','February','March','April','May','June','July','August','September','October','November','December'];
  return names[Number(month.slice(5))-1]+' '+month.slice(0,4);
}
function monthFromWorkbookName_(name) {
  var legacy=/^Screens (\d{4}-(?:0[1-9]|1[0-2]))$/.exec(name);
  if(legacy)return legacy[1];
  var full=/^(January|February|March|April|May|June|July|August|September|October|November|December) (\d{4})$/.exec(name);
  if(!full)return '';
  var names=['January','February','March','April','May','June','July','August','September','October','November','December'];
  return full[2]+'-'+('0'+(names.indexOf(full[1])+1)).slice(-2);
}
function monthPaused_(p) {
  return !!p.getProperty('TAG_SEQUENCE_MIGRATION_ACTIVE') || !!p.getProperty('TAG_SEQUENCE_JOURNAL') ||
    p.getProperty('TAG_SEQUENCE_SCAN_PAUSE')==='true';
}
function monthlyTemplateCheck_(ss) {
  var allowed=STORES.reduce(function(names,s){return names.concat(storeTabNames_(s));},[]).concat(['Totals',SCANS_TAB]);
  if (ss.getSheets().some(function(sh){return allowed.indexOf(sh.getName())<0;}) || !ss.getSheetByName('Totals')) {
    throw new Error('Template has unsupported/missing sheets. Contact Jared.');
  }
  var log=ss.getSheetByName(SCANS_TAB);if(log&&log.getLastRow()>1)throw new Error('Template contains scan records. Contact Jared.');
  var shapes=[];
  STORES.forEach(function(st){
    var sh=storeSheet_(ss, st);if(!sh)throw new Error('Template store missing. Contact Jared.');
    var l=storeLayout_(sh);if(!l.screens.SEQUENCE||!l.windows.SEQUENCE)throw new Error('Finish the template sequence-column migration first.');
    ['screens','windows'].forEach(function(block){
      var c=l[block],end=block==='screens'?screenBlockEnd_(sh):WINDOW_LAST_ROW;
      if(end<2)throw new Error('Template counter rows missing. Contact Jared.');
      var last=block==='screens'?c.EARNING:c.OTHER_EARN;
      var range=sh.getRange(2,c.DATE_IN,end-1,last-c.DATE_IN+1),v=range.getValues(),f=range.getFormulas();
      if(range.getNotes().some(function(row){return row.some(function(note){return note!=='';});}))throw new Error('Template contains job notes. Contact Jared before copying it.');
      v.forEach(function(row,i){row.forEach(function(value,j){
        var col=c.DATE_IN+j;
        if(block==='windows'&&col===c.SW){if(value!==''&&value!=='W')throw new Error('Template S/W changed. Contact Jared.');return;}
        if(f[i][j]) {
          var letters=function(n){var s='';for(;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;};
          var formula=String(f[i][j]).replace(/\s/g,'').toUpperCase(),rowNumber=i+2;
          var spline=block==='screens'&&((col===c.SPLINE&&formula==='='+letters(c.UNI_IN)+rowNumber+'*0.07')||
            (col===c.SPL_EARN&&formula==='='+letters(c.UNI_IN)+rowNumber+'*0.01'));
          var other='=SUM('+letters(c.LB_EARN)+'2:'+letters(c.LB_EARN)+'100)+SUM('+letters(c.SPL_EARN)+'2:'+letters(c.SPL_EARN)+'100)+SUM('+letters(c.OTHER_EARN)+'2:'+letters(c.OTHER_EARN)+'100)';
          if(spline||(block==='windows'&&st.name==='Joliet'&&col===c.OTHER&&rowNumber===101&&formula===other))return;
        }
        if(value!==''||f[i][j])throw new Error('Template contains job/input data. No new month was activated.');
      });});
    });
    shapes.push({tab:st.tab,headers:storeHeaders_(sh),rows:sh.getMaxRows(),columns:sh.getMaxColumns()});
  });
  var audit=formulaAudit_(ss);if(audit.errors.length||audit.dynamic.length)throw new Error('Template formulas need review. Contact Jared.');
  return JSON.stringify({shapes:shapes,formulaCount:audit.count});
}
/**
 * MONTH_EDITORS (Script Property, set by Jared): up to 5 comma-separated email addresses that get
 * Editor access to every new month, e.g. Kirsten. Unset = new months stay private, as before.
 * Only these people are ever added; nobody else's access is copied or inferred.
 */
function monthEditors_(p) {
  var list=String(p.getProperty('MONTH_EDITORS')||'').split(/[,;\s]+/).map(function(e){return e.trim().toLowerCase();}).filter(Boolean);
  if(list.length>5||list.some(function(e){return !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(e);}))throw new Error('MONTH_EDITORS needs review (up to 5 email addresses). No new month was started.');
  return list.filter(function(e,i){return list.indexOf(e)===i;});
}
function maskEmail_(e) { var at=e.indexOf('@'); return e.slice(0,Math.min(2,at))+'***'+e.slice(at); }
function editorEmails_(file) { return file.getEditors().map(function(u){return String(u.getEmail()).toLowerCase();}); }
/** Adds each approved editor once (safe to repeat on recovery) and confirms Drive shows them all. */
function shareMonthCopy_(file, editors) {
  var have=editorEmails_(file);
  editors.forEach(function(e){if(have.indexOf(e)<0)file.addEditor(e);});
  have=editorEmails_(file);
  if(editors.some(function(e){return have.indexOf(e)<0;}))throw new Error('Sharing the new workbook did not complete. It was not activated; try again or contact Jared.');
}
/**
 * MONTH_FOLDER_ID (Script Property): Drive folder that new months are created in. Share that folder
 * with Kirsten by name and every month inherits her access. Unset = My Drive root, as before.
 * A folder open to "anyone with the link" is refused. Keep the TEMPLATE outside this folder.
 */
function monthFolder_(id) {
  if(!id)return DriveApp.getRootFolder();
  var folder;try{folder=DriveApp.getFolderById(id);}catch(err){throw new Error('The monthly folder (MONTH_FOLDER_ID) could not be opened. No new month was started.');}
  if(folder.getSharingAccess()!==DriveApp.Access.PRIVATE)throw new Error('The monthly folder is shared by link. Share it with people by name only; no new month was started.');
  return folder;
}
/** People who inherit access from the monthly folder (lowercase emails). */
function folderPeople_(folder) {
  if(!folder.getEditors)return {editors:[],viewers:[]};
  var low=function(u){return String(u.getEmail()).toLowerCase();};
  return {editors:folder.getEditors().map(low),viewers:folder.getViewers().map(low)};
}
function privateMonthCopy_(file, allowed, allowedViewers) {
  var owner=file.getOwner();if(!owner)throw new Error('New workbook ownership could not be verified. Contact Jared.');
  var ownerEmail=owner.getEmail();allowed=allowed||[];allowedViewers=allowedViewers||[];
  if(file.getSharingAccess()!==DriveApp.Access.PRIVATE ||
      file.getEditors().some(function(u){return u.getEmail()!==ownerEmail&&allowed.indexOf(String(u.getEmail()).toLowerCase())<0;}) ||
      file.getViewers().some(function(u){return u.getEmail()!==ownerEmail&&allowedViewers.indexOf(String(u.getEmail()).toLowerCase())<0;})) {
    throw new Error('New workbook access is not private. It was not activated; contact Jared.');
  }
}
function monthCurrent_(p) {
  var id=p.getProperty('SHEET_ID');if(!id)throw new Error('Current workbook is not configured.');
  var file=DriveApp.getFileById(id),month=p.getProperty('CURRENT_WORKBOOK_MONTH_ID')===id?p.getProperty('CURRENT_WORKBOOK_MONTH')||'':'';
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))month='';
  if(!month)month=monthFromWorkbookName_(file.getName());
  return {currentId:id,currentName:file.getName(),currentUrl:file.getUrl(),currentMonth:month};
}

/** Authenticated read only; a remembered scanner password may load this view, never start a change. */
function getMonthSettings(req) {
  var auth=false,lock,held=false;
  try {
    if(!monthAuth_(req,['token']))return monthReply_(false,'Check the scanner password.',{badToken:true},false);
    auth=true;lock=LockService.getScriptLock();lock.waitLock(5000);held=true;
    var p=PropertiesService.getScriptProperties(),current=monthCurrent_(p),raw=p.getProperty('ROLLOVER_PENDING');
    var pending=raw?JSON.parse(raw):null;
    var today=Utilities.formatDate(new Date(),'America/Chicago','yyyy-MM-dd').split('-');
    var nextMonth=Number(today[1])+1,nextYear=Number(today[0]);if(nextMonth===13){nextMonth=1;nextYear++;}
    return monthReply_(true,'Settings loaded.',Object.assign(current,{paused:monthPaused_(p),pendingTarget:pending?pending.month:'',
      defaultYear:nextYear,defaultMonth:nextMonth,access:monthAccessText_(p),backupStatus:workbookBackupSummary_(p)}),true);
  } catch(err){return monthReply_(false,'Settings could not be loaded. Wait and try again, or contact Jared.',{},auth);}
  finally{if(held)lock.releaseLock();}
}
function monthAccessText_(p) {
  var editors;try{editors=monthEditors_(p);}catch(err){return 'Sharing list needs review: contact Jared before starting a month.';}
  var where='',folderId=p.getProperty('MONTH_FOLDER_ID');
  if(!folderId)return 'Set MONTH_FOLDER_ID with Jared before starting a month. Previous Totals will be archived as a PDF in that folder.';
  if(folderId){try{where=' It goes in the "'+monthFolder_(folderId).getName()+'" folder, with that folder\'s sharing.';}
    catch(err){return 'Monthly folder needs review: contact Jared before starting a month.';}}
  return (editors.length?'Previous workbooks are kept. The new file is shared (Editor) with: '+editors.map(maskEmail_).join(', ')+'.':
    'Previous workbooks are kept.'+(folderId?'':' The new file starts private (no sharing list set).'))+where+' Previous Totals are archived as a PDF before switching.';
}
function monthCopyAdmission_(p) {
  var raw=p.getProperty('MAX_MONTH_COPIES_PER_DAY'),limit=raw===null||raw===''?2:Number(raw);
  if(raw!==null&&raw!==''&&!/^\d+$/.test(raw))throw new Error('Month-copy limit settings need review.');
  if(!Number.isInteger(limit)||limit<1||limit>12)throw new Error('Month-copy limit settings need review.');
  var day=Utilities.formatDate(new Date(),'America/Chicago','yyyy-MM-dd'),stateRaw=p.getProperty('MONTH_COPY_LIMIT_STATE');
  var state=stateRaw?JSON.parse(stateRaw):{day:day,count:0};
  if(typeof state.day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(state.day)||!Number.isInteger(state.count)||state.count<0||state.day>day)throw new Error('Month-copy limit state needs review.');
  if(state.day!==day)state={day:day,count:0};
  if(state.count>=limit)throw new Error('Daily new-month copy limit reached. Existing-operation recovery is still allowed.');
  state.count++;p.setProperty('MONTH_COPY_LIMIT_STATE',JSON.stringify(state));
}
function monthStagingCopy_(pending) {
  var files=monthFolder_(pending.folderId||'').getFilesByName(pending.stagingName),found=[];
  while(files.hasNext()) {found.push(files.next());if(found.length>1)throw new Error('More than one pending copy found. Contact Jared; nothing was switched.');}
  return found[0]||null;
}

/** Fresh password must be supplied from the dedicated confirmation field for every change. */
function startMonth(req) {
  var auth=false,lock,held=false;
  try {
    if(!monthAuth_(req,['token','year','month','expectedSheetId']))return monthReply_(false,'Re-enter the scanner password for this change.',{badToken:true},false);
    auth=true;var month=monthKey_(req.year,req.month);
    if(typeof req.expectedSheetId!=='string'||!req.expectedSheetId||req.expectedSheetId.length>200||!/^[A-Za-z0-9_-]+$/.test(req.expectedSheetId))throw new Error('Refresh Settings and review the current workbook again.');
    lock=LockService.getScriptLock();lock.waitLock(20000);held=true;
    var p=PropertiesService.getScriptProperties();if(monthPaused_(p))throw new Error('Finish and resume the worksheet migration before starting a month.');
    var editors=monthEditors_(p);
    var current=p.getProperty('SHEET_ID'),recordKey='MONTH_ROLLOVER_'+month.replace('-','_');
    var recordRaw=p.getProperty(recordKey),record=recordRaw?JSON.parse(recordRaw):null;
    if(record&&record.status==='complete'){
      if(record.copyId!==current)throw new Error('That month already exists as a previous workbook. It was not switched or copied again.');
      var leftoverRaw=p.getProperty('ROLLOVER_PENDING'),leftover=leftoverRaw?JSON.parse(leftoverRaw):null;
      if(leftover&&leftover.month===month&&leftover.copyId===record.copyId&&leftover.operationId===record.operationId) {
        p.deleteProperty('ROLLOVER_PENDING');
        cleanupMonthArchive_(leftover);
      }
      if(record.archiveTempId)cleanupMonthArchive_({archive:{tempId:record.archiveTempId}});
      return monthReply_(true,'This month is already active. No duplicate file was created.',Object.assign(monthCurrent_(p),{month:month,alreadyActive:true}),true);
    }
    var pendingRaw=p.getProperty('ROLLOVER_PENDING'),pending=pendingRaw?JSON.parse(pendingRaw):null,newIntent=false;
    if(pending&&pending.month!==month)throw new Error('A pending rollover for '+pending.month+' must be recovered before starting another month.');
    if(Object.keys(monthScanLeases_(p)).length)throw new Error('A scan is still finishing. Wait for its result, then try Start new month again. Interrupted scans clear automatically within ten minutes.');
    var templateId=p.getProperty('TEMPLATE_ID');if(!templateId||templateId===current)throw new Error('A distinct migrated template is required.');
    if(pending){
      if(pending.version!==2)throw new Error('Finish or reconcile the older pending rollover with Jared before enabling PDF archival.');
      if(pending.templateId!==templateId||(current!==pending.priorSheetId&&current!==pending.copyId))throw new Error('Current workbook/template changed during rollover. Contact Jared before recovering.');
      if(req.expectedSheetId!==current&&req.expectedSheetId!==pending.priorSheetId)throw new Error('Settings are stale. Refresh before recovering.');
    }else{
      if(current!==req.expectedSheetId)throw new Error('Another phone changed the current workbook. Refresh Settings before starting a month.');
      var folderId=p.getProperty('MONTH_FOLDER_ID')||'';
      if(!folderId)throw new Error('Set MONTH_FOLDER_ID before archiving a month. No new month was started.');
      var priorMonth=monthCurrent_(p).currentMonth;
      if(!priorMonth)throw new Error('The current workbook month is unknown. Jared must label it before archiving.');
      if(priorMonth>=month)throw new Error('Choose a new month after the current workbook month.');
      if(!SpreadsheetApp.openById(current).getSheetByName('Totals'))throw new Error('The previous workbook has no Totals sheet.');
      if(monthFolder_(folderId).getFilesByName(monthWorkbookName_(month)).hasNext()||monthFolder_(folderId).getFilesByName('Screens '+month).hasNext())throw new Error('A workbook with this month name already exists but is not registered. Contact Jared; no duplicate was created.');
      var fingerprint=monthlyTemplateCheck_(SpreadsheetApp.openById(templateId));
      monthCopyAdmission_(p);
      var op=Utilities.getUuid();
      pending={version:2,month:month,priorMonth:priorMonth,priorSheetId:current,templateId:templateId,templateFingerprint:fingerprint,
        name:monthWorkbookName_(month),stagingName:monthWorkbookName_(month)+' [pending rollover '+op+']',operationId:op,status:'copy-intent',folderId:folderId};
      p.setProperty('ROLLOVER_PENDING',JSON.stringify(pending));newIntent=true;
    }
    var copy=pending.copyId?DriveApp.getFileById(pending.copyId):monthStagingCopy_(pending);
    if(!copy){
      if(!newIntent)throw new Error('The earlier copy result is uncertain. No additional copy was created. Jared must reconcile the pending operation.');
      copy=DriveApp.getFileById(templateId).makeCopy(pending.stagingName,monthFolder_(pending.folderId||''));
    }
    var alreadyActivated=pending.status==='verified'&&current===pending.copyId;
    pending.copyId=copy.getId();
    if(!alreadyActivated) {pending.status='copy-created';p.setProperty('ROLLOVER_PENDING',JSON.stringify(pending));var inherited=folderPeople_(monthFolder_(pending.folderId||''));
      privateMonthCopy_(copy,editors.concat(inherited.editors),inherited.viewers);}
    var copySheet=SpreadsheetApp.openById(pending.copyId);
    if(!alreadyActivated) {
      if(monthlyTemplateCheck_(copySheet)!==pending.templateFingerprint)throw new Error('Copied template/layout changed. It was not activated; contact Jared.');
      copy.setName(pending.name);pending.status='verified';p.setProperty('ROLLOVER_PENDING',JSON.stringify(pending));
    } else {
      STORES.forEach(function(st){var l=storeLayout_(storeSheet_(copySheet, st));if(!l.screens.SEQUENCE||!l.windows.SEQUENCE)throw new Error('Active copy layout changed; contact Jared.');});
      // The already-activated workbook may contain subsequent manual edits; never clear/re-copy it.
    }
    current=p.getProperty('SHEET_ID');
    if(current!==pending.priorSheetId&&current!==pending.copyId)throw new Error('Current workbook changed before activation. No switch was made.');
    // Share before the switch, so scans never land in a file Kirsten can't open yet. Safe to repeat.
    shareMonthCopy_(copy,editors);
    // Archive succeeds before the atomic switch; failure keeps scans gated and this copy recoverable.
    archiveMonthTotals_(p,pending);
    // Full old-workbook snapshot is required before activation; a failure keeps the old pointer.
    backupBeforeMonthSwitch_(p,pending);
    // This one property write is the atomic active-workbook switch, after copy verification.
    if(current!==pending.copyId)p.setProperty('SHEET_ID',pending.copyId);
    p.setProperty('CURRENT_WORKBOOK_MONTH',month);
    p.setProperty('CURRENT_WORKBOOK_MONTH_ID',pending.copyId);
    p.setProperty(recordKey,JSON.stringify({status:'complete',month:month,copyId:pending.copyId,priorSheetId:pending.priorSheetId,operationId:pending.operationId,archivedMonth:pending.priorMonth,pdfId:pending.archive.pdfId,archiveTempId:pending.archive.tempId||null}));
    p.deleteProperty('ROLLOVER_PENDING');
    cleanupMonthArchive_(pending);
    return monthReply_(true,pending.name+' is active. A full previous-workbook backup and Totals PDF were saved; workbooks were kept. '+(editors.length?'Shared with '+editors.length+' editor'+(editors.length===1?'':'s')+'.':'Not shared (no sharing list set).'),
      Object.assign(monthCurrent_(p),{month:month,alreadyActive:false,backupStatus:workbookBackupSummary_(p)}),true);
  }catch(err){return monthReply_(false,auth?'Month change could not be completed: '+String(err.message||'Refresh Settings and contact Jared.'):'Settings are unavailable. Contact Jared.',{},auth);}
  finally{if(held)lock.releaseLock();}
}

/** Owner-only reconciliation of a definite no-copy failure; never deletes any Drive file. */
function abandonUncreatedRollover_() {
  var lock=LockService.getScriptLock();lock.waitLock(20000);
  try{
    var p=PropertiesService.getScriptProperties(),raw=p.getProperty('ROLLOVER_PENDING');if(!raw)return {status:'no-pending-operation'};
    var pending=JSON.parse(raw);
    if(p.getProperty('ROLLOVER_NO_COPY_CONFIRMED')!==pending.operationId)throw new Error('Owner must verify no copy exists, then confirm the operation ID.');
    if(pending.copyId||monthStagingCopy_(pending)||p.getProperty('SHEET_ID')!==pending.priorSheetId)throw new Error('Cannot abandon a created or changed operation. No file was deleted.');
    p.deleteProperty('ROLLOVER_PENDING');p.deleteProperty('ROLLOVER_NO_COPY_CONFIRMED');
    return {status:'uncreated-operation-reconciled'};
  }finally{lock.releaseLock();}
}
