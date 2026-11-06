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
    .filter(p => {
      const fields = playerSearchFields(p).map(f => normalizeName(String(f || '')));
      return fields.some(f => f.includes(q));
    })
    .slice(0, limit);
}

/**
 * Filter players by alliance tag (exact, case-insensitive).
 */
export function filterByAlliance(players, tag) {
  const t = (tag || '').toLowerCase().trim();
  if (!t) return players;
  return players.filter(p => (p.allianceTag || '').toLowerCase().trim() === t);
}
