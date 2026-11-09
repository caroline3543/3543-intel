// TAL rally team generator, separate from legion/building assignments.
// No writes to player profiles, event snapshots or spreadsheet data.
import { battleStatus } from './talMatchReadiness.js';

export const TAL_TYPES = ['infantry', 'lancer', 'marksman'];
export const TAL_TIERS = ['t11', 't10'];
const number = value => value === '' || value == null ? null : Number.isFinite(Number(value)) && Number(value) >= 0 ? Math.floor(Number(value)) : null;
const power = (player, event) => number(event?.snapshots?.find(s => s.playerId === player.id)?.troopPower) ?? number(player?.talTroopPower) ?? 0;
export function normaliseRatio(ratio = [50, 0, 50]) {
  const parts = Array.isArray(ratio) ? ratio : [ratio.infantry, ratio.lancer, ratio.marksman];
  if (parts.length !== 3 || parts.some(x => !Number.isFinite(Number(x)) || Number(x) < 0 || Number(x) > 100) || Math.abs(parts.reduce((a,b) => a + Number(b), 0) - 100) > 0.00001) throw new Error('Troop ratio must have three non-negative percentages totalling 100.');
  return parts.map(Number);
}
export function troopTargets(capacity, ratio) {
  const total = number(capacity);
  if (total == null || total <= 0) throw new Error('A positive rally capacity is required.');
  const values = normaliseRatio(ratio).map(p => total * p / 100);
  const floors = values.map(Math.floor);
  let remainder = total - floors.reduce((a,b) => a+b, 0);
  const order = [0,1,2].sort((a,b) => (values[b]-floors[b])-(values[a]-floors[a]) || a-b);
  for (let i = 0; i < remainder; i++) floors[order[i]]++;
  return Object.fromEntries(TAL_TYPES.map((t,i) => [t, floors[i]]));
}
export function playerCapacity(player, overrides = {}) {
  return number(overrides.marchCapacity ?? player.marchCapacity);
}
export function playerInventory(player, overrides = {}) {
  const raw = { ...(player.talTroopInventory || {}), ...(overrides.troopInventory || {}) };
  return Object.fromEntries(TAL_TYPES.map(type => [type, Object.fromEntries(TAL_TIERS.map(tier => [tier, number(raw[type]?.[tier])]))]));
}
export function rallyCapacity(player, overrides = {}) {
  return number(overrides.rallyCapacity ?? player.leaderProfile?.rallyCapacity ?? player.rallyCapacity);
}
export function joinerHeroes(player) {
  return (player.joinerHeroes || []).filter(h => h && (h.hero || h.name)).map(h => ({
    name:String(h.hero || h.name), skillLevel:number(h.skillLevel), stars:number(h.stars ?? h.starLevel),
    confirmed: h.verified === true, 
  }));
}
export function hasNorah(player) {
  return joinerHeroes(player).some(h => h.name.toLowerCase().includes('norah'));
}
function heroPriority(player) {
  const heroes = joinerHeroes(player).filter(h => h.confirmed && h.skillLevel != null);
  return heroes.reduce((best,h) => Math.max(best, Math.min(5,h.skillLevel) * 100 + (h.name.toLowerCase().includes('norah') ? 10 : 0)),0);
}
function ranking(player,event) {
  const rank = number(player.leadershipRank);
  return (rank != null && rank > 0 ? 1e12 / rank : 0) + power(player,event);
}
function eligibleLeader(player) {
  return player?.leaderProfile?.role === 'leader' || player?.leaderProfile?.role === 'both' || player?.roles?.some(role => /rally.?lead/i.test(role));
}
function snapshotItem(player) {
  return { id:player.id, name:player.username || player.alias || String(player.fid || player.id), norah: joinerHeroes(player).find(h => h.name.toLowerCase().includes('norah')) || null };
}
function memberAllocation(player, remaining, overrides = {}, plannedCount = null) {
  const cap = playerCapacity(player, overrides);
  if (!cap) return null;
  const inventory = playerInventory(player, overrides);
  const count = Math.min(cap, plannedCount ?? cap, TAL_TYPES.reduce((s,t) => s + remaining[t],0));
  if (!count) return null;
  const assigned = Object.fromEntries(TAL_TYPES.map(t => [t,{t11:0,t10:0,unknown:0}]));
  let budget=count, estimated=false;
  // Relevant T11 first; then relevant T10; unknown inventory is estimated, never claimed as T11.
  for (const tier of TAL_TIERS) {
    for (const type of TAL_TYPES) {
      if (!budget || !remaining[type]) continue;
      const available=inventory[type][tier];
      if (available == null) continue;
      const use=Math.min(budget,remaining[type],available);
      assigned[type][tier]+=use; remaining[type]-=use;budget-=use;
    }
  }
  // Missing inventory entries can contribute only to a hypothetical estimated fill.
  for (const type of TAL_TYPES) {
    if (!budget || !remaining[type]) continue;
    if (inventory[type].t11 !== null && inventory[type].t10 !== null) continue;
    const use=Math.min(budget,remaining[type]);
    assigned[type].unknown+=use;remaining[type]-=use;budget-=use;estimated=true;
  }
  const used=count-budget;
  if (!used) return null;
  return {...snapshotItem(player), troops:assigned, total:used, estimated, marchCapacity:cap};
}
function preferredScore(player,targets,event) {
  const inv=playerInventory(player);
  const t11=TAL_TYPES.reduce((s,type)=>s+(targets[type]>0 ? (inv[type].t11 || 0):0),0);
  const t10=TAL_TYPES.reduce((s,type)=>s+(targets[type]>0 ? (inv[type].t10 || 0):0),0);
  return t11 * 3 + t10 + heroPriority(player) * 1000 + power(player,event) * 0.01;
}
export function generateTalRallyDraft({ team, config, players, event, settings = {}, overrides = {} }) {
  const mode=settings.mode === 'balanced' ? 'balanced' : 'strongest';
  const count=Math.max(1,Math.min(8,Math.floor(Number(settings.teamCount) || 1)));
  const preferredSize=Math.max(2,Math.floor(Number(settings.preferredSize)||5));
  const maxJoiners=Math.max(1,Math.floor(Number(settings.maxJoiners)||30));
  const ratio=normaliseRatio(settings.ratio || [50,0,50]);
  const rosterIds=new Set((team.members || []).filter(m => m.role === 'combatant').map(m => String(m.id)));
  const eligible=players.filter(p => rosterIds.has(String(p.id)) && !p.blacklisted && (!team.matchTime || battleStatus(team,config,p.id) !== 'not-attending'));
  const locked=[...new Set(settings.lockedLeaderIds || [])].filter(id => eligible.some(p => String(p.id) === String(id)));
  const byId=new Map(eligible.map(p=>[String(p.id),p]));
  const leaders=[...eligible].filter(eligibleLeader).sort((a,b)=>ranking(b,event)-ranking(a,event) || String(a.id).localeCompare(String(b.id)));
  const first=[...locked.map(id=>byId.get(String(id))), ...leaders.filter(p=>!locked.some(id=>String(id)===String(p.id)))].filter(Boolean);
  const selected=first.slice(0,Math.min(count,first.length));
  const warnings=[];
  if (selected.length<count) warnings.push('Not enough eligible rally leaders for the requested team count.');
  if (!team.matchTime) warnings.push('Match time not confirmed; attendance is provisional.');
  if (eligible.length<(team.members||[]).filter(m=>m.role==='combatant').length) warnings.push('Some combatants are unavailable or excluded.');
  const pool=eligible.filter(p=>!selected.some(l=>String(l.id)===String(p.id)));
  const used=new Set(selected.map(p=>String(p.id)));
  const result=selected.map((leader,i)=>{
    const capacity=rallyCapacity(leader,overrides[leader.id] || {});
    if (!capacity) {
      return { id:'rally-'+(i+1),leader:snapshotItem(leader),capacity:null,players:[],ratio,targets:null,remaining:null,fill:0,estimated:true,status:'needs-review',warnings:['Rally capacity missing for leader.'] };
    }
    const remaining=troopTargets(capacity,ratio);
    const assigned=[];
    const own=memberAllocation(leader,remaining,overrides[leader.id] || {});
    if (own) assigned.push({...own,leader:true});
    let candidates=pool.filter(p=>!used.has(String(p.id)) && playerCapacity(p,overrides[p.id] || {}));
    while (assigned.length < maxJoiners+1 && Object.values(remaining).some(x=>x>0) && candidates.length) {
      candidates.sort((a,b)=>preferredScore(b,remaining,event)-preferredScore(a,remaining,event) || String(a.id).localeCompare(String(b.id)));
      let next=null, allocation=null;
      for (const candidate of candidates) {
        const trial=memberAllocation(candidate,{...remaining},overrides[candidate.id]||{});
        if (trial) {next=candidate;allocation=trial;break;}
      }
      if (!next) break;
      const actual=memberAllocation(next,remaining,overrides[next.id]||{});
      assigned.push(actual);
      used.add(String(next.id));
      candidates=candidates.filter(p=>p.id!==next.id);
      // Flexible preferred size. Extra joiners are allowed when needed to fill.
    }
    const fill=capacity-Object.values(remaining).reduce((a,b)=>a+b,0);
    const estimated=assigned.some(a=>a.estimated);
    const full=fill===capacity;
    return {id:'rally-'+(i+1),leader:snapshotItem(leader),capacity,ratio,targets:troopTargets(capacity,ratio),remaining,players:assigned,fill,estimated,status:full?(estimated?'estimated-full':'confirmed-full'):'incomplete',warnings:[...(!full?['Not enough recorded available troops or usable march capacity.']:[]),...(estimated?['Unknown troop quantities used as estimated contributions.']:[])]};
  });
  if(mode==='balanced') warnings.push('Balanced mode currently shares the Strongest allocator; full cross-team balancing is not yet implemented.');
  return {mode,teamId:team.id,teams:result,warnings,unused:pool.filter(p=>!used.has(String(p.id))).map(snapshotItem),settings:{teamCount:count,preferredSize,maxJoiners,ratio}};
}
