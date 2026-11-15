import { playerSearchFields } from './playerNames.js';
import { normalizeName, nameSimilarity } from '../utils/normalize.js';

/**
 * Search players by partial name, FID, nickname, or past name.
 * Returns up to `limit` results sorted by relevance.
 */
export function searchPlayers(players, query, limit = 8) {
  const q = normalizeName(query);
  if (!q) return [];
  // Numeric player IDs are identifiers, not names: never suggest fuzzy IDs.
  if (/^\d+$/.test(q)) return players.filter(p => String(p.fid||'') === q || String(p.id||'') === q).slice(0,limit);

  return players
    .map((player, index) => {
      const fields = playerSearchFields(player).map(f => normalizeName(String(f || '')));
      const exact = fields.some(f => f === q);
      const prefix = fields.some(f => f.startsWith(q));
      const partial = fields.some(f => f.includes(q));
      const fuzzy = q.length >= 4 && fields.some(f => nameSimilarity(f, q) >= 0.65);
      const similarity = Math.max(0, ...fields.map(f => nameSimilarity(f, q)));
      return { player, index, rank: exact ? 0 : prefix ? 1 : partial ? 2 : fuzzy ? 3 : 4, similarity };
    })
    .filter(item => item.rank < 4)
    .sort((a, b) => a.rank - b.rank || b.similarity - a.similarity || a.index - b.index)
    .slice(0, limit)
    .map(item => item.player);
}

/**
 * Filter players by alliance tag (exact, case-insensitive).
 */
export function filterByAlliance(players, tag) {
  const t = (tag || '').toLowerCase().trim();
  if (!t) return players;
  return players.filter(p => (p.allianceTag || '').toLowerCase().trim() === t);
}
