/**
 * Evaluate whether a Whiteout Stats alliance response can be used as an
 * authoritative current-membership snapshot. Never infer departures from
 * a partial response or an unsuccessful lookup.
 */
export function assessAllianceRoster(response, {stateId, allianceTag, capacity=100}={}) {
  const members=response?.data?.members;
  const problems=[];
  if (!Array.isArray(members)) problems.push('missing_members');
  const rows=Array.isArray(members)?members:[];
  const ids=new Set();
  for (const member of rows) {
    const fid=String(member?.chief_id ?? member?.fid ?? member?.governor_id ?? '').trim();
    if (!/^\d+$/.test(fid)) problems.push('invalid_fid');
    else if(ids.has(fid)) problems.push('duplicate_fid');
    else ids.add(fid);
    if (member?.kid != null && String(member.kid)!==String(stateId)) problems.push('wrong_member_state');
  }
  if(response?.data?.alliance?.kid != null && String(response.data.alliance.kid)!==String(stateId)) problems.push('wrong_alliance_state');
  const returnedTag=response?.data?.alliance?.tag ?? response?.data?.alliance?.alliance_tag;
  if(returnedTag && allianceTag && String(returnedTag).toUpperCase()!==String(allianceTag).toUpperCase()) problems.push('wrong_alliance');
  if(ids.size>capacity) problems.push('over_capacity');
  // Provider does not currently promise that members[] is exhaustive.
  // A successful HTTP response alone is NOT proof of a complete roster.
  const completenessConfirmed=response?.data?.complete===true || response?.data?.is_complete===true;
  if(!completenessConfirmed) problems.push('completeness_unverified');
  const uniqueProblems=[...new Set(problems)];
  return {
    stateId:String(stateId??''), allianceTag:String(allianceTag??''),
    returnedCount:rows.length, uniqueFidCount:ids.size,
    complete:completenessConfirmed, authoritative:uniqueProblems.length===0,
    problems:uniqueProblems,
    // Returned members may be individually observed; absent players must
    // not be marked departed unless authoritative === true.
    observedFids:[...ids]
  };
}
