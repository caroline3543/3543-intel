// Manual R5 preferences. Reusable defaults can be overridden for one battle.
// Never infer attendance, skill or trust.
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
  const groups=(Array.isArray(raw.groups)?raw.groups:[]).filter(g=>g&&typeof g.id==='string'&&Array.isArray(g.memberIds)&&g.memberIds.length>=2&&g.memberIds.every(id=>typeof id==='string'&&id));
  return {players, pairs,groups};
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
  const groups=(preferences?.groups||[]).filter(g=>g.memberIds.includes(String(playerId))&&g.memberIds.some(id=>teammateIds.map(String).includes(id))).length;
  return (p.priority ? 4 : 0) + traits + relationshipMatches(playerId,teammateIds,preferences)*3 + groups*2;
}

/** Apply explicit match overrides without changing reusable defaults.
 * pairs add affinities, excludedPairs suppress them for this battle.
 * Explicit false trait values can override saved true values. */
export function mergeRallyPreferences(shared = {}, overrides = {}) {
  const base = normaliseRallyPreferences(shared);
  const mergedPlayers = Object.fromEntries(Object.entries(base.players).map(([id, v]) => [id,{...v}]));
  for(const [id, values] of Object.entries(overrides?.players || {})){
    if (!values || typeof values !== 'object') continue;
    const current = {...(mergedPlayers[String(id)] || {})};
    for(const trait of [...TRAITS,'priority']){
      if(typeof values[trait] === 'boolean') current[trait] = values[trait];
    }
    mergedPlayers[String(id)] = current;
  }
  const removed = new Set((overrides?.excludedPairs || [])
    .filter(pair=>Array.isArray(pair) && pair.length===2)
    .map(([a,b])=>pairKey(a,b)));
  const pairs = normaliseRallyPreferences({pairs:[...base.pairs,...(overrides?.pairs||[])]}).pairs
    .filter(([a,b])=>!removed.has(pairKey(a,b)));
  return normaliseRallyPreferences({players:mergedPlayers,pairs,groups:base.groups});
}
export function withBattlePairOverride(current = {}, shared = {}, a, b, enabled) {
  const key=pairKey(a,b);
  const has = pairs => (pairs||[]).some(pair=>Array.isArray(pair)&&pair.length===2&&pairKey(pair[0],pair[1])===key);
  const normalized = pair => [String(pair[0]),String(pair[1])];
  const baseHas = has(shared.pairs);
  const next={...current,pairs:(current.pairs||[]).filter(pair=>pairKey(pair[0],pair[1])!==key).map(normalized),
    excludedPairs:(current.excludedPairs||[]).filter(pair=>pairKey(pair[0],pair[1])!==key).map(normalized)};
  if(enabled && !baseHas) next.pairs.push([String(a),String(b)]);
  if(!enabled && baseHas) next.excludedPairs.push([String(a),String(b)]);
  return next;
}
