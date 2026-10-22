const REGISTRY_KEY = 'svs_state_workspaces_v1';
const LEGACY_KEYS = ['svs_rally_data', 'svs_battle_pool_v1', 'svs_live_rally_room_v2',
  'svs_castle_command_v1', 'svs_field_registry_custom_options', 'svs_field_registry_custom_hero_gens'];
export function normalizeStateId(value) {
  const id = String(value ?? '').trim();
  if (!/^[1-9]\d{0,4}$/.test(id)) throw new Error('Enter a valid state number.');
  return id;
}
export function initializeWorkspaces(storage) {
  const saved = storage.getItem(REGISTRY_KEY);
  if (saved) {
    const registry = JSON.parse(saved);
    registry.states.forEach(normalizeStateId);
    if (!registry.states.includes(registry.activeStateId)) throw new Error('Invalid saved state selection');
    return registry;
  }
  const legacy = JSON.parse(storage.getItem('svs_rally_data') || 'null');
  const primary = legacy?.settings?.stateId ? normalizeStateId(legacy.settings.stateId) : '3543';
  const registry = { version: 1, activeStateId: primary, states: [primary, primary === '3573' ? '3543' : '3573'] };
  // Copy before publishing the registry. Originals remain untouched as a backup.
  for (const key of LEGACY_KEYS) {
    const old = storage.getItem(key);
    const destination = `${key}:state:${primary}`;
    if (old != null && storage.getItem(destination) == null) storage.setItem(destination, old);
  }
  storage.setItem(REGISTRY_KEY, JSON.stringify(registry));
  return registry;
}
let bootRegistry;
export function getWorkspaces() {
  if (!bootRegistry) bootRegistry = initializeWorkspaces(localStorage);
  return bootRegistry;
}
// Fixed for the lifetime of this page, including pending saves from old tabs.
export function activeStateId() { return getWorkspaces().activeStateId; }
export function stateStorageKey(base, stateId = activeStateId()) {
  return `${base}:state:${normalizeStateId(stateId)}`;
}
export function selectWorkspace(value) {
  const id = normalizeStateId(value);
  const registry = initializeWorkspaces(localStorage);
  const next = { ...registry, activeStateId: id, states: [...new Set([...registry.states, id])] };
  localStorage.setItem(REGISTRY_KEY, JSON.stringify(next));
  // A complete reload clears every open player, filter, timer and pending preview.
  window.location.reload();
}
export function assertImportState(imported, stateId) {
  const source = imported?.settings?.stateId;
  if (source && String(source) !== String(stateId)) {
    throw new Error(`This file belongs to State ${source}. Switch states before importing it.`);
  }
  if ((imported?.allianceWatches || []).some(w => String(w.stateId) !== String(stateId))) throw new Error('This file contains alliance watches from a different state.');
  const stats = (imported?.players || []).find(p => p.providerStats?.stateId && String(p.providerStats.stateId) !== String(stateId));
  if (stats) throw new Error('This file contains player stats from a different state.');
  const rankings = (imported?.players || []).some(p => Object.values(p.providerRankings || {}).some(r => r.stateId && String(r.stateId) !== String(stateId)));
  if (rankings) throw new Error('This file contains rankings from a different state.');
  const history=(imported?.players || []).some(p=>(p.observationHistory || []).some(e=>e.stateId && String(e.stateId)!==String(stateId)));
  if(history)throw new Error('This file contains history from a different state.');
  const details=(imported?.players || []).some(p=>p.providerDetails?.stateId && String(p.providerDetails.stateId)!==String(stateId));
  if(details)throw new Error('This file contains equipment from a different state.');
}

// Remove the selector entry, retaining state-specific records for recovery.
// Read the latest registry to avoid resurrecting states removed in another tab.
export function removeWorkspace(storage, value) {
  const id = normalizeStateId(value);
  const registry = initializeWorkspaces(storage);
  if (!registry.states.includes(id)) throw new Error(`State ${id} is no longer in your list. Reload the page.`);
  const states = registry.states.filter(state => state !== id);
  if (!states.length) throw new Error('Add your correct state before deleting the last state.');
  const next = {...registry, states, activeStateId:registry.activeStateId === id ? states[0] : registry.activeStateId};
  storage.setItem(REGISTRY_KEY, JSON.stringify(next));
  return next;
}
export function deleteSelectedWorkspace() {
  removeWorkspace(localStorage, activeStateId());
  window.location.reload();
}
