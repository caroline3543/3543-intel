export const C = {
  bg:      '#0A1628',
  card:    '#1E3A52',
  section: '#152236',
  gold:    '#F5A623',
  white:   '#FFFFFF',
  icy:     '#A8C4D8',
  muted:   '#5A7A94',
  inf:     '#6B8CAE',
  lan:     '#7BAE8C',
  mar:     '#B8859A',
  red:     '#FF453A',
  green:   '#30D158',
  border:  '#2A4A64',
};

// Tier order, low to high. FC1–FC8 all enhance T10 troops without
// changing their tier name; T11 is unlocked separately; Helios
// ("Helios T11") is a further War Academy research tier above T11 —
// not a camp-level milestone like the FC tiers.
// NOTE: 'T12' was already in this list before this edit and is kept
// as-is (not removing data that may already be stored on players) —
// but current sourcing only confirms Helios as the tier above T11, not
// a 'T12'. Worth confirming whether T12 is real or a leftover/typo.
export const TIER_OPTIONS = ['T10','FC1','FC2','FC3','FC4','FC5','FC6','FC7','FC8','T11/Helios','T12'];

// Furnace level options — separate from TIER_OPTIONS above. Furnace is
// FC1-FC8 only; T10/T11/Helios/T12 are troop camp tiers, not furnace
// levels (see the "T11/Helios is not a furnace" fix in PlayerSheet.jsx).
export const FC_OPTIONS = ['FC1','FC2','FC3','FC4','FC5','FC6','FC7','FC8'];

// NOTE: player roles are no longer a fixed list. "Rally Lead" is the only
// permanent, built-in role (see src/utils/roles.js) — every other role is
// created by the alliance itself and stored in app data, not here.

export const EVENT_ICONS = {
  'Foundry':                  '🔥',
  'Canyon Clash':              '🏔️',
  'SvS Castle Battle':         '🏰',
  'Internal Sunfire Castle':   '🏯',
  'Transfer Season':           '🚀',
  'Custom':                    '📋',
};

export const TIMEZONES = [
  'Oceania','Southeast Asia','East Asia','South Asia','Middle East',
  'Eastern Europe','Central Europe','Western Europe','UK & Ireland',
  'West Africa','East Africa','South Africa','Eastern North America',
  'Central North America','Western North America',
  'Central America & Caribbean','South America (East)','South America (West)',
];

export const LANGUAGES = [
  'English','Mandarin','Spanish','Portuguese','Russian','Arabic','Turkish',
  'German','French','Indonesian','Vietnamese','Thai','Korean','Japanese',
  'Polish','Italian','Dutch','Hindi','Malay','Other',
];

export const COUNTRIES = [
  'Afghanistan','Albania','Algeria','Argentina','Australia','Austria',
  'Bangladesh','Belgium','Brazil','Cambodia','Canada','Chile','China',
  'Colombia','Czech Republic','Denmark','Egypt','Ethiopia','Finland',
  'France','Germany','Ghana','Greece','Hungary','India','Indonesia',
  'Iran','Iraq','Ireland','Italy','Japan','Jordan','Kazakhstan','Kenya',
  'Malaysia','Mexico','Morocco','Myanmar','Nepal','Netherlands',
  'New Zealand','Nigeria','Norway','Pakistan','Peru','Philippines',
  'Poland','Portugal','Romania','Russia','Saudi Arabia','Serbia',
  'Singapore','South Africa','South Korea','Spain','Sri Lanka','Sweden',
  'Switzerland','Taiwan','Thailand','Turkey','Ukraine',
  'United Arab Emirates','United Kingdom','United States',
  'Venezuela','Vietnam','Other',
];

export const HEROES_BY_GEN = [
  { gen:'Gen 1',  heroes:['Jessie','Jasser','Jeronimo','Seo-Yoon','Patrick','Bahiti','Ling Xue','Lumak Bokan','Sergey'] },
  { gen:'Gen 2',  heroes:['Philly','Alonso'] },
  { gen:'Gen 3',  heroes:['Mia','Logan','Greg'] },
  { gen:'Gen 4',  heroes:['Reina','Ahmose','Lynn'] },
  { gen:'Gen 5',  heroes:['Norah','Hector','Gwen'] },
  { gen:'Gen 6',  heroes:['Wu Ming','Renee','Wayne'] },
  { gen:'Gen 7',  heroes:['Edith','Gordon','Bradley'] },
  { gen:'Gen 8',  heroes:['Gatot','Sonya','Hendrik'] },
  { gen:'Gen 9',  heroes:['Magnus','Fred','Xura'] },
  { gen:'Gen 10', heroes:['Gregory','Freya','Blanchette'] },
  { gen:'Gen 11', heroes:['Eleonora','Lloyd','Rufus'] },
];

export const STRATEGY_TYPES = [
  'Solo Rush','Double Rally','Multi Rally','Counter Rally',
  'Castle Switching','Decoy Garrison Lead','Defensive Hold',
  'Reinforcement Wall','Hybrid','Custom',
];

export const TEAM_ROLES = [
  'Solo Attack','Counter Rally','Reinforcement','Castle Fill',
  'Exit Team','Backup','Voice Required','Garrison Lead','Decoy Lead',
];

export const EVENT_TYPES = [
  'SvS Castle Battle', 'Internal Sunfire Castle',
  'Foundry', 'Canyon Clash',
  'Transfer Season', 'Custom',
];

// Event types that automatically include joiner coverage in exports
export const JOINER_COVERAGE_EVENTS = ['SvS Castle Battle', 'Internal Sunfire Castle'];

// Event types that track troop power per player, per event (see
// SnapshotEditor.jsx and ProfileView.jsx's troop-power chart)
export const TROOP_POWER_EVENTS = ['Foundry', 'Canyon Clash'];

// RSVP prediction fields (arriving late / leaving early / discord /
// present whole time) only make sense for the two SvS-related event
// types — nobody needs to predict "will I be on time" for a Foundry
// run. Every other event type skips straight to a plain roster; post-
// event actuals (attended/no-show/voice) still apply universally via
// EventsTab.jsx's bulk actions regardless of this list.
export const SHOWS_RSVP_TYPES = ['SvS Castle Battle', 'Internal Sunfire Castle'];

// Alliance rank — mutually exclusive (a player holds exactly one), so
// modeled as a single value (player.allianceRank), not another entry
// in the multi-select roles array. R5 is highest.
export const ALLIANCE_RANKS = ['R5', 'R4', 'R3', 'R2', 'R1'];

// Shared "obviously selected" style for tier/FC chips (PlayerSheet,
// RallySlotCard, BatchAddSheet all use this) — thicker border + solid
// fill + bold text make selection unambiguous at a glance, instead of
// each screen's own subtle border-tint variant.
export function tierChipStyle(selected, color = C.gold) {
  return {
    padding: '7px 13px',
    borderRadius: 16,
    flexShrink: 0,
    border: `2px solid ${selected ? color : C.border}`,
    background: selected ? color : C.section,
    color: selected ? C.bg : C.muted,
    fontWeight: selected ? 800 : 600,
    fontSize: 13,
    cursor: 'pointer',
    minHeight: 36,
  };
}
