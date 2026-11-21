const MAX_PROVIDER_AGE_MS = 60 * 60 * 1000;

export function providerObservationTime(value, now = Date.now()) {
  const unix = typeof value === 'number' || (typeof value === 'string' && /^\d{10,13}$/.test(value));
  const number = unix ? Number(value) : NaN;
  const milliseconds = unix
    ? (number < 1e12 ? number * 1000 : number)
    : (typeof value === 'string' ? Date.parse(value) : NaN);
  if (!Number.isFinite(milliseconds) || milliseconds > now || now - milliseconds > MAX_PROVIDER_AGE_MS) {
    throw Error('Provider membership observation is stale or invalid');
  }
  return new Date(milliseconds).toISOString();
}

export function verifiedProviderUsage(response) {
  const payload = response?.data ?? response;
  if (payload?.ok !== true ||
      !validUsageBucket(payload.minute, 60) || !validUsageBucket(payload.daily, 5000)) {
    throw Error('Unverified provider usage response');
  }
  return {used: payload.daily.used, minuteUsed: payload.minute.used};
}

function validUsageBucket(bucket, limit) {
  return bucket?.limit === limit && Number.isSafeInteger(bucket.used) &&
    bucket.used >= 0 && bucket.used <= limit && bucket.remaining === limit - bucket.used;
}

/**
 * Interpret a player lookup conservatively. An absent alliance field is not
 * equivalent to an explicitly null alliance. Cached observations must be fresh.
 */
export function verifiedPlayerLocation(response, expectedFid, now=Date.now()) {
  const payload=response?.data??response;
  if(payload?.fresh!==true || payload.ok===false || payload.pending===true)throw Error('Provider has not confirmed a fresh player profile');
  const base=payload?.player;
  const fid=String(base?.chief_id??base?.fid??payload?.chief_id??'');
  if(!base || fid!==String(expectedFid))throw Error('Player ID mismatch or missing player profile');
  const state=String(base.kid??payload?.kid??'').trim();
  if(!/^[1-9][0-9]*$/.test(state))throw Error('API did not confirm player state');
  if(!Object.prototype.hasOwnProperty.call(base,'alliance'))throw Error('API omitted alliance membership');
  const alliance=base.alliance;
  const tag=alliance===null?'':typeof alliance?.abbr==='string'&&alliance.abbr.trim()?alliance.abbr.trim():null;
  if(tag===null)throw Error('API did not explicitly confirm alliance membership');
  if(!/^[A-Za-z0-9_]{0,20}$/.test(tag))throw Error('API alliance tag has invalid characters');
  const observedAt=base.cached_at??payload?.cached_at??payload?.meta?.cached_at??null;
  if(!observedAt)throw Error('API did not provide a verifiable observation timestamp');
  const at=providerObservationTime(observedAt,now);
  return {status:'verified',fresh:true,fid,state,tag,at,source:'whiteoutstats-player'};
}
