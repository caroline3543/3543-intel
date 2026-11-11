import {record,setRecord} from './planner.js';

const unique=ids=>[...new Set(ids.map(String))];
const key=(a,b)=>[a,b].sort().join(':');
export function previewTalBulk(data,ids,action){
 const selected=new Set(unique(ids));
 const players=(data.players||[]).filter(p=>selected.has(String(p.id)));
 if(!players.length)throw Error('Select at least one player.');
 if(data.talPlan?.locked)throw Error('Unlock the TAL plan to edit player records.');
 if(!['language','availability','registration','teamwork','allocate','remove'].includes(action.type))throw Error('Choose an update.');
 if(action.type==='language'&&(!action.language||typeof action.language!=='string'||!['add','remove'].includes(action.mode||'add')))throw Error('Choose a communication language.');
 if(action.type==='availability'){
  if(!['add','remove','replace'].includes(action.mode))throw Error('Choose how to update availability.');
  if(!Array.isArray(action.times)||!action.times.length||action.times.some(t=>!data.talPlan?.times?.includes(t)))throw Error('Choose valid UTC times.');
 }
 if(action.type==='registration'&&!['needs','pending','verified','registered','unregistered'].includes(action.value))throw Error('Choose a registration status.');
 if(action.type==='teamwork'&&!['pair','group'].includes(action.mode))throw Error('Choose a teamwork mode.');
 if(action.type==='allocate'&&(!action.teamId||!data.talPlan?.teams?.some(t=>String(t.id)===String(action.teamId))))throw Error('Choose a valid TAL legion.');
 if(action.type==='remove'&&action.confirm!==true)throw Error('Confirm removal from TAL. Members profiles will be kept.');
 if(action.type==='teamwork'&&players.length<2)throw Error('Select at least two players.');
 const count=action.type==='teamwork'?(action.mode==='group'?1:(players.length*(players.length-1))/2):players.length;
 const summary=action.type==='teamwork'
  ?action.mode==='group'?'One shared cooperation group will be recorded for '+players.length+' selected players.':'Two-way working relationships will be added.'
  :action.type==='availability'?action.mode+' '+action.times.join(', ')+' UTC for '+players.length+' players.'
  :action.type==='registration'?players.length+' players will be marked '+action.value+'.'
  :action.type==='allocate'?players.length+' players will be moved to '+(data.talPlan.teams.find(t=>String(t.id)===String(action.teamId))?.host||'the selected')+' legion '+(data.talPlan.teams.find(t=>String(t.id)===String(action.teamId))?.number||'')+'.':action.type==='remove'?players.length+' players will be removed from TAL, not Members.':players.length+' players will '+(action.mode==='remove'?'lose':'receive')+' '+action.language+' in their communication languages.';
 return {ids:players.map(p=>String(p.id)),count,summary,players:players.map(p=>({id:p.id,name:p.username||p.alias||p.fid||'Unknown',fid:p.fid}))};
}
export function applyTalBulk(data,ids,action){
 const preview=previewTalBulk(data,ids,action),selected=new Set(preview.ids);
 let next={...data};
 const at=new Date().toISOString();
 if(action.type==='language'){
  next.players=(data.players||[]).map(p=>{
   if(!selected.has(String(p.id)))return p;
   const existing=[...new Set([...(Array.isArray(p.languages)?p.languages:[]),p.communicationLanguage].filter(x=>typeof x==='string'&&x.trim()))];
   const languages=action.mode==='remove'?existing.filter(l=>l!==action.language):[...new Set([...existing,action.language])];
   return {...p,languages,communicationLanguage:languages[0]||null,profileLastUpdated:at};
  });
 }
 if(action.type==='availability'){
  const times=unique(action.times);
  let plan={...data.talPlan,records:{...(data.talPlan?.records||{})},availability:{...(data.talPlan?.availability||{})}};
  for(const p of data.players||[]){
   if(!selected.has(String(p.id)))continue;
   const old=record(plan,p);
   const current=plan.availability[p.id]||old.times||[];
   const updated=action.mode==='replace'?times:action.mode==='add'?unique([...current,...times]):current.filter(t=>!times.includes(t));
   plan=setRecord(plan,p,{status:updated.length?'available':'pending',times:updated,
     unavailableTimes:(old.unavailableTimes||[]).filter(t=>!updated.includes(t)),
     availabilitySubmitted:true});
   plan.availability[p.id]=updated;
  }
  next.talPlan=plan;
 }
 if(action.type==='registration'){
  let plan={...data.talPlan,records:{...(data.talPlan?.records||{})},teams:(data.talPlan?.teams||[]).map(t=>({...t,members:t.members.map(m=>({...m}))}))};
  for(const p of data.players||[]){
   if(!selected.has(String(p.id)))continue;
   const matches=plan.teams.flatMap(t=>t.members.filter(m=>String(m.id)===String(p.id)).map(m=>({team:t,member:m})));
   if(action.value==='registered'){
    if(matches.length!==1)throw Error('Allocate '+(p.username||p.fid)+' to a legion before marking registered.');
    plan.teams=plan.teams.map(t=>({...t,members:t.members.map(m=>String(m.id)===String(p.id)?{...m,registered:true,role:m.role==='pending'?'combatant':m.role}:m)}));
   }else if(action.value==='unregistered'||action.value==='needs'){
    plan.teams=plan.teams.map(t=>({...t,members:t.members.map(m=>String(m.id)===String(p.id)?{...m,registered:false}:m)}));
    plan=setRecord(plan,p,{registrationStatus:'needs',sheetRegistration:action.value==='needs'?'Needs registration':plan.records?.[p.id]?.sheetRegistration});
   }else {
    plan=setRecord(plan,p,{sheetRegistration:action.value==='verified'?'Verified':'Pending verification',registrationStatus:action.value});
   }
  }
  next.talPlan=plan;
 }
 if(action.type==='allocate'||action.type==='remove'){
  const plan={...next.talPlan};
  const target=plan.teams?.find(t=>String(t.id)===String(action.teamId));
  if(action.type==='allocate'&&target?.tournamentStatus==='eliminated')throw Error('Cannot allocate to an eliminated legion.');
  if(action.type==='allocate'&&(target.members||[]).filter(m=>!selected.has(String(m.id))).length+selected.size>50)throw Error('Not enough spaces in the destination legion.');
  plan.teams=(plan.teams||[]).map(t=>{
   const members=(t.members||[]).filter(m=>!selected.has(String(m.id)));
   const candidates=(t.candidates||[]).filter(m=>!selected.has(String(m.id)));
   if(action.type==='allocate'&&String(t.id)===String(action.teamId)){
    const from=selected.size?preview.ids.map(id=>plan.teams.flatMap(t=>t.members||[]).find(m=>String(m.id)===id)||{id,role:'pending',registered:false}):[];
    return {...t,members:[...members,...from],candidates};
   }
   return {...t,members,candidates,captain:selected.has(String(t.captain))?'':t.captain};
  });
  next.talPlan=plan;
 }
 if(action.type==='teamwork'){
  const prefs=data.talTeamPreferences||{};
  if(action.mode==='group'){
   const ids=[...preview.ids].sort();const groups=(prefs.groups||[]).filter(g=>!Array.isArray(g?.ids)||g.ids.map(String).sort().join('|')!==ids.join('|'));
   next.talTeamPreferences={...prefs,groups:[...groups,{id:'group:'+ids.join(':'),ids,createdAt:at}]};return {data:next,preview};
  }
  const pairs=[...(prefs.pairs||[])],seen=new Set(pairs.map(([a,b])=>key(String(a),String(b))));
  for(let i=0;i<preview.ids.length;i++)for(let j=i+1;j<preview.ids.length;j++){
   const a=preview.ids[i],b=preview.ids[j],k=key(a,b);
   if(!seen.has(k)){pairs.push([a,b]);seen.add(k);}
  }
  next.talTeamPreferences={...prefs,pairs};
 }
 return {data:next,preview};
}
