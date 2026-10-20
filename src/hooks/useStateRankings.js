import {useEffect,useState} from 'react';
import {mightpulseRequest} from '../services/mightpulseService.js';
import {normalizeRankings} from '../services/stateRankingsService.js';
export function useStateRankings(stateId,board) {
  const [result,setResult]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0);
  useEffect(()=>{
    let cancelled=false;
    setResult(null);setError('');setBusy(true);
    mightpulseRequest('rankings',{state:Number(stateId),board,limit:100})
      .then(response=>{const next=normalizeRankings(response,stateId,board);if(!cancelled)setResult(next);})
      .catch(e=>{if(!cancelled)setError(e.message || 'Unable to retrieve rankings.');})
      .finally(()=>{if(!cancelled)setBusy(false);});
    return()=>{cancelled=true;};
  },[stateId,board,revision]);
  return {result:result?.board===board && result.stateId===String(stateId)?result:null,error,busy,refresh:()=>setRevision(n=>n+1)};
}
