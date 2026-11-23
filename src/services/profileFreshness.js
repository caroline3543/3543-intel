// A successful membership observation is distinct from a profile edit, an
// attempted lookup, and a provider's cached response timestamp.
export function validTimestamp(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}
export function dataFreshness(value, recordedAt, now = Date.now(), staleAfterDays = 30) {
  if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) {
    return {status:'missing', label:'Not recorded'};
  }
  const recorded = validTimestamp(recordedAt);
  if (recorded === null || recorded > now) return {status:'unknown',label:'Recording date unavailable'};
  const ageDays = Math.floor((now - recorded) / 86400000);
  if (ageDays > staleAfterDays) return {status:'stale',label:`Recorded ${ageDays}d ago · Outdated`};
  if (ageDays === 0) return {status:'current',label:'Recorded today'};
  return {status:'current',label:`Recorded ${ageDays}d ago`};
}
export function membershipFreshness(player, now = Date.now()) {
  const recorded = validTimestamp(player?.membershipLastSuccessfulAt);
  if (recorded === null || recorded > now) return {status:'unknown',label:'Membership not verified'};
  const hours = Math.floor((now - recorded)/3600000);
  return {status:hours>=48?'stale':'current',label:hours<1?'Verified less than 1h ago':hours<48?`Verified ${hours}h ago`:`Last verified ${Math.floor(hours/24)}d ago`};
}
