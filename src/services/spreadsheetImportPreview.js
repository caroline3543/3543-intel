/**
 * Read-only worksheet preview and column mapping. No writes, no tokens.
 * Spreadsheet rows are not assumed to be player records until approved.
 */
import { indexPlayers, resolveSpreadsheetRow } from './spreadsheetMappingService.js';

export function previewWorksheet({ values, players, stateId, headerRow = 1, limit = 100 }) {
  if (!Array.isArray(values) || !Number.isSafeInteger(headerRow) || headerRow < 1) {
    throw new Error('Invalid worksheet data or header row');
  }
  const headers = (values[headerRow - 1] || []).map(v => String(v ?? '').trim());
  if (!headers.length || headers.every(h => !h)) throw new Error('Header row is empty');
  const normalized = headers.map(h => h.toLowerCase());
  const duplicates = normalized.filter((h, i) => h && normalized.indexOf(h) !== i);
  const seen = new Set();
  const uniqueDuplicates = duplicates.filter(h => !seen.has(h) && seen.add(h));
  const sample = values.slice(headerRow, headerRow + Math.min(Math.max(limit, 0), 100));
  const index = indexPlayers(players, stateId);
  const candidates = sample.map((cells, indexInSample) => {
    const row = Object.fromEntries(headers.map((h, i) => [h, cells?.[i] ?? null]));
    const keyed = {
      record_id: row.record_id ?? row['Record ID'],
      chief_id: row.chief_id ?? row['Player ID'] ?? row.FID,
      state: row.state ?? row.State ?? stateId,
    };
    const match = resolveSpreadsheetRow(keyed, index, stateId);
    return { sheetRow: headerRow + indexInSample + 1, cells: [...(cells || [])], match: {
      status: match.status,
      reason: match.reason ?? null,
      method: match.method ?? null,
      recordId: match.player?.id ?? null,
    } };
  });
  const matches = candidates.filter(c => c.match.status === 'matched');
  return {
    headers,
    duplicateHeaders: uniqueDuplicates,
    sampledRows: candidates.length,
    matchedRows: matches.length,
    unmatchedRows: candidates.length - matches.length,
    candidates,
    safeToImport: uniqueDuplicates.length === 0 && matches.length > 0,
  };
}
