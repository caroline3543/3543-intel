/**
 * Calculate reliability metrics for a player across all events.
 * Returns null if the player has no event history.
 */
export function calcMetrics(player, events) {
  const today = new Date().toISOString().slice(0, 10);
  const snaps = (events || []).filter(ev => ev.date && ev.date <= today).flatMap(ev =>
    (ev.snapshots || []).filter(s => s.playerId === player.id)
  );
  if (!snaps.length) return null;

  const attended  = snaps.filter(s => s.attendance.attended === true);
  const noShows   = snaps.filter(s => s.attendance.noShow);
  const voiceOn   = snaps.filter(s => s.voice.joined === true);
  const rogue     = snaps.filter(s => s.combat.wentRogue);

  const ap = Math.round((attended.length / snaps.length) * 100);
  const vp = Math.round((voiceOn.length  / snaps.length) * 100);

  const sorted = [...snaps].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  let streak = 0;
  for (const s of sorted) { if (s.attendance.attended === true) streak++; else break; }

  let consecutiveMisses = 0;
  for (const s of sorted) {
    if (s.attendance.attended === false || s.attendance.noShow) consecutiveMisses++;
    else break;
  }

  const reliabilityScore = Math.round(
    ap * 0.5 +
    vp * 0.2 +
    Math.max(0, 100 - rogue.length * 20) * 0.2 +
    Math.max(0, 100 - noShows.length * 10) * 0.1
  );

  return {
    totalEvents:       snaps.length,
    attended:          attended.length,
    noShows:           noShows.length,
    late:              snaps.filter(s => s.attendance.late).length,
    voiceCount:        voiceOn.length,
    attendancePct:     ap,
    voicePct:          vp,
    streak,
    consecutiveMisses,
    reliabilityScore,
    wentRogue:         rogue.length,
  };
}

/**
 * Auto-suggest players ranked by suitability for a given requirement set.
 */
export function autoSuggestPlayers(players, events, requirements = {}) {
  const {
    heroes = [],
    minFurnace = 0,
    requireDiscord = false,
    requireAvailable = true,
    minReliability = 0,
    roles = [],
    allianceTags = [],
  } = requirements;

  return players
    .map(player => {
      const metrics = calcMetrics(player, events);
      let score = 0;
      const reasons = [], missing = [];

      if (allianceTags.length > 0 && !allianceTags.includes(player.allianceTag)) return null;

      // Hero match — reads from joinerHeroes (single source of truth)
      if (heroes.length > 0) {
        const playerJoiners = (player.joinerHeroes || [])
          .filter(jh => jh.skillLevel >= 5)
          .map(jh => jh.hero);
        const owned = heroes.filter(h => playerJoiners.includes(h));
        if (owned.length === heroes.length) {
          score += 30; reasons.push(`Has ${owned.join(', ')} at Skill 5`);
        } else if (owned.length > 0) {
          score += 10; reasons.push(`Has ${owned.join(', ')}`);
          missing.push(`Missing: ${heroes.filter(h => !playerJoiners.includes(h)).join(', ')}`);
        } else {
          missing.push(`Missing heroes: ${heroes.join(', ')}`);
        }
      }

      if (player.availability?.present === 'available') {
        score += 20; reasons.push('Available');
      } else if (requireAvailable) {
        missing.push('Not available');
      }

      if (player.availability?.discord === 'yes') {
        score += 15; reasons.push('On Discord');
      } else if (requireDiscord) {
        missing.push('Discord not confirmed');
      }

      if (minFurnace > 0) {
        if ((player.furnaceLevel || 0) >= minFurnace) {
          score += 10; reasons.push(`FC${player.furnaceLevel}`);
        } else {
          missing.push(`FC${minFurnace}+ required`);
        }
      }

      if (roles.length > 0) {
        const hasRole = roles.some(r => player.roles?.includes(r));
        if (hasRole) {
          score += 15;
          reasons.push(`Role: ${player.roles?.filter(r => roles.includes(r)).join(', ')}`);
        } else {
          missing.push('Role not set');
        }
      }

      if (metrics) {
        if (metrics.reliabilityScore >= minReliability) {
          score += Math.round(metrics.reliabilityScore / 10);
          reasons.push(`Reliability: ${metrics.reliabilityScore}`);
        } else {
          missing.push('Reliability too low');
        }
        if (metrics.streak >= 3) { score += 5; reasons.push(`${metrics.streak} event streak`); }
      } else {
        missing.push('No event history');
      }

      return { player, score: Math.min(100, Math.round(score)), reasons, missing };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);
}
