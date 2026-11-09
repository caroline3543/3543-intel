import {record} from '../tal/planner.js';
import {battlePower} from './model.js';

const validFID = fid => /^[1-9]\d{3,14}$/.test(String(fid ?? '').trim());
const verified = value => String(value ?? '').trim().toLowerCase() === 'verified';

// Read-only adapter for the actual State 3573 battle planner.
// In-game registration is distinct from sheet verification.
export function talBattleRallyInputs({battle,plan,players}) {
  if (battle?.type !== 'tal') return {ready:false,reason:'Rally teams are available for TAL battles.'};
  const legion=(plan?.teams || []).find(t => t.id === battle.sourceTeamId);
  if (!legion) return {ready:false,reason:'Create this TAL battle from an existing TAL legion to verify its roster.'};
  const byId=new Map((players || []).map(p=>[String(p.id),p]));
  const selected=new Set((legion.members || []).filter(m=>m.role==='combatant').map(m=>String(m.id)));
  const excluded=[],members=[];
  for (const m of battle.participants || []) {
    if (m.role!=='combatant') continue;
    const id=String(m.id),player=byId.get(id);
    if (!selected.has(id)) {excluded.push({id,reason:'Not selected for this legion'});continue;}
    if (!player || !validFID(player.fid)) {excluded.push({id,reason:'Valid player ID missing'});continue;}
    const row=record(plan,player);
    if (!verified(row.sheetRegistration)) {
      excluded.push({id,reason:'Spreadsheet registration is not Verified'});continue;
    }
    members.push({id,role:'combatant',verified:true,registered:legion.members.find(p=>String(p.id)===id)?.registered === true});
  }
  const attendance=Object.fromEntries((battle.participants || []).map(m=>[String(m.id),
    m.attendance==='available'?'attending':m.attendance==='unavailable'?'not-attending':'unknown']));
  const mappedEvent={
    ...battle,
    snapshots:(battle.participants||[]).map(m=>({playerId:m.id,troopPower:battlePower(m)})),
  };
  const team={
    id:battle.id,matchTime:battle.time,
    members,battleAttendance:attendance,
    rallyTeamDraft:battle.rallyTeamDraft,
    rallyMatchOverrides:battle.rallyMatchOverrides,
  };
  const warnings=[];
  if(excluded.length)warnings.push(excluded.length+' combatants excluded because selection, player ID or sheet registration could not be verified.');
  const needsGameRegistration=members.filter(m=>!m.registered).length;
  if(needsGameRegistration)warnings.push(needsGameRegistration+' eligible players still need in-game registration confirmation.');
  return {ready:true,team,config:{availability:{}},event:mappedEvent,warnings,excluded};
}
