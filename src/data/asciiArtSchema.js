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
const WOS_ICON_SEEDS = WOS_ICON_DEFS.map(([hex, name]) => ({
  title: name,
  category: 'Game Icons',
  tags: [hex],
  art: String.fromCodePoint(parseInt(hex, 16)),
}));

// Common Korean alliance-chat phrases. These are my best-effort
// natural translations, not verified by a native speaker or pulled
// from an in-game source the way the icon codes above were — if the
// register or wording isn't quite what your alliance actually uses,
// edit them directly in the library, same as anything else here.
const KOREAN_PHRASE_SEEDS = [
  { title: 'Thanks Everyone (Korean)', category: 'Korean Phrases', tags: ['korean','thanks'], art: '모두 감사합니다!' },
  { title: 'Good Job (Korean)',        category: 'Korean Phrases', tags: ['korean','good job'], art: '수고하셨습니다!' },
  { title: 'How Are You (Korean)',     category: 'Korean Phrases', tags: ['korean','greeting'], art: '잘 지내세요?' },
];

// Kaomoji and chat decorations, transcribed directly from what was
// pasted in — these are ordinary Unicode (no Private Use Area
// characters involved), so unlike the game icons above these actually
// render and were visually checked before being written here.
//
// The "•" bullet markers ARE part of the stored content — an earlier
// version of this file wrongly assumed they were just list formatting
// from how the entries were originally posted and stripped them; that
// was incorrect and has been reverted. Nothing here is reformatted or
// "cleaned up" — every space, including trailing whitespace, is kept
// exactly as given.
const KAOMOJI_SEEDS = [
  // These four lines were originally pasted together as ONE piece —
  // a hello/cuties card opener followed by its own border — and had
  // been wrongly split into four separate library entries (two
  // kaomoji + two "Card Border" pieces, with the connector line only
  // saved once instead of the four times it actually repeats).
  // Restored here as the single multi-line entry it always was.
  // Same rule as elsewhere in this file: every character, every
  // trailing space, and every repeated line is kept exactly as given.
  { title: 'Hello / Cuties Card', category: 'Decorations', tags: ['cat','hello','cuties','border','frame'], art:
`•     /),,,,/).           ˗ˋˏ helloˎˊ˗  
•    (｡•ㅅ•｡)      ˗ˋˏ cutiesˎˊ˗ 
• ╭∪──∪──────────
• ┊
• ┊
• ┊
• ┊` },
  { title: 'Cat (Sitting, 2-line)',   category: 'Kaomoji', tags: ['cat','cute'], art:
`  /)    /)
(｡•ㅅ•｡)` },
  { title: 'Bear Hug + Heart',        category: 'Kaomoji', tags: ['bear','hug','heart'], art: 'ʕ •ᴥ•ʔづ♡' },
  // Built from its codepoint (U+2501, BOX DRAWINGS HEAVY HORIZONTAL)
  // repeated a measured 15 times, rather than hand-typed and eyeballed
  // — same reasoning as the PUA icons above: verify by construction,
  // not by looking at it.
  { title: 'Heavy Line Divider',      category: 'Decorations', tags: ['border','divider','line'], art: String.fromCodePoint(0x2501).repeat(15) },
];

// A larger batch of bear/emote-style kaomoji, transcribed the same
// way as the set above — exact characters, exact spacing, nothing
// normalized or "corrected" for apparent inconsistency. Some entries
// look like near-duplicates of others with different spacing (e.g.
// the two "I will feast on the blood of your soldiers" bears below
// use different indentation and line-wrapping from each other) — that
// difference is preserved deliberately, not merged, since each was
// given as its own distinct piece. One entry ("ʕ •ᴥ•ʔっ") appeared
// twice in the original list with identical content; it's included
// here once, not twice, since a duplicate library entry with the same
// exact copy output isn't useful — flagged in case that repeat was
// actually meant to be two different things.
const BEAR_KAOMOJI_SEEDS = [
  { title: 'Crying Bear Face (Simple)', category: 'Kaomoji', tags: ['bear','crying','sad'], art: '໒꒰ྀི╥﹏╥꒱ྀི১' },
  { title: 'Content Bear Face',         category: 'Kaomoji', tags: ['bear','happy'], art: '໒꒰ྀི๑• ༝ •๑꒱ྀི১' },
  { title: 'Sad Face (Ears)',           category: 'Kaomoji', tags: ['bear','sad'], art:
`.  ᲘᲘ
( •̯́ •̯̀)` },
  { title: 'Angry Bear — Blood Threat', category: 'Kaomoji', tags: ['bear','angry','threat'], art:
`.   Ი  Ი
໒ ( ´ཀ\` ) ა
I will feast on the blood of your soldiers` },
  { title: 'Excited Bear Arms Up',      category: 'Kaomoji', tags: ['bear','excited'], art:
`.  Ი Ი
\\(^ ཀ ^)/` },
  { title: 'Bear Wave',                 category: 'Kaomoji', tags: ['bear','wave'], art: 'ʕ •ᴥ•ʔっ' },
  { title: 'Crying Bear (No Ears)',     category: 'Kaomoji', tags: ['bear','crying','sad'], art: 'ʕó﹏ò｡ʔ' },
  { title: 'Crying Face (Ears)',        category: 'Kaomoji', tags: ['bear','crying','sad'], art:
`.  Ი  Ი
( ó﹏ò｡) ` },
  { title: 'Angry Bear — Blood Threat (Variant Spacing)', category: 'Kaomoji', tags: ['bear','angry','threat'], art:
`.               ᲘᲘ
           ໒ ( ´ཀ\` ) ა

I will feast on the 
blood of your soldiers` },
  { title: 'Content Face (Small)',      category: 'Kaomoji', tags: ['bear','happy'], art: '໒ ྀིᴗ͈ . ᴗ͈ ྀིა' },
  { title: 'Happy Bear Arms Up (Sparkle)', category: 'Kaomoji', tags: ['bear','happy','excited'], art:
`.     Ი   Ი
٩(๑ᵔ ᴗ ᵔ๑) ۶` },
  { title: 'Happy Bear Arms Up (Blush)', category: 'Kaomoji', tags: ['bear','happy','excited'], art:
`.   Ი  Ი
٩(｡•́‿•̀｡)۶` },
  { title: 'Shy Bear',                  category: 'Kaomoji', tags: ['bear','shy'], art:
`.  Ი  Ი
(„• ᴗ •„)` },
  { title: 'Excited Bear Arms Up (Grin)', category: 'Kaomoji', tags: ['bear','excited'], art:
`.  Ი Ი
\\(^ヮ^)/` },
  { title: 'Determined Fist Pump',      category: 'Kaomoji', tags: ['determined'], art: '(๑˃ᴗ˂)ﻭ' },
  { title: 'Determined Fist Pump (Soft)', category: 'Kaomoji', tags: ['determined'], art: '(๑ • ᴗ •)ﻭ' },
  { title: 'Cheering Bear Arms Up',     category: 'Kaomoji', tags: ['bear','cheering'], art:
`.  Ი Ი
٩(˘ ³˘) ۶` },
  { title: 'Kissy Face Reaching',       category: 'Kaomoji', tags: ['kiss'], art: '(づ￣ ³￣)づ' },
  { title: 'Wavy Mouth Face (Ears)',    category: 'Kaomoji', tags: ['bear','confused'], art:
`.  Ი  Ი
(︶︹︺)` },
  { title: 'Skeptical Face (Ears)',     category: 'Kaomoji', tags: ['bear','skeptical'], art:
`.  Ი Ი
(·•᷄ ︹•᷅ )` },
  { title: 'Skeptical Bear',            category: 'Kaomoji', tags: ['bear','skeptical'], art: 'ʕ·•᷄ ︹•᷅ ʔ' },
  { title: 'Skeptical Bear (Alt Mouth)', category: 'Kaomoji', tags: ['bear','skeptical'], art: 'ʕ·•᷄ ᴥ•᷅ ʔ' },
  { title: 'Sad Face (Ears, Alt)',      category: 'Kaomoji', tags: ['bear','sad'], art:
`.  Ი  Ი
(｡•́︿•̀｡)` },
  { title: 'Fighting Face',             category: 'Kaomoji', tags: ['fighting','angry'], art: '(ง •̀_•́)ง' },
  { title: 'Shrug',                     category: 'Kaomoji', tags: ['shrug'], art: '¯\\_(ツ)_/¯' },
  { title: 'Simple Bear Face',          category: 'Kaomoji', tags: ['bear'], art: 'ʕ•ᴥ•ʔ' },
  { title: 'Happy Bear Reaching',       category: 'Kaomoji', tags: ['bear','happy'], art:
`.  Ი  Ი
(っ ᵔ ᴥ ᵔ) っ` },
  { title: 'Sad Face Reaching',         category: 'Kaomoji', tags: ['sad'], art: '(っ˘̩╭╮˘̩)っ' },
  { title: 'Simple Happy Bear',         category: 'Kaomoji', tags: ['bear','happy'], art:
`. Ი Ი
(ᵔ ᴥ ᵔ)` },
];

export const SEED_ASCII_ART = [...WOS_ICON_SEEDS, ...KOREAN_PHRASE_SEEDS, ...KAOMOJI_SEEDS, ...BEAR_KAOMOJI_SEEDS];
