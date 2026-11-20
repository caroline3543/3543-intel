/**
 * Interpret a player lookup conservatively. An absent alliance field is not
 * equivalent to an explicitly null alliance. Cached observations must be fresh.
 */
export function verifiedPlayerLocation(response, expectedFid, now=Date.now()) {
  const base=response?.data?.player;
  const fid=String(base?.chief_id??base?.fid??response?.data?.chief_id??'');
  if(!base || fid!==String(expectedFid))throw Error('Player ID mismatch or missing player profile');
  const state=String(base.kid??response?.data?.kid??'').trim();
  if(!/^\d+$/.test(state))throw Error('API did not confirm player state');
  if(!Object.prototype.hasOwnProperty.call(base,'alliance'))throw Error('API omitted alliance membership');
  const alliance=base.alliance;
  const tag=alliance===null?'':typeof alliance?.abbr==='string'&&alliance.abbr.trim()?alliance.abbr.trim():null;
  if(tag===null)throw Error('API did not explicitly confirm alliance membership');
  const observedAt=base.cached_at??response?.data?.cached_at??response?.data?.meta?.cached_at??null;
  if(!observedAt)throw Error('API did not provide a verifiable observation timestamp');
  const observedMs=typeof observedAt==='number'?observedAt<1e12?observedAt*1000:observedAt:Date.parse(observedAt);
  if(!Number.isFinite(observedMs)||observedMs>now||now-observedMs>72*60*60*1000)throw Error('Provider membership observation is stale or invalid');
  return {status:'verified',state,tag,at:new Date(observedMs).toISOString()};
}
