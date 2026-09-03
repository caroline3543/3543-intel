/**
 * noticeCycleService.js
 *
 * The game runs on a fixed 4-week (28-day) recurring schedule. Rather
 * than anyone manually tagging a notice with "this goes on day 3",
 * this watches actual posting history (notice.postedDates) and learns
 * which point in the cycle each notice tends to get used at, purely
 * from behavior. Needs a cycle anchor date set in Settings — any known
 * "Day 1" of a past cycle — and at least 2 historical posts per
 * notice before it will ever suggest anything; a single post could
 * just be a coincidence, not a pattern.
 *
 * Pure functions — no React, no side effects.
 */

const CYCLE_LENGTH = 28;

/**
 * Which day of the 4-week cycle a date falls on (1-28), relative to
 * the alliance's cycle anchor. Returns null if no anchor is set, or
 * either date is invalid — cycle day is meaningless without an anchor.
 */
export function cycleDayOf(dateStr, anchorDateStr) {
  if (!anchorDateStr || !dateStr) return null;
  const anchor = new Date(anchorDateStr + 'T00:00:00');
  const date   = new Date(dateStr + 'T00:00:00');
  if (isNaN(anchor) || isNaN(date)) return null;
  const diffDays = Math.floor((date - anchor) / 86400000);
  const mod = ((diffDays % CYCLE_LENGTH) + CYCLE_LENGTH) % CYCLE_LENGTH;
  return mod + 1; // 1-28
}

export function todayCycleDay(anchorDateStr) {
  return cycleDayOf(new Date().toISOString().slice(0, 10), anchorDateStr);
}

// Distance between two cycle days on a 28-day WHEEL, not a line — day
// 28 and day 1 are 1 apart, not 27.
function circularDist(a, b) {
  const diff = Math.abs(a - b);
  return Math.min(diff, CYCLE_LENGTH - diff);
}

/**
 * How well a notice's real posting history matches a target cycle
 * day, from 0 (no match / not enough history) to 1 (every recorded
 * post landed within a day of this point in the cycle).
 */
export function matchScore(notice, anchorDateStr, targetCycleDay) {
  if (!anchorDateStr || targetCycleDay == null) return 0;
  const days = (notice.postedDates || [])
    .map(d => cycleDayOf(d, anchorDateStr))
    .filter(d => d != null);
  if (days.length < 2) return 0;
  const closeHits = days.filter(d => circularDist(d, targetCycleDay) <= 1).length;
  return closeHits / days.length;
}

/**
 * Ranks notices for "what should we post today" — only returns ones
 * with a genuine historical pattern (score > 0), best match first.
 * Returns [] if no cycle anchor is set, rather than guessing.
 */
export function suggestForToday(notices, anchorDateStr) {
  const targetDay = todayCycleDay(anchorDateStr);
  if (targetDay == null) return [];
  return notices
    .map(n => ({ notice: n, score: matchScore(n, anchorDateStr, targetDay) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ notice }) => notice);
}

/**
 * Records that a notice was just posted today — returns the updated
 * notice object (does not mutate).
 */
export function markPostedToday(notice) {
  const today = new Date().toISOString().slice(0, 10);
  return {
    ...notice,
    postedDates: [...(notice.postedDates || []), today],
    updatedAt: new Date().toISOString(),
  };
}
