/** Approved 2024 PK = earnings. Glass reference prices are never used here. */
var PART_EARNINGS = {
  '580602':{name:'Spring pins',rate:0.50,unit:'each'},'580603':{name:'Spring clips',rate:0.50,unit:'each'},
  '580604':{name:'Plastic tabs',rate:0.50,unit:'each'},'580607':{name:'Turn buttons',rate:0.50,unit:'each'},
  '580401':{name:'Corners',rate:2,unit:'each'},'580402':{name:'Latches',rate:2.50,unit:'each'},
  '580404':{name:'Rollers',rate:6,unit:'each'},'580409':{name:'Patio door corners',rate:5,unit:'each'},
  '580406':{name:'Pella corners',rate:2,unit:'each'},'580407':{name:'Sears corners/latches',rate:3,unit:'each'},
  '580414':{name:'Anderson rollers',rate:9,unit:'each'},'580605':{name:'Frame spreaders',rate:2,unit:'each'},
  '580601':{name:'New-screen corners',rate:1.50,unit:'set4',buildOverlap:true},
  // Kirsten (2026-10-27): assembly ("cuts") is labor, so it is added to LB Earn on screen rows, not Earning.
  '580625':{name:'Assembly',rate:2.25,unit:'side',buildOverlap:true,column:'lb'},
  '580408':{name:'Pet grille installation',rate:8,unit:'job'},'580301':{name:'Wood-frame extra labor',rate:11,unit:'job'}
};
var ZERO_PK_MATERIALS = ['575001','575003','575006','54249','54398','54429'];
var STANDARD_SCREEN_LABOR = ['575013','575011','580606'];
var PARTS_RECEIPT = 'PARTS_EARNINGS_V1: ';
function escapePartsReceiptText_(text) {
  return String(text||'').replace(/(^|\n)(PARTS_EARNINGS_V1: )/g,'$1Literal OCR: $2');
}
/** The Name cell still matches a receipt. Receipts from 0.13.22-0.13.25 hold "li" while the cell holds "amy li". */
function receiptNameOk_(receipt,nameCell) {
  if(receipt.customer===nameCell)return true;
  try{var client=JSON.parse(receipt.client);return Array.isArray(client)&&receipt.customer===(client[1]||client[0])&&receiptCustomerOk_(nameCell,client);}catch(err){return false;}
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
/**
 * Spring pins are always $2.00 each to the customer (Kirsten, 2026-10-22), so a pins line with no
 * quantity but a dollar amount ("580602 $2.00") tells us the count. Only used when no quantity is written.
 */
var PIN_CUSTOMER_PRICE = 2.00;
function pinQuantityFromPrice_(raw, literalText) {
  var lines=[String(raw||'')].concat(String(literalText||'').split('\n').filter(function(l){return /\b580602\b/.test(l);}));
  // "3rd pin $2.00" means three pins in total, not one: ordinals stay manual (see ordinal-parts tests).
  if(lines.some(function(l){return /\b\d+(?:st|nd|rd|th)\b|\b(?:first|second|third|fourth|another|extra|additional)\b/i.test(l);}))return null;
  var amount=null,unitCents=Math.round(PIN_CUSTOMER_PRICE*100);
  for(var i=0;i<lines.length;i++){
    var line=lines[i];
    // Signed amounts, credits, unit prices and multiple numbers cannot establish a positive line total.
    if(/refund|credit|cancel|return|discount|\b(?:cr|minus|negative)\b|\bno\s+charge\b|[-−–—]\s*\$?\s*\d|\$\s*[-−–—]\s*\d|\d+\.\d{2}\s*[-−–—]|\(\s*\$?\s*\d/i.test(line))return null;
    if(/\?|\b(?:or|maybe|approx(?:imately)?|about|unclear|illegible|unreadable)\b/i.test(line))return null;
    if(/\b(?:pk|earnings?|wholesale)\b/i.test(line))return null; // shop earnings are not a customer line total
    if(/\b(?:ea|each|unit\s+price|per\s+pin)\b|\/\s*(?:ea|each|pin)\b/i.test(line))return null;
    var skus=line.match(/\b\d{5,7}\b/g)||[];
    if(skus.length>1||skus.some(function(s){return s!=='580602';}))return null;
    if(skus.indexOf('580602')<0)continue; // require literal SKU evidence for the price being used
    if(/^\s*\d+\s+580602\b/.test(line)||/\b(?:qty|quantity)\s*[:=#]?\s*[-+]?\d/i.test(line))return null;
    var numbers=line.replace(/\b580602\b/g,' ').match(/(?:\$\s*)?\d+(?:\.\d+)?/g)||[];
    if(!numbers.length)continue;
    if(numbers.length!==1||!/^\$?\s*\d{1,3}\.\d{2}$/.test(numbers[0]))return null;
    var cents=Math.round(Number(numbers[0].replace(/[^\d.]/g,''))*100),q=cents/unitCents;
    if(!Number.isInteger(q)||q<1||q>50||amount!==null&&amount!==cents)return null;
    amount=cents;
  }
  return amount===null?null:{quantity:amount/unitCents,amount:amount/100};
}
function calculateParts_(x) {
  // Checked on the tag as read, before recognized labor lines are taken out below.
  var laborLine=[x.extras||'',x.group_extras||''].join('\n').split('\n').some(function(l){return !!extraLaborLine_(l);});
  var laborLines=x._extra_labor_plan ? x._extra_labor_plan.recognized : [];
  if(laborLines && laborLines.length) {
    x=Object.assign({},x);
    ['extras','group_extras'].forEach(function(k){x[k]=String(x[k]||'').split('\n').filter(function(line){return laborLines.indexOf(line.trim())<0;}).join('\n');});
  }
  var plan={items:[],flags:[],posted:[],references:[]},parts=Array.isArray(x.parts)?x.parts:[];
  var literalAll=[x.extras||'',x.group_extras||''].join('\n'),derivedPins=false;
  parts=parts.map(function(p){
    if(!p||String(p.sku||'').trim()!=='580602'||p.quantity!==0)return p;
    var d=pinQuantityFromPrice_(p.raw,literalAll);if(!d)return p;
    derivedPins=true;return Object.assign({},p,{quantity:d.quantity,derived:'$'+d.amount.toFixed(2)+' at $'+PIN_CUSTOMER_PRICE.toFixed(2)+' each'});
  });
  if((String(x.extras||'').trim()||String(x.group_extras||'').trim())&&!parts.length){
    plan.flags.push('Literal extras have no structured parts evidence: verify quantity and earnings manually');
  }
  var literalText=[x.extras||'',x.group_extras||''].join('\n'),literalSkus=literalText.match(/\b\d{5,7}\b/g)||[];
  if(parts.length&&literalSkus.some(function(s){return Object.prototype.hasOwnProperty.call(PART_EARNINGS,s)&&!parts.some(function(p){return p&&String(p.sku||'').trim()===s;});})){
    plan.flags.push('Literal extras include a parts SKU missing from structured evidence; reconcile remaining earnings manually');
  }
  if(parts.length>30){plan.flags.push('More than 30 parts lines: earnings need manual review');return plan;}
  // A missing pins quantity that the $2.00 price settled is no longer a doubt.
  var unclearParts=(Array.isArray(x.unclear)?x.unclear:[]).filter(function(f){f=String(f);
    var missingOnly=/580602|\bpins?\b/i.test(f)&&/quantity|\bqty\b/i.test(f)&&/\b(?:no|missing|without|absent)\b|not\s+(?:written|stated|provided)/i.test(f)&&!/digit|handwrit|misread|identity|conflict|unclear|unknown|uncertain|ambigu|disagree|correction|illegible|unread|total|price|amount/i.test(f);
    return /part|extra|pin|sku|quantity/i.test(f)&&!(derivedPins&&missingOnly);});
  if(parts.length&&unclearParts.length){
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
    // Group text without SKUs only counts when it is a real whole-group instruction ("pins on all frames")
    // about this part; a stray comment like "missing frame spreader" must not hold every part on the tag.
    var words=function(t){return (String(t).toLowerCase().match(/[a-z]{4,}/g)||[]).map(function(w){return w.replace(/s$/,'');});};
    var aboutThis=words(groupText).some(function(w){return w!=='frame'&&w!=='screen'&&words(ref.name+' '+raw).indexOf(w)>=0;});
    var literalGroup=groupPartsLine_(raw)||!!groupText&&(groupSkus.length?groupSkus.indexOf(sku)>=0:groupPartsLine_(groupText)&&aboutThis);
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
    var split=splitPerFrame_(x,sku,p,group);
    if(split){plan.items.push(split);return;}
    if(group&&Array.isArray(x.unclear)&&x.unclear.some(function(f){return /tag_count|tag_index|sequence/i.test(String(f));}))scope='';
    if(!scope){plan.flags.push('Group/part identity is uncertain: allocate earnings manually');return;}
    // LB Earn carries one receipt chain: with ANY written-in additional labor line on the tag (credited, already
    // credited on a sibling, or held), assembly stays in Earning as before (review of #27: group double credit).
    var toLb=ref.column==='lb'&&x.item_type!=='window'&&!laborLine;
    if(ref.column==='lb'&&x.item_type!=='window'&&laborLine)plan.flags.push('SKU '+sku+' assembly kept in Earning because this tag also has additional labor');
    var item={sku:sku,name:ref.name,quantity:p.quantity,rate:ref.rate,unit:ref.unit,group:group,scope:scope,amount:cents_(p.quantity*ref.rate)};
    if(toLb)item.column='lb';
    if(p.derived)item.derived=p.derived;
    plan.items.push(item);
  });
  return plan;
}
/**
 * Pins (and other $0.50 hardware) written once for a whole group are split evenly per frame (Kirsten, 2026-10-27: "16
 * pins" on 1 of 8 tags; "I wanted to see it on each frame"). Only when the count divides evenly by N and the line is
 * for the group: marked group-wide, or more than one frame's worth (over 4) at 4 or fewer per frame. Each frame's
 * share has its own receipt (scope [tab,'frames',id,k]), so no frame is ever credited twice.
 */
var SPLIT_PER_FRAME_SKUS = ['580602','580603','580604','580607'];
function splitPerFrame_(x,sku,p,group) {
  var seq=verifiedSequence_(tagOf_(x)),n=Number(x.tag_count),k=Number(x.tag_index),q=p.quantity;
  if(SPLIT_PER_FRAME_SKUS.indexOf(sku)<0||!seq||!(n>=2&&n<=GROUP_HOLD_MAX)||!Number.isInteger(q)||q%n)return null;
  if(!(group||(q>4&&q/n<=4)))return null;
  var st=resolveStore_(x).store,name=sequenceIdentity_(sheetName_(x));if(!st||!x.ticket_number||!name)return null;
  var ref=PART_EARNINGS[sku],per=q/n,id=JSON.stringify([st.tab,String(x.ticket_number),sku,n]);
  return {sku:sku,name:ref.name,quantity:per,rate:ref.rate,unit:ref.unit,group:false,scope:JSON.stringify([st.tab,'frames',id,k]),amount:cents_(per*ref.rate),
    split:{id:id,of:n,index:k,total:q,from:k,name:name,ticket:String(x.ticket_number)}};
}
/** A split receipt's group is this tag's group: same N, a close name and a close ticket (as for group holds). */
function splitMatches_(split,x) {
  return split.of===Number(x.tag_count)&&namesClose_(split.name,sequenceIdentity_(sheetName_(x)))&&ticketsClose_(split.ticket,String(x.ticket_number||''));
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
        var sameTab=Array.isArray(scope)&&(scope[0]===r.tab||STORES.some(function(st){return st.tab===scope[0]&&st.name===r.tab;}));
        var frames=Array.isArray(scope)&&scope[1]==='frames'&&scope.length===4&&typeof scope[2]==='string'&&Number.isInteger(scope[3])&&
          !r.group&&r.split&&r.split.id===scope[2]&&r.split.index===scope[3]&&Number.isInteger(r.split.of)&&r.split.of>=2&&
          Number.isInteger(r.split.total)&&r.quantity*r.split.of===r.split.total&&typeof r.split.name==='string'&&typeof r.split.ticket==='string';
        var valid=ref&&Array.isArray(scope)&&scope.length>=3&&sameTab&&(frames||sequenceIdentity_(scope[1])===r.ticket&&
          (r.group?['group','build-form'].indexOf(scope[2])>=0:scope[2]==='tag'))&&
          Array.isArray(client)&&client.length===3&&client.every(function(v){return typeof v==='string';})&&
          !!(client[1]||client[0])&&receiptCustomerOk_(r.customer,client)&&/^\d*$/.test(client[2])&&
          typeof r.customer==='string'&&!!r.customer&&typeof r.ticket==='string'&&!!r.ticket&&
          Number.isInteger(r.quantity)&&r.quantity>=1&&r.quantity<=1000&&r.rate===ref.rate&&r.unit===ref.unit&&
          Number.isFinite(r.amount)&&r.amount===cents_(r.quantity*r.rate)&&typeof r.group==='boolean'&&
          ['reserved','posted'].indexOf(r.status)>=0&&typeof r.tab==='string'&&!!r.tab&&
          ['screens','windows'].indexOf(r.block)>=0&&Number.isInteger(r.row)&&r.row>=2&&
          Number.isFinite(r.expectedTotal)&&r.expectedTotal>=r.amount&&(r.column===undefined||r.column==='lb');
        out.push(valid?r:{invalid:true});
      });
    }
    catch(err){out.push({invalid:true});}
  });return out;
}
function preparePartsEarnings_(ss,x) {
  var plan=calculateParts_(x),st=resolveStore_(x).store;
  // A group tag with no parts of its own may still pick up its frame's share of split pins (below).
  if(!st||!plan.items.length&&!(x.tag_count>=2&&verifiedSequence_(tagOf_(x))))return plan;
  var sh=storeSheet_(ss,st),layout;try{layout=storeLayout_(sh);}catch(err){plan.flags.push('Layout must be reviewed before parts earnings');plan.items=[];return plan;}
  var found=[],held=[];
  // Receipts live on Earning (Other Earn for windows) and, for assembly, on the screens LB Earn cell.
  [['screens','earning'],['screens','lb'],['windows','earning']].forEach(function(where){
    var block=where[0],c=layout[block],earning=where[1]==='lb'?c.LB_EARN:block==='screens'?c.EARNING:c.OTHER_EARN,end=block==='screens'?screenBlockEnd_(sh):WINDOW_LAST_ROW;
    var notes=sh.getRange(2,earning,end-1,1).getNotes(),ticket=sequenceIdentity_(x.ticket_number);
    notes.forEach(function(r,i){
      var row=i+2;
      partsReceipts_(r[0]).forEach(function(receipt){
        if(!receipt.invalid&&(receipt.column==='lb')!==(where[1]==='lb'))receipt=Object.assign({},receipt,{invalid:true}); // moved by hand
        // A receipt only matters to this scan when it is about the same ticket. Kirsten correcting a
        // name, ticket or amount on another row is her call and never blocks the rest of the tab
        // (2026-10-21: one edited Downers Grove row had silently stopped every later parts earning).
        var rowTicket=sequenceIdentity_(sh.getRange(row,c.TICKET).getValues()[0][0]);
        if(receipt.invalid){
          if(rowTicket===ticket)held.push('An earlier earnings note for this ticket was changed by hand; enter parts earnings manually');
          return;
        }
        var current=sh.getRange(row,earning).getValues()[0][0];
        var edited=(receipt.tab!==st.tab&&receipt.tab!==sh.getName())||receipt.block!==block||receipt.row!==row||
          !receiptNameOk_(receipt,sequenceIdentity_(sh.getRange(row,c.NAME).getValues()[0][0]))||
          receipt.ticket!==rowTicket||receipt.status==='posted'&&current!==receipt.expectedTotal;
        found.push(Object.assign({},receipt,{block:block,row:row,paid:!edited&&current===receipt.expectedTotal,edited:edited}));
      });
    });
  });
  // A frame scanned after its group's split pins picks up its own share (one item per split, never twice).
  var mine=verifiedSequence_(tagOf_(x))?Number(x.tag_index):0,seen={};
  if(mine)found.forEach(function(r){
    if(!r.split||r.edited||seen[r.split.id]||!splitMatches_(r.split,x))return;seen[r.split.id]=true;
    var scope=JSON.stringify([JSON.parse(r.scope)[0],'frames',r.split.id,mine]);
    if(plan.items.some(function(i){return i.scope===scope;}))return;
    plan.items.push({sku:r.sku,name:r.name,quantity:r.quantity,rate:r.rate,unit:r.unit,group:false,scope:scope,amount:r.amount,
      split:{id:r.split.id,of:r.split.of,index:mine,total:r.split.total,from:r.split.from,name:r.split.name,ticket:r.split.ticket}});
  });
  // Scans Notes contain untrusted OCR and are an audit copy only, never payment authority.
  plan.items=plan.items.filter(function(item){
    var prior=found.filter(function(r){return r.scope===item.scope&&r.sku===item.sku;})[0];
    if(!prior)return true;
    if(prior.edited){plan.flags.push(prior.column==='lb'?'Earlier LB Earn for this part was edited by hand ('+prior.block+' row '+prior.row+'): check that row; the assembly may already be included':
      'Earlier row for this part was edited by hand ('+prior.block+' row '+prior.row+'); add these earnings manually');return false;}
    // A split share's receipt carries the frame's own name, not the phone, so it is not compared.
    var sameClient=item.split?true:prior.client===partsClient_(x);plan.references.push({item:item,prior:prior,sameClient:sameClient});
    if(!sameClient)plan.flags.push('Parts group customer identity differs from the earlier receipt; earnings held for manual review');
    if(!prior.paid)plan.flags.push('Parts allocation is pending on an earlier row; reconcile it before adding earnings');
    if(prior.quantity!==item.quantity||prior.amount!==item.amount)plan.flags.push('Parts quantity/rate differs from the earlier receipt; no additional earnings added');
    return false;
  });
  if(held.length){plan.flags.push(held[0]);plan.items=[];}
  return plan;
}
function applyPartsEarnings_(sh,row,c,x,firstRow,base,laborBase,flags) {
  var plan=x._parts_plan;if(!plan)return;
  var lbItems=plan.items.filter(function(item){return item.column==='lb';});
  var lbBefore=plan.posted.length;
  if(lbItems.length)applyLbParts_(sh,row,c,x,firstRow,lbItems,laborBase,flags||[]);
  var items=plan.items.filter(function(item){return item.column!=='lb';});
  var earning=x.item_type==='window'?c.OTHER_EARN:c.EARNING,range=sh.getRange(row,earning),note=range.getNote(),lines=[];
  // The Earning note lists the tag's extras "to enter": say where assembly went so it is never entered twice.
  plan.posted.slice(lbBefore).forEach(function(r){lines.push('SKU '+r.sku+' '+r.name+': $'+r.amount.toFixed(2)+' added to LB Earn on this row; do not enter it here.');});
  items.forEach(function(item){lines.push('SKU '+item.sku+' '+item.name+': '+item.quantity+' '+item.unit+(item.derived?' (from '+item.derived+')':'')+' × $'+item.rate.toFixed(2)+' = $'+item.amount.toFixed(2)+
    (item.split?' for this frame ('+item.split.total+' written on tag '+item.split.from+' of '+item.split.of+', split per frame); credit once':item.group?' total for the whole group; credit once':' total for this tag/form; credit once'));});
  plan.references.forEach(function(ref){lines.push(ref.sameClient===false?'SKU '+ref.prior.sku+': customer identity conflicts with an earlier group receipt; earnings held for manual allocation.':
    'SKU '+ref.prior.sku+': $'+ref.prior.amount.toFixed(2)+' whole-group/tag total '+(ref.prior.paid?'already recorded':'PENDING review')+' on '+ref.prior.tab+' '+ref.prior.block+' row '+ref.prior.row+(ref.prior.column==='lb'?' (LB Earn)':'')+'. No duplicate amount added.');});
  if(!firstRow&&plan.posted.length)lines.push('Parts total is recorded on the first row of this form; no duplicate amount added.');
  if(!lines.length)return;
  var receipts=firstRow?items.map(function(item){return Object.assign({},item,{status:'reserved',tab:storeByTabName_(sh.getName()).tab,block:x.item_type==='window'?'windows':'screens',row:row,
    client:partsClient_(x),customer:sequenceIdentity_(sheetName_(x)),ticket:sequenceIdentity_(x.ticket_number)});}):[];
  var extra=receipts.reduce(function(n,item){return n+item.amount;},0),total=cents_((base||0)+extra);
  receipts.forEach(function(r){r.expectedTotal=total;});
  var human=escapePartsReceiptText_((note?note+'\n\n':'')+lines.join('\n'));
  // Reserve receipts in notes BEFORE the value write. An interrupted write must be reconciled, never duplicated.
  range.setNote(human+(receipts.length?'\n'+PARTS_RECEIPT+JSON.stringify(receipts):''));
  if(receipts.length){range.setNumberFormat('$0.00').setValue(total);receipts.forEach(function(r){r.status='posted';});
    range.setNote(human+'\n'+PARTS_RECEIPT+JSON.stringify(receipts));plan.posted.push.apply(plan.posted,receipts);}
  range.setBackground(FLAG_COLOR);
  if(firstRow)receipts.forEach(function(r){if(r.split&&r.split.from===r.split.index)splitToSiblings_(sh,c,x,r,row);});
}
/**
 * The frames of a split group already on the tab get their share now, each with its own receipt. Only into a blank
 * Earning cell with no receipt and no formula; any other row gets a note instead (never added on top of her entry).
 */
function splitToSiblings_(sh,c,x,r,row) {
  if(x.item_type==='window'||!c.SEQUENCE)return;
  var end=screenBlockEnd_(sh),names=sh.getRange(2,c.NAME,end-1,1).getValues(),seqs=sh.getRange(2,c.SEQUENCE,end-1,1).getValues();
  var tickets=sh.getRange(2,c.TICKET,end-1,1).getValues(),st=storeByTabName_(sh.getName()),done={};done[r.split.index]=true;
  for(var i=0;i<names.length;i++){
    var at=i+2,m=/^(\d+) of (\d+)$/.exec(String(seqs[i][0]).trim());
    if(at===row||!m||Number(m[2])!==r.split.of||done[Number(m[1])])continue;
    var who=sequenceIdentity_(names[i][0]),tk=String(tickets[i][0]).trim();
    if(!namesClose_(who,r.split.name)||!ticketsClose_(tk,r.split.ticket))continue;
    var k=Number(m[1]);done[k]=true;
    var cell=sh.getRange(at,c.EARNING),note=cell.getNote(),value=cell.getValues()[0][0];
    if(cell.getFormulas()[0][0]||(value!==''&&value!==0)||partsReceipts_(note).length){
      cell.setNote([note,'Pins for this frame not added ($'+r.amount.toFixed(2)+', split from tag '+r.split.from+' of '+r.split.of+'): Earning already has an entry.'].filter(Boolean).join('\n'));continue;
    }
    var rec=Object.assign({},r,{scope:JSON.stringify([st.tab,'frames',r.split.id,k]),split:Object.assign({},r.split,{index:k}),status:'reserved',row:at,
      client:JSON.stringify([who,who,'']),customer:who,ticket:sequenceIdentity_(tk),expectedTotal:r.amount});
    var human=escapePartsReceiptText_([note,'SKU '+r.sku+' '+r.name+': '+r.quantity+' '+r.unit+' × $'+r.rate.toFixed(2)+' = $'+r.amount.toFixed(2)+' for this frame ('+r.split.total+' written on tag '+r.split.from+' of '+r.split.of+', split per frame); credit once'].filter(Boolean).join('\n'));
    cell.setNote(human+'\n'+PARTS_RECEIPT+JSON.stringify([rec]));
    cell.setNumberFormat('$0.00').setValue(r.amount);rec.status='posted';
    cell.setNote(human+'\n'+PARTS_RECEIPT+JSON.stringify([rec]));cell.setBackground(FLAG_COLOR);
  }
}
/**
 * Assembly (580625) is added to LB Earn (Kirsten, 2026-10-27): only on the first row, only when LB Earn still holds
 * exactly the labor just written (no formula), with a receipt reserved in the LB note before the value changes.
 */
function applyLbParts_(sh,row,c,x,firstRow,items,laborBase,flags) {
  var range=sh.getRange(row,c.LB_EARN),note=range.getNote();
  if(!firstRow){if(x._parts_plan.posted.some(function(r){return r.column==='lb';}))range.setNote([note,'Assembly is added to LB Earn on the first row of this form only.'].filter(Boolean).join('\n'));return;}
  var raw=items.map(function(i){return 'SKU '+i.sku+' '+i.name+': '+i.quantity+' '+i.unit+' × $'+i.rate.toFixed(2)+' = $'+i.amount.toFixed(2);}).join('\n');
  if(typeof laborBase!=='number'||!Number.isFinite(laborBase)||laborBase<0||range.getFormulas()[0][0]||range.getValues()[0][0]!==laborBase){
    flags.push('Assembly not added to LB Earn: LB Earn is blank, a formula or changed; add it by hand');
    range.setNote([note,'Pending assembly (not added):\n'+raw].filter(Boolean).join('\n'));return;
  }
  var extra=items.reduce(function(n,i){return n+i.amount;},0),total=cents_(laborBase+extra),st=storeByTabName_(sh.getName());
  var receipts=items.map(function(item){return Object.assign({},item,{status:'reserved',tab:st.tab,block:'screens',row:row,
    client:partsClient_(x),customer:sequenceIdentity_(sheetName_(x)),ticket:sequenceIdentity_(x.ticket_number),expectedTotal:total});});
  var human=escapePartsReceiptText_([note,raw+'\nAdded to LB Earn: $'+laborBase.toFixed(2)+' + $'+cents_(extra).toFixed(2)+' = $'+total.toFixed(2)+'; credit once'].filter(Boolean).join('\n'));
  range.setNote(human+'\n'+PARTS_RECEIPT+JSON.stringify(receipts));
  range.setNumberFormat('$0.00').setValue(total);
  receipts.forEach(function(r){r.status='posted';});
  range.setNote(human+'\n'+PARTS_RECEIPT+JSON.stringify(receipts));
  x._parts_plan.posted.push.apply(x._parts_plan.posted,receipts);
}
