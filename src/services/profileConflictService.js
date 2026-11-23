import {normalizeStateId} from './stateWorkspaceService.js';

/**
 * A guarded profile write requires a server-sourced row version.
 * No fallback to upsert: an unavailable RPC must fail closed.
 * The server function is SECURITY INVOKER and respects players RLS.
 */
export async function saveProfileIfUnchanged({player,expectedUpdatedAt,stateId,client}){
 if(!client) return {persisted:false,reason:'Cloud sync unavailable'};
 if(!player?.id || !expectedUpdatedAt || !Number.isFinite(Date.parse(expectedUpdatedAt))){
  return {persisted:false,reason:'Reload this profile to obtain its server version before editing'};
 }
 const {data,error}=await client.rpc('update_player_if_unchanged',{
  p_state_id:normalizeStateId(stateId),
  p_id:String(player.id),
  p_expected_updated_at:expectedUpdatedAt,
  p_alliance_tag:player.allianceTag||'',
  p_data:player
 });
 if(error)return {persisted:false,reason:'Guarded save unavailable or denied',error:error.message};
 const result=Array.isArray(data)?data[0]:data;
 if(result?.status!=='saved'||!result.server_updated_at)
  return {persisted:false,conflict:true,reason:'Profile changed, was removed, or you lack permission. Reload before retrying.'};
 return {persisted:true,serverUpdatedAt:result.server_updated_at};
}

/**
 * Fetch the authoritative row version. A profileLastUpdated timestamp inside
 * player JSON is NOT an acceptable substitute for the database updated_at.
 */
export async function loadPlayerVersion({playerId,stateId,client}){
 if(!client)return {ready:false,reason:'Cloud sync unavailable'};
 if(playerId==null||String(playerId).trim()==='')return {ready:false,reason:'Missing player ID'};
 const {data,error}=await client.from('players').select('updated_at,data')
   .eq('state_id',normalizeStateId(stateId)).eq('id',String(playerId)).maybeSingle();
 if(error)return {ready:false,reason:'Unable to verify player version',error:error.message};
 if(!data?.updated_at)return {ready:false,reason:'Player is unavailable or you lack permission'};
 if(!Number.isFinite(Date.parse(data.updated_at)))return {ready:false,reason:'Invalid server version'};
 return {ready:true,updatedAt:data.updated_at,player:data.data};
}
