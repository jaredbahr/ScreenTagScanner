'use strict';
// Local structural/ancestry gate. No deployment, scans, paid service or network unless --fetch is explicit.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),util=require('node:util');
const ROOT=path.resolve(__dirname,'..');
function git(root,args){return cp.execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:8*1024*1024}).trim();}
function json(text){return JSON.parse(text.replace(/^\uFEFF/,''));}
function policy(root){return json(fs.readFileSync(path.join(root,'release/manifest.json'),'utf8'));}
function requireThat(value,message){if(!value)throw Error(message);}
function commit(root,ref){requireThat(/^[A-Za-z0-9_][A-Za-z0-9_/.-]*$/.test(ref),'Use a commit SHA or branch ref.');return git(root,['rev-parse','--verify','--end-of-options',ref+'^{commit}']);}
function read(root,sha,file){try{return git(root,['show',sha+':'+file]);}catch(err){throw Error('Required committed file missing: '+file);}}
function ancestor(root,base,head,label){try{git(root,['merge-base','--is-ancestor',base,head]);}catch(err){throw Error(label+' is not an ancestor of the candidate. Reconcile histories; do not deploy a copied or stale branch.');}}
function version(source){const m=/var EXTRACTION_VERSION\s*=\s*'([0-9]+\.[0-9]+\.[0-9]+)(?:-draft)?'/.exec(source);requireThat(m,'Missing recognizable EXTRACTION_VERSION.');return m[1].split('.').map(Number);}
function newer(a,b){for(let i=0;i<3;i++){if(a[i]!==b[i])return a[i]>b[i];}return false;}
function config(text){const x=json(text);if(Array.isArray(x.oauthScopes))x.oauthScopes=x.oauthScopes.slice().sort();return x;}
function checkRelease(root=ROOT,options={}){
  const m=policy(root);requireThat(m.schemaVersion===1,'Unsupported release manifest version.');
  if(options.requireClean!==false)requireThat(!git(root,['status','--porcelain','--untracked-files=all']),'Commit reviewed changes before validating an exact release.');
  const sha=commit(root,options.ref||'HEAD'),live=commit(root,m.lastVerifiedDeployment.sourceCommit),upstream=commit(root,m.requiredUpstreamCommit);
  ancestor(root,live,sha,'Last verified deployed source');ancestor(root,upstream,sha,'Recorded upstream reconciliation source');
  const freshRef=options.upstreamRef||'refs/remotes/origin/'+m.developmentBranch;
  if(options.requireRemote!==false)ancestor(root,commit(root,freshRef),sha,'Fetched canonical development branch');
  const candidatePolicy=json(read(root,sha,'release/manifest.json'));
  requireThat(util.isDeepStrictEqual(candidatePolicy,m),'Candidate policy differs from the reviewed manifest in this checkout.');
  const expected=m.requiredProductionFiles.slice().sort(),actual=git(root,['ls-tree','-r','--name-only',sha,'--','apps-script']).split('\n').filter(Boolean).sort();
  requireThat(expected.length>0&&expected.every(f=>/^apps-script\/[\w.-]+\.(gs|html|json)$/.test(f)),'Invalid production inventory.');
  requireThat(util.isDeepStrictEqual(actual,expected),'Production inventory differs. Missing: '+expected.filter(f=>!actual.includes(f)).join(', ')+'; unexpected: '+actual.filter(f=>!expected.includes(f)).join(', '));
  const changed=[],sources={};
  for(const file of expected){
    const baselineBlob=git(root,['rev-parse',live+':'+file]);
    requireThat(m.baselineRuntimeBlobs[file]===baselineBlob,'Recorded baseline fingerprint differs: '+file);
    if(git(root,['rev-parse',sha+':'+file])!==baselineBlob)changed.push(file);
    sources[file]=read(root,sha,file);
  }
  const publicNames=[];
  for(const [file,source]of Object.entries(sources))if(file.endsWith('.gs')){
    for(const match of source.matchAll(/^(?:async\s+)?function\s+(\w+)\s*\(/gm))if(!match[1].endsWith('_'))publicNames.push(match[1]);
  }
  requireThat(util.isDeepStrictEqual(publicNames.sort(),m.allowedPublicFunctions.slice().sort()),'Public server entrypoints changed; security review is required.');
  for(const [file,names]of Object.entries(m.requiredFunctions))for(const name of names){
    requireThat(/^\w+_$/.test(name)&&sources[file]&&new RegExp('^function\\s+'+name+'\\s*\\(','m').test(sources[file]),'Required feature contract missing: '+file+' / '+name);
  }
  requireThat(util.isDeepStrictEqual(config(sources['apps-script/appsscript.json']),config(read(root,live,'apps-script/appsscript.json'))),'OAuth scopes, access, runtime or manifest settings changed; explicit review is required.');
  const currentVersion=version(sources['apps-script/Extraction.gs']),baselineVersion=version(read(root,live,'apps-script/Extraction.gs'));
  requireThat(!changed.length||newer(currentVersion,baselineVersion),'Changed production source must have a version newer than the verified deployment.');
  const testFiles=git(root,['ls-tree','-r','--name-only',sha,'--','tests']).split('\n').filter(f=>/^tests\/[\w.-]+\.test\.cjs$/.test(f)).sort();
  requireThat(util.isDeepStrictEqual(testFiles,Object.keys(m.minimumTestCounts).sort()),'Regression suite inventory differs from the release policy. Review new or missing tests.');
  requireThat(Object.values(m.minimumTestCounts).every(n=>Number.isInteger(n)&&n>0),'Invalid minimum test counts.');
  const workflows=git(root,['ls-tree','-r','--name-only',sha,'--','.github/workflows']);
  requireThat(m.allowWorkflowDefinitions||!workflows,'Workflow definitions require separate cost review. No hosted job was started.');
  return {sha,version:currentVersion.join('.')+'-draft',baseline:live,upstream,changedProductionFiles:changed,testFiles,minimumTestCounts:m.minimumTestCounts,remoteFreshnessVerified:!!options.fetched};
}
function args(argv){const out={};for(let i=0;i<argv.length;i++){if(argv[i]==='--fetch')out.fetch=true;else if(argv[i]==='--ref')out.ref=argv[++i];else if(argv[i]==='--upstream-ref')out.upstreamRef=argv[++i];else throw Error('Unknown release-check argument: '+argv[i]);}return out;}
function prepare(root,options){
  if(options.fetch){const branch=policy(root).developmentBranch;requireThat(/^[A-Za-z0-9_][A-Za-z0-9_/.-]*$/.test(branch),'Invalid canonical branch.');
    git(root,['fetch','--no-tags','origin','refs/heads/'+branch+':refs/remotes/origin/'+branch]);options.fetched=true;}
  return checkRelease(root,options);
}
if(require.main===module){try{const result=prepare(ROOT,args(process.argv.slice(2)));console.log(JSON.stringify(result,null,2));console.log(result.remoteFreshnessVerified?'Canonical branch fetched; Google source still requires read-only verification.':'Offline check only. Before deployment rerun with --fetch and verify the live Google source.');}catch(err){console.error('Release blocked: '+err.message);process.exitCode=1;}}
module.exports={checkRelease,prepare,args,policy,git};
