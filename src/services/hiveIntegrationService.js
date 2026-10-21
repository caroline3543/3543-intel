// The planner receives a minimal roster, never authentication or provider payloads.
export function reportedLocation(player,stateId){
 const observation=player.providerStats?.locationObservation;
 const sources=[{raw:observation,state:observation?.stateId,at:observation?.retrievedAt},{raw:player.providerDetails?.raw?.player,state:player.providerDetails?.stateId,at:player.providerDetails?.retrievedAt},{raw:player.providerStats?.raw,state:player.providerStats?.stateId,at:player.providerStats?.retrievedAt}];
 for(const source of sources.sort((a,b)=>(Date.parse(b.at)||0)-(Date.parse(a.at)||0))){
  if(String(source.state)!==String(stateId) || (source.raw?.kid!=null && String(source.raw.kid)!==String(stateId)))continue;
  const ids=[source.raw?.chief_id,source.raw?.fid].filter(v=>v!=null && v!=='');
  if(ids.some(id=>String(id)!==String(player.fid)))continue;
  const {x,y}=source.raw || {};
  const valid=v=>['string','number'].includes(typeof v) && String(v).trim()!=='' && Number.isInteger(Number(v)) && Number(v)>=0 && Number(v)<=1199;
  if(valid(x)&&valid(y))return {x:Number(x),y:Number(y),retrievedAt:source.at || null};
 }
 return null;
}
export function hiveRoster(players,stateId,alliance){
 if(!/^\d{1,5}$/.test(String(stateId)) || Number(stateId)<1 || typeof alliance!=='string' || !alliance.trim() || alliance.length>20)throw Error('Choose a state and alliance first.');
 const selected=players.filter(p=>p.allianceTag===alliance),counts=new Map();
 selected.forEach(p=>{const fid=String(p.fid || '').trim();if(fid)counts.set(fid,(counts.get(fid)||0)+1)});
 return {version:1,stateId:String(stateId),alliance,players:selected.filter(p=>/^\d+$/.test(String(p.fid||'').trim())&&counts.get(String(p.fid).trim())===1).map(p=>({id:String(p.id),fid:String(p.fid).trim(),name:String(p.username || p.alias || p.fid),furnace:p.furnaceLevel || null,location:reportedLocation(p,stateId)})),excluded:selected.filter(p=>!/^\d+$/.test(String(p.fid||'').trim()) || counts.get(String(p.fid).trim())!==1).length};
}
export function locationBounds(players){
 const located=players.filter(p=>p.location);
 if(!located.length)return{x:0,y:0,w:100,h:100};
 const xs=located.map(p=>p.location.x),ys=located.map(p=>p.location.y);
 const x=Math.min(...xs)-5,y=Math.min(...ys)-5;
 return{x,y,w:Math.max(20,Math.max(...xs)-x+7),h:Math.max(20,Math.max(...ys)-y+7)};
}
