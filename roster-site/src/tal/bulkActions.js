import {normaliseRallyPreferences} from '../../../src/services/talTeamPreferences.js';
import {record,setRecord} from './planner.js';

const unique=ids=>[...new Set(ids.map(String))];
const key=(a,b)=>[a,b].sort().join(':');
export function previewTalBulk(data,ids,action){
 const selected=new Set(unique(ids));
 const players=(data.players||[]).filter(p=>selected.has(String(p.id)));
 if(!players.length)throw Error('Select at least one player.');
 if(data.talPlan?.locked)throw Error('Unlock the TAL plan to edit player records.');
 if(!['language','availability','registration','teamwork'].includes(action.type))throw Error('Choose an update.');
 if(action.type==='language'&&(!action.language||typeof action.language!=='string'))throw Error('Choose a communication language.');
 if(action.type==='availability'){
  if(!['add','remove','replace'].includes(action.mode))throw Error('Choose how to update availability.');
  if(!Array.isArray(action.times)||!action.times.length||action.times.some(t=>!data.talPlan?.times?.includes(t)))throw Error('Choose valid UTC times.');
 }
 if(action.type==='registration'&&!['needs','pending','verified','registered','unregistered'].includes(action.value))throw Error('Choose a registration status.');
 if(action.type==='teamwork'&&!['pair','group'].includes(action.mode))throw Error('Choose a teamwork mode.');
 if(action.type==='teamwork'&&players.length<2)throw Error('Select at least two players.');
 const count=action.type==='teamwork'&&action.mode==='pair'?(players.length*(players.length-1))/2:players.length;
 const summary=action.type==='teamwork'
  ?action.mode==='pair'?count+' two-way working relationships will be added. Every selected player will be paired with every other selected player.':'One shared preferred group will be created without claiming every pair works well together.'
  :action.type==='availability'?action.mode+' '+action.times.join(', ')+' UTC for '+players.length+' players.'
  :action.type==='registration'?players.length+' players will be marked '+action.value+'. In-game registration is a separate status.'
  :players.length+' players will receive '+action.language+' as preferred communication language.';
 return {ids:players.map(p=>String(p.id)),count,summary,players:players.map(p=>({id:p.id,name:p.username||p.alias||p.fid||'Unknown',fid:p.fid}))};
}
export function applyTalBulk(data,ids,action){
 const preview=previewTalBulk(data,ids,action),selected=new Set(preview.ids);
 let next={...data};
 const at=new Date().toISOString();
 if(action.type==='language'){
  next.players=(data.players||[]).map(p=>selected.has(String(p.id))?{...p,communicationLanguage:action.language,profileLastUpdated:at}:p);
 }
 if(action.type==='availability'){
  const times=unique(action.times);
  let plan={...data.talPlan,records:{...(data.talPlan?.records||{})}};
  for(const p of data.players||[]){
   if(!selected.has(String(p.id)))continue;
   const old=record(plan,p);
   const updated=action.mode==='replace'?times:action.mode==='add'?unique([...old.times,...times]):old.times.filter(t=>!times.includes(t));
   plan=setRecord(plan,p,{status:updated.length?'available':'pending',times:updated});
  }
  next.talPlan=plan;
 }
 if(action.type==='registration'){
  let plan={...data.talPlan,records:{...(data.talPlan?.records||{})},teams:(data.talPlan?.teams||[]).map(t=>({...t,members:t.members.map(m=>({...m}))}))};
  for(const p of data.players||[]){
   if(!selected.has(String(p.id)))continue;
   if(action.value==='registered'||action.value==='unregistered'){
    const found=plan.teams.some(t=>t.members.some(m=>m.id===p.id&&m.role!=='pending'));
    if(!found)throw Error('Assign a confirmed combatant or substitute role before changing in-game registration for '+(p.username||p.fid));
    plan.teams=plan.teams.map(t=>({...t,members:t.members.map(m=>m.id===p.id?{...m,registered:action.value==='registered'}:m)}));
   }else{
    plan=setRecord(plan,p,{sheetRegistration:action.value==='verified'?'Verified':action.value==='pending'?'Pending verification':'Needs registration'});
   }
  }
  next.talPlan=plan;
 }
 if(action.type==='teamwork'){
  const current=normaliseRallyPreferences(data.talTeamPreferences||{});
  if(action.mode==='pair'){
   const pairs=[...current.pairs],seen=new Set(pairs.map(([a,b])=>key(a,b)));
   for(let i=0;i<preview.ids.length;i++)for(let j=i+1;j<preview.ids.length;j++){
    const a=preview.ids[i],b=preview.ids[j],k=key(a,b);
    if(!seen.has(k)){pairs.push([a,b]);seen.add(k);}
   }
   next.talTeamPreferences={...current,pairs};
  }else{
   const groups=Array.isArray(current.groups)?current.groups:[];
   const groupId=preview.ids.slice().sort().join(':');
   if(!groups.some(g=>g.id===groupId))next.talTeamPreferences={...current,groups:[...groups,{id:groupId,memberIds:preview.ids}]};
  }
 }
 return {data:next,preview};
}
