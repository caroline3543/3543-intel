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

// Edit distance between two strings — used to catch likely typos
// ("Jonh" vs "John") that exact matching (above) would miss.
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// Flags a pasted name that's CLOSE to (but not identical to) an
// existing player's name — a likely typo, surfaced as a suggestion
// rather than auto-skipped like an exact match, since it might
// genuinely be a different person who just has a similar name. The
// distance threshold scales gently with name length: short names need
// a near-exact match to trigger, longer names allow a bit more slack.
export function findCloseMatches(name, existingPlayers) {
  const key = name.trim().toLowerCase();
  const threshold = key.length <= 4 ? 1 : key.length <= 7 ? 2 : 3;
  return existingPlayers
    .map(p => {
      const existingName = (p.username || p.alias || '').trim();
      if (!existingName) return null;
      const dist = levenshtein(key, existingName.toLowerCase());
      return dist > 0 && dist <= threshold ? { player: p, distance: dist } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.distance - b.distance);
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
