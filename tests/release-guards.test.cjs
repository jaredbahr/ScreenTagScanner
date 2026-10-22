'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {checkRelease,git}=require('../tools/release-check.cjs');
const {validate}=require('../tools/validate-release.cjs');
let passed=0;
const TEMP_ROOT=path.resolve(__dirname,'../private/release-guard-fixtures');
function test(name,fn){fn();passed++;console.log('PASS release-guard: '+name);}
function fixture(){
  fs.mkdirSync(TEMP_ROOT,{recursive:true});
  const root=fs.mkdtempSync(path.join(TEMP_ROOT,'screenrepo-release-guard-'));
  const write=(file,text)=>{fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});fs.writeFileSync(path.join(root,file),text);};
  git(root,['init','-b','live']);git(root,['config','user.name','Synthetic fixture']);git(root,['config','user.email','synthetic@example.invalid']);git(root,['config','commit.gpgsign','false']);
  fs.mkdirSync(path.join(root,'.empty-hooks'));git(root,['config','core.hooksPath','.empty-hooks']);
  const save=message=>{git(root,['add','.']);git(root,['commit','-m',message]);return git(root,['rev-parse','HEAD']);};
  const runtime=['apps-script/Extraction.gs','apps-script/Feature.gs','apps-script/appsscript.json'];
  write('.gitignore','stage.tmp\n.empty-hooks/\n');write(runtime[0],"var EXTRACTION_VERSION = '0.13.16-draft';\n");
  write(runtime[1],'function backup_(){return 1;}\n');write(runtime[2],JSON.stringify({oauthScopes:['synthetic-scope'],runtimeVersion:'V8',webapp:{access:'ANYONE_ANONYMOUS'}}));
  write('tests/01-first.test.cjs',"require('node:fs').writeFileSync('stage.tmp','first');console.log('1 fake tests passed');\n");
  write('tests/02-second.test.cjs',"require('node:assert/strict').equal(require('node:fs').readFileSync('stage.tmp','utf8'),'first');console.log('1 fake tests passed');\n");
  const common=save('Synthetic common source');write(runtime[0],"var EXTRACTION_VERSION = '0.13.17-draft';\n");const live=save('Synthetic verified deployment');
  git(root,['checkout','-b','development',common]);write('UPSTREAM.txt','Synthetic intended update\n');const upstream=save('Synthetic upstream update');
  git(root,['checkout','-b','candidate',live]);git(root,['merge','--no-commit','--no-ff','development']);
  write(runtime[0],"var EXTRACTION_VERSION = '0.13.18-draft';\n");
  const manifest={schemaVersion:1,developmentBranch:'development',requiredUpstreamCommit:upstream,lastVerifiedDeployment:{sourceCommit:live,version:'0.13.17-draft'},
    requiredProductionFiles:runtime,baselineRuntimeBlobs:Object.fromEntries(runtime.map(f=>[f,git(root,['rev-parse',live+':'+f])])),allowedPublicFunctions:[],
    requiredFunctions:{'apps-script/Feature.gs':['backup_']},minimumTestCounts:{'tests/01-first.test.cjs':1,'tests/02-second.test.cjs':1},allowWorkflowDefinitions:false};
  const saveManifest=()=>write('release/manifest.json',JSON.stringify(manifest));saveManifest();const candidate=save('Synthetic combined candidate');
  return {root,write,save,manifest,saveManifest,live,upstream,candidate,check:ref=>checkRelease(root,{ref:ref||'HEAD',upstreamRef:'development'})};
}
function withFixture(fn){const t=fixture();try{fn(t);}finally{
  const base=fs.realpathSync(TEMP_ROOT),target=fs.realpathSync(t.root),relative=path.relative(base,target);
  assert.ok(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative)&&path.basename(target).startsWith('screenrepo-release-guard-'));
  fs.rmSync(target,{recursive:true,force:true});
}}
test('a committed candidate carrying live and upstream histories passes',()=>withFixture(t=>{const r=t.check();assert.equal(r.sha,t.candidate);assert.equal(r.version,'0.13.18-draft');assert.equal(r.testFiles.length,2);}));
test('dirty work and omitted production modules are rejected',()=>withFixture(t=>{
  fs.unlinkSync(path.join(t.root,'apps-script/Feature.gs'));assert.throws(()=>t.check(),/Commit reviewed changes/);t.save('Synthetic omitted module');assert.throws(()=>t.check(),/Production inventory differs/);
}));
test('copied trees without deployed or upstream ancestry are rejected',()=>withFixture(t=>{
  const tree=git(t.root,['rev-parse','HEAD^{tree}']);
  const stale=git(t.root,['commit-tree',tree,'-p',t.upstream,'-m','Synthetic stale live ancestry']);assert.throws(()=>t.check(stale),/Last verified deployed source is not an ancestor/);
  const missed=git(t.root,['commit-tree',tree,'-p',t.live,'-m','Synthetic missed upstream']);assert.throws(()=>t.check(missed),/upstream reconciliation source is not an ancestor/);
}));
test('changed runtime cannot reuse or downgrade a deployed version',()=>withFixture(t=>{
  t.write('apps-script/Extraction.gs',"var EXTRACTION_VERSION = '0.13.17-draft';\n");t.write('apps-script/Feature.gs','function backup_(){return 2;}\n');t.save('Synthetic stale version');assert.throws(()=>t.check(),/version newer/);
}));
test('new scopes or access changes require explicit review',()=>{
  for(const change of [x=>x.oauthScopes.push('synthetic-new-scope'),x=>x.webapp.access='DOMAIN'])withFixture(t=>{
    const file=path.join(t.root,'apps-script/appsscript.json'),x=JSON.parse(fs.readFileSync(file,'utf8'));change(x);t.write('apps-script/appsscript.json',JSON.stringify(x));t.save('Synthetic security change');assert.throws(()=>t.check(),/OAuth scopes, access/);
  });
});
test('missing feature functions or new public entrypoints are rejected',()=>{
  for(const [source,error]of [['function unrelated_(){}\n',/feature contract missing/],['function backup_(){}\nfunction exposed(){}\n',/Public server entrypoints changed/]])withFixture(t=>{
    t.write('apps-script/Feature.gs',source);t.save('Synthetic feature or API regression');assert.throws(()=>t.check(),error);
  });
});
test('removed suites and reduced executed test counts are rejected',()=>{
  withFixture(t=>{fs.unlinkSync(path.join(t.root,'tests/02-second.test.cjs'));t.save('Synthetic missing suite');assert.throws(()=>t.check(),/Regression suite inventory differs/);});
  withFixture(t=>{t.write('tests/02-second.test.cjs',"console.log('0 fake tests passed');\n");t.save('Synthetic missing cases');assert.throws(()=>validate(t.root,{upstreamRef:'development',quiet:true}),/fewer verified cases/);});
});
test('validation runs the approved suites sequentially without a hosted runner',()=>withFixture(t=>{
  const r=validate(t.root,{upstreamRef:'development',quiet:true});assert.equal(r.passed,2);assert.equal(r.suites,2);assert.equal(r.remoteFreshnessVerified,false);
}));
console.log(passed+' release-guard tests passed');
