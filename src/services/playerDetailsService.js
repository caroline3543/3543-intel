import {normalizeStateId} from './stateWorkspaceService.js';
import {mergeAllianceProfiles,allianceRows} from './allianceImportService.js';
import {rankingProfileUpdates} from './stateRankingsService.js';
const own=(obj,key)=>Object.prototype.hasOwnProperty.call(obj || {},key);
function section(body,base,key){return own(body,key)?body[key]:own(base,key)?base[key]:undefined;}
export function normalizePlayerDetails(response,player,state){
  const stateId=normalizeStateId(state),body=response?.data,base=body?.player;
  if(!body || body.ok===false || !base || typeof base!=='object')throw new Error('Provider did not return a player profile.');
  if(String(base.kid ?? body.kid ?? '')!==stateId)throw new Error('This player belongs to a different state. Nothing was changed.');
  const ids=[body.chief_id,base.chief_id,base.fid].filter(v=>v!=null && v!=='').map(String);
  if(!ids.length || ids.some(id=>id!==String(player.fid).trim()))throw new Error('Provider returned a different or missing chief ID. Nothing was changed.');
  const at=response.retrieved_at;
  if(!at || !Number.isFinite(Date.parse(at)))throw new Error('Provider response is missing a valid retrieval time.');
  const heroes=section(body,base,'heroes'),chief=section(body,base,'chief_gear'),ranks=section(body,base,'ranks');
  if(heroes!=null && !Array.isArray(heroes))throw new Error('Unrecognised heroes response. Existing data was kept.');
  if(chief!=null && (typeof chief!=='object' || Array.isArray(chief) || (!chief.hidden && !Array.isArray(chief.items))))throw new Error('Unrecognised chief equipment response. Existing data was kept.');
  const previous=player.providerDetails;
  const retained=previous?.stateId===stateId && previous?.fid===String(player.fid).trim()?previous:{};
  const details={...retained,stateId,fid:String(player.fid).trim(),retrievedAt:new Date(at).toISOString(),cachedAt:body.cached_at || null,raw:structuredClone(body)};
  if(heroes!=null)details.heroes={items:structuredClone(heroes),retrievedAt:details.retrievedAt};
  if(chief!=null)details.chiefGear={...structuredClone(chief),items:chief.hidden?[]:structuredClone(chief.items || []),retrievedAt:details.retrievedAt};
  if(ranks!=null && typeof ranks==='object' && !Array.isArray(ranks))details.ranks=structuredClone(ranks);
  return {details,base,ranks,at:details.retrievedAt};
}
export function applyPlayerDetails(player,response,state){
  const {details,base,ranks,at}=normalizePlayerDetails(response,player,state);
  const member={...base,chief_id:player.fid,alliance_rank_label:base.alliance?.rank_label ?? base.alliance_rank_label,alliance_rank:base.alliance?.rank ?? base.alliance_rank};
  const tag=typeof base.alliance?.abbr==='string'?base.alliance.abbr:player.allianceTag || '';
  const rows=allianceRows({retrieved_at:at,data:{members:[member]}},String(state),tag);
  let updated=mergeAllianceProfiles([player],rows,String(state)).updated[0];
  if(!updated)throw new Error('Unable to match this player. Nothing was changed.');
  updated={...updated,providerDetails:details};
  for(const [board,scoreKey,rankKey] of [['personal_power','power','power_rank'],['kills','kills','kills_rank'],['furnace','furnace_level','furnace_rank'],['state_transfer','state_transfer_score','state_transfer_rank'],['labyrinth','labyrinth','labyrinth_rank']]){
    const rank=ranks?.[rankKey],score=ranks?.[scoreKey];
    if(score==null || score==='' || !Number.isInteger(Number(rank)) || Number(rank)<1)continue;
    const result={stateId:String(state),board,retrievedAt:at,cachedAt:details.cachedAt,rows:[{fid:String(player.fid).trim(),rank:Number(rank),score,scoreLabel:null}]};
    updated=rankingProfileUpdates([updated],result,String(state))[0] || updated;
  }
  return updated;
}
export function heroStars(hero){
  if(typeof hero.star_label==='string' && hero.star_label)return hero.star_label;
  if(['string','number'].includes(typeof hero.stars) && String(hero.stars).trim()!=='' && Number.isFinite(Number(hero.stars)) && Number(hero.stars)>=0 && Number(hero.stars)<=5)return String(hero.stars);
  if(['string','number'].includes(typeof hero.star) && String(hero.star).trim()!=='' && Number.isFinite(Number(hero.star)) && Number(hero.star)>=0 && Number(hero.star)<=5)return String(hero.star);
  return null;
}
