import { uid } from '../utils/dates.js';

// The raw `art` string is the single source of truth for every piece
// — nothing here ever derives, trims, reformats, or NORMALIZES it.
// Whatever's typed or pasted in is exactly what gets stored,
// previewed, and copied, character for character, code point for
// code point. In particular:
//   - No .normalize('NFC'|'NFD'|'NFKC'|'NFKD') is ever called on art
//     anywhere in this app. Never add one — Whiteout Survival's
//     Private Use Area icon characters (see WOS_PUA_ICONS below) have
//     no canonical decomposition; normalizing would risk altering or
//     stripping them, and PUA characters are invisible in virtually
//     every font, so a corruption here would not even be visible to
//     catch by looking at it.
//   - Tabs, if any end up in an entry, are preserved the same way —
//     JS strings and <textarea>/<pre> carry them through unchanged as
//     long as nothing calls .trim() or a regex-replace on the value.
export function newAsciiArt(overrides = {}) {
  return {
    id:        uid(),
    title:     '',
    category:  'Uncategorized', // free-form, alliance-defined — no fixed list, same pattern as Alliance tags elsewhere in the app
    tags:      [],               // optional, free-form, searchable
    art:       '',               // raw text — copied verbatim, no code-fence wrapping, no normalization
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ── Whiteout Survival Private-Use-Area icon reference ───────────
// Every code point here is a Basic-Multilingual-Plane Private Use Area
// character (U+E000–U+F8FF) — a single UTF-16 code unit, no surrogate
// pairs involved. Each character is constructed from its hex code via
// String.fromCodePoint() at load time, not hand-typed or pasted —
// these characters render as blank/invisible in almost every font
// (including whatever renders this source file), so there is no way
// to visually verify a hand-typed one is correct. Building it
// mathematically from the hex value removes that risk entirely: the
// only thing that could be wrong is the hex-to-name mapping itself,
// which is plainly readable and checkable here.
const WOS_ICON_DEFS = [
  ['E001', 'Diamond'],
  ['E002', 'Meat'],
  ['E003', 'Wood'],
  ['E004', 'Coal'],
  ['E005', 'Iron'],
  ['E006', 'Steel'],
  ['E007', 'Hero EXP'],
  ['E009', 'Wheel Coin'],
  ['E010', 'Fire Crystal'],
  ['E011', 'Thorn of Enigma'],
  ['E012', 'Bag of Gems'],
  ['E013', 'Building Speedup'],
  ['E014', 'Troop Speedup'],
  ['E015', 'Research Speedup'],
  ['E016', 'Essence Stone'],
  ['E017', 'Speedup'],
  ['E018', 'Adventure Coin'],
  ['E019', 'SSR Shard'],
  ['E020', 'Vase'],
  ['E021', 'Other Meat'],
  ['E022', 'Sandwich'],
  ['E024', 'Blue Completed'],
  ['E025', 'Red Completed'],
  ['E026', 'Red Flag'],
  ['E027', 'Blue Flag'],
  ['E029', 'Car Keys'],
  ['E030', 'Small Bouquet'],
  ['E031', 'Medium Bouquet'],
  ['E032', 'Large Bouquet'],
  ['E033', 'Clover'],
  ['E034', 'Coin'],
  ['E035', 'ChocoGift'],
  ['E036', 'Dream Mark'],
  ['E037', 'Top Up Coin'],
  ['E039', 'Bread Loaf'],
  ['E040', 'Recycle Token'],
  ['E041', 'Blue Token'],
];

// Keyed by 4-digit uppercase hex (e.g. 'E010') — used both to seed the
// library below and by the Character Inspector to look up the
// human-readable meaning of any PUA character it encounters, whether
// in a seeded entry or something pasted into a custom one.
export const WOS_PUA_ICONS = Object.fromEntries(
  WOS_ICON_DEFS.map(([hex, name]) => [hex, { name, char: String.fromCodePoint(parseInt(hex, 16)) }])
);

// One entry per icon — each `art` value is the bare single character,
// nothing else, so it's individually findable/copyable and safe to
// combine into your own multi-icon creations by copying several into
// one new entry. The emoji-free `title` is metadata for humans
// browsing the list; the stored `art` is always the actual PUA
// character, never the emoji or the name.
export const SEED_ASCII_ART = WOS_ICON_DEFS.map(([hex, name]) => ({
  title: name,
  category: 'Game Icons',
  tags: [hex],
  art: String.fromCodePoint(parseInt(hex, 16)),
}));
