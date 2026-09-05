// ── squadBalancerService.js ────────────────────────────────────
// Pure functions only — no React, no side effects. Powers the Squad
// Balancer feature for Foundry/Canyon Clash events (see
// TROOP_POWER_EVENTS in constants.js), where an alliance's own
// contingent splits into several independent teams that each operate
// on their own part of the map — there are no rallies in these events,
// so this is deliberately separate from the Battle Plan / rally-slot
// system used for SvS Castle Battle.

/**
 * Splits `participants` into `teamCount` squads as close to equal
 * total power as a simple, explainable heuristic can manage.
 *
 * Algorithm (greedy / "largest remaining first"):
 *   1. Each chosen leader anchors their own squad; their power counts
 *      toward that squad's total immediately.
 *   2. Everyone else with a known power is sorted strongest-first,
 *      then placed one at a time into whichever squad currently has
 *      the LOWEST total power. This is the standard greedy approach
 *      to balanced-partition problems — not provably optimal, but
 *      reliably close, deterministic, and easy to explain to a
 *      non-technical officer ("strongest players go to whichever team
 *      is currently behind").
 *   3. Anyone with no recorded power can't be weighed against anyone
 *      else numerically, so they're placed last, round-robin, purely
 *      to keep headcounts even rather than to balance power.
 *
 * @param participants  Player objects to distribute (including leaders)
 * @param leaderIds     playerIds chosen as squad anchors, in squad
 *                      order — length may be less than teamCount, in
 *                      which case the remaining squads simply start
 *                      leaderless and get filled by the balancer same
 *                      as anyone else
 * @param teamCount     number of squads to create (2–6 in the UI, but
 *                      this function doesn't enforce a range itself)
 * @param getPower      (player) => number|null — power lookup, so the
 *                      caller decides the fallback chain (this event's
 *                      recorded troop power vs. the general
 *                      cross-event figure from metrics.js)
 *
 * @returns { squads: [{ leaderId, memberIds, totalPower }], noPowerCount }
 */
export function balanceSquads(participants, leaderIds, teamCount, getPower) {
  const squads = Array.from({ length: teamCount }, () => ({ leaderId: null, memberIds: [], totalPower: 0 }));
  const leaderSet = new Set(leaderIds);

  leaderIds.slice(0, teamCount).forEach((id, i) => {
    squads[i].leaderId = id;
    const leaderPlayer = participants.find(p => p.id === id);
    squads[i].totalPower = leaderPlayer ? (getPower(leaderPlayer) || 0) : 0;
  });

  const rest = participants.filter(p => !leaderSet.has(p.id));
  const withPower = rest.filter(p => getPower(p) != null).sort((a, b) => getPower(b) - getPower(a));
  const noPower   = rest.filter(p => getPower(p) == null);

  withPower.forEach(p => {
    let targetIdx = 0;
    for (let i = 1; i < squads.length; i++) {
      if (squads[i].totalPower < squads[targetIdx].totalPower) targetIdx = i;
    }
    squads[targetIdx].memberIds.push(p.id);
    squads[targetIdx].totalPower += getPower(p) || 0;
  });

  noPower.forEach((p, i) => {
    squads[i % teamCount].memberIds.push(p.id);
  });

  return { squads, noPowerCount: noPower.length };
}

/** Total recorded power for a squad, including its leader. */
export function squadTotalPower(squad, players, getPower) {
  const ids = [squad.leaderId, ...(squad.memberIds || [])].filter(Boolean);
  return ids.reduce((sum, id) => {
    const p = players.find(pl => pl.id === id);
    return sum + (p ? (getPower(p) || 0) : 0);
  }, 0);
}

/** Highest total minus lowest total across all squads — 0 is perfectly even. */
export function powerSpread(squads, players, getPower) {
  if (!squads.length) return 0;
  const totals = squads.map(s => squadTotalPower(s, players, getPower));
  return Math.max(...totals) - Math.min(...totals);
}
