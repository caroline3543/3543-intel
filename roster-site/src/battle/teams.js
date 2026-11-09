import {balanceSquads} from '../../../src/services/squadBalancerService.js';
import {battlePower} from './eventPower.js';
export const teamEligible=m=>m.attendance==='available'&&m.role==='combatant';
export function balanceFingerprint(event){return JSON.stringify(event.participants.map(m=>[m.id,m.role,m.attendance,m.power]).sort((a,b)=>a[0].localeCompare(b[0])));}
export function balanceGuard(event){const meta=teams=>(teams||[]).map(t=>[t.id,t.name||'',t.leaderId||'',t.building||'',t.note||'']).sort((a,b)=>a[0].localeCompare(b[0]));return JSON.stringify({power:balanceFingerprint(event),assignments:event.participants.map(m=>[m.id,m.battleTeamId||'']).sort((a,b)=>a[0].localeCompare(b[0])),teams:meta(event.battleTeams),retired:meta(event.retiredBattleTeams)});}
export function suggestBattleTeams(event,count){
 if(![4,5,6].includes(count))throw Error('Choose 4, 5 or 6 teams.');
 const eligible=event.participants.filter(teamEligible),known=eligible.filter(m=>battlePower(m)!=null).sort((a,b)=>a.id.localeCompare(b.id)),missing=eligible.filter(m=>battlePower(m)==null);
 if(known.length<count)throw Error(`Add troop powers for at least ${count} attending combatants.`);
 const {squads}=balanceSquads(known,[],count,battlePower);
 const teams=squads.map((s,i)=>({id:`battle-team-${i+1}`,name:`Team ${i+1}`,leaderId:'',memberIds:s.memberIds,building:'',note:''}));
 const totals=squads.map(s=>s.totalPower);
 return {teams,missingIds:missing.map(m=>m.id),fingerprint:balanceFingerprint(event),guard:balanceGuard(event),spread:Math.max(...totals)-Math.min(...totals)};
}
export function activeTeamMembers(event,team){return event.participants.filter(m=>m.battleTeamId===team.id&&teamEligible(m));}
export function saveBattleTeams(event,preview){
 if(preview.guard!==balanceGuard(event))throw Error('Attendance, powers or teams changed. Preview teams again.');
 // Build again from current event rather than trusting a stale/tampered preview.
 const current=suggestBattleTeams(event,preview.teams.length);
 const assignments=new Map(current.teams.flatMap(t=>t.memberIds.map(id=>[id,t.id])));
 const old=new Map([...(event.retiredBattleTeams||[]),...(event.battleTeams||[])].map(t=>[t.id,t]));
 const battleTeams=current.teams.map(({memberIds,...team})=>{const saved=old.get(team.id);return {...team,...saved,leaderId:memberIds.includes(saved?.leaderId)?saved.leaderId:''};});
 const activeIds=new Set(battleTeams.map(t=>t.id));
 return {...event,participants:event.participants.map(m=>({...m,battleTeamId:assignments.get(m.id)||''})),battleTeams,retiredBattleTeams:[...old.values()].filter(t=>!activeIds.has(t.id)),balanceFingerprint:current.fingerprint};
}
export function updateBattleTeam(event,id,patch){
 const team=event.battleTeams?.find(t=>t.id===id);if(!team)throw Error('Team no longer exists.');
 if(patch.leaderId&&!activeTeamMembers(event,team).some(m=>m.id===patch.leaderId))throw Error('Choose an attending member of this team.');
 return {...event,battleTeams:event.battleTeams.map(t=>t.id===id?{...t,...patch}:t)};
}
export function moveBattleTeamMember(event,playerId,targetId){
 if(!event.battleTeams?.some(t=>t.id===targetId))throw Error('Choose a team.');
 if(!event.participants.some(m=>m.id===playerId&&teamEligible(m)))throw Error('Only attending combatants can join a team.');
 return {...event,participants:event.participants.map(m=>m.id===playerId?{...m,battleTeamId:targetId}:m),battleTeams:event.battleTeams.map(t=>({...t,leaderId:t.leaderId===playerId&&t.id!==targetId?'':t.leaderId}))};
}
