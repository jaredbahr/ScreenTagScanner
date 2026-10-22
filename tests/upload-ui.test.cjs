// Inert DOM/canvas/RPC tests: synthetic image metadata, no browser accounts/network.
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(path.join(__dirname,'../apps-script/Upload.html'),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
let passed=0;
function environment(opts={}) {
  const elements={};
  for(const id of ['scan-form','photo','camera','take-photo','choose-photo','reset-photo','retake','password','remember','remember-row','password-row','forget','preview','submit','status','review','result-details','result-text'])elements[id]={value:'',files:[],listeners:{},clicks:0,click(){this.clicks++;},addEventListener(n,f){this.listeners[n]=f;},removeAttribute(n){delete this[n];}};
  const calls=[],canvases=[],revoked=[],settingsCalls=[],monthCalls=[];let success,failure,slow;
  const runner={withSuccessHandler(f){success=f;return this;},withFailureHandler(f){failure=f;return this;},scanTag(req){calls.push(req);if(opts.throwRpc)throw Error('inert disconnect');},
    getMonthSettings(req){settingsCalls.push({req,success,failure});},startMonth(req){monthCalls.push({req,success,failure});}};
  class FakeImage {
    constructor(){this.naturalWidth=opts.width||4000;this.naturalHeight=opts.height||3000;}
    set src(v){if(opts.decodeFail)this.onerror();else this.onload();}
  }
  const storage=opts.storage||new Map();
  const localStorage=opts.noStorage?undefined:{getItem:k=>{if(opts.storageThrows)throw Error('blocked');return storage.has(k)?storage.get(k):null;},setItem:(k,v)=>{if(opts.writeThrows)throw Error('blocked');storage.set(k,String(v));},removeItem:k=>{if(opts.removeThrows)throw Error('blocked');storage.delete(k);}};
  const ctx={document:{getElementById:id=>elements[id]||(elements[id]={value:'',files:[],listeners:{},focus(){this.focused=true;},addEventListener(n,f){this.listeners[n]=f;}}),createElement:()=>{
    const canvas={width:0,height:0,getContext:()=>({fillRect(){},drawImage(...args){canvas.drawn=args.slice(1);}}),
      toDataURL:(type,quality)=>{canvas.encoded={type,quality,width:canvas.width,height:canvas.height};return opts.data||'data:image/jpeg;base64,/9j/AP/Z';}};
    canvases.push(canvas);return canvas;
  }},Image:FakeImage,URL:{createObjectURL:()=> 'blob:synthetic',revokeObjectURL:v=>revoked.push(v)},
  window:{localStorage,addEventListener(n,f){this[n]=f;}},setTimeout:f=>{slow=f;return 1;},clearTimeout(){slow=null;},
  google:{script:{run:runner}}};
  elements.remember.checked=opts.remember!==false;
  vm.createContext(ctx);vm.runInContext(script,ctx);
  const select=async(file={type:'image/jpeg',size:1024},input='photo')=>{elements[input].files=file?[file]:[];await elements[input].listeners.change();};
  const token=()=>{elements.password.value='synthetic-test-token';elements.password.listeners.input();};
  const submit=()=>elements.submit.listeners.click();
  return {ctx,elements,calls,canvases,revoked,storage,settingsCalls,monthCalls,select,token,submit,success:r=>success(r),failure:()=>failure(Error('inert failure')),slow:()=>slow&&slow()};
}
async function test(name,fn){await fn();passed++;console.log('PASS '+name);}
(async()=>{
  await test('photo resized to 2000 longest edge, JPEG at .82, input cleared, URL revoked',async()=>{
    const t=environment();await t.select();assert.deepEqual(t.canvases[0].encoded,{type:'image/jpeg',quality:.82,width:2000,height:1500});
    assert.equal(t.elements.photo.value,'');assert.equal(t.revoked.length,1);assert.equal(t.elements.preview.hidden,false);
    t.token();assert.equal(t.elements.submit.disabled,false);
  });
  await test('camera button activates dedicated rear-camera input; gallery stays separate',async()=>{
    const t=environment();t.elements['take-photo'].listeners.click();
    assert.equal(t.elements.camera.clicks,1);assert.equal(t.elements.photo.clicks,0);
    t.elements['choose-photo'].listeners.click();assert.equal(t.elements.photo.clicks,1);
    assert.match(html,/<input id="camera"[^>]*accept="image\/\*"[^>]*capture="environment"[^>]*hidden>/);
    const gallery=html.match(/<input id="photo"[^>]*>/)[0];assert.doesNotMatch(gallery,/capture=/);
    assert.doesNotMatch(script,/getUserMedia/);assert.equal(t.calls.length,0);
    await t.select(undefined,'camera');t.token();assert.equal(t.elements.submit.disabled,false);assert.equal(t.calls.length,0);
  });
  await test('cancelling first capture or gallery picker leaves submission disabled',async()=>{
    for(const input of ['camera','photo']){
      const t=environment();t.elements[input].listeners.cancel();t.token();
      assert.equal(t.elements.submit.disabled,true);assert.equal(t.calls.length,0);
      await t.select(null,input);assert.match(t.elements.status.textContent,/No photo/);
    }
  });
  await test('cancelled retake preserves prior preview, and explicit reset removes it',async()=>{
    const t=environment();await t.select(undefined,'camera');t.token();const preview=t.elements.preview.src;
    assert.equal(t.elements['take-photo'].textContent,'Retake photo');
    t.elements['take-photo'].listeners.click();t.elements.camera.listeners.cancel();
    assert.equal(t.elements.preview.src,preview);assert.equal(t.elements.submit.disabled,false);
    await t.select(null,'camera');assert.equal(t.elements.preview.src,preview);
    t.elements['reset-photo'].listeners.click();assert.equal(t.elements.preview.hidden,true);
    assert.equal(t.elements.submit.disabled,true);assert.equal(t.elements['take-photo'].textContent,'Take photo');
    assert.equal(t.elements['reset-photo'].hidden,true);assert.equal(t.calls.length,0);
  });
  await test('retake refreshes preview without paid submission; same file can be reselected',async()=>{
    const t=environment();await t.select();t.elements.camera.value='previous-file';t.elements['take-photo'].listeners.click();
    assert.equal(t.elements.camera.value,'');await t.select(undefined,'camera');
    assert.equal(t.canvases.length,2);assert.equal(t.elements.preview.hidden,false);assert.equal(t.calls.length,0);
  });
  await test('small portrait does not upscale and aspect ratio retained',async()=>{
    const t=environment({width:300,height:600});await t.select();assert.equal(t.canvases[0].encoded.width,300);assert.equal(t.canvases[0].encoded.height,600);
    const p=environment({width:3000,height:4000});await p.select();assert.equal(p.canvases[0].encoded.width,1500);assert.equal(p.canvases[0].encoded.height,2000);
  });
  await test('bad files, oversized originals, dimensions, conversion errors are rejected',async()=>{
    for(const [opts,file] of [[{}, {type:'text/plain',size:10}],[{}, {type:'image/jpeg',size:21*1024*1024}],
      [{decodeFail:true},undefined],[{width:10000,height:10000},undefined],[{data:'data:image/png;base64,AAAA'},undefined],
      [{data:'data:image/jpeg;base64,'+'A'.repeat(5*1024*1024+1)},undefined]]) {
      const t=environment(opts);await t.select(file);t.token();assert.equal(t.elements.submit.disabled,true);assert.equal(t.calls.length,0);
    }
  });
  await test('one submission only, masked token cleared immediately, no automatic retry',async()=>{
    const t=environment();await t.select();t.token();t.submit();t.submit();assert.equal(t.calls.length,1);
    assert.equal(t.calls[0].image,'/9j/AP/Z');assert.equal(t.elements.password.value,'');assert.equal(t.elements.submit.disabled,true);
    assert.match(t.elements.status.textContent,/Reading and saving/);
    t.elements['take-photo'].listeners.click();t.elements['choose-photo'].listeners.click();t.elements['reset-photo'].listeners.click();
    assert.equal(t.elements.camera.clicks,0);assert.equal(t.elements.photo.clicks,0);assert.equal(t.calls.length,1);
    t.slow();assert.match(t.elements.status.textContent,/Do not tap again/);assert.equal(t.calls.length,1);
    t.success({status:'ok',message:'Already scanned. Nothing new added.'});assert.match(t.elements.status.textContent,/Already scanned/);
    assert.equal(t.elements.preview.hidden,true);assert.equal(t.elements.submit.disabled,true);
  });
  await test('auth/non-tag rejection uses exact server message with no HTML interpretation',async()=>{
    for(const message of ['Check the password','Not a tag','<img src=x onerror=alert(1)>']) {
      const t=environment();await t.select();t.token();t.submit();t.success({status:'error',message});
      assert.equal(t.elements.status.textContent,message);assert.equal(t.calls.length,1);
    }
  });
  await test('interrupted or malformed response requires sheet check and reselect',async()=>{
    for(const kind of ['failure','malformed','synchronous']) {
      const t=environment({throwRpc:kind==='synchronous'});await t.select();t.token();t.submit();
      if(kind==='failure')t.failure();if(kind==='malformed')t.success(null);
      assert.match(t.elements.status.textContent,/Check the workbook/);assert.equal(t.calls.length,1);
      t.token();t.submit();assert.equal(t.calls.length,1);assert.equal(t.elements.submit.disabled,true);
    }
  });
  await test('no how-to paragraphs: only the status line gives instructions',async()=>{
    const visible=html.replace(/<script[\s\S]*<\/script>/,'').replace(/<style[\s\S]*<\/style>/,'');
    assert.doesNotMatch(visible,/class="hint"|<details>|filling the frame|does not save|Only submit once|Personal phone only/i);
    const scannerVisible=visible.slice(visible.indexOf('<div id="scanner-view">'),visible.indexOf('<section id="settings-view"'));
    assert.equal((scannerVisible.match(/<p[\s>]/g)||[]).length,3,'normal scanner keeps three result paragraphs; Settings is separate');
  });
  await test('page exit clears typed password and preview; photos are never stored',async()=>{
    const t=environment({remember:false});await t.select();t.token();t.ctx.window.pagehide();assert.equal(t.elements.password.value,'');assert.equal(t.elements.preview.hidden,true);
    assert.equal(t.storage.size,0,'nothing stored when Remember is off');
    assert.doesNotMatch(script,/sessionStorage|indexedDB|document\.cookie|console\.|fetch\(/);
    assert.doesNotMatch(script,/setItem\([^)]*(prepared|preview|image)/,'photo data never written to storage');
    assert.match(html,/type="password"/);assert.match(html,/autocomplete="off"/);assert.match(html,/aria-live="polite"/);
  });
  await test('remembered password: saved only after the server accepts it, then the field is hidden',async()=>{
    const t=environment();await t.select();t.token();t.submit();
    assert.equal(t.storage.size,0,'not saved before a response');
    t.success({status:'ok',message:'Added: X',authenticated:true});
    assert.equal(t.storage.get('scanner-token'),'synthetic-test-token');
    assert.equal(t.elements['password-row'].hidden,true);assert.equal(t.elements['remember-row'].hidden,true);assert.equal(t.elements.forget.hidden,false);
    await t.select();assert.equal(t.elements.submit.disabled,false,'next scan needs no typing');
    t.submit();assert.equal(t.calls[1].token,'synthetic-test-token');
  });
  await test('rejected password is not saved; a remembered one that stops working is forgotten',async()=>{
    const t=environment();await t.select();t.token();t.submit();t.success({status:'error',message:'Check the password',badToken:true});
    assert.equal(t.storage.size,0);assert.equal(t.elements['password-row'].hidden,false);
    const s=new Map([['scanner-token','old-token']]);const u=environment({storage:s});
    assert.equal(u.elements['password-row'].hidden,true);await u.select();u.submit();assert.equal(u.calls[0].token,'old-token');
    u.success({status:'error',message:'Check the password',badToken:true});
    assert.equal(s.size,0);assert.equal(u.elements['password-row'].hidden,false);
  });
  await test('Forget password clears it; storage unavailable still works with typing',async()=>{
    const s=new Map([['scanner-token','old-token']]);const t=environment({storage:s});
    t.elements.forget.listeners.click();assert.equal(s.size,0);assert.equal(t.elements['password-row'].hidden,false);
    const u=environment({noStorage:true});await u.select();u.token();assert.equal(u.elements.submit.disabled,false);u.submit();assert.equal(u.calls.length,1);
  });
  await test('compact normal flow: flexible preview, essential status unclipped, expandable full details',async()=>{
    assert.match(html,/main \{[^}]*height: 100dvh/);assert.match(html,/body \{[^}]*overflow-y: auto/);
    assert.match(html,/#frame \{[^}]*flex: 1/);assert.match(html,/object-fit: contain/);
    assert.doesNotMatch(html,/line-clamp|text-overflow/);
    const statusCss=html.match(/#status \{[^}]*\}/)[0];assert.doesNotMatch(statusCss,/overflow: hidden/);
    assert.match(html,/<details id="result-details" hidden><summary>Details/);
    assert.match(html,/max-height: 560px[^}]*main \{ height: auto/);
    assert.match(html,/<p id="review"[^>]*aria-live="polite"/);
  });
  await test('no persistence for pre-auth settings errors, old schema or malformed auth signals',async()=>{
    for(const result of [{status:'error',message:'Scanner settings are unavailable. Contact Jared.'},
      {status:'error',message:'Scanner settings unavailable',authenticated:false},
      {status:'ok',message:'Added: X'}, {status:'ok',message:'Added: X',authenticated:'true'},
      {status:'ok',message:'Added: X',authenticated:true,badToken:true},
      {status:'ok',authenticated:true},null]) {
      const t=environment();await t.select();t.token();t.submit();t.success(result);
      assert.equal(t.storage.size,0);assert.equal(t.elements['password-row'].hidden,false);
    }
  });
  await test('positive authentication can remember even a post-auth quota/non-tag error',async()=>{
    const t=environment();await t.select();t.token();t.submit();
    t.success({status:'error',message:'Daily scan limit reached.',authenticated:true});
    assert.equal(t.storage.get('scanner-token'),'synthetic-test-token');
  });
  await test('transport failures never persist a newly typed token',async()=>{
    for(const synchronous of [false,true]) {
      const t=environment({throwRpc:synchronous});await t.select();t.token();t.submit();if(!synchronous)t.failure();
      assert.equal(t.storage.size,0);assert.equal(t.elements['password-row'].hidden,false);
    }
  });
  await test('unchecked remember prevents storage; unchecking removes old storage and exposes password',async()=>{
    const t=environment({remember:false});await t.select();t.token();t.submit();t.success({status:'ok',message:'Added',authenticated:true});
    assert.equal(t.storage.size,0);
    const u=environment({storage:new Map([['scanner-token','old-token']])});u.elements.remember.checked=false;u.elements.remember.listeners.change();
    assert.equal(u.storage.size,0);assert.equal(u.elements['password-row'].hidden,false);assert.equal(u.elements.forget.hidden,true);
    // Choice remains outside the password row, so it is reachable even with a saved token.
    assert.match(html,/<\/div>\s*<label class="remember" id="remember-row">/);
  });
  await test('blocked storage never falsely claims a remembered or forgotten password',async()=>{
    for(const opts of [{noStorage:true},{writeThrows:true},{storageThrows:true}]) {
      const t=environment(opts);await t.select();t.token();t.submit();t.success({status:'ok',message:'Added',authenticated:true});
      assert.equal(t.elements['password-row'].hidden,false);assert.match(t.elements['result-text'].textContent,/could not be remembered/);
    }
    const u=environment({storage:new Map([['scanner-token','old-token']]),removeThrows:true});u.elements.forget.listeners.click();
    assert.equal(u.elements['password-row'].hidden,false);assert.match(u.elements.status.textContent,/could not be cleared/);
  });
  await test('earlier unplaced scans are shown on the summary line, not hidden in Details',async()=>{
    const t=environment();await t.select();t.token();t.submit();
    t.success({status:'ok',message:'Added: Person #1 → Homer Glen\n⚠️ 2 earlier scans still need placing. See orange rows in the Scans tab.',authenticated:true});
    assert.equal(t.elements.status.textContent,'Saved.\n2 earlier scans need reconciliation (Scans). Check existing store rows before adding.');
    const u=environment();await u.select();u.token();u.submit();
    u.success({status:'ok',message:'Added: Person #1 → Homer Glen\n⚠️ 1 earlier scan still needs placing. See orange rows in the Scans tab.',authenticated:true});
    assert.equal(u.elements.status.textContent,'Saved.\n1 earlier scan needs reconciliation (Scans). Check existing store rows before adding.');
  });
  await test('reconciliation and unavailable-count guidance stays visible on a confirmed-save summary',async()=>{
    const t=environment();await t.select();t.token();t.submit();t.success({status:'ok',message:'Added\n1 earlier scan still needs reconciliation. Existing store rows may be present.',authenticated:true});
    assert.match(t.elements.status.textContent,/Saved\.[\s\S]*needs reconciliation[\s\S]*Check existing store rows before adding/);assert.doesNotMatch(t.elements.status.textContent,/needs placing/);
    const u=environment();await u.select();u.token();u.submit();u.success({status:'ok',message:'Added\nEarlier scan review status could not be checked. Check Scans and store tabs before adding rows.',authenticated:true});
    assert.match(u.elements.status.textContent,/Saved\.[\s\S]*status unavailable[\s\S]*before adding/);
  });
  await test('long names never suppress review summary; full message stays available as inert text',async()=>{
    const message='Added: '+ 'LongSyntheticName'.repeat(80)+' → Homer Glen\n⚠️ Flagged for a double check.';
    const t=environment();await t.select();t.token();t.submit();t.success({status:'ok',message,authenticated:true,needsReview:true});
    assert.equal(t.elements.status.textContent,'Saved.');assert.equal(t.elements.review.hidden,false);
    assert.equal(t.elements['result-text'].textContent,message);assert.equal(t.elements['result-details'].hidden,false);
    assert.equal(t.elements['result-details'].open,false);
    const u=environment();await u.select();u.token();u.submit();u.success({status:'ok',message});assert.equal(u.elements.review.hidden,false);
  });
  await test('long errors and interrupted writes keep essential guidance outside Details',async()=>{
    for(const message of ['SyntheticError'.repeat(100),'Save could not be confirmed. '+ 'LongSyntheticName'.repeat(50)]) {
      const t=environment();await t.select();t.token();t.submit();t.success({status:'error',message,authenticated:true});
      assert.match(t.elements.status.textContent,/before retrying/);assert.equal(t.elements['result-text'].textContent,message);
    }
  });
  const settingsInfo={status:'ok',authenticated:true,currentId:'S',currentName:'Screens TEST',currentUrl:'https://docs.google.com/spreadsheets/d/S/edit',currentMonth:'',defaultYear:2026,defaultMonth:11,paused:false,pendingTarget:''};
  function openSettings(t){t.elements['settings-open'].listeners.click();if(t.settingsCalls.length)t.settingsCalls.at(-1).success({...settingsInfo});}
  function reviewMonth(t){t.elements['month-year'].value='2026';t.elements['month-select'].value='11';t.elements['month-password'].value='fresh-synthetic-confirmation';t.elements['month-form'].listeners.submit({preventDefault(){}});}
  await test('What\'s new opens release notes and Back returns; the notes carry no customer data',async()=>{
    const t=environment();t.elements['notes-open'].listeners.click();
    assert.equal(t.elements['scanner-view'].hidden,true);assert.equal(t.elements['notes-view'].hidden,false);
    t.elements['notes-back'].listeners.click();assert.equal(t.elements['notes-view'].hidden,true);assert.equal(t.elements['scanner-view'].hidden,false);
    const notes=html.slice(html.indexOf('<section id="notes-view"'),html.indexOf('</section>',html.indexOf('<section id="notes-view"')));
    assert.match(notes,/What's new/);
    assert.doesNotMatch(notes,/\d{6,}|\d{3}[-. ]\d{3}[-. ]\d{4}|@/,'no ticket numbers, phone numbers or emails');
  });
  await test('Settings shows who the new month will be shared with',async()=>{
    const t=environment({storage:new Map([['scanner-token','remembered-synthetic']])});
    t.elements['settings-open'].listeners.click();
    t.settingsCalls.at(-1).success({...settingsInfo,access:'Previous workbooks are kept. The new file is shared (Editor) with: ki***@example.invalid.'});
    assert.match(t.elements['month-access'].textContent,/shared \(Editor\) with: ki\*\*\*@example\.invalid/);
  });
  await test('Settings displays backup completion or review status as literal text',async()=>{
    for(const backupStatus of ['Backups: nightly around 2 a.m. Chicago time. Last backup completed: 2026-10-20T02:00:00.000Z.',
      'Backups: Last backup needs owner review. <synthetic>']) {
      const t=environment({storage:new Map([['scanner-token','remembered-synthetic']])});
      t.elements['settings-open'].listeners.click();t.settingsCalls.at(-1).success({...settingsInfo,backupStatus});
      assert.equal(t.elements['backup-status'].textContent,backupStatus);assert.equal(t.monthCalls.length,0);
    }
  });
  await test('Settings is a separate hidden view; Back/cancel clears confirmation password and preserves an unsubmitted photo',async()=>{
    const t=environment({storage:new Map([['scanner-token','remembered-synthetic']])});await t.select();const prior=t.elements.preview.src;
    openSettings(t);assert.equal(t.elements['scanner-view'].hidden,true);assert.equal(t.elements['settings-view'].hidden,false);assert.equal(t.elements['month-password'].value,'');
    t.elements['month-password'].value='fresh-synthetic-confirmation';t.elements['settings-back'].listeners.click();
    assert.equal(t.elements['month-password'].value,'');assert.equal(t.elements['settings-view'].hidden,true);assert.equal(t.elements.preview.src,prior);assert.equal(t.monthCalls.length,0);
    assert.match(html,/<section id="settings-view" hidden aria-labelledby="settings-title"/);assert.match(html,/<label for="month-password">/);
  });
  await test('month change never auto-submits remembered token and requires review plus a fresh confirmation field',async()=>{
    const t=environment({storage:new Map([['scanner-token','remembered-synthetic']])});openSettings(t);
    assert.equal(t.settingsCalls[0].req.token,'remembered-synthetic','read-only Settings authentication');
    t.elements['month-form'].listeners.submit({preventDefault(){}});assert.equal(t.monthCalls.length,0);
    reviewMonth(t);assert.equal(t.monthCalls.length,0);assert.equal(t.elements['month-confirmation'].hidden,false);
    assert.ok(t.elements['month-proposal'].textContent.startsWith('Start November 2026 and make it active?'));assert.ok(!t.elements['month-proposal'].textContent.includes('Start Screens')); 
    t.elements['month-confirm'].listeners.click();assert.equal(t.monthCalls.length,1);assert.equal(t.monthCalls[0].req.token,'fresh-synthetic-confirmation');
    assert.equal(t.elements['month-password'].value,'');assert.equal(t.storage.get('scanner-token'),'remembered-synthetic');
  });
  await test('pending month confirmation disables controls/back and ignores duplicate clicks, with no automatic retry',async()=>{
    const t=environment({storage:new Map([['scanner-token','remembered-synthetic']])});openSettings(t);reviewMonth(t);
    t.elements['month-confirm'].listeners.click();t.elements['month-confirm'].listeners.click();t.elements['settings-back'].listeners.click();
    assert.equal(t.monthCalls.length,1);assert.equal(t.elements['settings-back'].disabled,true);assert.equal(t.elements['settings-view'].hidden,false);
    t.monthCalls[0].failure(Error('inert disconnect'));assert.equal(t.monthCalls.length,1);assert.match(t.elements['month-status'].textContent,/may have succeeded/);
    assert.equal(t.elements['settings-back'].disabled,false);assert.equal(t.elements['month-password'].value,'');
  });
  await test('successful month change clears draft photo, shows the active month, and requires reentry for another change',async()=>{
    const t=environment({storage:new Map([['scanner-token','remembered-synthetic']])});await t.select();openSettings(t);reviewMonth(t);t.elements['month-confirm'].listeners.click();
    t.monthCalls[0].success({status:'ok',authenticated:true,message:'New month active; sharing separate.',currentId:'C1',currentName:'Screens 2026-11',currentUrl:'https://docs.google.com/spreadsheets/d/C1/edit',month:'2026-11'});
    assert.equal(t.elements.preview.hidden,true);assert.match(t.elements['month-current'].textContent,/2026-11/);assert.equal(t.elements['month-password'].value,'');
    t.elements['month-form'].listeners.submit({preventDefault(){}});assert.equal(t.monthCalls.length,1);assert.match(t.elements['month-status'].textContent,/Re-enter/);
  });
  await test('editing intended month invalidates confirmation; cancelled readonly response cannot reopen Settings',async()=>{
    const t=environment({storage:new Map([['scanner-token','remembered-synthetic']])});openSettings(t);reviewMonth(t);
    t.elements['month-select'].value='12';t.elements['month-select'].listeners.change();t.elements['month-confirm'].listeners.click();assert.equal(t.monthCalls.length,0);
    const u=environment({storage:new Map([['scanner-token','remembered-synthetic']])});u.elements['settings-open'].listeners.click();u.elements['settings-back'].listeners.click();u.settingsCalls[0].success({...settingsInfo});
    assert.equal(u.elements['settings-view'].hidden,true);assert.equal(u.elements['month-password'].value,'');
  });
  await test('confirmation input is masked, not persisted/logged, and is cleared on exit',async()=>{
    const t=environment({storage:new Map([['scanner-token','remembered-synthetic']])});openSettings(t);reviewMonth(t);t.ctx.window.pagehide();
    assert.equal(t.elements['month-password'].value,'');assert.equal(t.storage.get('scanner-token'),'remembered-synthetic');
    assert.match(html,/<input id="month-password" type="password"[^>]*autocomplete="off"/);assert.match(html,/<p id="month-status"[^>]*aria-live="polite"/);
    assert.doesNotMatch(script,/saveToken\([^)]*monthPassword|setItem\([^)]*monthPassword|console\./);
  });
  console.log(`${passed} inert UI tests passed`);
})().catch(err=>{console.error(err);process.exitCode=1;});
