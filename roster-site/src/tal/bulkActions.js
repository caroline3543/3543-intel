import {record,setRecord,createTeam} from './planner.js';

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
 if(action.type==='registration'&&!['needs','pending','verified','registered','unregistered','considering'].includes(action.value))throw Error('Choose a registration status.');
 if(action.type==='teamwork'&&!['pair','group'].includes(action.mode))throw Error('Choose a teamwork mode.');
 if(action.type==='allocate'&&(!/^[a-z0-9_-]{2,10}$/i.test(String(action.host||''))||![1,2].includes(Number(action.number))))throw Error('Choose a host alliance and Legion 1 or 2.');
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
  let plan={...data.talPlan,records:{...(data.talPlan?.records||{})},teams:(data.talPlan?.teams||[]).map(t=>({...t,members:[...(t.members||[])],candidates:[...(t.candidates||[])]}))};
  for(const p of data.players||[]){
   if(!selected.has(String(p.id)))continue;
   const id=String(p.id);
   const found=plan.teams.find(t=>(t.members||[]).some(m=>String(m.id)===id)||(t.candidates||[]).some(m=>String(m.id)===id));
   if(!found){throw Error('Add '+(p.username||p.fid)+' to a TAL legion first.');}
   const member=(found.members||[]).find(m=>String(m.id)===id);
   if(action.value==='considering'){
    plan.teams=plan.teams.map(t=>t.id!==found.id?t:{...t,members:t.members.filter(m=>String(m.id)!==id),candidates:[...t.candidates.filter(m=>String(m.id)!==id),{id,role:'candidate',registered:false}]});
   }else if(action.value==='registered'||action.value==='needs'||action.value==='unregistered'){
    const current=member||{id,role:'pending',registered:false};
    const existing=found.members.filter(m=>String(m.id)!==id);
    if(!member&&existing.length>=50)throw Error('Legion has 50 members. Cannot promote '+(p.username||p.fid)+'.');
    let role=current.role;
    if(action.value==='registered'&&role==='pending'){
     const combatants=existing.filter(m=>m.role==='combatant').length;
     const substitutes=existing.filter(m=>m.role==='substitute').length;
     role=combatants<30?'combatant':substitutes<20?'substitute':null;
     if(!role)throw Error('There are no combatant or substitute slots for '+(p.username||p.fid)+'.');
    }
    plan.teams=plan.teams.map(t=>t.id!==found.id?t:{...t,candidates:t.candidates.filter(m=>String(m.id)!==id),members:[...existing,{...current,role,registered:action.value==='registered'}]});
   }else{
    plan=setRecord(plan,p,{sheetRegistration:action.value==='verified'?'Verified':'Pending verification',registrationStatus:action.value});
   }
  }
  next.talPlan=plan;
 }
 if(action.type==='allocate'||action.type==='remove'){
  const plan={...next.talPlan};
  const host=String(action.host||'').toUpperCase(),number=Number(action.number);
  const targetId=host+':'+number;
  const existingTeam=plan.teams?.find(t=>String(t.id)===targetId);
  if(action.type==='allocate'&&existingTeam?.tournamentStatus==='eliminated')throw Error('Cannot allocate to an eliminated legion.');
  const remaining=action.type==='allocate'?(existingTeam?.members||[]).filter(m=>!selected.has(String(m.id))).length:0;
  if(action.type==='allocate'&&remaining+selected.size>50)throw Error('Not enough spaces in '+host+' Legion '+number+'.');
  const priorMembers=new Map((plan.teams||[]).flatMap(t=>(t.members||[]).map(m=>[String(m.id),m])));
  let teams=(plan.teams||[]).map(t=>({...t,members:(t.members||[]).filter(m=>!selected.has(String(m.id))),candidates:(t.candidates||[]).filter(m=>!selected.has(String(m.id))),captain:selected.has(String(t.captain))?'':t.captain}));
  if(action.type==='allocate'){
   if(!teams.some(t=>String(t.id)===targetId))teams=[...teams,createTeam(host,number)];
   teams=teams.map(t=>String(t.id)===targetId?{...t,members:[...t.members,...preview.ids.map(id=>priorMembers.get(id)||{id,role:'pending',registered:false})]}:t);
  }
  next.talPlan={...plan,teams};
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
