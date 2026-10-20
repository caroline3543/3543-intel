import {newPlayerObservation} from '../data/playerSchema.js';
import {providerProfilePatch} from './providerProfileService.js';
export const HISTORY_LIMIT=200;
export const PROFILE_HISTORY_FIELDS=['username','allianceTag','power','kills','furnaceLevel'];
const validDate=value=>typeof value==='string' && Number.isFinite(Date.parse(value));
function hash(value){let n=2166136261;for(const ch of value)n=Math.imul(n^ch.charCodeAt(0),16777619);return (n>>>0).toString(36);}
function clean(values){return Object.fromEntries(Object.entries(values).filter(([,v])=>v!=null && v!=='' && ['string','number'].includes(typeof v) && (typeof v!=='number' || Number.isFinite(v))).sort(([a],[b])=>a.localeCompare(b)));}
function observation(stateId,stream,observedAt,values,fields,changes=[],baseline=false){
  observedAt=new Date(observedAt).toISOString();
  const id=`${stateId}:${stream}:${observedAt}:${hash(JSON.stringify({values,fields}))}`;
  return newPlayerObservation({id,stateId:String(stateId),stream,observedAt,values,fields,changes,baseline});
}
export function mergeObservationHistory(left=[],right=[]){
  const map=new Map();
  for(const entry of [...left,...right])if(entry?.id && validDate(entry.observedAt) && entry.values && typeof entry.values==='object')map.set(entry.id,entry);
  return [...map.values()].sort((a,b)=>Date.parse(a.observedAt)-Date.parse(b.observedAt) || a.id.localeCompare(b.id)).slice(-HISTORY_LIMIT);
}
export function playerObservations(player,stateId){
  let history=mergeObservationHistory(player?.observationHistory || []);
  if(history.length)return history.filter(e=>String(e.stateId)===String(stateId));
  // Seed only dated source data already saved, never invent older measurements.
  const stats=player?.providerStats;
  if(stats && String(stats.stateId)===String(stateId) && validDate(stats.retrievedAt)){
    const patch=providerProfilePatch(stats);
    const values=clean(Object.fromEntries(PROFILE_HISTORY_FIELDS.filter(k=>patch[k]!=null).map(k=>[k,patch[k]])));
    if(Object.keys(values).length)history.push(observation(stateId,'profile',stats.retrievedAt,values,Object.keys(values),[],true));
  }
  for(const [board,row] of Object.entries(player?.providerRankings || {})){
    if(String(row?.stateId)!==String(stateId) || !validDate(row.retrievedAt))continue;
    const values=clean({score:row.score,rank:row.rank});
    if(Object.keys(values).length)history.push(observation(stateId,`ranking:${board}`,row.retrievedAt,values,Object.keys(values),[],true));
  }
  return mergeObservationHistory(history);
}
export function recordPlayerObservation(previous,next,{stateId,stream,observedAt,values}){
  const history=playerObservations(previous,stateId);
  if(!validDate(observedAt))return {...next,observationHistory:history};
  observedAt=new Date(observedAt).toISOString();
  const supplied=clean(values),fields=Object.keys(supplied);
  if(!fields.length)return {...next,observationHistory:history};
  const last=[...history].reverse().find(entry=>entry.stream===stream);
  // Late cached responses cannot rewrite the recorded sequence.
  if(last && Date.parse(observedAt)<Date.parse(last.observedAt))return {...next,observationHistory:history};
  const changes=last?fields.filter(key=>last.values[key]!=null && last.values[key]!==supplied[key]).map(field=>({field,before:last.values[field],after:supplied[field]})):[];
  const allValues={...last?.values,...supplied};
  const sameDay=last && new Date(last.observedAt).toISOString().slice(0,10)===observedAt.slice(0,10);
  if(last && sameDay && !changes.length && JSON.stringify(clean(last.values))===JSON.stringify(clean(allValues)) && fields.every(key=>last.fields?.includes(key)))return {...next,observationHistory:history};
  const entry=observation(stateId,stream,observedAt,allValues,fields,changes,!last);
  return {...next,observationHistory:mergeObservationHistory(history,[entry])};
}
