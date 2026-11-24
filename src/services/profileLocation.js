const coordinate = value => (typeof value === 'string' && value.trim() !== '' || typeof value === 'number') &&
  Number.isInteger(Number(value)) && Number(value) >= 0 && Number(value) <= 1199;

export function lastProfileLocation(player) {
  const details = player.providerDetails;
  const raw = details?.raw?.player;
  const fid = String(player.fid ?? '');
  // The individual profile payload is a single observation. The roster raw
  // object merges partial responses, so its latest timestamp may date other fields.
  const rawIds = [raw?.chief_id,raw?.fid,details?.raw?.chief_id,details?.fid].filter(value => value != null);
  const rawMatches = raw && fid && rawIds.length && rawIds.every(value => String(value) === fid) &&
    String(raw?.kid ?? details?.stateId) === '3573' && String(details?.stateId ?? '3573') === '3573';
  const provider = player.providerStats?.locationObservation;
  return [
    player.lastKnownLocation,
    provider && String(provider.fid) === fid && String(provider.stateId) === '3573'
      ? {...provider,observedAt:provider.cachedAt || provider.observedAt} : null,
    rawMatches ? {x:raw.x,y:raw.y,observedAt:details.cachedAt ?? details.raw.cached_at} : null,
  ].filter(entry => entry && coordinate(entry.x) && coordinate(entry.y))
    .sort((a,b) => (Date.parse(b.observedAt) || 0) - (Date.parse(a.observedAt) || 0))[0] ?? null;
}
