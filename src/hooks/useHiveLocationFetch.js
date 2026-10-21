import {useEffect,useRef,useState} from 'react';
import {mightpulseRequest} from '../services/mightpulseService.js';
import {fetchHiveLocations} from '../services/hiveLocationFetchService.js';
import {activeStateId} from '../services/stateWorkspaceService.js';
export function useHiveLocationFetch({roster,players,onSave}){
 const latest=useRef({roster,players,onSave});latest.current={roster,players,onSave};
 const run=useRef(null),[busy,setBusy]=useState(false),[stopping,setStopping]=useState(false),[progress,setProgress]=useState(null);
 const stateId=roster?.stateId,alliance=roster?.alliance;
 useEffect(()=>{setBusy(false);setStopping(false);setProgress(null);return()=>{if(run.current)run.current.cancelled=true;run.current=null}},[stateId,alliance]);
 async function start(){
  if(run.current || !roster || typeof onSave!=='function')return;
  const token={cancelled:false};run.current=token;setBusy(true);setStopping(false);
  const sameScope=()=>run.current===token && latest.current.roster?.stateId===stateId && latest.current.roster?.alliance===alliance && activeStateId()===stateId;
  try{await fetchHiveLocations({roster,request:mightpulseRequest,getPlayers:()=>latest.current.players,save:p=>latest.current.onSave(p),active:()=>sameScope()&&!token.cancelled,onProgress:p=>{if(sameScope())setProgress(p)}})}
  finally{if(sameScope()){run.current=null;setBusy(false);setStopping(false)}}
 }
 function stop(){if(run.current){run.current.cancelled=true;setStopping(true)}}
 return {busy,stopping,progress,start,stop};
}
