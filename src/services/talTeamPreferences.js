// Manual, battle-scoped R5 preferences. Never infer attendance, skill or trust.
const TRAITS = ['reliable', 'strategy', 'voice', 'punctual'];
const pairKey = (a, b) => [String(a), String(b)].sort().join(':');
export function normaliseRallyPreferences(raw = {}) {
  const players = {};
  for (const [id, value] of Object.entries(raw.players || {})) {
    if (!value || typeof value !== 'object') continue;
    players[String(id)] = Object.fromEntries(TRAITS.map(t => [t, value[t] === true]));
    players[String(id)].priority = value.priority === true;
  }
  const seen = new Set();
  const pairs = (Array.isArray(raw.pairs) ? raw.pairs : []).filter(pair => {
    if (!Array.isArray(pair) || pair.length !== 2 || !pair[0] || !pair[1] || String(pair[0]) === String(pair[1])) return false;
    const key = pairKey(pair[0], pair[1]);
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }).map(([a,b]) => [String(a), String(b)]);
  return {players, pairs};
}
export function joinerPreference(playerId, preferences) {
  const p = preferences?.players?.[String(playerId)] || {};
  return {priority:p.priority===true, reliable:p.reliable===true, strategy:p.strategy===true,
    voice:p.voice===true, punctual:p.punctual===true};
}
export function relationshipMatches(playerId, teammateIds, preferences) {
  const id = String(playerId), others = new Set(teammateIds.map(String));
  return (preferences?.pairs || []).filter(([a,b]) => a === id && others.has(b) || b === id && others.has(a)).length;
}
export function joinerPreferenceScore(playerId, teammateIds, preferences) {
  const p = joinerPreference(playerId, preferences);
  const traits = [p.reliable,p.strategy,p.voice,p.punctual].filter(Boolean).length;
  // A nudge within otherwise viable same-tier marches; never a substitute
  // for T11/T10 troop suitability, capacity or eligibility.
  return (p.priority ? 4 : 0) + traits + relationshipMatches(playerId,teammateIds,preferences)*3;
}
