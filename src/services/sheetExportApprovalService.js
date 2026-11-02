// Explicit, single-use export approval receipt. A receipt documents review;
// it does not grant permission to write. Live server validation is still required.
const clean=v=>String(v??'').trim();
export function canonicalExportReview(plan,preflight){
 if(!plan||!preflight?.readOnly||preflight.writeEnabled!==false||preflight.allMatched!==true)throw Error('Successful read-only preflight required');
 if(plan.conflicts?.length||!Array.isArray(plan.proposals)||!plan.proposals.length||plan.proposals.length>20)throw Error('Unresolved conflicts or invalid batch size');
 if(!Array.isArray(preflight.checked)||preflight.checked.length!==plan.proposals.length||preflight.checked.some(c=>c.match!==true))throw Error('Incomplete live verification');
 const unique=new Set();
 const changes=plan.proposals.map(p=>{
  const id=[clean(p.fid),p.row,clean(p.column)].join(':');
  if(unique.has(id))throw Error('Duplicate reviewed change');
  unique.add(id);
  if(!/^\d{4,15}$/.test(clean(p.fid))||!Number.isSafeInteger(p.row)||p.row<2||!p.column)throw Error('Invalid reviewed change');
  return {fid:clean(p.fid),row:p.row,column:clean(p.column),expected:clean(p.expected),value:clean(p.value)};
 }).sort((a,b)=>a.row-b.row||a.column.localeCompare(b.column));
 return {stateId:clean(plan.stateId),spreadsheetId:clean(plan.spreadsheetId),worksheetTitle:clean(plan.worksheetTitle),changes};
}
export async function hashExportReview(review){
 const canonical=JSON.stringify(review);
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical));
 return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
}
export async function prepareExportApproval(plan,preflight,{now=()=>new Date()}={}){
 const review=canonicalExportReview(plan,preflight);
 return {review,hash:await hashExportReview(review),reviewedAt:now().toISOString(),approved:false,writeEnabled:false};
}
