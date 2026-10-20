export function normalizeAvatarUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (!['https:','http:'].includes(url.protocol) || url.username || url.password) return null;
    return url.href;
  } catch { return null; }
}
export function playerAvatarUrl(player) {
  for (const candidate of [player?.avatarUrl, player?.providerStats?.avatarUrl, player?.providerStats?.raw?.avatar_url]) {
    const url = normalizeAvatarUrl(candidate);
    if (url) return url;
  }
  return null;
}
