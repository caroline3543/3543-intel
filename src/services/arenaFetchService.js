import {normalizePlayerDetails} from './playerDetailsService.js';
// Comparison-only profile. Never added to or saved over the Members roster.
export function arenaFetchedPlayer(response,fid,stateId){
 const id=String(fid || '').trim();
 if(!/^[1-9]\d{3,14}$/.test(id))throw Error('Enter a valid in-game player ID.');
 const seed={id:`arena-fetched-${id}`,fid:id};
 const {details,base}=normalizePlayerDetails(response,seed,stateId);
 if(!details.heroes?.items?.some(h=>h && typeof h==='object' && (h.id!=null || h.hero_id!=null)))throw Error('No Arena defence heroes were returned. Previous lineup kept.');
 return {...seed,username:base.nick_name || id,allianceTag:base.alliance?.abbr || '',providerDetails:details};
}
export async function requestArenaPlayer({fid,stateId,request,active}){
 const id=String(fid || '').trim();
 if(!/^[1-9]\d{3,14}$/.test(id))throw Error('Enter a valid in-game player ID.');
 const response=await request('player_details',{state:Number(stateId),fid:id});
 if(!active())return null;
 return arenaFetchedPlayer(response,id,stateId);
}
