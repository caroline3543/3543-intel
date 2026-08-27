const CURRENT_VERSION = '3.1.0';
const STORAGE_KEY = 'svs_rally_data';

export function saveToStorage(data) {
  try {
    const toSave = { ...data, lastUpdated: new Date().toISOString() };
    const serialized = JSON.stringify(toSave);

    // Warn if approaching 4MB (browser limit is ~5MB)
    if (serialized.length > 4_000_000) {
      console.warn(`[App] localStorage approaching limit: ${(serialized.length / 1_000_000).toFixed(1)}MB`);
    }

    localStorage.setItem(STORAGE_KEY, serialized);
    return toSave;
  } catch (e) {
    if (e.name === 'QuotaExceededError' || e.code === 22) {
      // Surface to UI via a custom event that useAppState can listen to
      window.dispatchEvent(new CustomEvent('app:storage-full'));
      console.error('[App] localStorage full — data not saved');
    } else {
      console.error('[App] Failed to save', e);
    }
    return data;
  }
}

export function loadFromStorage(defaultData) {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return migrateIfNeeded(JSON.parse(stored));
  } catch (e) {
    console.warn('Failed to load from localStorage', e);
  }
  return structuredClone(defaultData);
}

export function exportToFile(data, allianceTag) {
  const obj = {
    _version: CURRENT_VERSION,
    _exported: new Date().toISOString(),
    _note: 'Exported from Alliance Manager.',
    ...data,
  };
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = `alliance-manager-${allianceTag || 'export'}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try { resolve(migrateIfNeeded(JSON.parse(e.target.result))); }
      catch { reject(new Error('Invalid JSON file')); }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

// ── XLSX import ─────────────────────────────────────────────────
// Reads the plain "…Data" sheets written by exportWorkbook() (see
// exportXlsx.js) — one row per record, raw fields, nested
// arrays/objects JSON-encoded per cell. This is deliberately separate
// from the polished human-readable report sheets (Roster, Joiner
// Coverage, etc.), which lose information on the way out (no id
// column, joiner heroes collapsed to a display string) and were never
// meant to round-trip.
// ── Merge helpers ────────────────────────────────────────────────
// Genuine "most recently edited wins" per record, using each record's
// own timestamp — NOT "whichever file was imported most recently",
// which is what this used to do. See per-collection notes below for
// what's compared and what's always unioned regardless of which side
// is newer.

function ts(record, field) {
  return record?.[field] ? new Date(record[field]).getTime() : 0;
}

// Players: joinerHeroes and eventHistory are accumulative logs, not a
// single current value — they're always unioned regardless of which
// side's profileLastUpdated is newer, so a hero verified on an older
// device is never lost. Everything else defers to whichever side has
// the newer profileLastUpdated.
function mergePlayer(existing, incoming) {
  const exT = ts(existing, 'profileLastUpdated');
  const inT = ts(incoming, 'profileLastUpdated');
  const base = inT >= exT ? { ...existing, ...incoming } : { ...incoming, ...existing };

  const jm = new Map((existing.joinerHeroes || []).map(jh => [jh.hero, jh]));
  (incoming.joinerHeroes || []).forEach(jh => {
    const ex = jm.get(jh.hero);
    if (!ex || jh.skillLevel >= ex.skillLevel) jm.set(jh.hero, jh);
  });
  base.joinerHeroes = [...jm.values()];

  const hm = new Map((existing.eventHistory || []).map(s => [s.snapshotId, s]));
  (incoming.eventHistory || []).forEach(s => { if (!hm.has(s.snapshotId)) hm.set(s.snapshotId, s); });
  base.eventHistory = [...hm.values()];

  base.profileLastUpdated = inT >= exT ? incoming.profileLastUpdated : existing.profileLastUpdated;
  return base;
}

// Events: top-level fields (name/date/status/notes) follow whichever
// side has the newer updatedAt. Snapshots (per-player attendance) are
// merged individually by playerId, each compared on its OWN
// createdAt — so if two officers mark different players' attendance
// on different devices, both survive the merge instead of one
// officer's whole snapshot list clobbering the other's.
function mergeEvent(existing, incoming) {
  const exT = ts(existing, 'updatedAt');
  const inT = ts(incoming, 'updatedAt');
  const base = inT >= exT ? { ...existing, ...incoming } : { ...incoming, ...existing };

  const sm = new Map((existing.snapshots || []).map(s => [s.playerId, s]));
  (incoming.snapshots || []).forEach(s => {
    const ex = sm.get(s.playerId);
    if (!ex || ts(s, 'createdAt') >= ts(ex, 'createdAt')) sm.set(s.playerId, s);
  });
  base.snapshots = [...sm.values()];
  base.updatedAt = inT >= exT ? incoming.updatedAt : existing.updatedAt;
  return base;
}

// SvS Plans: treated as one atomic unit (including rallySlots) — the
// whole record with the newer updatedAt wins outright. Rally slots
// don't carry their own timestamps today, so field-level merging
// within a plan isn't possible yet; this is a known simplification,
// reasonable for now since a plan's slots are usually edited together
// in one planning session rather than concurrently across devices.
function mergePlan(existing, incoming) {
  return ts(incoming, 'updatedAt') >= ts(existing, 'updatedAt') ? incoming : existing;
}

// Custom roles: newer updatedAt wins per role, keyed by id.
// NOTE — known limitation, same as everywhere else in this merge:
// there's no tombstone tracking, so a role (or player, event, or plan)
// deleted on one device can be silently resurrected by importing an
// older file that still has it. Accepted tradeoff — solving this
// properly needs deletion-tracking, which is a lot of machinery for
// "pass a spreadsheet between a few officers."
function mergeRoles(existing, incoming) {
  const rm = new Map((existing || []).map(r => [r.id, r]));
  (incoming || []).forEach(r => {
    const ex = rm.get(r.id);
    rm.set(r.id, (!ex || ts(r, 'updatedAt') >= ts(ex, 'updatedAt')) ? r : ex);
  });
  return [...rm.values()];
}

export function mergeImportedData(current, incoming) {
  const pm = new Map(current.players.map(p => [p.id, p]));
  (incoming.players || []).forEach(p => pm.set(p.id, pm.has(p.id) ? mergePlayer(pm.get(p.id), p) : p));

  const em = new Map((current.events || []).map(e => [e.id, e]));
  (incoming.events || []).forEach(e => em.set(e.id, em.has(e.id) ? mergeEvent(em.get(e.id), e) : e));

  const sm = new Map((current.svsPlans || []).map(p => [p.id, p]));
  (incoming.svsPlans || []).forEach(p => sm.set(p.id, sm.has(p.id) ? mergePlan(sm.get(p.id), p) : p));

  const mergedRoles = mergeRoles(current.customRoles || [], incoming.customRoles || []);

  return {
    ...current,
    ...incoming,
    players:     [...pm.values()],
    events:      [...em.values()],
    svsPlans:    [...sm.values()],
    customRoles: mergedRoles,
    lastUpdated: new Date().toISOString(),
  };
}

function migrateIfNeeded(data) {
  const m = { ...data };
  if (!m.events)     m.events     = [];
  if (!m.prepScores) m.prepScores = [];
  if (!m.svsPlans)   m.svsPlans   = [];
  if (!m.customRoles) m.customRoles = [];
  if (!m.settings)   m.settings   = { allianceName:'', allianceTag:'', stateId:'' };

  m.players = (m.players || []).map(p => ({
    ...p,
    joinerHeroes:  p.joinerHeroes  || [],
    eventHistory:  p.eventHistory  || [],
  }));

  m._version = CURRENT_VERSION;
  return m;
}
