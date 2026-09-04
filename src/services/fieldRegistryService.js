// Pure functions backing FieldRegistry.jsx and RosterTab.jsx's bulk-
// assign — no React, no side effects beyond the isolated custom-option
// localStorage store below.
//
// localStorage key: svs_field_registry_custom_options
// Owner: fieldRegistryService.js (never write to it elsewhere — see
// CONSTITUTION.md localStorage key registry, add this key there).

import { LANGUAGES, TIER_OPTIONS, ALLIANCE_RANKS, FC_OPTIONS } from '../utils/constants.js';
import { JOINER_HEROES } from '../data/joinerMeta.js';

// Add a new field here to extend BOTH the Field Registry and the
// roster's bulk-assign to any other profile attribute — nothing else
// in either file needs to change.
export const FIELD_DEFS = [
  {
    id: 'languages', label: 'Languages', icon: '🗣️', multi: true,
    baseOptions: () => LANGUAGES,
    get: (p) => p.languages || [],
  },
  {
    id: 'furnace', label: 'Furnace Level', icon: '🔥', multi: false,
    baseOptions: () => FC_OPTIONS,
    get: (p) => (p.furnaceLevel ? [p.furnaceLevel] : []),
  },
  {
    id: 'allianceTag', label: 'Alliance', icon: '🚩', multi: false,
    // No fixed base list — alliance tags are entirely alliance-defined,
    // not a preset table. Values come from whatever's already on
    // someone's profile, plus anything typed into the custom-add row.
    baseOptions: () => [],
    get: (p) => (p.allianceTag ? [p.allianceTag] : []),
  },
  {
    id: 'infantry', label: 'Infantry Tier', icon: '⚔️', multi: false,
    baseOptions: () => TIER_OPTIONS,
    get: (p) => (p.troops?.infantry ? [p.troops.infantry] : []),
  },
  {
    id: 'lancer', label: 'Lancer Tier', icon: '🐎', multi: false,
    baseOptions: () => TIER_OPTIONS,
    get: (p) => (p.troops?.lancer ? [p.troops.lancer] : []),
  },
  {
    id: 'marksman', label: 'Marksman Tier', icon: '🏹', multi: false,
    baseOptions: () => TIER_OPTIONS,
    get: (p) => (p.troops?.marksman ? [p.troops.marksman] : []),
  },
  {
    id: 'joinerHeroes', label: 'Joiner Heroes (Skill 5)', icon: '🦸', multi: true,
    baseOptions: () => JOINER_HEROES,
    get: (p) => (p.joinerHeroes || []).filter(jh => jh.skillLevel >= 5).map(jh => jh.hero),
  },
  {
    id: 'allianceRank', label: 'Alliance Rank', icon: '🎖️', multi: false,
    baseOptions: () => ALLIANCE_RANKS,
    get: (p) => (p.allianceRank ? [p.allianceRank] : []),
  },
];

const CUSTOM_OPTIONS_KEY = 'svs_field_registry_custom_options';

function loadCustomOptions() {
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_OPTIONS_KEY)) || {};
  } catch {
    return {};
  }
}

function saveCustomOptions(data) {
  try {
    localStorage.setItem(CUSTOM_OPTIONS_KEY, JSON.stringify(data));
  } catch {
    // storage full or unavailable — custom option simply won't persist
  }
}

export function getCustomOptions(fieldId) {
  return loadCustomOptions()[fieldId] || [];
}

export function addCustomOption(fieldId, value) {
  const trimmed = (value || '').trim();
  if (!trimmed) return;
  const data = loadCustomOptions();
  const existing = data[fieldId] || [];
  if (!existing.some(v => v.toLowerCase() === trimmed.toLowerCase())) {
    data[fieldId] = [...existing, trimmed];
    saveCustomOptions(data);
  }
}

// localStorage key: svs_field_registry_custom_hero_gens
// Owner: fieldRegistryService.js. Only covers joiner heroes an officer
// typed in themselves that aren't already in HEROES_BY_GEN
// (constants.js) — built-in heroes get their generation from there,
// this just fills the gap for genuinely custom ones.
const CUSTOM_HERO_GENS_KEY = 'svs_field_registry_custom_hero_gens';

function loadCustomHeroGens() {
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_HERO_GENS_KEY)) || {};
  } catch {
    return {};
  }
}

function saveCustomHeroGens(data) {
  try {
    localStorage.setItem(CUSTOM_HERO_GENS_KEY, JSON.stringify(data));
  } catch {
    // storage full or unavailable — generation tag simply won't persist
  }
}

export function getCustomHeroGen(hero) {
  return loadCustomHeroGens()[hero] || null;
}

export function setCustomHeroGen(hero, gen) {
  const data = loadCustomHeroGens();
  data[hero] = gen;
  saveCustomHeroGens(data);
}

// Full set of values to show for a field: predefined options + any
// custom ones added at runtime + anything already present on a player
// (defensive — covers data set some other way, e.g. direct profile edit).
export function getFieldValues(players, field) {
  const fromPlayers = new Set();
  players.forEach(p => field.get(p).forEach(v => fromPlayers.add(v)));
  const base = field.baseOptions();
  const custom = getCustomOptions(field.id);
  return Array.from(new Set([...base, ...custom, ...fromPlayers]));
}

export function getPlayersWithFieldValue(players, field, value) {
  return players.filter(p => field.get(p).includes(value));
}

function setFieldValue(player, fieldId, value) {
  const stamp = new Date().toISOString();
  switch (fieldId) {
    case 'languages':
      return { ...player, languages: value, profileLastUpdated: stamp };
    case 'furnace':
      return { ...player, furnaceLevel: value, profileLastUpdated: stamp };
    case 'allianceTag':
      return { ...player, allianceTag: value, profileLastUpdated: stamp };
    case 'infantry':
      return { ...player, troops: { ...player.troops, infantry: value }, profileLastUpdated: stamp };
    case 'lancer':
      return { ...player, troops: { ...player.troops, lancer: value }, profileLastUpdated: stamp };
    case 'marksman':
      return { ...player, troops: { ...player.troops, marksman: value }, profileLastUpdated: stamp };
    case 'allianceRank':
      return { ...player, allianceRank: value, profileLastUpdated: stamp };
    default:
      return player;
  }
}

// Multi-value fields (languages) ADD to the existing array.
// Single-value fields (troop tiers) REPLACE the existing value.
export function assignFieldValue(player, field, value) {
  if (field.multi) {
    const current = field.get(player);
    if (current.includes(value)) return player;
    return setFieldValue(player, field.id, [...current, value]);
  }
  return setFieldValue(player, field.id, value);
}

export function removeFieldValue(player, field, value) {
  if (field.multi) {
    return setFieldValue(player, field.id, field.get(player).filter(v => v !== value));
  }
  return setFieldValue(player, field.id, null);
}
