import defaultData from './defaultData.json';

const STORAGE_KEY = 'svs_rally_data';
const CURRENT_VERSION = '1.0.0';

export function loadData() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return migrateIfNeeded(parsed);
    }
  } catch (e) {
    console.warn('Failed to load from localStorage, using defaults', e);
  }
  return structuredClone(defaultData);
}

export function saveData(data) {
  try {
    const toSave = { ...data, lastUpdated: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    return toSave;
  } catch (e) {
    console.error('Failed to save', e);
    return data;
  }
}

// Export players only — not full app state
export function exportPlayers(players, allianceTag) {
  const exportObj = {
    _version: CURRENT_VERSION,
    _exported: new Date().toISOString(),
    _note: 'Player profiles exported from Sunfire Castle Rally Planner.',
    players,
  };
  const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `svs-players-${allianceTag || 'export'}-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// Import players from file — returns array of player objects
export function importPlayers(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        // Accept either { players: [...] } wrapper or a raw array
        const players = Array.isArray(parsed) ? parsed : parsed.players;
        if (!Array.isArray(players)) throw new Error('No players array found');
        resolve(players);
      } catch (err) {
        reject(new Error('Invalid file — expected exported player JSON'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

// Merge incoming players into current by id — incoming wins on conflict
export function mergePlayers(current, incoming) {
  const map = new Map(current.map(p => [p.id, p]));
  incoming.forEach(p => map.set(p.id, p));
  return Array.from(map.values());
}

function migrateIfNeeded(data) {
  // Add version migration cases here as schema evolves
  // e.g. if (!data._version || data._version < '1.1.0') { ... }
  return {
    ...structuredClone(defaultData),
    ...data,
    _version: CURRENT_VERSION,
  };
}

// Unofficial WOS FID lookup — optional, fails gracefully
export async function lookupWosPlayer(fid) {
  try {
    const resp = await fetch(
      `https://wos-giftcode-api.top/api/player?fid=${fid}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!resp.ok) return { success: false };
    const json = await resp.json();
    const raw = json?.data || json?.player || json;
    if (!raw?.nickname && !raw?.username) return { success: false };
    return {
      success: true,
      username:     raw.nickname      ||
