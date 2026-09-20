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
 * Parse "FID, username" CSV text into structured rows: [{ fid, text }].
 * A header row is dropped automatically — if the first line's first
 * cell isn't purely numeric, it's treated as a column label ("ID,
 * username") rather than real data. Comma-separated; blank lines
 * skipped. Feeds into resolveBatchRows below exactly like the typed-
 * name flow does, just with fid pre-supplied instead of guessed.
 */
export function parseCsvRows(raw) {
  const lines = (raw || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (!lines.length) return [];

  const rows = lines.map(line => {
    const [fidRaw, ...rest] = line.split(',');
    return { fid: (fidRaw || '').trim(), text: rest.join(',').trim() };
  });

  if (rows.length && rows[0].fid && !/^\d+$/.test(rows[0].fid)) rows.shift();

  return rows.filter(r => r.fid || r.text);
}

/**
 * Resolve a list of { text, linkedId, fid? } rows against existing players.
 * `fid` is optional — set by CSV import rows; typed-name rows never
 * carry it and fall back to the original numeric-text guess below,
 * unchanged from before this field existed.
 *
 * Returns { exact[], fuzzy[], fresh[] }
 *   exact  — matched by linkedId, FID, or exact name/nickname → will update
 *   fuzzy  — similar name but not exact                       → needs officer review
 *   fresh  — no match found                                   → will create
 * Every entry also carries `fid` through (undefined for rows that
 * never had one) so buildAndSave can set it on newly-created players.
 */
export function resolveBatchRows(rows, existingPlayers) {
  const exact = [];
  const fuzzy = [];
  const fresh = [];

  rows.forEach(row => {
    const { text, linkedId, fid } = row;
    const norm = normalizeName(text);
    if (!norm && !fid) return;
    const displayName = text || `FID ${fid}`;

    // 1. Pre-linked by autosuggest selection (or CSV FID match, see below)
    if (linkedId) {
      const player = existingPlayers.find(p => p.id === linkedId);
      if (player) { exact.push({ name: displayName, existingPlayer: player, fid }); return; }
    }

    // 2. FID — an explicit fid field (CSV import) takes priority; a
    // purely numeric typed name is still tried as a possible FID,
    // same guess this always made before CSV import existed.
    const fidToTry = fid || (/^\d+$/.test(norm) ? norm : null);
    if (fidToTry) {
      const byFid = existingPlayers.find(p => p.fid && String(p.fid).trim() === String(fidToTry).trim());
      if (byFid) { exact.push({ name: displayName, existingPlayer: byFid, fid }); return; }
    }

    if (norm) {
      // 3. Exact normalized name or nickname (checks both username and alias)
      const byName = findExistingPlayer(existingPlayers, { name: text });
      if (byName) { exact.push({ name: displayName, existingPlayer: byName, fid }); return; }

      // 4. Fuzzy
      const dupes = findPossibleDuplicates(existingPlayers, text);
      if (dupes.length > 0) {
        fuzzy.push({ name: displayName, existingPlayer: dupes[0].player, score: dupes[0].score, fid });
        return;
      }
    }

    fresh.push({ name: displayName, fid });
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
