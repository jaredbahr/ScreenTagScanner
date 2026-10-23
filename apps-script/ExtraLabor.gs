/** Explicit standalone added labor only. Cost-sheet SKU lines remain Parts' responsibility. */
var EXTRA_LABOR_RECEIPT = 'EXTRA_LABOR_V1: ';
function extraLaborLine_(line) {
  line=String(line||'').trim();
  // A SKU-bearing line must never bypass approved PK pricing, even if it says labor.
  if(!line || /\b\d{5,7}\b/.test(line))return null;
  var label=/\b(?:LB|(?:extra|additional)\s+labor)\b/i;
  if(!label.test(line))return null;
  var matches=[],re=/\b(?:LB|(?:extra|additional)\s+labor)\s*(?:earn(?:ings)?|charge)?\s*[:=]?\s*\$?\s*(\d+(?:\.\d{1,2})?)(?![\d.,])/ig,m;
  while((m=re.exec(line)))matches.push(m);
  if(matches.length!==1)return {raw:line,problem:'Additional labor amount is not explicit'};
  var amount=Number(matches[0][1]),rest=line.replace(matches[0][0],'');
  if(/\b(?:no|not|already|included|including|total|base|existing|paid|waived|waive|replace|replaces|replacement|deduct|less|subtract|cancelled|canceled)\b/i.test(line))return {raw:line,problem:'Additional labor may be negated, included or a total; manual review'};
  if(!Number.isFinite(amount)||amount<=0||amount>1000||/\b(?:total|base|existing)\s+(?:LB|labor)\b/i.test(line)||/\d|\?|\b(?:or|vs|versus|EUR|GBP)\b|\$|\b(?:total\s+labor|labor\s+total|subtotal|retail|tax|refund|credit|cancel|no\s+charge|per|each)\b|[-−]/i.test(rest))
    return {raw:line,problem:'Additional labor amount/basis needs review'};
  return {raw:line,amount:cents_(amount),key:line.toLowerCase().replace(/\s+/g,' ').trim()};
}
function calculateExtraLabor_(x) {
  var plan={items:[],flags:[],posted:[],references:[],recognized:[]};
  var lines=[];
  [x.extras||'',x.group_extras||''].forEach(function(text,i){String(text).split('\n').forEach(function(raw){var item=extraLaborLine_(raw);if(item)lines.push({item:item,group:i===1||/\b(?:both|all|every|whole)\b/i.test(raw)});});});
  if(!lines.length)return plan;
  if(x.has_corrections || x.quantity_conflict || x.name_unclear || (x.unclear||[]).length){plan.flags.push('Additional labor has uncertain scan evidence: amount and scope need manual review');return plan;}
  // A balance-due slip's labor is already billed through its extra inches; never credit it twice.
  var due=balanceDueQty_(x);if(due.qty||due.bad){plan.flags.push('Additional labor on a tag with a balance-due slip may be the slip\'s own charge: reconcile by hand');return plan;}
  if(lines.some(function(l){return l.item.problem;})){plan.flags.push('Additional labor amount/basis needs manual review');return plan;}
  // Multiple labor lines require explicit reconciliation; do not add repeated slip/tag text.
  if(lines.length!==1){plan.flags.push('Multiple additional labor lines: reconcile before crediting');return plan;}
  var line=lines[0];
  if((x.parts||[]).some(function(p){return p&&String(p.raw||'').split('\n').some(function(raw){return raw.trim()===line.item.raw;});})){plan.flags.push('The same charge appears as both parts and additional labor: reconcile manually');return plan;}
  var st=resolveStore_(x).store,client=partsClient_(x),dates=storeDates_(x);
  if(!st || !x.ticket_number || !sequenceIdentity_(x.last_name||x.customer_name) || !String(x.phone||'').replace(/\D/g,'') || dates.dateIn===''){
    plan.flags.push('Additional labor identity/date is incomplete: manual review');return plan;
  }
  if(x.screens_on_tag>1&&!line.group){plan.flags.push('Additional labor on a multi-frame form needs explicit whole-form scope');return plan;}
  if(line.group && !(x.tag_count>1 || x.form_type==='new_build'&&x.screens_on_tag>1)){
    plan.flags.push('Additional labor group identity is incomplete: manual review');return plan;
  }
  var groupKey=JSON.stringify([st.tab,String(x.phone||'').replace(/\D/g,''),dates.dateIn,x.tag_count>1?x.tag_count:x.screens_on_tag]);
  var scope=line.group?JSON.stringify([st.tab,'group',groupKey]):JSON.stringify([st.tab,'tag',String(x.ticket_number),tagOf_(x),x.width_in,x.height_in,x.item_type]);
  plan.items.push({amount:line.item.amount,raw:line.item.raw,key:line.item.key,group:line.group,scope:scope,groupKey:groupKey});
  plan.recognized.push(line.item.raw);return plan;
}
function extraLaborReceipts_(note) {
  var out=[];String(note||'').split('\n').forEach(function(line){
    if(line.indexOf(EXTRA_LABOR_RECEIPT)!==0)return;
    try{var r=JSON.parse(line.slice(EXTRA_LABOR_RECEIPT.length));
      var scope=JSON.parse(r.scope),client=JSON.parse(r.client),groupKey=JSON.parse(r.groupKey);
      var identity=Array.isArray(client)&&client.length===3&&client.every(function(v){return typeof v==='string';})&&receiptCustomerOk_(r.customer,client)&&/^\d+$/.test(client[2])&&Array.isArray(groupKey)&&groupKey.length===4&&groupKey[0]===r.tab&&groupKey[1]===client[2]&&Number.isFinite(groupKey[2])&&Number.isInteger(groupKey[3])&&groupKey[3]>=1&&Array.isArray(scope)&&scope[0]===r.tab&&
        (r.group?scope.length===3&&scope[1]==='group'&&scope[2]===r.groupKey&&groupKey[3]>1:scope.length===7&&scope[1]==='tag'&&sequenceIdentity_(scope[2])===r.ticket&&scope[6]===(r.block==='windows'?'window':'screen'));
      var valid=identity&&r&&r.version===1&&typeof r.scope==='string'&&typeof r.client==='string'&&typeof r.customer==='string'&&!!r.customer&&typeof r.ticket==='string'&&!!r.ticket&&typeof r.tab==='string'&&!!storeByTabName_(r.tab)&&['screens','windows'].indexOf(r.block)>=0&&Number.isInteger(r.row)&&r.row>=2&&typeof r.group==='boolean'&&typeof r.key==='string'&&typeof r.groupKey==='string'&&Number.isFinite(r.amount)&&r.amount>0&&r.amount<=1000&&r.amount===cents_(r.amount)&&Number.isFinite(r.base)&&r.base>=0&&r.expectedTotal===cents_(r.base+r.amount)&&['reserved','posted'].indexOf(r.status)>=0;
      out.push(valid?r:{invalid:true});
    }catch(e){out.push({invalid:true});}
  });return out;
}
function prepareExtraLabor_(ss,x) {
  var plan=calculateExtraLabor_(x),st=resolveStore_(x).store;if(!plan.items.length||!st)return plan;
  var sh=storeSheet_(ss,st),layout;try{layout=storeLayout_(sh);}catch(e){plan.items=[];plan.flags.push('Additional labor layout needs review');return plan;}
  var found=[],broken=false;
  ['screens','windows'].forEach(function(block){var c=layout[block],end=block==='screens'?screenBlockEnd_(sh):WINDOW_LAST_ROW;
    sh.getRange(2,c.LB_EARN,end-1,1).getNotes().forEach(function(row,i){extraLaborReceipts_(row[0]).forEach(function(r){
      var actualRow=i+2;
      if(r.invalid || r.tab!==st.tab || r.block!==block || r.row!==actualRow || r.customer!==sequenceIdentity_(sh.getRange(actualRow,c.NAME).getValues()[0][0]) || r.ticket!==sequenceIdentity_(sh.getRange(actualRow,c.TICKET).getValues()[0][0]) || r.status!=='posted' || sh.getRange(actualRow,c.LB_EARN).getFormulas()[0][0] || sh.getRange(actualRow,c.LB_EARN).getValues()[0][0]!==r.expectedTotal){broken=true;return;}
      found.push(r);
    });});
  });
  if(broken){plan.items=[];plan.flags.push('Existing additional labor receipt is pending or changed: reconcile before crediting');return plan;}
  plan.items=plan.items.filter(function(item){
    var prior=found.filter(function(r){return r.scope===item.scope || item.group&&r.group&&(JSON.stringify(JSON.parse(r.groupKey).slice(0,3))===JSON.stringify(JSON.parse(item.groupKey).slice(0,3)) || r.ticket===sequenceIdentity_(x.ticket_number));})[0];
    if(!prior)return true;
    var same=prior.client===partsClient_(x)&&prior.amount===item.amount&&prior.key===item.key&&(!item.group||prior.groupKey===item.groupKey);
    plan.references.push({prior:prior,same:same});
    if(!same || prior.ticket!==sequenceIdentity_(x.ticket_number))plan.flags.push('Additional labor group/amount differs from an earlier credit: reconcile manually; no duplicate added');
    return false;
  });return plan;
}
function applyExtraLabor_(sh,row,c,x,firstRow,base,flags) {
  var plan=x._extra_labor_plan;if(!plan)return;
  var range=sh.getRange(row,c.LB_EARN),existing=range.getNote(),human=[];
  plan.references.forEach(function(ref){human.push('Additional labor already credited or held for reconciliation on '+ref.prior.tab+' '+ref.prior.block+' row '+ref.prior.row+'; no duplicate amount added.');});
  if(!firstRow&&plan.posted.length)human.push('Whole-form additional labor was credited on the first row only.');
  if(firstRow&&plan.items.length){
    if(typeof base!=='number'||!Number.isFinite(base)||base<0||range.getFormulas()[0][0]||range.getValues()[0][0]!==base){flags.push('Additional labor base is blank, formula-backed or changed: enter the extra labor manually');range.setNote([existing,'Pending additional labor (not credited): '+plan.items[0].raw].filter(Boolean).join('\n'));return;}
    var item=plan.items[0],st=storeByTabName_(sh.getName());
    var r=Object.assign({},item,{version:1,status:'reserved',tab:st.tab,block:x.item_type==='window'?'windows':'screens',row:row,client:partsClient_(x),customer:sequenceIdentity_(sheetName_(x)),ticket:sequenceIdentity_(x.ticket_number),base:base,expectedTotal:cents_(base+item.amount)});
    var description='Additional labor: $'+item.amount.toFixed(2)+(item.group?' for the whole group/form, once':' for this tag, once')+'; base $'+base.toFixed(2)+' + extra = $'+r.expectedTotal.toFixed(2)+'.\n'+item.raw;
    var note=String(existing||'').replace(/(^|\n)(EXTRA_LABOR_V1: )/g,'$1Literal text: $2');
    var prefix=[note,description].filter(Boolean).join('\n');
    range.setNote(prefix+'\n'+EXTRA_LABOR_RECEIPT+JSON.stringify(r));
    range.setNumberFormat('$0.00').setValue(r.expectedTotal);
    r.status='posted';range.setNote(prefix+'\n'+EXTRA_LABOR_RECEIPT+JSON.stringify(r));plan.posted.push(r);
  }
  if(human.length)range.setNote([existing,human.join('\n')].filter(Boolean).join('\n'));
}

/** Exclude verified labor from parts-entry notes; evidence remains in LB notes and Scans. */
function extraLaborPartsNote_(x,text) {
  var lines=x._extra_labor_plan&&x._extra_labor_plan.recognized||[];
  if(!lines.length)return text;
  return String(text||'').split('\n').filter(function(line){return lines.indexOf(line.trim())<0;}).filter(function(line,i,all){return !/^Group extras \(whole group;/.test(line)||all.slice(i+1).some(function(rest){return !!rest.trim();});}).join('\n').trim();
}
