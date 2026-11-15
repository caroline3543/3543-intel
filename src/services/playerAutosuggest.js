import { playerSearchFields } from './playerNames.js';
import { normalizeName } from '../utils/normalize.js';

/**
 * Search players by partial name, FID, nickname, or past name.
 * Returns up to `limit` results sorted by relevance.
 */
export function searchPlayers(players, query, limit = 8) {
  const q = normalizeName(query);
  if (!q) return [];

  return players
    .map((player, index) => {
      const fields = playerSearchFields(player).map(f => normalizeName(String(f || '')));
      const exact = fields.some(f => f === q);
      const prefix = fields.some(f => f.startsWith(q));
      const partial = fields.some(f => f.includes(q));
      return { player, index, rank: exact ? 0 : prefix ? 1 : partial ? 2 : 3 };
    })
    .filter(item => item.rank < 3)
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
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
