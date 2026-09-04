import { uid } from '../utils/dates.js';

// The raw `art` string is the single source of truth for every piece
// — nothing here ever derives, trims, or reformats it. Whatever's
// typed or pasted in is exactly what gets stored, previewed, and
// copied, character for character (including tabs, if any end up in
// there — JS strings and <textarea>/<pre> preserve them natively, no
// special handling needed as long as nothing calls .trim() or a
// regex-replace on the value itself).
export function newAsciiArt(overrides = {}) {
  return {
    id:        uid(),
    title:     '',
    category:  'Uncategorized', // free-form, alliance-defined — no fixed list, same pattern as Alliance tags elsewhere in the app
    tags:      [],               // optional, free-form, searchable
    art:       '',               // raw text — copied verbatim, no code-fence wrapping (this gets pasted straight into the game, which doesn't render markdown)
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// Seeded once into app state on first load (see useAppState.js), then
// treated as ordinary data from then on — editable, deletable, no
// different from anything the user saves themselves.
//
// Every multi-line piece here was built by constructing each row to an
// explicit fixed width (padding/centering by code, not by counting
// spaces by eye) and then verifying every line came out the same
// length before being written here — a hand-typed Castle broke this
// rule once already (its top row came out narrower than the rest), so
// this set was rebuilt and checked properly.
export const SEED_ASCII_ART = [
  {
    title: 'SvS Banner',
    category: 'Banners',
    art:
`╔═══════════════════╗
║    S v S  WEEK    ║
╚═══════════════════╝`,
  },
  {
    title: 'Divider — Simple',
    category: 'Dividers',
    art: '─────────────────────',
  },
  {
    title: 'Divider — Double',
    category: 'Dividers',
    art: '═════════════════════',
  },
  {
    title: 'Castle',
    category: 'Icons',
    art:
`  _   _   _  
 | |_| |_| | 
 |         | 
 |    _    | 
 |   |_|   | 
 |_________| `,
  },
  {
    title: 'Warning Banner',
    category: 'Banners',
    art:
`┏━━━━━━━━━━━━━━━━━━━┓
┃     ATTENTION     ┃
┗━━━━━━━━━━━━━━━━━━━┛`,
  },
  {
    title: 'Trophy',
    category: 'Icons',
    art:
`  _______  
 |       | 
 |   1   | 
  \\_____/  
    | |    
   _|_|_   
  |_____|  `,
  },
  {
    title: 'Shield',
    category: 'Icons',
    art:
` _________ 
|         |
|    *    |
|         |
 \\       / 
  \\     /  
   \\   /   
    \\ /    
     V     `,
  },
  {
    title: 'Flag Banner',
    category: 'Banners',
    art:
`   ___   
  /   \\  
 |     | 
  \\___/  
    |    
    |    `,
  },
  {
    title: 'Star Divider',
    category: 'Dividers',
    art: '★ ★ ★ ★ ★ ★ ★ ★ ★ ★',
  },
  {
    title: 'Crossed Divider',
    category: 'Dividers',
    art: '---------X---------',
  },
  {
    title: 'Rally Banner',
    category: 'Banners',
    art: '»»»      RALLY      «««',
  },
  {
    title: 'Alert Box',
    category: 'Banners',
    art:
`╭───────────────────╮
│   ⚠ IMPORTANT ⚠   │
╰───────────────────╯`,
  },
];
