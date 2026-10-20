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
  const registry = getWorkspaces();
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
  const stats = (imported?.players || []).find(p => p.providerStats?.stateId && String(p.providerStats.stateId) !== String(stateId));
  if (stats) throw new Error('This file contains player stats from a different state.');
}
