import {allianceCheck, plannedMemberIds} from './talRosterService.js';

// Match-time readiness is scoped to a legion. A season poll is an indication,
// not an attendance confirmation, and manual battle-day choices take priority.
export function pollAvailable(config, playerId, matchTime) {
 return !!matchTime && (config?.availability?.[playerId] || []).includes(matchTime);
}
export function battleStatus(team, config, playerId) {
 const override=team?.battleAttendance?.[playerId];
 if(override==='attending'||override==='not-attending'||override==='unknown')return override;
 return pollAvailable(config,playerId,team?.matchTime)?'attending':'unknown';
}
export function matchRoster(team, config, players) {
 const byId=new Map(players.map(p=>[String(p.id),p]));
 const roles=new Map((team?.members||[]).map(m=>[String(typeof m==='object'?m.id:m),typeof m==='object'?m.role:'combatant']));
 return [...plannedMemberIds(team)].map(id=>{
  const player=byId.get(String(id));
  return {id:String(id),player,role:roles.get(String(id))||'combatant',
   status:battleStatus(team,config,id),
   pollYes:pollAvailable(config,id,team?.matchTime),
   alliance:player?allianceCheck(player,team).status:'unknown'};
 });
}
export function readinessForMatch(team,config,players) {
 const roster=matchRoster(team,config,players);
 const attending=roster.filter(r=>r.status==='attending');
 return {roster,attending:attending.length,correct:attending.filter(r=>r.alliance==='in-host').length,
   needMove:attending.filter(r=>r.alliance==='move').length,
   unverified:attending.filter(r=>r.alliance==='unknown').length,
   pollYes:roster.filter(r=>r.pollYes).length};
}
