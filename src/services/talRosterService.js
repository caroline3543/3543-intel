import {allianceEvidence} from './allianceEvidenceService.js';
export const legionLabel = team => `${team.host} Legion ${team.number}`;
export function legionForPlayer(plan, id) { return plan?.teams?.find(team => team.members.some(member => member.id === id)); }
export function allianceCheck(player, team) {
  const {tag,at,noAlliance}=allianceEvidence(player);
  const matches=tag&&tag.toLowerCase()===team.host.trim().toLowerCase();
  return {tag,at,status:noAlliance?'move':!tag?'unknown':matches?'in-host':'move',label:noAlliance?`Join ${team.host} · No alliance`:!tag?'Alliance unknown':matches?`Last seen in ${team.host}`:`Move to ${team.host} · Last seen in ${tag}`};
}
export function recentNameChanges(players) {
  const rows=[];
  for(const player of players){
    const seen=new Set();
    for(const entry of player.observationHistory||[]){
      if(entry.stream!=='profile'||!Number.isFinite(Date.parse(entry.observedAt)))continue;
      for(const change of entry.changes||[]){
        if(change.field!=='username'||typeof change.before!=='string'||typeof change.after!=='string'||!change.before.trim()||!change.after.trim()||change.before===change.after)continue;
        const key=JSON.stringify([entry.observedAt,change.before,change.after]);if(seen.has(key))continue;seen.add(key);
        rows.push({id:`${player.id}:${key}`,playerId:player.id,before:change.before,after:change.after,at:entry.observedAt});
      }
    }
  }
  return rows.sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)||a.id.localeCompare(b.id));
}
export function utcChecked(at) { return at&&Number.isFinite(Date.parse(at))?new Date(at).toISOString().slice(0,16).replace('T',' ')+' UTC':'Not checked'; }
