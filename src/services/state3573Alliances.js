export const PRIORITY_ALLIANCES = Object.freeze(['ARC', 'HOT', 'RKG', 'WAR', 'LUN']);

export function state3573AllianceTags(players = []) {
  const tags = new Set(players
    .filter(player => player.membershipStatus !== 'transferred_out')
    .map(player => player.allianceTag).filter(Boolean));
  for (const tag of PRIORITY_ALLIANCES) tags.delete(tag);
  return [...PRIORITY_ALLIANCES, ...[...tags].sort((a, b) => a.localeCompare(b))];
}
