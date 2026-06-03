/**
 * Normalize a player name for comparison.
 * Strips invisible chars, collapses spaces, lowercases.
 */
export function normalizeName(n) {
  return (n || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '');
}

/**
 * Levenshtein distance between two strings.
 */
export function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[a.length][b.length];
}

/**
 * Similarity score 0–1 between two names.
 */
export function nameSimilarity(a, b) {
  const na = normalizeName(a), nb = normalizeName(b);
  if (na === nb) return 1;
  if (!na || !nb) return 0;
  if (na.startsWith(nb) || nb.startsWith(na)) return 0.85;
  const lo = na.length > nb.length ? na : nb;
  const sh = na.length > nb.length ? nb : na;
  return 1 - levenshtein(lo, sh) / lo.length;
}
