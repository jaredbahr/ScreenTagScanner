/** Approved 2024 PK = earnings. Glass reference prices are never used here. */
var PART_EARNINGS = {
  '580602':{name:'Spring pins',rate:0.50,unit:'each'},'580603':{name:'Spring clips',rate:0.50,unit:'each'},
  '580604':{name:'Plastic tabs',rate:0.50,unit:'each'},'580607':{name:'Turn buttons',rate:0.50,unit:'each'},
  '580401':{name:'Corners',rate:2,unit:'each'},'580402':{name:'Latches',rate:2.50,unit:'each'},
  '580404':{name:'Rollers',rate:6,unit:'each'},'580409':{name:'Patio door corners',rate:5,unit:'each'},
  '580406':{name:'Pella corners',rate:2,unit:'each'},'580407':{name:'Sears corners/latches',rate:3,unit:'each'},
  '580414':{name:'Anderson rollers',rate:9,unit:'each'},'580605':{name:'Frame spreaders',rate:2,unit:'each'},
  '580601':{name:'New-screen corners',rate:1.50,unit:'set4',buildOverlap:true},
  '580625':{name:'Assembly',rate:2.25,unit:'side',buildOverlap:true},
  '580408':{name:'Pet grille installation',rate:8,unit:'job'},'580301':{name:'Wood-frame extra labor',rate:11,unit:'job'}
};
var ZERO_PK_MATERIALS = ['575001','575003','575006','54249','54398','54429'];
var STANDARD_SCREEN_LABOR = ['575013','575011','580606'];
var PARTS_RECEIPT = 'PARTS_EARNINGS_V1: ';
function escapePartsReceiptText_(text) {
  return String(text||'').replace(/(^|\n)(PARTS_EARNINGS_V1: )/g,'$1Literal OCR: $2');
}
function partsClient_(x) {
  return JSON.stringify([sequenceIdentity_(x.customer_name),sequenceIdentity_(x.last_name),String(x.phone||'').replace(/\D/g,'')]);
}

function partsScope_(x, group) {
  var st=resolveStore_(x).store;if(!st||!x.ticket_number||!sequenceIdentity_(x.last_name||x.customer_name))return '';
  if(group){
    if(x.tag_count>1)return JSON.stringify([st.tab,String(x.ticket_number),'group',x.tag_count]);
    if(x.form_type==='new_build'&&x.screens_on_tag>1)return JSON.stringify([st.tab,String(x.ticket_number),'build-form',x.width_in,x.height_in]);
    return ''; // no inferred group identity/allocation
  }
  return JSON.stringify([st.tab,String(x.ticket_number),'tag',tagOf_(x),x.width_in,x.height_in,x.billable_inches,x.item_type]);
}
function calculateParts_(x) {
  var laborLines=x._extra_labor_plan ? x._extra_labor_plan.recognized : [];
  if(laborLines && laborLines.length) {
    x=Object.assign({},x);
    ['extras','group_extras'].forEach(function(k){x[k]=String(x[k]||'').split('\n').filter(function(line){return laborLines.indexOf(line.trim())<0;}).join('\n');});
  }
  var plan={items:[],flags:[],posted:[],references:[]},parts=Array.isArray(x.parts)?x.parts:[];
  if((String(x.extras||'').trim()||String(x.group_extras||'').trim())&&!parts.length){
    plan.flags.push('Literal extras have no structured parts evidence: verify quantity and earnings manually');
  }
  var literalText=[x.extras||'',x.group_extras||''].join('\n'),literalSkus=literalText.match(/\b\d{5,7}\b/g)||[];
  if(parts.length&&literalSkus.some(function(s){return Object.prototype.hasOwnProperty.call(PART_EARNINGS,s)&&!parts.some(function(p){return p&&String(p.sku||'').trim()===s;});})){
    plan.flags.push('Literal extras include a parts SKU missing from structured evidence; reconcile remaining earnings manually');
  }
  if(parts.length>30){plan.flags.push('More than 30 parts lines: earnings need manual review');return plan;}
  if(parts.length&&Array.isArray(x.unclear)&&x.unclear.some(function(f){return /part|extra|pin|sku|quantity/i.test(String(f));})){
    plan.flags.push('Parts quantity/identity was flagged unclear: earnings need manual review');return plan;
  }
  var counts={};parts.forEach(function(p){if(p&&typeof p.sku==='string'){var s=p.sku.trim();counts[s]=(counts[s]||0)+1;}});
  parts.forEach(function(p){
    if(!p||typeof p.sku!=='string'){plan.flags.push('Part SKU missing: earnings need manual review');return;}
    var sku=p.sku.trim();
    if(ZERO_PK_MATERIALS.indexOf(sku)>=0||STANDARD_SCREEN_LABOR.indexOf(sku)>=0||exactGlassSkus_(sku).length)return;
    if(sku==='575005'||sku==='515005'){plan.flags.push('Spline-reference earnings uncertain; existing spline formulas preserved');return;}
    var ref=Object.prototype.hasOwnProperty.call(PART_EARNINGS,sku)?PART_EARNINGS[sku]:null;if(!ref){plan.flags.push('Unrecognized part SKU: earnings need manual review');return;}
    var raw=String(p.raw||''),rawSkus=raw.match(/\b\d{5,7}\b/g)||[],rawQty=/\b(?:qty|quantity)\s*[:=#]?\s*(\d+)\b/i.exec(raw);
    var quantityConflict=literalText.split('\n').some(function(line){
      var skus=line.match(/\b\d{5,7}\b/g)||[],qty=/\b(?:qty|quantity)\s*[:=#]?\s*(\d+)\b/i.exec(line);
      return skus.indexOf(sku)>=0&&qty&&(skus.length>1||Number(qty[1])!==p.quantity);
    });
    if(rawSkus.length&&rawSkus.indexOf(sku)<0||rawQty&&Number(rawQty[1])!==p.quantity||quantityConflict){
      plan.flags.push('SKU '+sku+' structured parts disagree with literal SKU/quantity evidence; earnings held for review');return;
    }
    var groupText=String(x.group_extras||'').trim(),groupSkus=groupText.match(/\b\d{5,7}\b/g)||[];
    // A group field is independent evidence: never let a contradictory per-tag boolean charge each sibling.
    // Explicit unrelated group SKUs can coexist with a genuinely separate per-tag part.
    var literalGroup=groupPartsLine_(String(p.raw||''))||!!groupText&&(!groupSkus.length||groupSkus.indexOf(sku)>=0);
    if(p.group_wide!==true&&literalGroup){
      plan.flags.push('SKU '+sku+' group/per-tag evidence disagrees: earnings held for manual allocation');return;
    }
    if(counts[sku]>1){plan.flags.push('Repeated SKU '+sku+': reconcile quantities before adding earnings');return;}
    if(!Number.isInteger(p.quantity)||p.quantity<1||p.quantity>1000){plan.flags.push('SKU '+sku+' quantity missing/uncertain: no automatic earnings');return;}
    var unit=String(p.unit||'unknown').toLowerCase();
    var compatible=ref.unit==='each'?['each','piece','unknown'].indexOf(unit)>=0:
      ref.unit==='set4'?unit==='set4':ref.unit==='side'?['side','piece'].indexOf(unit)>=0:
      unit==='job'||(unit==='unknown'&&p.quantity===1);
    if(!compatible){plan.flags.push('SKU '+sku+' unit needs review ('+ref.unit+' basis)');return;}
    if(ref.buildOverlap&&x.form_type==='new_build'){plan.flags.push('SKU '+sku+' may already be covered by the build base/labor; no duplicate earnings added');return;}
    if(x.screens_on_tag>1&&/\bper frame\b/i.test(String(p.raw||''))){plan.flags.push('Per-frame parts on a multi-frame form need manual allocation');return;}
    var group=p.group_wide===true||groupPartsLine_(String(p.raw||'')),scope=partsScope_(x,group);
    if(group&&Array.isArray(x.unclear)&&x.unclear.some(function(f){return /tag_count|tag_index|sequence/i.test(String(f));}))scope='';
    if(!scope){plan.flags.push('Group/part identity is uncertain: allocate earnings manually');return;}
    plan.items.push({sku:sku,name:ref.name,quantity:p.quantity,rate:ref.rate,unit:ref.unit,group:group,scope:scope,amount:cents_(p.quantity*ref.rate)});
  });
  return plan;
}
function partsReceipts_(text) {
  var out=[];String(text||'').split('\n').forEach(function(line){
    if(line.indexOf(PARTS_RECEIPT)!==0)return;
    try{
      var parsed=JSON.parse(line.slice(PARTS_RECEIPT.length));
      if(!Array.isArray(parsed)||!parsed.length||parsed.length>30){out.push({invalid:true});return;}
      parsed.forEach(function(r){
        var ref=r&&Object.prototype.hasOwnProperty.call(PART_EARNINGS,r.sku)?PART_EARNINGS[r.sku]:null;
        var scope,client;try{scope=JSON.parse(r&&r.scope);client=JSON.parse(r&&r.client);}catch(err){}
        var valid=ref&&Array.isArray(scope)&&scope.length>=3&&scope[0]===r.tab&&sequenceIdentity_(scope[1])===r.ticket&&
          (r.group?['group','build-form'].indexOf(scope[2])>=0:scope[2]==='tag')&&
          Array.isArray(client)&&client.length===3&&client.every(function(v){return typeof v==='string';})&&
          !!(client[1]||client[0])&&r.customer===(client[1]||client[0])&&/^\d*$/.test(client[2])&&
          typeof r.customer==='string'&&!!r.customer&&typeof r.ticket==='string'&&!!r.ticket&&
          Number.isInteger(r.quantity)&&r.quantity>=1&&r.quantity<=1000&&r.rate===ref.rate&&r.unit===ref.unit&&
          Number.isFinite(r.amount)&&r.amount===cents_(r.quantity*r.rate)&&typeof r.group==='boolean'&&
          ['reserved','posted'].indexOf(r.status)>=0&&typeof r.tab==='string'&&!!r.tab&&
          ['screens','windows'].indexOf(r.block)>=0&&Number.isInteger(r.row)&&r.row>=2&&
          Number.isFinite(r.expectedTotal)&&r.expectedTotal>=r.amount;
        out.push(valid?r:{invalid:true});
      });
    }
    catch(err){out.push({invalid:true});}
  });return out;
}
function preparePartsEarnings_(ss,x) {
  var plan=calculateParts_(x),st=resolveStore_(x).store;if(!st||!plan.items.length)return plan;
  var sh=storeSheet_(ss, st),layout;try{layout=storeLayout_(sh);}catch(err){plan.flags.push('Layout must be reviewed before parts earnings');plan.items=[];return plan;}
  var found=[];
  ['screens','windows'].forEach(function(block){
    var c=layout[block],earning=block==='screens'?c.EARNING:c.OTHER_EARN,end=block==='screens'?screenBlockEnd_(sh):WINDOW_LAST_ROW;
    var notes=sh.getRange(2,earning,end-1,1).getNotes();notes.forEach(function(r,i){
      partsReceipts_(r[0]).forEach(function(receipt){
        if(receipt.invalid){plan.flags.push('Existing earnings receipt needs review; no new automatic allocation');return;}
        var row=i+2,current=sh.getRange(row,earning).getValues()[0][0];
        if(receipt.tab!==st.tab||receipt.block!==block||receipt.row!==row||
          receipt.customer!==sequenceIdentity_(sh.getRange(row,c.NAME).getValues()[0][0])||
          receipt.ticket!==sequenceIdentity_(sh.getRange(row,c.TICKET).getValues()[0][0])||
          receipt.status==='posted'&&current!==receipt.expectedTotal){
          plan.flags.push('Existing earnings receipt does not match its store row; reconcile manually');return;
        }
        found.push(Object.assign({},receipt,{tab:st.tab,block:block,row:i+2,
          paid:current===receipt.expectedTotal}));
      });
    });
  });
  // Scans Notes contain untrusted OCR and are an audit copy only, never payment authority.
  plan.items=plan.items.filter(function(item){
    var prior=found.filter(function(r){return r.scope===item.scope&&r.sku===item.sku;})[0];
    if(!prior)return true;
    var sameClient=prior.client===partsClient_(x);plan.references.push({item:item,prior:prior,sameClient:sameClient});
    if(!sameClient)plan.flags.push('Parts group customer identity differs from the earlier receipt; earnings held for manual review');
    if(!prior.paid)plan.flags.push('Parts allocation is pending on an earlier row; reconcile it before adding earnings');
    if(prior.quantity!==item.quantity||prior.amount!==item.amount)plan.flags.push('Parts quantity/rate differs from the earlier receipt; no additional earnings added');
    return false;
  });
  if(plan.flags.some(function(f){return /Existing earnings receipt/.test(f);}))plan.items=[];
  return plan;
}
function applyPartsEarnings_(sh,row,c,x,firstRow,base) {
  var plan=x._parts_plan;if(!plan)return;
  var earning=x.item_type==='window'?c.OTHER_EARN:c.EARNING,range=sh.getRange(row,earning),note=range.getNote(),lines=[];
  plan.items.forEach(function(item){lines.push('SKU '+item.sku+' '+item.name+': '+item.quantity+' '+item.unit+' × $'+item.rate.toFixed(2)+' = $'+item.amount.toFixed(2)+(item.group?' total for the whole group; credit once':' total for this tag/form; credit once'));});
  plan.references.forEach(function(ref){lines.push(ref.sameClient===false?'SKU '+ref.prior.sku+': customer identity conflicts with an earlier group receipt; earnings held for manual allocation.':
    'SKU '+ref.prior.sku+': $'+ref.prior.amount.toFixed(2)+' whole-group/tag total '+(ref.prior.paid?'already recorded':'PENDING review')+' on '+ref.prior.tab+' '+ref.prior.block+' row '+ref.prior.row+'. No duplicate amount added.');});
  if(!firstRow&&plan.posted.length)lines.push('Parts total is recorded on the first row of this form; no duplicate amount added.');
  if(!lines.length)return;
  var receipts=firstRow?plan.items.map(function(item){return Object.assign({},item,{status:'reserved',tab:storeByTabName_(sh.getName()).tab,block:x.item_type==='window'?'windows':'screens',row:row,
    client:partsClient_(x),customer:sequenceIdentity_(x.last_name||x.customer_name),ticket:sequenceIdentity_(x.ticket_number)});}):[];
  var extra=receipts.reduce(function(n,item){return n+item.amount;},0),total=cents_((base||0)+extra);
  receipts.forEach(function(r){r.expectedTotal=total;});
  var human=escapePartsReceiptText_((note?note+'\n\n':'')+lines.join('\n'));
  // Reserve receipts in notes BEFORE the value write. An interrupted write must be reconciled, never duplicated.
  range.setNote(human+(receipts.length?'\n'+PARTS_RECEIPT+JSON.stringify(receipts):''));
  if(receipts.length){range.setNumberFormat('$0.00').setValue(total);receipts.forEach(function(r){r.status='posted';});
    range.setNote(human+'\n'+PARTS_RECEIPT+JSON.stringify(receipts));plan.posted.push.apply(plan.posted,receipts);}
  range.setBackground(FLAG_COLOR);
}
