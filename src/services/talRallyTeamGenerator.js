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
  const raw = Object.fromEntries(TAL_TYPES.map(type => [type, { ...(player.talTroopInventory?.[type] || {}), ...(overrides.troopInventory?.[type] || {}) }]));
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
function stageScore(player,remaining,event,phase,overrides = {}) {
  const inv=playerInventory(player,overrides);
  const available=TAL_TYPES.reduce((sum,type)=>{
    if (remaining[type]<=0) return sum;
    const n=phase==='unknown' ? (inv[type].t11==null||inv[type].t10==null ? playerCapacity(player,overrides)||0 : 0) : (inv[type][phase]||0);
    return sum+Math.min(n,remaining[type]);
  },0);
  return available*1000 + heroPriority(player)*1000 + power(player,event)*0.001;
}
export function generateTalRallyDraft({ team, config, players, event, settings = {}, overrides = {} }) {
  const mode = settings.mode === 'balanced' ? 'balanced' : 'strongest';
  const teamCount = Math.max(1, Math.min(8, Math.floor(Number(settings.teamCount) || 1)));
  const preferredSize = Math.max(2, Math.floor(Number(settings.preferredSize) || 5));
  const maxJoiners = Math.max(1, Math.min(49, Math.floor(Number(settings.maxJoiners) || 29)));
  const ratio = normaliseRatio(settings.ratio || [50, 0, 50]);
  const members = (team.members || []).filter(m => m.role === 'combatant');
  const ids = new Set(members.map(m => String(m.id)));
  const eligible = players.filter(p =>
    ids.has(String(p.id)) &&
    !p.blacklisted &&
    (!team.matchTime || battleStatus(team, config, p.id) !== 'not-attending'));
  const warnings = [];
  if (!team.matchTime) warnings.push('Match time is not confirmed; attendance is provisional.');
  if (eligible.length < members.length) warnings.push('Some combatants are excluded or unavailable.');
  if (eligible.some(p => !team.matchTime || battleStatus(team, config, p.id) !== 'attending'))
    warnings.push('Unknown attendance is included provisionally; confirm before the match.');

  const byId = new Map(eligible.map(p => [String(p.id), p]));
  const leaders = eligible.filter(eligibleLeader).sort((a, b) =>
    ranking(b, event) - ranking(a, event) || String(a.id).localeCompare(String(b.id)));
  const locked = [...new Set(settings.lockedLeaderIds || [])]
    .map(id => byId.get(String(id)))
    .filter(p => p && eligibleLeader(p));
  const selected = [...locked, ...leaders.filter(p => !locked.some(l => l.id === p.id))]
    .slice(0, teamCount);
  if (selected.length < teamCount) warnings.push('Not enough eligible rally leaders for the requested number of teams.');
  if (!selected.length) warnings.push('Record a rally leader profile or Rally Lead role before generating teams.');
  if (selected.some(p => !p.leadershipRank && power(p, event) === 0))
    warnings.push('Leader strength is estimated: some leaders lack leadership ranking and TAL troop power.');

  const assignedToTeam = new Set(selected.map(p => String(p.id)));
  const pool = eligible.filter(p => !assignedToTeam.has(String(p.id)));
  const states = selected.map((leader, i) => {
    const capacity = rallyCapacity(leader, overrides[leader.id] || {});
    const valid = capacity != null && capacity > 0;
    return {
      id: 'rally-' + (i + 1), leader, capacity: valid ? capacity : null,
      remaining: valid ? troopTargets(capacity, ratio) : null, assigned: new Map(),
    };
  });

  function addToState(state, player, tier) {
    if (!state.remaining) return false;
    const previous = state.assigned.get(String(player.id)) || null;
    const allocation = memberAllocation(player, state.remaining, overrides[player.id] || {}, tier, previous);
    if (!allocation) return false;
    state.assigned.set(String(player.id), mergeAllocation(previous, allocation));
    if (player.id !== state.leader.id) assignedToTeam.add(String(player.id));
    return true;
  }
  function slotsFree(state) {
    return state.assigned.size - Number(state.assigned.has(String(state.leader.id))) < maxJoiners;
  }
  function hasShortfall(state) {
    return !!state.remaining && Object.values(state.remaining).some(v => v > 0);
  }
  function fillFraction(state) {
    return state.capacity
      ? 1 - Object.values(state.remaining).reduce((a, b) => a + b, 0) / state.capacity
      : 0;
  }
  function addBestNewPlayer(state, tier) {
    if (!slotsFree(state) || !hasShortfall(state)) return false;
    const candidates = pool.filter(p =>
      !assignedToTeam.has(String(p.id)) && playerCapacity(p, overrides[p.id] || {}) > 0);
    const viable = candidates.map(p => {
      const trial = memberAllocation(p, { ...state.remaining }, overrides[p.id] || {}, tier);
      return { player: p, trial, score: stageScore(p, state.remaining, event, tier, overrides[p.id] || {}) };
    }).filter(v => v.trial);
    viable.sort((a, b) => b.score - a.score || String(a.player.id).localeCompare(String(b.player.id)));
    return !!viable[0] && addToState(state, viable[0].player, tier);
  }

  // Reserve the leader's own T11 march. Joiners' T11 is prioritised over T10.
  states.forEach(s => addToState(s, s.leader, 't11'));

  for (const tier of ['t11', 't10', 'unknown']) {
    // Re-use each existing march for the next tier before consuming another player.
    if (tier !== 't11') {
      for (const s of states) {
        addToState(s, s.leader, tier);
        for (const p of pool.filter(p => s.assigned.has(String(p.id)))) addToState(s, p, tier);
      }
    }
    if (mode === 'strongest') {
      for (const s of states) {
        while (addBestNewPlayer(s, tier)) { /* strongest rally fills first */ }
      }
    } else {
      // In balanced mode, repeatedly give the least-filled rally the next suitable
      // contributor, avoiding a single team monopolising the best joiners.
      const exhausted = new Set();
      while (true) {
        const candidates = states.filter(s =>
          !exhausted.has(s.id) && hasShortfall(s) && slotsFree(s))
          .sort((a, b) => fillFraction(a) - fillFraction(b) || a.id.localeCompare(b.id));
        if (!candidates.length) break;
        const current = candidates[0];
        if (!addBestNewPlayer(current, tier)) exhausted.add(current.id);
      }
    }
  }

  const result = states.map(s => {
    const participants = [...s.assigned.values()].map(a =>
      String(a.id) === String(s.leader.id) ? { ...a, leader: true } : a);
    const fill = s.capacity == null ? 0
      : s.capacity - Object.values(s.remaining).reduce((a, b) => a + b, 0);
    const estimated = participants.some(a => a.estimated);
    const full = s.capacity != null && fill === s.capacity;
    const leaderRecorded = s.assigned.has(String(s.leader.id));
    const status = !s.capacity || !leaderRecorded ? 'needs-review'
      : full ? (estimated ? 'estimated-full' : 'confirmed-full') : 'incomplete';
    return {
      id: s.id, leader: snapshotItem(s.leader), capacity: s.capacity,
      ratio, targets: s.capacity ? troopTargets(s.capacity, ratio) : null,
      remaining: s.remaining, players: participants, fill, estimated, status,
      warnings: [
        ...(!s.capacity ? ['Leader rally capacity is missing.'] : []),
        ...(!leaderRecorded ? ['Leader own march could not be established from inventory.'] : []),
        ...(s.capacity && !full ? ['Rally remains short of required troop types or capacity.'] : []),
        ...(estimated ? ['Unknown troop counts are estimated, not confirmed.'] : []),
      ],
    };
  });
  return {
    mode, teamId: team.id, teams: result, warnings,
    unused: pool.filter(p => !assignedToTeam.has(String(p.id))).map(snapshotItem),
    settings: { teamCount, preferredSize, maxJoiners, ratio },
  };
}
