import { normalizeName, nameSimilarity } from '../utils/normalize.js';

/**
 * Find an existing player by FID (numeric string match).
 */
export function matchPlayerByFID(players, fid) {
  if (!fid) return null;
  const s = String(fid).trim();
  return players.find(p => p.fid && String(p.fid).trim() === s) || null;
}

/**
 * Find an existing player by exact normalized username or alias.
 */
export function matchPlayerByUsername(players, name) {
  const norm = normalizeName(name);
  if (!norm) return null;
  return players.find(p =>
    normalizeName(p.username || '') === norm ||
    normalizeName(p.alias || '') === norm
  ) || null;
}

/**
 * Find a player by ID.
 */
export function matchPlayerById(players, id) {
  return players.find(p => p.id === id) || null;
}

/**
 * Try FID → exact name → return null.
 */
export function findExistingPlayer(players, { fid, name }) {
  if (fid) {
    const byFid = matchPlayerByFID(players, fid);
    if (byFid) return byFid;
  }
  if (name) {
    return matchPlayerByUsername(players, name);
  }
  return null;
}

/**
 * Find possible duplicates (fuzzy, score > 0.75 < 1.0).
 * Returns { player, score } sorted best-first.
 */
export function findPossibleDuplicates(players, name) {
  const norm = normalizeName(name);
  return players
    .map(p => {
      const score = Math.max(
        nameSimilarity(name, p.username || ''),
        nameSimilarity(name, p.alias || ''),
      );
      return { player: p, score };
    })
    .filter(r => r.score > 0.75 && r.score < 1.0)
    .sort((a, b) => b.score - a.score);
}
