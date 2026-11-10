import {useEffect,useRef,useState} from 'react';
import {workspaceCache} from './sharedWorkspace.js';
import {sharedData} from '../shared/workspace.js';

// Fresh State 3739 workspace, independent of the original 3573 snapshot.
// Every edit remains in this browser. No cross-state import or remote write.
export function useSharedWorkspace(initial){
 const storage=useRef(null);
 const current=useRef(sharedData({...initial,players:[],events:[],customRoles:[],settings:{stateId:'3739'}}));
 const [data,setData]=useState(current.current);
 const [sync,setSync]=useState({mode:'active',ready:false,joined:true,conflicts:[],dirty:false,syncing:false,issue:null,checkedAt:null});
 useEffect(()=>{
  let cancelled=false;
  (async()=>{
   try{
    // One-time purge of previously imported State 3573 data on this clone's origin.
    if(localStorage.getItem('caroline3739-clean-v2')!=='yes'){
     localStorage.clear();
     localStorage.setItem('caroline3739-clean-v2','yes');
     try{indexedDB.deleteDatabase('caroline-shared-workspace');}catch{}
    }
    const cache=workspaceCache();
    storage.current=cache;
    const saved=await cache.read();
    if(cancelled)return;
    if(saved?.local?.settings?.stateId==='3739'){
     current.current=sharedData(saved.local);
     setData(current.current);
    }else{
     await cache.write({local:current.current,origin:'3739-fresh'});
    }
    setSync(s=>({...s,ready:true,checkedAt:new Date().toISOString()}));
   }catch(e){if(!cancelled)setSync(s=>({...s,ready:true,issue:'Unable to open local storage. Export a backup after making changes.'}));}
  })();
  return()=>{cancelled=true};
 },[]);
 function update(value){
  const next=sharedData(typeof value==='function'?value(current.current):value);
  if(next.settings?.stateId!=='3739'||next.players.some(p=>p.stateId&&String(p.stateId)!=='3739'||p.providerStats?.stateId&&String(p.providerStats.stateId)!=='3739')){
   setSync(s=>({...s,issue:'This app accepts only State 3739 records.'}));
   return;
  }
  current.current=next;setData(next);
  storage.current?.write({local:next,origin:'3739-only',savedAt:new Date().toISOString()}).then(()=>setSync(s=>({...s,issue:null,checkedAt:new Date().toISOString()}))).catch(()=>setSync(s=>({...s,issue:'Could not save to this device.'})));
 }
 const noop=async()=>({mode:'active',ready:true,joined:true,conflicts:[],dirty:false,syncing:false,checkedAt:new Date().toISOString()});
 return {data,setData:update,sync,publish:noop,join:noop,retry:noop,resolve:noop};
}
