// Stable profile section IDs. Display labels and visual groupings may change without
// invalidating saved preferences. Preserve all eleven approved sections.
export const PROFILE_SECTION_IDS = Object.freeze([
  'event-power','troop-tiers','quick-statistics','previous-usernames',
  'alliance-movements','hero-pet-expert-power','joiner-heroes',
  'teamwork','officer-notes','last-known-location','more'
]);

export function normalizeProfileSectionOrder(value) {
  const requested = Array.isArray(value) ? value : [];
  const known = new Set(PROFILE_SECTION_IDS);
  const ordered = [];
  for (const id of requested) {
    if (typeof id === 'string' && known.has(id) && !ordered.includes(id)) ordered.push(id);
  }
  return [...ordered, ...PROFILE_SECTION_IDS.filter(id => !ordered.includes(id))];
}

export function moveProfileSection(order, id, direction) {
  const result = normalizeProfileSectionOrder(order);
  const from = result.indexOf(id);
  const to = from + direction;
  if (from < 0 || !Number.isInteger(direction) || Math.abs(direction) !== 1 || to < 0 || to >= result.length) return result;
  [result[from], result[to]] = [result[to], result[from]];
  return result;
}
