import { normalizeName, nameSimilarity } from '../utils/normalize.js';

const fields = p => [p.username, p.alias, String(p.fid || ''), String(p.id || '')].filter(Boolean);
export function pollSuggestions(players, query, limit = 5) {
  const q = normalizeName(query);
  if (!q) return [];
  return players.map(p => {
    const values = fields(p).map(normalizeName);
    const exact = values.includes(q);
    const partial = values.some(v => v.includes(q));
    const similarity = Math.max(...values.map(v => nameSimilarity(v,q)),0);
    return { player:p, score:exact?3:partial?2:similarity };
  }).filter(r => r.score >= 0.65).sort((a,b) => b.score-a.score || String(a.player.username).localeCompare(String(b.player.username))).slice(0,limit).map(r=>r.player);
}
// Resolve only unique exact names/IDs automatically; partial and fuzzy names
// are suggestions the officer must explicitly select.
export function matchPollEntries(players, text) {
  return text.split(/[\n\r,;\t]+/).map(s=>s.trim()).filter(Boolean).map(entry => {
    const query = normalizeName(entry);
    const byId = players.filter(p => [String(p.fid||''),String(p.id||'')].includes(entry));
    const matches = byId.length ? byId : players.filter(p => [p.username,p.alias].filter(Boolean).some(v=>normalizeName(v)===query));
    return {entry,player:matches.length===1?matches[0]:null,suggestions:matches.length>1?matches:pollSuggestions(players,entry),ambiguous:matches.length>1};
  });
}
export function addPollPlayers(config, key, ids) {
  const availability = {...config.availability};
  const interested = new Set(config.interestedIds||[]);
  [...new Set(ids)].forEach(id=>{
    if (key === 'interested') { if (!(availability[id]||[]).length) interested.add(id); }
    else { availability[id]=[...new Set([...(availability[id]||[]),key])]; interested.delete(id); }
  });
  return { availability, interestedIds:[...interested] };
}
export function removePollPlayer(config,key,id) {
  if(key==='interested') return {interestedIds:(config.interestedIds||[]).filter(x=>x!==id)};
  const times=(config.availability[id]||[]).filter(t=>t!==key);
  return {availability:{...config.availability,[id]:times},interestedIds:times.length?(config.interestedIds||[]):[...new Set([...(config.interestedIds||[]),id])]};
}

export function talPollResultsText(config,players) {
  const label=p=>`${p.username||p.alias||p.fid||p.id}${p.fid?` · ${p.fid}`:''}${p.allianceTag?` [${p.allianceTag}]`:''}`;
  const sorted=[...players].sort((a,b)=>label(a).localeCompare(label(b)));
  const available=sorted.filter(p=>(config.availability[p.id]||[]).length);
  const pending=sorted.filter(p=>(config.interestedIds||[]).includes(p.id)&&!(config.availability[p.id]||[]).length);
  const lines=['TUNDRA ARMS LEAGUE · POLL RESULTS',`${available.length} players with availability · ${pending.length} interested, awaiting times`,'Players may appear under more than one time.',''];
  for(const slot of config.slots){const list=sorted.filter(p=>(config.availability[p.id]||[]).includes(slot));lines.push(`${slot} UTC · ${list.length}`,list.length?list.map(label).join('\n'):'No responses yet','');}
  lines.push(`INTERESTED · AVAILABILITY PENDING · ${pending.length}`,pending.length?pending.map(label).join('\n'):'None');
  return lines.join('\n');
}
