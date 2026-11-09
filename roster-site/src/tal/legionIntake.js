import {assignedTeam,eligible,placePlayer,record,setRecord} from './planner.js';
export function intakePreview(plan,players,targetId,entries,{role='auto',allowConflicts=false,moveExisting=false}={}){
 let next=plan;const seen=new Set(),results=[];
 for(const entry of entries){
  const player=entry.player?players.find(p=>p.id===entry.player.id):null;
  if(!player){results.push({...entry,state:'unmatched',reason:entry.ambiguous?'More than one match. Choose a player.':'No exact match. Check the ID or load this player in Members.'});continue;}
  if(seen.has(player.id)){results.push({...entry,player,state:'skip',reason:'Repeated in this list.'});continue;}seen.add(player.id);
  const source=assignedTeam(next,player.id),team=next.teams.find(t=>t.id===targetId);
  if(source?.id===targetId){results.push({...entry,player,state:'skip',reason:'Already in this legion.'});continue;}
  if(!team){results.push({...entry,player,state:'blocked',reason:'This legion no longer exists.'});continue;}
  const r=record(next,player);
  if(player.blacklisted){results.push({...entry,player,state:'blocked',reason:'Excluded from battle plans. Update their member profile first.'});continue;}
  if(r.status==='declined'){results.push({...entry,player,state:'blocked',reason:'Marked not participating. Update their availability first.'});continue;}
  if(source&&!moveExisting){results.push({...entry,player,state:'blocked',reason:`In [${source.host}] Legion ${source.number}. Enable moves below or use Move.`});continue;}
  const conflict=!eligible(next,player,team);
  if(conflict&&!allowConflicts){results.push({...entry,player,state:'blocked',reason:'Times not confirmed for this legion. Record availability or enable unconfirmed times below.'});continue;}
  const assignedRole=role==='auto'?(team.members.filter(m=>m.role==='combatant').length<30?'combatant':'substitute'):role;
  try{
   const prepared=r.status==='pending'?setRecord(next,player,{status:'available'}):next;
   next=placePlayer(prepared,players,player.id,targetId,assignedRole,'',{allowAvailabilityConflict:allowConflicts});
   results.push({...entry,player,state:source?'move':'add',role:assignedRole,conflict,reason:source?`Move from [${source.host}] Legion ${source.number}`:conflict?'Availability needs review.':'Ready to add.'});
  }catch(error){results.push({...entry,player,state:'blocked',reason:error.message});}
 }
 return {plan:next,results,added:results.filter(r=>r.state==='add').length,moved:results.filter(r=>r.state==='move').length,skipped:results.filter(r=>r.state==='skip').length,needsReview:results.filter(r=>['blocked','unmatched'].includes(r.state)).length};
}
