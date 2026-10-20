import {useEffect,useRef,useState} from 'react';
import {mightpulseRequest} from '../services/mightpulseService.js';
import {applyPlayerDetails} from '../services/playerDetailsService.js';
export function usePlayerDetails(player,onSave,stateId){
  const latest=useRef({player,onSave});latest.current={player,onSave};
  const sequence=useRef(0);
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  useEffect(()=>{setBusy(false);setMessage('');setError('');return()=>{sequence.current++;};},[player.id,stateId]);
  async function refresh(){
    if(busy || typeof latest.current.onSave!=='function')return;
    const id=player.id,fid=String(player.fid || '').trim(),request=++sequence.current;
    setBusy(true);setMessage('');setError('');
    try{
      const response=await mightpulseRequest('player_details',{state:Number(stateId),fid});
      if(request!==sequence.current || latest.current.player.id!==id || String(latest.current.player.fid || '').trim()!==fid)return;
      const updated=applyPlayerDetails(latest.current.player,response,stateId);
      latest.current.onSave(updated);
      setMessage('Profile, available heroes and equipment saved. Missing sections keep their previous pull date.');
    }catch(e){if(request===sequence.current)setError(e.message || 'Unable to refresh heroes and gear.');}
    finally{if(request===sequence.current)setBusy(false);}
  }
  return {busy,message,error,refresh};
}
