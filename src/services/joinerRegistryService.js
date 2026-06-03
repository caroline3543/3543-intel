/**
 * joinerRegistryService
 *
 * All reads and writes go through player.joinerHeroes = [
 *   { hero, skillLevel, verified, updatedAt }
 * ]
 *
 * This is the SINGLE SOURCE OF TRUTH for hero ownership.
 */

/**
 * Add a hero at Skill 5 to a player's joinerHeroes array.
 * Prevents duplicates. Returns updated player object (does not mutate).
 */
export function addJoinerHeroToPlayer(player, heroName) {
  const existing = (player.joinerHeroes || []);
  const already = existing.find(jh => jh.hero === heroName);
  if (already) {
    // Update verified + timestamp but keep existing entry
    return {
      ...player,
      joinerHeroes: existing.map(jh =>
        jh.hero === heroName
          ? { ...jh, skillLevel: 5, verified: true, updatedAt: new Date().toISOString() }
          : jh
      ),
      profileLastUpdated: new Date().toISOString(),
    };
  }
  return {
    ...player,
    joinerHeroes: [
      ...existing,
      { hero: heroName, skillLevel: 5, verified: true, updatedAt: new Date().toISOString() },
    ],
    profileLastUpdated: new Date().toISOString(),
  };
}

/**
 * Remove a hero from a player's joinerHeroes array.
 * Returns updated player object.
 */
export function removeJoinerHeroFromPlayer(player, heroName) {
  return {
    ...player,
    joinerHeroes: (player.joinerHeroes || []).filter(jh => jh.hero !== heroName),
    profileLastUpdated: new Date().toISOString(),
  };
}

/**
 * Get all players who own a specific hero at Skill 5.
 */
export function getPlayersWithJoinerHero(players, heroName) {
  return players.filter(p =>
    (p.joinerHeroes || []).some(jh => jh.hero === heroName && jh.skillLevel >= 5)
  );
}

/**
 * Get a count map { heroName: count } for all tracked joiner heroes.
 */
export function getJoinerHeroCounts(players, heroList) {
  const counts = {};
  heroList.forEach(h => { counts[h] = 0; });
  players.forEach(p => {
    (p.joinerHeroes || []).forEach(jh => {
      if (jh.skillLevel >= 5 && counts[jh.hero] !== undefined) {
        counts[jh.hero]++;
      }
    });
  });
  return counts;
}

/**
 * Get all Skill 5 hero names for a single player.
 */
export function getPlayerJoiners(player) {
  return (player.joinerHeroes || [])
    .filter(jh => jh.skillLevel >= 5)
    .map(jh => jh.hero);
}
