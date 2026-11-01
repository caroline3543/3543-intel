/**
 * Pure helpers for mapping Google Sheets rows to existing 3543 Intel player records.
 * No network calls or database writes. Never match by username alone.
 */
export const DEFAULT_PLAYER_COLUMNS = Object.freeze({
  record_id: 'id',
  chief_id: 'fid',
  state: 'stateId',
  username: 'username',
  alliance: 'allianceTag',
  furnace: 'furnaceLevel',
  power: 'power',
  kills: 'kills',
  availability: 'sheetFields.availability',
  notes: 'notes',
});

export const API_OWNED_FIELDS = new Set([
  'username', 'allianceTag', 'furnaceLevel', 'power', 'kills',
]);

export function normalizeChiefId(value) {
  const id = String(value ?? '').trim();
  return /^\d{4,15}$/.test(id) ? id : null;
}

export function normalizeStateId(value) {
  const state = String(value ?? '').trim();
  return /^\d{1,5}$/.test(state) && Number(state) > 0 ? String(Number(state)) : null;
}

export function lookupKey(state, fid) {
  const s = normalizeStateId(state);
  const f = normalizeChiefId(fid);
  return s && f ? `${s}:${f}` : null;
}

export function indexPlayers(players, stateId) {
  const byRecordId = new Map();
  const byChiefId = new Map();
  for (const player of players) {
    if (player.id) byRecordId.set(String(player.id), player);
    const key = lookupKey(player.stateId ?? stateId, player.fid);
    if (key) {
      if (byChiefId.has(key)) throw new Error(`Duplicate chief identity: ${key}`);
      byChiefId.set(key, player);
    }
  }
  return { byRecordId, byChiefId };
}

export function resolveSpreadsheetRow(row, index, stateId) {
  const id = String(row.record_id ?? '').trim();
  if (id) {
    const match = index.byRecordId.get(id);
    if (match) return { status: 'matched', player: match, method: 'record_id' };
  }
  const key = lookupKey(row.state ?? stateId, row.chief_id);
  if (key) {
    const match = index.byChiefId.get(key);
    if (match) return { status: 'matched', player: match, method: 'chief_id' };
  }
  return { status: 'unmatched', reason: key ? 'unknown_chief_id' : 'missing_valid_chief_id' };
}

/** Three-way merge against the previous successful sync snapshot.
 * Comparison is cell-by-cell; row numbers must not be treated as IDs.
 */
export function compareCell({ baseline, database, sheet, authority = 'manual' }) {
  const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const dbChanged = !equal(database, baseline);
  const sheetChanged = !equal(sheet, baseline);
  if (!dbChanged && !sheetChanged) return { action: 'none' };
  if (authority === 'api') {
    return sheetChanged && !equal(sheet, database)
      ? { action: 'reject_sheet_edit', value: database }
      : { action: 'write_sheet', value: database };
  }
  if (dbChanged && sheetChanged && !equal(database, sheet)) {
    return { action: 'conflict', baseline, database, sheet };
  }
  if (dbChanged) return { action: 'write_sheet', value: database };
  return { action: 'write_database', value: sheet };
}

export function columnName(index) {
  if (!Number.isSafeInteger(index) || index < 0) throw new Error('Invalid column index');
  let n = index + 1, result = '';
  while (n) { n--; result = String.fromCharCode(65 + n % 26) + result; n = Math.floor(n / 26); }
  return result;
}

export function sheetCellRange(title, row, column) {
  if (!Number.isSafeInteger(row) || row < 1) throw new Error('Invalid row');
  const escaped = String(title).replace(/'/g, "''");
  return `'${escaped}'!${columnName(column)}${row}`;
}
