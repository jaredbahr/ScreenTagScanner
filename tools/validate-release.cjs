'use strict';
const path=require('node:path'),cp=require('node:child_process');
const {prepare,args}=require('./release-check.cjs');
function validate(root=path.resolve(__dirname,'..'),options={}){
  const result=prepare(root,options);
  const head=cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
  if(head!==result.sha)throw Error('Check out the candidate before running its regression suites.');
  let count=0;const order=['tests/offline.test.cjs',...result.testFiles.filter(f=>f!=='tests/offline.test.cjs')].filter(f=>result.testFiles.includes(f));
  for(const file of order){
    const run=cp.spawnSync(process.execPath,[path.join(root,file)],{cwd:root,encoding:'utf8',maxBuffer:8*1024*1024});
    if(run.status!==0)throw Error(file+' failed:\n'+(run.stdout||'')+(run.stderr||'')+(run.error?run.error.message:''));
    const summary=(run.stdout||'').trim().split(/\r?\n/).filter(Boolean).at(-1)||'',match=/^(\d+)\b.*passed/.exec(summary);
    if(!match||Number(match[1])<result.minimumTestCounts[file])throw Error(file+' ran fewer verified cases than the release policy requires: '+summary);
    count+=Number(match[1]);if(!options.quiet)console.log(file+': '+summary);
  }
  if(!options.quiet)console.log(count+' tests passed sequentially across '+order.length+' suites; source '+result.sha);
  return {...result,passed:count,suites:order.length};
}
if(require.main===module){try{validate(undefined,args(process.argv.slice(2)));}catch(err){console.error('Release validation failed: '+err.message);process.exitCode=1;}}
module.exports={validate};
