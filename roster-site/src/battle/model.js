import {compareLegionStrength} from '../tal/autoRoles.js';
import {parsePower} from '../tal/power.js';
import {playerLabel} from '../tal/planner.js';
export const BUILDINGS=['Prototype Site I','Prototype Site II','Repair Facility I','Repair Facility II','Repair Facility III','Repair Facility IV','Boiler Room','Transit Station','Imperial Foundry','Munitions Warehouse','Mercenary Camp','Weapon Workshops','Roaming / supplies'];
export const battleEvents=events=>(events||[]).filter(e=>e.kind==='battle-plan');
export function validateBattleTime(date,time){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date||'')||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time||''))throw Error('Choose a date and time in UTC.');
 const d=new Date(date+'T00:00:00Z');if(!Number.isFinite(d.valueOf())||d.toISOString().slice(0,10)!==date)throw Error('Choose a valid calendar date.');
}
export function createBattle({id,type='tal',date,time,team,alliance,players,plan}){
 validateBattleTime(date,time);
 const ids=team?new Set(team.members.map(m=>m.id)):new Set(players.filter(p=>p.allianceTag===alliance).map(p=>p.id));
 const sorted=players.filter(p=>ids.has(p.id)).sort((a,b)=>compareLegionStrength(plan,a,b));
 const subCap=type==='foundry'?10:20;
 return {id,kind:'battle-plan',type,date,time,title:`${team?`${team.host} Legion ${team.number}`:alliance} · ${type==='tal'?'TAL':'Foundry'}`,sourceTeamId:team?.id||'',sourceLabel:team?`${team.host} Legion ${team.number}`:alliance,officer:'',opponent:'',notes:'',createdAt:new Date().toISOString(),participants:sorted.map((p,i)=>({id:p.id,role:i<30?'combatant':i<30+subCap?'substitute':'reserve',attendance:'unknown',building:'',task:'Joiner',power:'',note:''}))};
}
export function patchBattle(events,id,patch){return events.map(e=>e.id===id?{...e,...patch}:e);}
export function patchParticipant(event,id,patch){
 const member=event.participants.find(p=>p.id===id);if(!member)throw Error('Player is no longer in this battle.');
 if(patch.role&&patch.role!==member.role){const cap=patch.role==='combatant'?30:patch.role==='substitute'?(event.type==='foundry'?10:20):Infinity;if(event.participants.filter(p=>p.role===patch.role).length>=cap)throw Error(`No ${patch.role} places left. Move someone to reserve first.`);}
 return {...event,participants:event.participants.map(p=>p.id===id?{...p,...patch}:p)};
}
export function battlePower(member){try{return parsePower(member.power);}catch{return null;}}
export function battleStats(event){const selected=event.participants.filter(p=>p.role!=='reserve'),available=selected.filter(p=>p.attendance==='available'),known=available.map(battlePower).filter(p=>p!=null).sort((a,b)=>b-a);return {selected:selected.length,available:available.length,unknown:selected.filter(p=>p.attendance==='unknown').length,unassigned:available.filter(p=>!p.building).length,known:known.length,total:known.reduce((a,b)=>a+b,0),top20:known.slice(0,20).reduce((a,b)=>a+b,0)};}
export function battleText(event,players){
 const byId=new Map(players.map(p=>[p.id,p]));
 const label=m=>`${playerLabel(byId.get(m.id))} · ${byId.get(m.id)?.fid||'ID missing'} · ${m.role} · ${m.attendance}${battlePower(m)!=null?` · Power ${battlePower(m).toLocaleString('en-US')}`:' · Power not entered'}${m.note?` · ${m.note}`:''}`;
 const rows=event.participants.filter(p=>p.role!=='reserve').sort((a,b)=>playerLabel(byId.get(a.id)).localeCompare(playerLabel(byId.get(b.id))));
 const buildings=[...new Set([...BUILDINGS,...rows.map(p=>p.building).filter(Boolean)])];
 return [event.title,`${event.date} · ${event.time} UTC`,event.opponent?`Opponent: ${event.opponent}`:'',event.officer?`Lead: ${event.officer}`:'',event.notes,'',...buildings.flatMap(b=>{const assigned=rows.filter(p=>p.building===b&&p.attendance!=='unavailable');return assigned.length?[b,...assigned.map(p=>`${label(p)} · ${p.task}`),'']:[];}),'Unassigned / attendance to check',...rows.filter(p=>!p.building||p.attendance==='unavailable').map(label),'','Reserve',...event.participants.filter(p=>p.role==='reserve').sort((a,b)=>playerLabel(byId.get(a.id)).localeCompare(playerLabel(byId.get(b.id)))).map(label)].filter(v=>v!==undefined).join('\n');
}
export function applyBattleAction(events,action){
 if(action.type==='add'){if(events.some(e=>e.id===action.event.id))return events;return [...events,action.event];}
 return events.map(e=>{
  if(e.id!==action.id||e.kind!=='battle-plan')return e;
  if(action.type==='patch'){if('date' in action.patch||'time' in action.patch)validateBattleTime(action.patch.date??e.date,action.patch.time??e.time);return {...e,...action.patch};}
  if(action.type==='member')return patchParticipant(e,action.playerId,action.patch);
  if(action.type==='addMember')return e.participants.some(m=>m.id===action.playerId)?e:{...e,participants:[...e.participants,{id:action.playerId,role:'reserve',attendance:'unknown',building:'',task:'Joiner',power:'',note:''}]};
  if(action.type==='powers'){if(action.rows.some(r=>r.beforeRaw!==undefined&&e.participants.find(m=>m.id===r.player.id)?.power!==r.beforeRaw))throw Error('Event powers changed. Review them again before saving.');const byId=new Map(action.rows.filter(r=>!r.error).map(r=>[r.player.id,r.value]));return {...e,participants:e.participants.map(m=>byId.has(m.id)?{...m,power:String(byId.get(m.id)),powerUpdatedAt:new Date().toISOString()}:m)};}
  return e;
 });
}
