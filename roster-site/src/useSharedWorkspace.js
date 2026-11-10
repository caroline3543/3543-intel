import {useEffect,useRef,useState} from 'react';
import {workspaceCache,workspaceRequest} from './sharedWorkspace.js';
import {sharedData} from '../shared/workspace.js';

// Caroline 3739 is a testing copy. It imports the original roster once,
// stores changes only on this browser, and never sends workspace writes.
export function useSharedWorkspace(initial) {
 const cache=useRef(workspaceCache());
 const local=useRef(sharedData(initial));
 const [data,setData]=useState(local.current);
 const [sync,setSync]=useState({mode:'active',status:'Opening Caroline 3739 testing copy…',ready:false,joined:true,conflicts:[],dirty:false,checkedAt:null,syncing:false,issue:null});
 const statusPatch=patch=>setSync(old=>({...old,...patch}));
 useEffect(()=>{
  let disposed=false;
  (async()=>{
   try{
    const saved=await cache.current.read();
    if(disposed)return;
    if(saved?.local?.players?.length){
     local.current=sharedData(saved.local);setData(local.current);
     statusPatch({ready:true,status:'Saved locally · independent testing copy',checkedAt:new Date().toISOString()});
     return;
    }
    const original=await workspaceRequest('GET');
    if(disposed)return;
    if(original?.data){
     local.current=sharedData(original.data);
     setData(local.current);
     await cache.current.write({local:local.current,origin:'3573-snapshot',importedAt:new Date().toISOString()});
     statusPatch({ready:true,status:'Imported testing snapshot · changes saved only here',checkedAt:new Date().toISOString()});
    }else{
     statusPatch({ready:true,status:'No shared snapshot available',issue:'Original roster data was not available. No changes will reach the live website.'});
    }
   }catch(error){if(!disposed)statusPatch({ready:true,status:'Offline testing copy',issue:error.message||'Could not load original roster snapshot'});}
  })();
  return()=>{disposed=true;};
 },[]);
 const setLocal=update=>{
  const next=sharedData(typeof update==='function'?update(local.current):update);
  local.current=next;setData(next);
  statusPatch({dirty:false,status:'Saving on this device…'});
  cache.current.write({local:next,origin:'3739-local',updatedAt:new Date().toISOString()})
   .then(()=>statusPatch({dirty:false,status:'Saved on this device · original unchanged',checkedAt:new Date().toISOString()}))
   .catch(()=>statusPatch({issue:'Could not save locally. Export a backup.',status:'Local save failed'}));
 };
 const retry=async()=>({mode:'active',joined:true,ready:true,conflicts:[],dirty:false,syncing:false,checkedAt:new Date().toISOString()});
 return {data,setData:setLocal,sync,publish:retry,join:retry,retry,resolve:retry};
}
