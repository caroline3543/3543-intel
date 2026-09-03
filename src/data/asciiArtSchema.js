import { uid } from '../utils/dates.js';

export function newAsciiArt(overrides = {}) {
  return {
    id:        uid(),
    title:     '',
    art:       '',      // raw text — copied verbatim, wrapped in a code block
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// Seeded once into app state on first load (see useAppState.js), then
// treated as ordinary data from then on — editable, deletable, no
// different from anything the user saves themselves. Kept simple and
// compact on purpose: dense multi-line ASCII art is exactly the kind
// of thing that breaks on a narrow mobile screen or a non-monospace
// fallback font, so these lean on box-drawing characters and short
// line widths rather than elaborate figures.
export const SEED_ASCII_ART = [
  {
    title: 'SvS Banner',
    art:
`╔═══════════════════╗
║   S v S   W E E K  ║
╚═══════════════════╝`,
  },
  {
    title: 'Divider — Simple',
    art: '─────────────────────',
  },
  {
    title: 'Divider — Double',
    art: '═════════════════════',
  },
  {
    title: 'Crown',
    art: String.raw`   .-'''-.
  /    ^    \
 |_.-'''-._|
  \_______/`,
  },
  {
    title: 'Castle',
    art:
`  _   _   _
 [_]_[_]_[_]
 |  ___    |
 | |   |   |
 |_|___|___|`,
  },
  {
    title: 'Warning Banner',
    art:
`⚠ ⚠ ⚠ ⚠ ⚠ ⚠ ⚠
   A T T E N T I O N
⚠ ⚠ ⚠ ⚠ ⚠ ⚠ ⚠`,
  },
  {
    title: 'Victory (GG)',
    art: String.raw`  ____  ____
 / ___||  _ \
| |  _ | | | |
| |_| || |_| |
 \____||____/`,
  },
  {
    title: 'Fire (Foundry)',
    art:
`   (  .      )
)           (
(    )  )    )
_____________
|___________|`,
  },
];
