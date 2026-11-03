export const TAL_BUILDINGS = ['Proto I', 'Proto II', 'Repair I', 'Repair II', 'Repair III', 'Repair IV', 'Boiler', 'Transit'];
export const TAL_SLOTS = ['02:00', '07:00', '12:00', '14:00', '19:00'];
export function talConfig(event) {
  return { mode: 'state', hostTags: [], slots: TAL_SLOTS, availability: {}, teams: [], locked: false, ...event.tal };
}
export function strength(player, event) {
  const snap = event.snapshots?.find(s => s.playerId === player.id);
  return Number(snap?.troopPower || 0);
}
export function candidateTeams(config) {
  return config.hostTags.flatMap(tag => [1, 2].map(legion => ({ id: `${tag}:${legion}`, host: tag, legion, slots: [], members: [], buildings: [...TAL_BUILDINGS], assignments: {} })));
}
// Greedy suggestion: keep players available at all three times together first.
// Never invent availability, duplicate a player, or exceed 30 + 20 places.
export function suggestTalTeams(config, players, event) {
  const pool = players.filter(p => (config.mode !== 'solo' || p.allianceTag === config.hostTags[0]) && (config.availability[p.id] || []).length);
  const remaining = new Set(pool.map(p => p.id));
  return candidateTeams(config).map(team => {
    const combos = config.slots.flatMap((a,i) => config.slots.slice(i+1).flatMap((b,j) => config.slots.slice(i+j+2).map(c => [a,b,c])));
    const score = slots => pool.filter(p => remaining.has(p.id)).reduce((n,p) => n + (slots.every(s => config.availability[p.id].includes(s)) ? 100 : slots.filter(s => config.availability[p.id].includes(s)).length),0);
    const slots = combos.sort((a,b) => score(b)-score(a))[0] || [];
    const ranked = pool.filter(p => remaining.has(p.id) && slots.some(s => config.availability[p.id].includes(s))).sort((a,b) => {
      const overlap = p => slots.filter(s => config.availability[p.id].includes(s)).length;
      return overlap(b)-overlap(a) || strength(b,event)-strength(a,event) || a.id.localeCompare(b.id);
    }).slice(0,50);
    ranked.forEach(p => remaining.delete(p.id));
    return { ...team, slots, members: ranked.map((p,i) => ({ id:p.id, role:i<30?'combatant':'substitute' })) };
  });
}
export function assignTalBuildings(team, players, event) {
  const ranked = team.members.filter(m => m.role === 'combatant').map(m => players.find(p => p.id === m.id)).filter(Boolean).sort((a,b) => strength(b,event)-strength(a,event) || a.id.localeCompare(b.id));
  // First eight are leaders in priority order; distribute followers evenly.
  return Object.fromEntries(team.buildings.map((building,i) => [building, [ranked[i], ...ranked.slice(8).filter((_,j) => j%8 === i)].filter(Boolean).map(p => p.id)]));
}
export function teamWarnings(team, config) {
  const warnings = [];
  if (team.slots.length !== 3) warnings.push('Select exactly three battle times.');
  if (team.members.length < 15) warnings.push('At least 15 registered players needed.');
  if (team.members.filter(m => m.role === 'combatant').length > 30) warnings.push('Maximum 30 combatants.');
  if (team.members.filter(m => m.role === 'substitute').length > 20) warnings.push('Maximum 20 substitutes.');
  const conflicts = team.members.filter(m => !team.slots.every(s => (config.availability[m.id] || []).includes(s))).length;
  if (conflicts) warnings.push(`${conflicts} players cannot confirm every selected time.`);
  return warnings;
}
