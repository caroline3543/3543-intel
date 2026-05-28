import defaultData from './defaultData.json';

const STORAGE_KEY = 'wos_alliance_data';
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
    console.error('Failed to save data', e);
    return data;
  }
}

export function exportData(data) {
  const exportObj = {
    ...data,
    _version: CURRENT_VERSION,
    _exported: new Date().toISOString(),
    _note: 'Exported from WOS Alliance Manager. Import this file to restore your data.',
  };
  const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `wos-alliance-${data.settings?.allianceTag || 'export'}-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importData(file, mode = 'replace') {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result);
        const migrated = migrateIfNeeded(imported);
        resolve(migrated);
      } catch (err) {
        reject(new Error('Invalid JSON file'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

function migrateIfNeeded(data) {
  const version = data._version || '0.0.0';
  // Future migrations go here as version checks
  // e.g. if (version < '1.1.0') { ...migrate... }
  return {
    ...structuredClone(defaultData),
    ...data,
    _version: CURRENT_VERSION,
  };
}

export function mergeData(current, incoming) {
  // Merge players by id - incoming wins on conflict
  const playerMap = new Map(current.players.map(p => [p.id, p]));
  incoming.players?.forEach(p => playerMap.set(p.id, p));

  return {
    ...current,
    ...incoming,
    players: Array.from(playerMap.values()),
    events: [...(current.events || []), ...(incoming.events || [])].filter(
      (e, i, arr) => arr.findIndex(x => x.id === e.id) === i
    ),
    notes: [...(current.notes || []), ...(incoming.notes || [])].filter(
      (n, i, arr) => arr.findIndex(x => x.id === n.id) === i
    ),
  };
}

// WOS unofficial API lookup
export async function lookupWosPlayer(fid) {
  // WOS uses a public leaderboard/profile endpoint - unofficial, may break
  const endpoints = [
    `https://wos-giftcode-api.top/api/player?fid=${fid}`,
  ];

  for (const url of endpoints) {
    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!resp.ok) continue;
      const json = await resp.json();
      // Normalize whatever shape comes back
      if (json?.data || json?.nickname || json?.player) {
        const raw = json.data || json.player || json;
        return {
          success: true,
          username: raw.nickname || raw.username || raw.name || null,
          furnaceLevel: raw.stove_lv || raw.furnace_level || raw.fc_level || null,
          stateId: raw.kid || raw.state_id || raw.server_id || null,
          avatarUrl: raw.avatar_image || raw.head_image || null,
          allianceName: raw.alliance_name || null,
          raw,
        };
      }
    } catch (e) {
      // Timeout or network error - silently continue
    }
  }
  return { success: false };
}
