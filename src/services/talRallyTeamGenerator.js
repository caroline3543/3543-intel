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
function memberAllocation(player, remaining, overrides = {}, phase = 't11', previous = null) {
  const cap = playerCapacity(player, overrides);
  if (!cap || (previous?.total || 0) >= cap) return null;
  const inventory = playerInventory(player, overrides);
  const assigned = Object.fromEntries(TAL_TYPES.map(t => [t,{t11:0,t10:0,unknown:0}]));
  let budget=cap-(previous?.total||0), estimated=false;
  for (const type of TAL_TYPES) {
    if (!budget || !remaining[type]) continue;
    if (phase==='unknown' && inventory[type].t11!==null && inventory[type].t10!==null) continue;
    const availability=phase==='unknown' ? budget : inventory[type][phase];
    if (availability == null) continue;
    const prior=previous?.troops[type]?.[phase] || 0;
    const use=Math.max(0,Math.min(budget,remaining[type],availability-prior));
    if (!use) continue;
    assigned[type][phase]+=use;
    remaining[type]-=use;
    budget-=use;
    if(phase==='unknown') estimated=true;
  }
  const used=cap-(previous?.total||0)-budget;
  if (!used) return null;
  return {...snapshotItem(player),troops:assigned,total:used,estimated,marchCapacity:cap};
}
function mergeAllocation(previous, additional) {
  if (!previous) return additional;
  return {...previous,total:previous.total+additional.total,estimated:previous.estimated||additional.estimated,
    troops:Object.fromEntries(TAL_TYPES.map(t=>[t,Object.fromEntries(['t11','t10','unknown'].map(k=>[k,previous.troops[t][k]+additional.troops[t][k]]))]))};
}
function stageScore(player,remaining,event,phase) {
  const inv=playerInventory(player);
  const available=TAL_TYPES.reduce((sum,type)=>{
    if (remaining[type]<=0) return sum;
    const n=phase==='unknown' ? (inv[type].t11==null||inv[type].t10==null ? playerCapacity(player)||0 : 0) : (inv[type][phase]||0);
    return sum+Math.min(n,remaining[type]);
  },0);
  return available*1000 + heroPriority(player)*1000 + power(player,event)*0.001;
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
    const assigned=new Map();
    const add=(player,phase)=>{
      const prior=assigned.get(String(player.id))||null;
      const amount=memberAllocation(player,remaining,overrides[player.id]||{},phase,prior);
      if (!amount) return false;
      assigned.set(String(player.id),mergeAllocation(prior,amount));
      return true;
    };
    // Strict type-aware T11 pass over the leader and all joiners before any T10 use.
    // Each member contributes at most one march, possibly composed of both tiers.
    for (const phase of ['t11','t10','unknown']) {
      if(phase==='t11') add(leader,'t11');
      else for(const player of [leader,...pool.filter(p=>assigned.has(String(p.id)))]) add(player,phase);
      let candidates=pool.filter(p=>!used.has(String(p.id)) && playerCapacity(p,overrides[p.id]||{}));
      while (assigned.size - (assigned.has(String(leader.id))?1:0) < maxJoiners &&
          Object.values(remaining).some(x=>x>0) && candidates.length) {
        candidates.sort((a,b)=>stageScore(b,remaining,event,phase)-stageScore(a,remaining,event,phase) || String(a.id).localeCompare(String(b.id)));
        let next=null;
        for (const candidate of candidates) {
          if (memberAllocation(candidate,{...remaining},overrides[candidate.id]||{},phase)) {next=candidate;break;}
        }
        if(!next)break;
        add(next,phase);
        used.add(String(next.id));
        candidates=candidates.filter(p=>p.id!==next.id);
      }
    }
    const participants=[...assigned.values()].map(a=>String(a.id)===String(leader.id)?{...a,leader:true}:a);
    const fill=capacity-Object.values(remaining).reduce((a,b)=>a+b,0);
    const estimated=participants.some(a=>a.estimated);
    const full=fill===capacity;
    return {id:'rally-'+(i+1),leader:snapshotItem(leader),capacity,ratio,targets:troopTargets(capacity,ratio),remaining,players:participants,fill,estimated,status:full?(estimated?'estimated-full':'confirmed-full'):'incomplete',warnings:[...(!full?['Not enough recorded available troops or usable march capacity.']:[]),...(estimated?['Unknown troop quantities used as estimated contributions.']:[])]};
  });
  if(mode==='balanced') warnings.push('Balanced mode currently shares the Strongest allocator; full cross-team balancing is not yet implemented.');
  return {mode,teamId:team.id,teams:result,warnings,unused:pool.filter(p=>!used.has(String(p.id))).map(snapshotItem),settings:{teamCount:count,preferredSize,maxJoiners,ratio}};
}
