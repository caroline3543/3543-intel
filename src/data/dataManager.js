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

export function exportData(data, allianceTag) {
  const exportObj = {
    _version: CURRENT_VERSION,
    _exported: new Date().toISOString(),
    _note: 'Exported from Sunfire Castle Rally Planner. Paste into /src/data/defaultData.json to hardcode as seed data.',
    ...data,
  };
  const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `svs-${allianceTag || 'export'}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importData(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        resolve(migrateIfNeeded(parsed));
      } catch (err) {
        reject(new Error('Invalid JSON file'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

export function mergeData(current, incoming) {
  const playerMap = new Map(current.players.map(p => [p.id, p]));
  (incoming.players || []).forEach(p => playerMap.set(p.id, p));
  return {
    ...current,
    ...incoming,
    players: Array.from(playerMap.values()),
    lastUpdated: new Date().toISOString(),
  };
}

function migrateIfNeeded(data) {
  return {
    ...structuredClone(defaultData),
    ...data,
    _version: CURRENT_VERSION,
  };
}
