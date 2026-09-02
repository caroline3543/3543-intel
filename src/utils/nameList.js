// Shared name-list parsing/matching — the same paste-a-list technique
// Bulk Name Add uses for creating players, reused wherever pasting a
// list of names is faster than searching and tapping one at a time
// (Field Registry's troop tier / joiner hero assignment, Events'
// add-participant flow). One parsing rule lives here instead of being
// redefined per screen.

// Comma or newline separated, trimmed, blanks dropped.
export function parseNames(raw) {
  return raw
    .split(/[,\n]/)
    .map(s => s.trim())
    .filter(Boolean);
}

// Matches a pasted list against an existing pool of players
// (case-insensitive, exact match on username or alias — no fuzzy
// matching, since a wrong silent match on a bulk operation is worse
// than an unmatched name the officer has to fix by hand). Each player
// can only be matched once even if their name is pasted twice.
// Returns the matched player records plus any pasted names that
// didn't resolve to anyone in the pool.
export function matchNamesToPlayers(raw, players) {
  const matched = [];
  const matchedIds = new Set();
  const unmatched = [];
  parseNames(raw).forEach(name => {
    const key = name.toLowerCase();
    const player = players.find(p =>
      !matchedIds.has(p.id) &&
      ((p.username || '').trim().toLowerCase() === key || (p.alias || '').trim().toLowerCase() === key)
    );
    if (player) { matched.push(player); matchedIds.add(player.id); }
    else unmatched.push(name);
  });
  return { matched, unmatched };
}
