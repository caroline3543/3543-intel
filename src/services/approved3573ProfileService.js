/**
 * Development-only client adapter for the explicitly approved State 3573
 * organiser RPCs. Not wired into production until isolated auth tests pass.
 * Never falls back to direct players UPDATE or upsert.
 */
const ALLOWED_FIELDS=new Set(['notes','joinerHeroes','teamworkTraitStates','communicationLanguage']);
const STATE='3573';

export async function readApproved3573Profile({playerId,stateId,client}){
 if(String(stateId)!==STATE)return {ready:false,reason:'Organiser editing is limited to State 3573'};
 if(!client?.rpc)return {ready:false,reason:'Cloud authentication unavailable'};
 if(playerId==null||!String(playerId).trim())return {ready:false,reason:'Missing player ID'};
 const {data,error}=await client.rpc('read_3573_profile_for_edit',{p_id:String(playerId)});
 if(error)return {ready:false,reason:'Profile read unavailable or not authorised',error:error.message};
 const row=Array.isArray(data)?data[0]:data;
 if(!row?.updated_at||!Number.isFinite(Date.parse(row.updated_at))||!row.data||typeof row.data!=='object'||Array.isArray(row.data)||String(row.data.id)!==String(playerId))
  return {ready:false,reason:'Profile unavailable or invalid server version'};
 return {ready:true,updatedAt:row.updated_at,allianceTag:row.alliance_tag??'',player:row.data};
}

export async function saveApproved3573Profile({snapshot,changes,expectedFields,stateId,client}){
 if(String(stateId)!==STATE)return {persisted:false,reason:'Organiser editing is limited to State 3573'};
 if(!client?.rpc)return {persisted:false,reason:'Cloud authentication unavailable'};
 if(!snapshot?.ready||!snapshot.player?.id||!snapshot.updatedAt||!Number.isFinite(Date.parse(snapshot.updatedAt)))
  return {persisted:false,reason:'Reload the server profile before saving'};
 if(!changes||typeof changes!=='object'||Array.isArray(changes)||!Object.keys(changes).length||Object.keys(changes).some(key=>!ALLOWED_FIELDS.has(key)))
  return {persisted:false,reason:'Unsupported or empty profile changes'};
 if(!expectedFields||typeof expectedFields!=='object'||Array.isArray(expectedFields))
  return {persisted:false,reason:'Original field values required'};
 for(const key of Object.keys(changes)){
  if(!Object.hasOwn(expectedFields,key)||JSON.stringify(expectedFields[key]??null)!==JSON.stringify(snapshot.player[key]??null))
   return {persisted:false,conflict:true,reason:'This field changed since editing began'};
 }
 const {data,error}=await client.rpc('update_3573_profile_fields',{
  p_id:String(snapshot.player.id),
  p_expected_updated_at:snapshot.updatedAt,
  p_expected_alliance_tag:snapshot.allianceTag??'',
  p_changes:changes
 });
 if(error)return {persisted:false,reason:'Profile save unavailable or not authorised',error:error.message};
 const result=Array.isArray(data)?data[0]:data;
 if(result?.status!=='saved'||!result.server_updated_at)
  return {persisted:false,conflict:true,reason:'Profile changed or permission was denied. Reload before retrying'};
 return {persisted:true,serverUpdatedAt:result.server_updated_at,player:{...snapshot.player,...changes}};
}
