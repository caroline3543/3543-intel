import {record,setRecord} from './planner.js';
export function setLegionSelected(plan,players,id,teamId,selected,{confirmRegistered=false}={}){
 if(plan.locked)throw Error('Unlock the plan to change selections.');
 const player=players.find(p=>p.id===id),team=plan.teams.find(t=>t.id===teamId);
 if(!player||!team)throw Error('Choose a player and legion.');
 const member=team.members.find(m=>m.id===id),candidate=team.candidates?.find(m=>m.id===id);
 if(selected){
  if(member)return plan;
  if(plan.teams.some(t=>t.id!==teamId&&t.members.some(m=>m.id===id)))throw Error('Selected for another legion. Use Move or role.');
  if(player.blacklisted)throw Error('This player is excluded from battle plans.');
  if(record(plan,player).status==='declined')throw Error('Marked not participating. Update availability first.');
  if(team.members.length>=50)throw Error('50 players selected. Deselect someone first.');
  const role=!plan.autoRoles&&['combatant','substitute'].includes(candidate?.previousRole)?candidate.previousRole:'pending';
  if(role!=='pending'&&team.members.filter(m=>m.role===role).length>=(role==='combatant'?30:20))throw Error(`No ${role} places left. Choose a role first.`);
  const next=setRecord(plan,player,{excludeFromSuggestions:false});
  return {...next,teams:next.teams.map(t=>({...t,members:t.id===teamId?[...t.members,{id,role,registered:false}]:t.members,candidates:(t.candidates||[]).filter(c=>c.id!==id)}))};
 }
 if(!member)return plan;
 if(member.registered&&!confirmRegistered)throw Error('Confirm before deselecting a registered player.');
 const next=setRecord(plan,player,{excludeFromSuggestions:true});
 return {...next,teams:next.teams.map(t=>t.id===teamId?{...t,members:t.members.filter(m=>m.id!==id),candidates:[...(t.candidates||[]).filter(c=>c.id!==id),{id,status:'Not selected',previousRole:member.role,previousRegistered:!!member.registered}],captain:t.captain===id?'':t.captain}:t)};
}
export function removeLegionEntry(plan,id,teamId){
 if(plan.locked)throw Error('Unlock the plan to remove a player.');
 return {...plan,teams:plan.teams.map(t=>t.id===teamId?{...t,members:t.members.filter(m=>m.id!==id),candidates:(t.candidates||[]).filter(c=>c.id!==id),captain:t.captain===id?'':t.captain}:t)};
}
