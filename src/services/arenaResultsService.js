import {normalizeStateId} from './stateWorkspaceService.js';
export const arenaResultsKey=stateId=>`svs_arena_results_v1:state:${normalizeStateId(stateId)}`;
const validTeam=(team,stateId)=>team?.stateId===String(stateId) && typeof team.fid==='string' && team.fid!=='' && Array.isArray(team.slots) && team.slots.length===5 && team.slots.every(k=>typeof k==='string') && Array.isArray(team.heroes) && team.heroes.length<=50 && team.heroes.every(h=>h && typeof h.key==='string' && h.raw && typeof h.raw==='object');
export function loadArenaResults(storage,stateId){
 try{const value=JSON.parse(storage.getItem(arenaResultsKey(stateId)) || 'null');return value?.version===1 && value.stateId===String(stateId) && Array.isArray(value.results)?value.results.filter(r=>r?.stateId===String(stateId)&&typeof r.id==='string'&&(r.notes==null || typeof r.notes==='string')&&['win','loss','draw'].includes(r.outcome)&&validTeam(r.yours,stateId)&&validTeam(r.theirs,stateId)).slice(0,100):[]}catch{return []}
}
export function addArenaResult(storage,stateId,results,result){
 if(result?.stateId!==String(stateId) || !validTeam(result.yours,stateId) || !validTeam(result.theirs,stateId) || result.yours.fid===result.theirs.fid || !['win','loss','draw'].includes(result.outcome))throw Error('Invalid Arena battle result.');
 const next=[structuredClone(result),...results].slice(0,100);
 storage.setItem(arenaResultsKey(stateId),JSON.stringify({version:1,stateId:String(stateId),results:next}));return next;
}

export function removeArenaResult(storage,stateId,results,id){
 const next=results.filter(r=>r.id!==id);storage.setItem(arenaResultsKey(stateId),JSON.stringify({version:1,stateId:String(stateId),results:next}));return next;
}
