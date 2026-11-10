import {useEffect,useRef,useState} from 'react';
import {createSharedWorkspace,workspaceCache,workspaceRequest} from './sharedWorkspace.js';
import {sharedData} from '../shared/workspace.js';

// State 3739 only. Local backup is retained when the network is unavailable;
// remote edits merge by revision, with conflicting edits held for review.
export function useSharedWorkspace(initial){
 const initialData=useRef(sharedData(initial));
 const controller=useRef(null);
 const [data,setData]=useState(initialData.current);
 const [sync,setSync]=useState({mode:'connecting',ready:false,joined:false,conflicts:[],dirty:false,syncing:false,issue:null,checkedAt:null});
 useEffect(()=>{
  let disposed=false;
  const work=createSharedWorkspace({
   initial:initialData.current,
   cache:workspaceCache(),
   request:workspaceRequest,
   onChange:next=>{if(!disposed)setData(next);},
   onStatus:next=>{if(!disposed)setSync(next)}
  });
  controller.current=work;
  work.initialize();
  const interval=setInterval(()=>{if(!document.hidden)work.sync();},4500);
  const refresh=()=>{if(!document.hidden)work.sync();};
  document.addEventListener('visibilitychange',refresh);
  window.addEventListener('focus',refresh);
  return()=>{
   disposed=true;clearInterval(interval);
   document.removeEventListener('visibilitychange',refresh);
   window.removeEventListener('focus',refresh);
   work.dispose();controller.current=null;
  };
 },[]);
 const update=value=>{
  const work=controller.current;
  if(!work)return;
  work.update(value);
 };
 const call=method=>async(...args)=>controller.current?.[method](...args);
 return {data,setData:update,sync,publish:call('publish'),join:call('join'),seedFromDevice:call('seedFromDevice'),retry:call('sync'),resolve:call('resolve')};
}
