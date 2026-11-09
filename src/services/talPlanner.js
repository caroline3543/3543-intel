import {battleStatus} from './talMatchReadiness.js';
export const TAL_BUILDINGS = ['Proto I', 'Proto II', 'Repair I', 'Repair II', 'Repair III', 'Repair IV', 'Boiler', 'Transit'];
export const TAL_SLOTS = ['02:00', '07:00', '12:00', '14:00', '19:00'];
export function talConfig(event) {
  return { mode: 'state', hostTags: [], slots: TAL_SLOTS, availability: {}, interestedIds: [], teams: [], step: 'Availability', locked: false, ...event.tal };
}
export function strength(player, event) {
  const snap = event.snapshots?.find(s => s.playerId === player.id);
  return Number(snap?.troopPower || 0);
}
export function meetsTalAvailability(player, slots, config) {
  return !!player && slots.filter(s => (config.availability[player.id] || []).includes(s)).length >= 2;
}
export function talAvailabilityConflicts(team, config, players = []) {
  return team.members.filter(m => !meetsTalAvailability({id:m.id}, team.slots, config));
}
export function candidateTeams(config) {
  return config.hostTags.flatMap(tag => [1, 2].map(legion => ({ id: `${tag}:${legion}`, host: tag, legion, matchTime: '', slots: [], members: [], buildings: [...TAL_BUILDINGS], assignments: {} })));
}
// Greedy suggestion: keep players available at all three times together first.
// Never invent availability, duplicate a player, or exceed 30 + 20 places.
export function suggestTalTeams(config, players, event) {
  const pool = players.filter(p => (config.mode !== 'solo' || p.allianceTag === config.hostTags[0]) && (config.availability[p.id] || []).length);
  const remaining = new Set(pool.map(p => p.id));
  return candidateTeams(config).map(team => {
    const combos = config.slots.flatMap((a,i) => config.slots.slice(i+1).flatMap((b,j) => config.slots.slice(i+j+2).map(c => [a,b,c])));
    const score = slots => pool.filter(p => remaining.has(p.id)).reduce((n,p) => n + (!meetsTalAvailability(p,slots,config) ? 0 : slots.every(s => config.availability[p.id].includes(s)) ? 100 : slots.filter(s => config.availability[p.id].includes(s)).length),0);
    const slots = combos.sort((a,b) => score(b)-score(a))[0] || [];
    const ranked = pool.filter(p => remaining.has(p.id) && meetsTalAvailability(p,slots,config) && slots.some(s => config.availability[p.id].includes(s))).sort((a,b) => {
      const overlap = p => slots.filter(s => config.availability[p.id].includes(s)).length;
      return overlap(b)-overlap(a) || strength(b,event)-strength(a,event) || a.id.localeCompare(b.id);
    }).slice(0,50);
    ranked.forEach(p => remaining.delete(p.id));
    return { ...team, slots, members: ranked.map((p,i) => ({ id:p.id, role:i<30?'combatant':'substitute' })) };
  });
}
export function assignTalBuildings(team, players, event, config=null) {
  const ranked = team.members.filter(m => m.role === 'combatant' && (!team.matchTime || battleStatus(team,config,m.id)==='attending')).map(m => players.find(p => p.id === m.id)).filter(Boolean).sort((a,b) => strength(b,event)-strength(a,event) || a.id.localeCompare(b.id));
  // First eight are leaders in priority order; distribute followers evenly.
  return Object.fromEntries(team.buildings.map((building,i) => [building, [ranked[i], ...ranked.slice(8).filter((_,j) => j%8 === i)].filter(Boolean).map(p => p.id)]));
}
export function teamWarnings(team, config, players = []) {
  const warnings = [];
  if (team.slots.length !== 3) warnings.push('Select exactly three battle times.');
  if (team.members.length < 15) warnings.push('At least 15 registered players needed.');
  if (team.members.filter(m => m.role === 'combatant').length > 30) warnings.push('Maximum 30 combatants.');
  if (team.members.filter(m => m.role === 'substitute').length > 20) warnings.push('Maximum 20 substitutes.');
  const conflicts = team.members.filter(m => !team.slots.every(s => (config.availability[m.id] || []).includes(s))).length;
  if (conflicts) warnings.push(`${conflicts} players cannot confirm every selected time.`);
  const conflictCount = talAvailabilityConflicts(team,config,players).length;
  if (conflictCount) warnings.push(`${conflictCount} players need availability at two of these three times.`);
  return warnings;
}

// Apply a move or swap in one update so neither roster can lose a player.
export function moveTalMember(teams, playerId, targetId, swapId = null, config = null, players = []) {
  const source = teams.find(t => t.members.some(m => m.id === playerId));
  const target = teams.find(t => t.id === targetId);
  if (!source || !target || source.id === target.id) throw new Error('Choose another legion.');
  const member = source.members.find(m => m.id === playerId);
  const swapped = swapId ? target.members.find(m => m.id === swapId) : null;
  if (swapId && !swapped) throw new Error('Choose a player in the destination legion.');
  if (config && (!meetsTalAvailability(players.find(p=>p.id===playerId),target.slots,config) || (swapped && !meetsTalAvailability(players.find(p=>p.id===swapId),source.slots,config)))) throw new Error('Players must be available for at least two of the destination legion’s three times.');
  const role = swapped?.role || (target.members.filter(m => m.role === member.role).length < (member.role === 'combatant' ? 30 : 20) ? member.role : member.role === 'combatant' ? 'substitute' : 'combatant');
  if (!swapped && target.members.filter(m => m.role === role).length >= (role === 'combatant' ? 30 : 20)) throw new Error('This legion is full. Swap with a player instead.');
  return teams.map(t => t.id === source.id ? {...t, assignments:{}, members: swapped ? t.members.map(m => m.id === playerId ? {...swapped,role:member.role} : m) : t.members.filter(m => m.id !== playerId)} : t.id === target.id ? {...t, assignments:{}, members: swapped ? t.members.map(m => m.id === swapId ? {...member,role:swapped.role} : m) : [...t.members,{...member,role}]} : t);
}

/** Clears battle-day data without destroying poll responses or legion membership. */
export function clearTalBattlePlans(teams=[]) {
 return teams.map(team=>({...team,matchTime:'',battleAttendance:{},assignments:{},buildings:[...(team.buildings||TAL_BUILDINGS)]}));
}
/** Remove one draft legion. Other legions and the poll remain untouched. */
export function deleteTalLegion(teams=[],id) {
 return teams.filter(team=>team.id!==id);
}
