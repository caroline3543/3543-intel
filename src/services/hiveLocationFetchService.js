import {reportedLocation} from './hiveIntegrationService.js';
// Save a location observation separately, without changing profile stats or source dates.
export function applyHiveLocation(player,response,stateId){
 const body=response?.data,raw=body?.player;
 if(!body || body.ok===false || !raw || String(raw.kid)!==String(stateId))throw Error('Missing profile or different state. Previous location kept.');
 const ids=[body.chief_id,raw.chief_id,raw.fid].filter(v=>v!=null && v!=='');
 if(!ids.length || ids.some(id=>String(id)!==String(player.fid).trim()))throw Error('Different or missing player ID. Previous location kept.');
 const at=Date.parse(response.retrieved_at);
 if(!Number.isFinite(at))throw Error('Missing retrieval time. Previous location kept.');
 const valid=v=>['string','number'].includes(typeof v) && String(v).trim()!=='' && Number.isInteger(Number(v)) && Number(v)>=0 && Number(v)<=1199;
 if(!valid(raw.x)||!valid(raw.y))return null;
 const previous=reportedLocation(player,stateId);
 if(previous && Date.parse(previous.retrievedAt)>at)return null;
 if(player.providerStats?.stateId && String(player.providerStats.stateId)!==String(stateId))throw Error('Saved profile belongs to another state. Previous location kept.');
 return {...player,providerStats:{...player.providerStats,stateId:String(stateId),locationObservation:{stateId:String(stateId),fid:String(player.fid).trim(),kid:Number(stateId),x:Number(raw.x),y:Number(raw.y),retrievedAt:new Date(at).toISOString(),cachedAt:body.cached_at || null}}};
}
// Dependencies are injected so cancellation, partial failures and preservation are testable.
export async function fetchHiveLocations({roster,request,getPlayers,save,active,onProgress}){
 const result={total:roster.players.length,done:0,saved:0,missing:0,failed:[],stopped:false};
 onProgress({...result});
 for(const target of roster.players){
  if(!active()){result.stopped=true;break}
  let halt=false;
  try{
   const response=await request('player',{fid:target.fid});
   if(!active()){result.stopped=true;break}
   const matches=getPlayers().filter(p=>String(p.fid || '').trim()===target.fid);
   const player=matches.length===1 && matches[0].id===target.id && matches[0].allianceTag===roster.alliance?matches[0]:null;
   if(!player)throw Error('Player changed or was removed. Nothing saved.');
   const updated=applyHiveLocation(player,response,roster.stateId);
   if(updated){save(updated);result.saved++}else result.missing++;
  }catch(error){
   if(!active()){result.stopped=true;break}
   result.failed.push({fid:target.fid,name:target.name,message:error.message || 'Location request failed'});
   // Stop immediately on authentication/quota errors; never retry automatically.
   halt=[401,403,429].includes(error.status)||[401,403,429].includes(error.providerStatus)||/sign.in|required|not configured|HTTP (401|403|429)/i.test(error.message || '');
  }
  result.done++;onProgress({...result,failed:[...result.failed]});
  if(halt){result.stopped=true;break}
 }
 if(!active())result.stopped=true;
 onProgress({...result,failed:[...result.failed]});return result;
}
