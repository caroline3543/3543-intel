import {compareLabyrinth} from './labyrinth.js';
export const DEFAULT_TIMES=['02:00','07:00','12:00','14:00','19:00'];
export function newPlan(){return {name:'State 3739 TAL',step:'setup',deadline:'',times:[...DEFAULT_TIMES],timesConfirmed:false,minOverlap:2,targetCombatants:15,records:{},teams:[],locked:false};}
export function record(plan,player){return {status:'pending',times:[],homeAlliance:player.allianceTag||'',note:'',troopPower:'',...plan.records?.[player.id]};}
export function overlap(plan,player,team){const r=record(plan,player);return r.status==='available'?team.slots.filter(t=>r.times.includes(t)).length:0;}
export function eligible(plan,player,team){return !!player&&!player.blacklisted&&team.slots.length===3&&overlap(plan,player,team)>=plan.minOverlap;}
export function assignedTeam(plan,id){return plan.teams.find(t=>t.members.some(m=>m.id===id));}
export function playerLabel(p){return p?.username||p?.alias||p?.fid||'Unknown player';}
export function setRecord(plan,player,patch){return {...plan,records:{...plan.records,[player.id]:{...record(plan,player),...patch}}};}
export function toggleTime(plan,player,time){const r=record(plan,player);return setRecord(plan,player,{status:'available',times:r.times.includes(time)?r.times.filter(t=>t!==time):[...r.times,time]});}
export function createTeam(host,number=1){return {id:`${host}:${number}`,host,number,targetPower:'',slots:[],matchTime:'',captain:'',officer:'',members:[],candidates:[],secondConfirmed:false};}
export function coverage(plan,team,players){return team.slots.map(time=>({time,combatants:team.members.filter(m=>m.role==='combatant'&&record(plan,players.find(p=>p.id===m.id)||{id:m.id}).status==='available'&&record(plan,players.find(p=>p.id===m.id)||{id:m.id}).times.includes(time)).length,pending:team.members.filter(m=>m.role==='pending'&&record(plan,players.find(p=>p.id===m.id)||{id:m.id}).status==='available'&&record(plan,players.find(p=>p.id===m.id)||{id:m.id}).times.includes(time)).length,substitutes:team.members.filter(m=>m.role==='substitute'&&record(plan,players.find(p=>p.id===m.id)||{id:m.id}).status==='available'&&record(plan,players.find(p=>p.id===m.id)||{id:m.id}).times.includes(time)).length}));}
export function teamIssues(plan,team,players){
 const issues=[];
 const pendingRoles=team.members.filter(m=>m.role==='pending').length;if(pendingRoles)issues.push(`${pendingRoles} ${pendingRoles===1?'role is':'roles are'} not set.`);
 if(team.importedSource?.confirmGameLegion)issues.push('Confirm the in-game legion number; this is the spreadsheet label.');
 if(team.candidates?.length)issues.push(`${team.candidates.length} ${team.candidates.length===1?'proposal needs':'proposals need'} review.`);
 if(team.slots.length!==3||new Set(team.slots).size!==3||team.slots.some(t=>!plan.times.includes(t)))issues.push('Choose three valid battle times.');
 if(team.number===2&&!team.secondConfirmed)issues.push('Confirm Legion 2 is unlocked in game.');
 if(team.members.length<15)issues.push(`${15-team.members.length} more players needed to reach 15.`);
 for(const [role,cap] of [['combatant',30],['substitute',20]])if(team.members.filter(m=>m.role===role).length>cap)issues.push(`Too many ${role}s.`);
 const ids=new Set(players.map(p=>p.id));
 const invalid=team.members.filter(m=>!ids.has(m.id)||!eligible(plan,players.find(p=>p.id===m.id),team)).length;
 if(invalid)issues.push(`${invalid} players do not meet this legion’s availability preference.`);
 if(team.matchTime&&!team.slots.includes(team.matchTime))issues.push('Confirmed match time is outside this legion’s three choices.');
 if(team.slots.length===3){for(const c of coverage(plan,team,players))if(c.combatants+c.pending<plan.targetCombatants)issues.push(`${c.time}: ${c.combatants+c.pending} available for combatant places; target ${plan.targetCombatants}.`);}
 if(!team.captain||!team.members.some(m=>m.id===team.captain))issues.push('Choose a captain.');
 const duplicate=team.members.some(m=>plan.teams.flatMap(t=>t.members).filter(x=>x.id===m.id).length>1);
 if(duplicate)issues.push('A player is assigned more than once.');
 return issues;
}
function validateDestination(plan,player,team,role,leavingId=null,allowAvailabilityConflict=false){
 if(!['combatant','substitute'].includes(role))throw new Error('Choose a player role.');
 if(!player)throw new Error('This player is no longer in Members.');
 if(player.blacklisted)throw new Error('This player is excluded from battle plans. Update their member profile first.');
 if(record(plan,player).status==='declined')throw new Error('This player is marked not participating. Update their availability first.');
 if(!allowAvailabilityConflict&&!eligible(plan,player,team))throw new Error('This player needs more matching times for that legion.');
 if(team.members.filter(m=>m.id!==player.id&&m.id!==leavingId).length>=50)throw new Error('This legion has 50 players. Remove or swap a player first.');
 const cap=role==='combatant'?30:20;
 if(team.members.filter(m=>m.role===role&&m.id!==leavingId&&m.id!==player.id).length>=cap)throw new Error(`No ${role} places left. Choose another role or swap a player.`);
}
export function placePlayer(plan,players,id,targetId,role='combatant',swapId='',{allowAvailabilityConflict=false}={}){
 if(plan.locked)throw new Error('Unlock this plan before changing it.');
 const target=plan.teams.find(t=>t.id===targetId),player=players.find(p=>p.id===id),source=assignedTeam(plan,id);
 if(!target||!player)throw new Error('Choose a player and a legion.');
 const existing=source?.members.find(m=>m.id===id),swapped=swapId?target.members.find(m=>m.id===swapId):null;
 if(swapId&&(!swapped||!source||source.id===target.id))throw new Error('Choose a player in a different legion to swap.');
 validateDestination(plan,player,target,swapped?.role||role,swapped?.id,allowAvailabilityConflict);
 if(swapped)validateDestination(plan,players.find(p=>p.id===swapped.id),source,existing.role,id);
 let next=setRecord(plan,player,record(plan,player).excludeFromSuggestions?{excludeFromSuggestions:false}:{});
 next={...next,teams:next.teams.map(team=>{
  let members=team.members.filter(m=>m.id!==id&&(!swapped||m.id!==swapId));
  if(team.id===target.id)members=[...members,{id,role:swapped?.role||role,registered:source?.id===target.id&&existing?.role===(swapped?.role||role)?existing?.registered||false:false}];
  if(swapped&&team.id===source.id)members=[...members,{id:swapId,role:existing.role,registered:false}];
  return {...team,members,candidates:(team.candidates||[]).filter(m=>m.id!==id&&(!swapped||m.id!==swapId)),captain:members.some(m=>m.id===team.captain)?team.captain:''};
 })};
 return next;
}
export function unassign(plan,id){return {...plan,teams:plan.teams.map(t=>({...t,members:t.members.filter(m=>m.id!==id),captain:t.captain===id?'':t.captain}))};}
function triples(times){return times.flatMap((a,i)=>times.slice(i+1).flatMap((b,j)=>times.slice(i+j+2).map(c=>[a,b,c])));}
export function suggest(plan,players){
 const selected=new Set(plan.teams.flatMap(t=>t.members.map(m=>m.id)));
 const pool=players.filter(p=>!selected.has(p.id)&&record(plan,p).status==='available'&&!record(plan,p).excludeFromSuggestions&&!p.blacklisted);
 const teams=plan.teams.map(t=>({...t,members:t.members.map(m=>({...m})),slots:[...t.slots]}));
 let timingPool=[...pool];
 for(let index=0;index<teams.length;index++){
  const team=teams[index];
  if(team.slots.length!==3&&!team.members.length){
  team.slots=triples(plan.times).sort((a,b)=>{
   const score=slots=>{const candidates=timingPool.filter(p=>eligible(plan,p,{slots}));const counts=slots.map(s=>candidates.filter(p=>record(plan,p).times.includes(s)).length);return Math.min(...counts)*100+candidates.length+3*candidates.filter(p=>overlap(plan,p,{slots})===3).length;};
   return score(b)-score(a);
  })[0]||[];
  }
  // Reserve a fair sample before choosing the next legion’s times. These are
  // only timing samples; final assignment below still balances empty places.
  const activeRemaining=teams.slice(index).filter(t=>t.members.length<50).length||1;
  const share=Math.min(Math.max(0,30-team.members.filter(m=>m.role==='combatant').length),Math.ceil(timingPool.length/activeRemaining));
  const reserved=new Set(timingPool.filter(p=>eligible(plan,p,team)).sort((a,b)=>record(plan,a).times.length-record(plan,b).times.length||overlap(plan,b,team)-overlap(plan,a,team)).slice(0,share).map(p=>p.id));
  timingPool=timingPool.filter(p=>!reserved.has(p.id));
 }
 for(const [role,cap] of [['combatant',30],['substitute',20]]){
  let added=true;
  while(added){added=false;for(const team of teams){
   if(team.members.length>=50||team.members.filter(m=>m.role===role).length>=cap)continue;
   const candidates=pool.filter(p=>!selected.has(p.id)&&eligible(plan,p,team));
   const counts=coverage(plan,team,players);
   const score=p=>overlap(plan,p,team)*1000+counts.reduce((n,c)=>n+(record(plan,p).times.includes(c.time)?100/(1+c.combatants+c.substitutes):0),0);
   candidates.sort((a,b)=>score(b)-score(a)||compareLabyrinth(a,b)||(Number(record(plan,b).troopPower)||0)-(Number(record(plan,a).troopPower)||0)||playerLabel(a).localeCompare(playerLabel(b)));
   if(candidates.length){team.members.push({id:candidates[0].id,role,registered:false});selected.add(candidates[0].id);added=true;}
  }}
 }
 return {...plan,teams};
}
export function readyIssues(plan,players){
 const assigned=new Set(plan.teams.flatMap(t=>t.members.map(m=>m.id)));
 const issues=[];
 if(!plan.teams.length)issues.push('Choose a host alliance and create a legion.');
 if(!plan.timesConfirmed)issues.push('Confirm the five battle times in game.');
 if(!plan.deadline)issues.push('Record the in-game registration deadline.');
 const unplaced=players.filter(p=>record(plan,p).status==='available'&&!assigned.has(p.id));
 if(unplaced.length)issues.push(`${unplaced.length} participating players are unassigned.`);
 for(const team of plan.teams)for(const issue of teamIssues(plan,team,players))issues.push(`[${team.host}] Legion ${team.number}: ${issue}`);
 return issues;
}
export function transferRows(plan,players){return plan.teams.flatMap(t=>t.members.map(m=>{const p=players.find(p=>p.id===m.id);return {player:p,member:m,team:t,home:record(plan,p||{id:m.id}).homeAlliance,needsMove:p?.allianceTag!==t.host};}));}
export function planText(plan,players){return [`${plan.name} · STATE 3573`,`Registration deadline: ${plan.deadline?plan.deadline.replace('T',' ')+' UTC':'Not recorded'}`,'Planning only. R4/R5 must register players in game.','',...plan.teams.flatMap(t=>[`[${t.host}] Legion ${t.number}`,`Times: ${t.slots.map(s=>s+' UTC').join(', ')}`,`Captain: ${(t.captain?playerLabel(players.find(p=>p.id===t.captain)):'Not chosen')}`,`Confirmed match: ${t.matchTime||'Not announced'}`, ...t.members.map(m=>{const p=players.find(p=>p.id===m.id);return `${playerLabel(p)} · ${p?.fid||'ID unknown'} · ${record(plan,p||{id:m.id}).homeAlliance||'?'} → ${t.host} · ${m.role}${m.registered?' · Registered':' · Needs registration'}`;}),''])].join('\n');}
