import {TEAM_NAMES} from '../../../src/services/eventPlanner.js';

export function balanceEventSquads({players, count, leaderIds, plan, preferences, preserveAll = false, preferencesEnabled = true}) {
  const colours = TEAM_NAMES.slice(0, count);
  const roster = new Map(players.map(player => [player.id, player]));
  const teams = {}, leaders = {}, members = Object.fromEntries(colours.map(colour => [colour, []]));
  const totals = Object.fromEntries(colours.map(colour => [colour, 0]));
  const locks = {}, manual = {};
  if (![2,3,4,5,6].includes(count) || leaderIds.length > count || new Set(leaderIds).size !== leaderIds.length || leaderIds.some(id => !roster.has(id))) {
    return {error:'Choose eligible combatant leaders and a valid team count.'};
  }
  const put = (player, colour) => {
    teams[player.id] = colour;
    members[colour].push(player);
    totals[colour] += player.hasPower ? player.power : 0;
  };
  for (const [id, colour] of Object.entries(plan.teams ?? {})) {
    if (!roster.has(id)) continue;
    const locked = plan.teamLocks?.[id], moved = plan.manualTeams?.[id];
    if (!locked && !moved && !preserveAll) continue;
    if (!colours.includes(colour)) return {error:'Move players off removed teams and unlock any locked assignments before reducing team count.'};
    if (locked) locks[id] = true;
    if (moved) manual[id] = true;
    put(roster.get(id), colour);
  }
  for (const id of leaderIds) {
    if (!teams[id]) continue;
    const colour = teams[id];
    if (leaders[colour]) return {error:'Two selected leaders already have protected assignments on the same team.'};
    leaders[colour] = id;
  }
  for (const id of leaderIds) {
    if (teams[id]) continue;
    const colour = colours.find(candidate => !leaders[candidate]);
    leaders[colour] = id;
    put(roster.get(id), colour);
  }
  const links = [...(preferences.pairs ?? []), ...(preferences.groups ?? []).map(group => group.memberIds)]
    .filter(Array.isArray).map(group => new Set(group.map(String)));
  const affinity = (player, colour) => preferencesEnabled ? members[colour].reduce((score, other) => score
    + (links.some(group => group.has(player.id) && group.has(other.id)) ? 2 : 0)
    + (player.languages?.some(language => other.languages?.includes(language)) ? 1 : 0), 0) : 0;
  const cap = Math.ceil(roster.size / count);
  const ranked = [...roster.values()].sort((a,b) => Number(b.hasPower)-Number(a.hasPower) || b.power-a.power || a.name.localeCompare(b.name));
  for (const player of ranked) {
    if (teams[player.id]) continue;
    const available = colours.filter(colour => members[colour].length < cap);
    const empty = available.filter(colour => !members[colour].length);
    const choices = empty.length ? empty : available.length ? available : colours;
    const minimum = Math.min(...choices.map(colour => totals[colour]));
    const viable = choices.filter(colour => totals[colour] <= minimum + Math.max(1, minimum * .05));
    viable.sort((a,b) => affinity(player,b)-affinity(player,a) || totals[a]-totals[b] || members[a].length-members[b].length);
    put(player, viable[0]);
  }
  return {teams, members, leaders, locks, manual};
}
