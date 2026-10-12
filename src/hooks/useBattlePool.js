import {useEffect,useState} from 'react';
import {uid} from '../utils/dates.js';
import {newPlayer,newBattlePool} from '../data/playerSchema.js';
export const BATTLE_POOL_KEY='svs_battle_pool_v1';
const empty=newBattlePool();
export function useBattlePool(scope) {
 const [record,setRecord]=useState(()=>{try{const raw=localStorage.getItem(BATTLE_POOL_KEY);if(!raw)return {version:1,scopes:{}};const r=JSON.parse(raw);return r.version===1&&r.scopes?r:null;}catch{return null;}});
 const [error,setError]=useState(record?'':'Battle pool storage unreadable. Original data preserved.');
 const [blocked,setBlocked]=useState(false);
 useEffect(()=>{const changed=e=>{if(e.key===BATTLE_POOL_KEY){setBlocked(true);setError('Battle pool changed in another tab. Reload before editing.');}};window.addEventListener('storage',changed);return()=>window.removeEventListener('storage',changed);},[]);
 const key=scope||'manual';const pool=record?.scopes[key]||empty;
 function update(label,fn){if(blocked||!record)return;setRecord(prev=>{const old={...empty,...prev.scopes[key]};const next={...prev,scopes:{...prev.scopes,[key]:{...fn(old),audit:[...old.audit,{id:uid(),at:new Date().toISOString(),label}].slice(-200)}}};try{localStorage.setItem(BATTLE_POOL_KEY,JSON.stringify(next));setError('');return next;}catch{setError('Battle pool save failed. Changes were not applied.');return prev;}});}
 function setPlayer(id,patch){update('Player readiness updated',p=>({...p,overrides:{...p.overrides,[id]:{...p.overrides[id],...patch,confirmedAt:new Date().toISOString()}}}));}
 function addTemporary(name){const player=newPlayer({username:name,temporary:true});update('Temporary participant added',p=>({...p,temporary:[...p.temporary,player],overrides:{...p.overrides,[player.id]:{status:'Ready',confirmedAt:new Date().toISOString()}}}));return player.id;}
 function commit(id,playerIds,active,label='Live action',slotId=null){update(active?'Troops committed':'Troops confirmed available',p=>({...p,commitments:{...p.commitments,[id]:{playerIds,active,label,slotId,at:new Date().toISOString()}}}));}
 return {pool,error,setPlayer,addTemporary,commit,setStructure:(id,patch)=>update('Structure report updated',p=>({...p,structures:{...p.structures,[id]:{...p.structures[id],...patch,confirmedAt:new Date().toISOString()}}})),update};
}
