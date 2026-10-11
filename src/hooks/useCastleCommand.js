import {useState,useEffect,useCallback} from 'react';
import {uid, resolveEvents} from '../services/castleTimingService.js';
export const CASTLE_KEY = 'svs_castle_command_v1';
const emptyBattle = name => ({id:uid(),name,date:new Date().toISOString().slice(0,10),status:'Planning',events:[],notes:'',paused:false});
const initial = () => ({version:1,battles:[emptyBattle('Castle battle')],players:[],presets:[],audit:[],templates:{},drafts:{}});
export function useCastleCommand() {
  const [error,setError] = useState('');
  const [data,setData] = useState(()=>{try {const raw=localStorage.getItem(CASTLE_KEY); if (!raw) return initial(); const d=JSON.parse(raw); if(d.version!==1 || !Array.isArray(d.battles) || !Array.isArray(d.players)) throw Error(); d.battles.forEach(b=>resolveEvents(b.events)); return d;} catch {return null;}});
  const [now,setNow] = useState(Date.now());
  const [clockWarning,setClockWarning] = useState('Device clock not verified. Check UTC before battle.');
  useEffect(()=>{
    let previous=Date.now(), mono=performance.now();
    const tick=()=>{const wall=Date.now(), perf=performance.now(); if(Math.abs((wall-previous)-(perf-mono))>2000)setClockWarning('Device clock changed. Review all timing.'); previous=wall; mono=perf; setNow(Math.floor(wall/1000)*1000);};
    const timer=setInterval(tick,250); const resume=()=>{tick();setClockWarning('Returned to foreground. Verify UTC and reported timings.');};
    window.addEventListener('focus',resume); document.addEventListener('visibilitychange',resume);
    return()=>{clearInterval(timer);window.removeEventListener('focus',resume);document.removeEventListener('visibilitychange',resume);};
  },[]);
  useEffect(()=>{const receive=e=>{if(e.key===CASTLE_KEY)setError('Another tab changed battle data. Reload before editing to avoid conflicts.');};window.addEventListener('storage',receive);return()=>window.removeEventListener('storage',receive);},[]);
  const mutate=useCallback((label,fn)=>setData(old=>{
    if(!old)return old;
    const next=fn(structuredClone(old)); next.audit=[...old.audit,{id:uid(),at:Date.now(),label}].slice(-1000);
    try {localStorage.setItem(CASTLE_KEY,JSON.stringify(next));setError('');return next;}catch {setError('Save failed. Changes were not applied. Export a backup.');return old;}
  }),[]);
  const updateBattle=(id,patch)=>mutate('Battle updated',d=>({...d,battles:d.battles.map(b=>b.id===id?{...b,...patch}:b)}));
  const saveEvent=(battleId,event)=>mutate('Event saved',d=>{const b=d.battles.find(b=>b.id===battleId); const old=b.events.find(e=>e.id===event.id); b.events=b.events.some(e=>e.id===event.id)?b.events.map(e=>e.id===event.id?event:e):[...b.events,event];
    if(old?.type==='Enemy' && old.plannedAt!==event.plannedAt)b.events=b.events.map(e=>({...e,review:true}));
    b.events=resolveEvents(b.events);return d;});
  return {data,now,error,clockWarning,mutate,updateBattle,saveEvent,reset:()=>{const d=initial();localStorage.setItem(CASTLE_KEY,JSON.stringify(d));setData(d);},newBattle:name=>mutate('Battle created',d=>({...d,battles:[...d.battles,emptyBattle(name)]}))};
}
