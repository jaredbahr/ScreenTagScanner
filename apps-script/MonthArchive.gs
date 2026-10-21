/** Monthly PDF archive. Private helpers only; no new endpoint, trigger, paid call or source edit. */
function monthScanLeases_(p) {
  var raw=p.getProperty('MONTH_SCAN_LEASES'),leases=raw?JSON.parse(raw):{};
  if(!leases||typeof leases!=='object'||Array.isArray(leases)||Object.keys(leases).some(function(k){
    var l=leases[k];return !l||typeof l.sheetId!=='string'||!Number.isInteger(l.started)||l.started<0;
  }))throw new Error('Scan admission state needs owner review.');
  var now=Date.now();
  Object.keys(leases).forEach(function(k){
    if(leases[k].started>now)throw new Error('Scan admission clock needs owner review.');
    if(now-leases[k].started>=10*60*1000)delete leases[k];
  });
  // Expiry is safe because saveScan_ checks the same live lease under the same lock.
  // It is a write fence, not an assumption about Google's maximum execution duration.
  return leases;
}
function releaseMonthScan_(p,id) {
  if(!id)return;
  var lock,held=false;
  try {
    lock=LockService.getScriptLock();lock.waitLock(20000);held=true;
    var leases=monthScanLeases_(p);delete leases[id];p.setProperty('MONTH_SCAN_LEASES',JSON.stringify(leases));
  } catch(err) {
    // The scan result remains valid. A leftover lease expires within ten minutes; late writes are fenced.
    console.log('Monthly archive admission cleanup deferred until lease expiry.');
  } finally {if(held)lock.releaseLock();}
}
function monthArchiveHeading_(month) {
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month||''))throw new Error('Archived workbook month needs owner review.');
  var names=['January','February','March','April','May','June','July','August','September','October','November','December'];
  return 'P & K Window & Screen Repair '+names[Number(month.slice(5))-1]+' '+month.slice(0,4);
}
function monthArchiveSave_(p,pending) {p.setProperty('ROLLOVER_PENDING',JSON.stringify(pending));}
function monthArchiveFind_(folder,name) {
  var files=folder.getFilesByName(name),found=null;
  while(files.hasNext()){if(found)throw new Error('Multiple archive files found. Jared must reconcile them; nothing was switched.');found=files.next();}
  return found;
}
function monthArchiveCheck_(file,folder) {
  var people=folderPeople_(folder);privateMonthCopy_(file,people.editors,people.viewers);
  if(file.isTrashed())throw new Error('The archived PDF is in Trash. Restore it before retrying.');
  var parents=file.getParents(),inside=false;while(parents.hasNext())if(parents.next().getId()===folder.getId())inside=true;
  if(!inside||file.getMimeType()!=='application/pdf'||file.getSize()<=0)throw new Error('The archived PDF needs owner review.');
}
function monthArchiveSnapshot_(p,pending) {
  var a=pending.archive,root=DriveApp.getRootFolder(),temp;
  if(a.tempId)temp=SpreadsheetApp.openById(a.tempId);
  else {
    var found=monthArchiveFind_(root,a.tempName);
    if(found)temp=SpreadsheetApp.openById(found.getId());
    else {
      if(a.tempIntent)throw new Error('Temporary archive creation is uncertain. Jared must reconcile it; no second file was created.');
      a.tempIntent=true;monthArchiveSave_(p,pending);
      temp=SpreadsheetApp.create(a.tempName);
    }
    a.tempId=temp.getId();monthArchiveSave_(p,pending);
  }
  privateMonthCopy_(DriveApp.getFileById(a.tempId),[],[]);
  if(a.prepared)return temp.getSheetByName('Archive Totals');
  // Retain the original blank sheet so an interrupted copy can be discarded/rebuilt safely.
  var sheets=temp.getSheets();
  sheets.slice(1).forEach(function(sh){temp.deleteSheet(sh);});
  SpreadsheetApp.flush();
  var source=SpreadsheetApp.openById(pending.priorSheetId).getSheetByName('Totals');
  if(!source)throw new Error('The previous workbook has no Totals sheet.');
  var range=source.getDataRange(),values=range.getValues(),display=range.getDisplayValues();
  if(display.some(function(row){return row.some(function(v){return /^#(REF!|ERROR!|DIV\/0!|VALUE!|N\/A|NAME\?|NUM!)/.test(v);});})) {
    throw new Error('Previous Totals contains a formula error. Correct it before archiving.');
  }
  var sh=source.copyTo(temp);sh.setName('Archive Totals');
  // Capture evaluated values before cross-workbook formula references can break. Never edit source.
  values=values.map(function(row){return row.map(function(v){return typeof v==='string'&&v.charAt(0)==='='?"'"+v:v;});});
  sh.getRange(1,1,values.length,values[0].length).setValues(values);
  var first=String(display[0][0]||''),replace=/^P\s*&\s*K\s+Window\s*&\s*Screen\s+Repair\b/i.test(first);
  if(!replace)sh.insertRowBefore(1);
  var width=Math.max(values[0].length,8);
  // A pre-existing title merge can extend beyond the last populated data column.
  sh.getRange(1,1,1,sh.getMaxColumns()).getMergedRanges().forEach(function(r){width=Math.max(width,r.getLastColumn());r.breakApart();});
  if(sh.getMaxColumns()<width)sh.insertColumnsAfter(sh.getMaxColumns(),width-sh.getMaxColumns());
  sh.getRange(1,1,1,width).breakApart().clearContent().merge().setValue(monthArchiveHeading_(pending.priorMonth))
    .setFontSize(18).setFontWeight('normal').setHorizontalAlignment('left').setWrap(true);
  sh.setRowHeight(1,48);sh.setFrozenRows(0);sh.setFrozenColumns(0);
  a.rows=values.length+(replace?0:1);a.columns=width;a.prepared=true;
  SpreadsheetApp.flush();monthArchiveSave_(p,pending);return sh;
}
function monthArchiveExport_(pending,sh) {
  var a=pending.archive;
  var url='https://docs.google.com/spreadsheets/d/'+encodeURIComponent(a.tempId)+'/export?format=pdf'+
    '&gid='+sh.getSheetId()+'&size=letter&portrait=true&scale=4&sheetnames=false&printtitle=false'+
    '&pagenum=UNDEFINED&gridlines=false&fzr=false&top_margin=0.25&bottom_margin=0.25&left_margin=0.25&right_margin=0.25'+
    '&r1=0&c1=0&r2='+a.rows+'&c2='+a.columns;
  var response=UrlFetchApp.fetch(url,{headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},muteHttpExceptions:true});
  var blob=response.getBlob();
  if(response.getResponseCode()!==200||blob.getContentType()!=='application/pdf')throw new Error('Totals PDF export failed. Retry this same month; the old workbook remains active.');
  // Sheets currently emits ordinary page objects. Fail closed if its PDF encoding changes.
  var pdf=blob.getDataAsString('ISO-8859-1'),pages=pdf.match(/\/Type\s*\/Page\b/g)||[];
  if(pdf.indexOf('%PDF-')!==0||pages.length!==1)throw new Error('Totals PDF could not be verified as one page. No switch was made; contact Jared.');
  return blob.setName(a.stagingName);
}
function archiveMonthTotals_(p,pending) {
  if(pending.version!==2||!pending.priorMonth||!pending.folderId)throw new Error('This older pending rollover needs owner reconciliation before PDF archival.');
  var folder=monthFolder_(pending.folderId),a=pending.archive;
  if(!a){
    var heading=monthArchiveHeading_(pending.priorMonth);
    a=pending.archive={name:heading+' Totals.pdf',stagingName:heading+' Totals [archive '+pending.operationId+'].pdf',
      tempName:'Screens Totals export [archive '+pending.operationId+']'};
    if(folder.getFilesByName(a.name).hasNext())throw new Error('A PDF for the archived month already exists. Jared must reconcile it; no duplicate was created.');
    monthArchiveSave_(p,pending);
  }
  var file=a.pdfId?DriveApp.getFileById(a.pdfId):monthArchiveFind_(folder,a.stagingName);
  if(!file){
    if(a.pdfIntent)throw new Error('The earlier PDF creation is uncertain. No second PDF was created; contact Jared.');
    // Do not adopt a similarly named file created by a person or a different operation.
    if(folder.getFilesByName(a.name).hasNext())throw new Error('An unregistered archive PDF exists. Contact Jared.');
    var sh=monthArchiveSnapshot_(p,pending),blob=monthArchiveExport_(pending,sh);
    a.pdfIntent=true;monthArchiveSave_(p,pending);
    file=folder.createFile(blob);
    a.pdfId=file.getId();monthArchiveSave_(p,pending);
  } else if(!a.pdfId){a.pdfId=file.getId();monthArchiveSave_(p,pending);}
  monthArchiveCheck_(file,folder);
  var collision=monthArchiveFind_(folder,a.name);
  if(collision&&collision.getId()!==file.getId())throw new Error('Archive PDF name collision needs owner review.');
  file.setName(a.name);a.complete=true;monthArchiveSave_(p,pending);
}
function cleanupMonthArchive_(pending) {
  // Only the operation-owned, private scratch workbook is recoverably trashed, never the source.
  try {if(pending.archive&&pending.archive.tempId)DriveApp.getFileById(pending.archive.tempId).setTrashed(true);}
  catch(err){console.log('Monthly PDF complete; temporary export workbook cleanup is pending.');}
}
