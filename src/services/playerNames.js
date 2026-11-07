// Keep a chosen nickname separate from names recorded by game refreshes.
export function pastPlayerNames(player) {
  const names = [...(player.pastUsernames || [])];
  for (const entry of player.observationHistory || []) {
    if (entry.stream !== 'profile') continue;
    names.push(entry.values?.username);
    for (const change of entry.changes || []) if (change.field === 'username') names.push(change.before, change.after);
  }
  const current = String(player.username || '').trim().toLocaleLowerCase();
  const seen = new Set([current]);
  return names.filter(value => typeof value === 'string').map(value => value.trim()).filter(value => {
    const key = value.toLocaleLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key); return true;
  });
}
export const playerNameFields = player => [player.username, player.alias, ...pastPlayerNames(player)].filter(Boolean);
export const playerSearchFields = player => [...playerNameFields(player), player.fid];
