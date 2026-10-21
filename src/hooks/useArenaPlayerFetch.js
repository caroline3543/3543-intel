import {useEffect,useRef,useState} from 'react';
import {mightpulseRequest} from '../services/mightpulseService.js';
import {requestArenaPlayer} from '../services/arenaFetchService.js';
import {activeStateId} from '../services/stateWorkspaceService.js';
export function useArenaPlayerFetch({stateId,selectionVersion,selectedFid,onFetched}){
 const [fid,setFid]=useState(selectedFid || ''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const sequence=useRef(0),latest=useRef({onFetched,selectionVersion});latest.current={onFetched,selectionVersion};
 useEffect(()=>{sequence.current++;setFid(selectedFid || '');setBusy(false);setError('');return()=>{sequence.current++}},[stateId,selectionVersion,selectedFid]);
 function edit(value){sequence.current++;setFid(value);setBusy(false);setError('')}
 async function fetch(){
  if(busy)return;
  const token=++sequence.current,version=selectionVersion;setBusy(true);setError('');
  const active=()=>token===sequence.current && version===latest.current.selectionVersion && stateId===activeStateId();
  try{const player=await requestArenaPlayer({fid,stateId,request:mightpulseRequest,active});if(player && active())latest.current.onFetched(player)}
  catch(e){if(active())setError(e.message || 'Unable to fetch Arena heroes and gear.')}
  finally{if(active())setBusy(false)}
 }
 return {fid,edit,busy,error,fetch};
}
