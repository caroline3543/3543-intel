/** API-backed membership summary. Never label historical rows as current. */
export function membershipSummary(players, tag) {
  const relevant=players.filter(p=>String(p.allianceTag||'').toUpperCase()===String(tag||'').toUpperCase());
  const confirmed=relevant.filter(p=>p.membershipStatus==='confirmed');
  const unverified=relevant.filter(p=>p.membershipStatus!=='confirmed' && p.membershipStatus!=='not_in_roster');
  const absent=relevant.filter(p=>p.membershipStatus==='not_in_roster');
  const dates=confirmed.map(p=>Date.parse(p.membershipCheckedAt)).filter(Number.isFinite);
  return {
    confirmed:confirmed.length,
    unverified:unverified.length,
    absent:absent.length,
    snapshotTotal:relevant.length,
    verifiedAt:dates.length?new Date(Math.min(...dates)).toISOString():null,
    isComplete:unverified.length===0 && confirmed.length+absent.length===relevant.length && relevant.length>0,
  };
}
