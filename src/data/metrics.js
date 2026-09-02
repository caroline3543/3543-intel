/**
 * Calculate reliability metrics for a player across all events.
 * Returns null if the player has no qualifying event history.
 *
 * Only events that have actually HAPPENED count — determined by the
 * event's own `status` field ('active' or 'completed'), not by
 * comparing `event.date` to today's date. A date-string comparison
 * would incorrectly count an event scheduled for later TODAY as
 * already having happened the moment the calendar day starts, even
 * though it hasn't actually run yet.
 *
 * reliabilityScore is deliberately NOT influenced by Discord/voice
 * participation — whether someone was on voice doesn't reflect how
 * reliably they show up. Voice participation instead determines MVP
 * Joiner status (see isMvpJoiner below), which affects joiner
 * allocation order, not the reliability number itself. voicePct is
 * still returned for display purposes (e.g. ProfileView's stat grid).
 */
export function calcMetrics(player, events) {
  const snaps = (events || []).filter(ev => ev.status !== 'upcoming').flatMap(ev =>
    (ev.snapshots || []).filter(s => s.playerId === player.id)
  );
  if (!snaps.length) return null;

  const attended  = snaps.filter(s => s.attendance.attended === true);
  const noShows   = snaps.filter(s => s.attendance.noShow);
  const voiceOn   = snaps.filter(s => s.voice.joined === true);

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
    ap * 0.8 +
    Math.max(0, 100 - noShows.length * 10) * 0.2
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
  };
}

/**
 * MVP Joiner — true if this player has EVER joined Discord voice in a
 * real (non-upcoming) event. A binary flag, not a percentage
 * threshold: any confirmed voice participation qualifies. Used to rank
 * joiner allocation order (MVP joiners first), completely separate
 * from reliabilityScore, which no longer factors in voice at all.
 */
export function isMvpJoiner(player, events) {
  return (events || [])
    .filter(ev => ev.status !== 'upcoming')
    .some(ev => (ev.snapshots || []).some(s => s.playerId === player.id && s.voice?.joined === true));
}

/**
 * Given a recommended formation's joiner slots (already resolved to
 * their real hero alternatives — see battleConstants.js's
 * resolveHero(), which knows "Jessie*" means Jessie/Jasser/Jeronimo,
 * not literally "Jessie" with an asterisk stripped) and the current
 * roster, pick a specific roster member for each slot — weighted by
 * who owns any of that slot's acceptable heroes at Skill 5 and who's
 * currently available. Reuses autoSuggestPlayers' scoring rather than
 * duplicating it.
 *
 * Deliberately takes pre-resolved slots rather than raw formation
 * strings (formation.j1 etc.) or importing battleConstants.js itself —
 * this file is data-layer (src/data/), resolveHero() lives in the
 * battle component tree (src/components/svs/battle/), and the
 * substitution-notation parsing belongs there, not here.
 *
 * @param resolvedSlots  [{ slotLabel, heroOptions: string[] }, ...] —
 *                       heroOptions is every acceptable hero name for
 *                       that slot (e.g. ['Jessie','Jasser','Jeronimo']).
 * One player is never assigned to two slots in the same call.
 *
 * Returns one entry per slot: { player, hero, slotIndex, slotLabel,
 * score, reasons, missing }. `player` is null if no available roster
 * member owns any option in that slot.
 */
export function suggestPriorityJoiners(resolvedSlots, players, events) {
  if (!resolvedSlots?.length) return [];
  const assigned = new Set();

  return resolvedSlots.map(({ slotLabel, heroOptions }, slotIndex) => {
    let best = null;

    for (const hero of heroOptions || []) {
      const ranked = autoSuggestPlayers(players, events, { heroes: [hero], requireAvailable: true })
        .filter(c => !assigned.has(c.player.id))
        // autoSuggestPlayers only SCORES hero ownership as a bonus, it
        // never excludes non-owners — without this hard filter, the
        // "best available" candidate could be someone who simply
        // doesn't have the hero at all when nobody eligible does.
        // Never allocate a joiner nobody can actually fulfil.
        .filter(c => (c.player.joinerHeroes || []).some(jh => jh.hero === hero && jh.skillLevel >= 5));
      if (ranked.length && (!best || ranked[0].score > best.score)) {
        best = { player: ranked[0].player, hero, score: ranked[0].score, reasons: ranked[0].reasons, missing: ranked[0].missing };
      }
    }

    if (best) assigned.add(best.player.id);
    return best
      ? { ...best, slotIndex, slotLabel }
      : { player: null, hero: heroOptions?.[0] || null, slotIndex, slotLabel, score: 0, reasons: [], missing: ['No eligible attendee owns this hero'] };
  });
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
