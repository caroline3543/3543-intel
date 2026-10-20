export function playerDetailsPath(state,fid){
  if(!['string','number'].includes(typeof state))return null;
  const kid=Number(state),id=String(fid ?? '');
  if(!Number.isSafeInteger(kid) || kid<1 || kid>99999 || !/^[1-9]\d{3,14}$/.test(id))return null;
  return `/players/${id}?include=base,heroes,ranks,chief_gear`;
}
