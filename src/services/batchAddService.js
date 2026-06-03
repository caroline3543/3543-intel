import { normalizeName } from '../utils/normalize.js';
import { findExistingPlayer, findPossibleDuplicates } from './playerMatching.js';

/**
 * Parse raw text input into an array of name strings.
 * Accepts newline or comma-separated values.
 */
export function parseBatchInput(raw) {
  return (raw || '')
    .split(/[\n,]/)
    .map(s => s.trim())
    .filter(Boolean);
}

/**
 * Resolve a list of { text, linkedId } rows against existing players.
 *
 * Returns { exact[], fuzzy[], fresh[] }
 *   exact  — matched by linkedId, FID, or exact name  → will update
 *   fuzzy  — similar name but not exact                → needs officer review
 *   fresh  — no match found                            → will create
 */
export function resolveBatchRows(rows, existingPlayers) {
  const exact = [];
  const fuzzy = [];
  const fresh = [];

  rows.forEach(row => {
    const { text, linkedId } = row;
    const norm = normalizeName(text);
    if (!norm) return;

    // 1. Pre-linked by autosuggest selection
    if (linkedId) {
      const player = existingPlayers.find(p => p.id === linkedId);
      if (player) { exact.push({ name: text, existingPlayer: player }); return; }
    }

    // 2. Numeric — try FID
    if (/^\d+$/.test(norm)) {
      const byFid = existingPlayers.find(p => p.fid && String(p.fid).trim() === norm);
      if (byFid) { exact.push({ name: text, existingPlayer: byFid }); return; }
    }

    // 3. Exact normalized name
    const byName = findExistingPlayer(existingPlayers, { name: text });
    if (byName) { exact.push({ name: text, existingPlayer: byName }); return; }

    // 4. Fuzzy
    const dupes = findPossibleDuplicates(existingPlayers, text);
    if (dupes.length > 0) {
      fuzzy.push({ name: text, existingPlayer: dupes[0].player, score: dupes[0].score });
    } else {
      fresh.push({ name: text });
    }
  });

  return { exact, fuzzy, fresh };
}

/**
 * Merge an incoming patch object into an existing player.
 * Never overwrites a non-blank existing field with a blank value.
 */
export function mergePlayerObjects(existing, incoming) {
  const merged = { ...existing };

  Object.entries(incoming).forEach(([key, val]) => {
    if (key === 'joinerHeroes') {
      // Merge by hero name — never lose existing verified data
      const jm = new Map((existing.joinerHeroes || []).map(jh => [jh.hero, jh]));
      (incoming.joinerHeroes || []).forEach(jh => {
        const ex = jm.get(jh.hero);
        if (!ex || jh.skillLevel >= ex.skillLevel) jm.set(jh.hero, jh);
      });
      merged.joinerHeroes = [...jm.values()];
    } else if (key === 'eventHistory') {
      const hm = new Map((existing.eventHistory || []).map(s => [s.snapshotId, s]));
      (incoming.eventHistory || []).forEach(s => {
        if (!hm.has(s.snapshotId)) hm.set(s.snapshotId, s);
      });
      merged.eventHistory = [...hm.values()];
    } else if (
      val !== null &&
      val !== undefined &&
      val !== '' &&
      !(Array.isArray(val) && val.length === 0)
    ) {
      merged[key] = val;
    }
  });

  merged.profileLastUpdated = new Date().toISOString();
  return merged;
}
