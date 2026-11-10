import {sharedData,mergeWorkspace,resolveConflicts,validateWorkspace,sameWorkspaceValue} from '../shared/workspace.js';
const equal=sameWorkspaceValue;
const meaningful=data=>Boolean(data?.players?.length||data?.events?.length||data?.customRoles?.length||Object.keys(data?.talMatchDrafts||{}).length||Object.keys(data?.talPlan?.records||{}).length||data?.talPlan?.teams?.some(t=>t.members?.length||t.candidates?.length||t.slots?.length));
export function createSharedWorkspace({initial,cache,request,onChange=()=>{},onStatus=()=>{}}){
 let state={local:sharedData(initial),base:null,revision:0,joined:false,updatedAt:null,conflicts:[],mode:'connecting',issue:null,status:'Opening shared workspace…',ready:false,deviceBackup:null,syncing:false,checkedAt:null};
 let running=false,disposed=false,timer=null,persisting=Promise.resolve();
 function emit(){if(!disposed){onChange(state.local);onStatus({...state,dirty:!equal(state.local,state.base)});}}
 function persist(){const value=structuredClone(state);persisting=persisting.catch(()=>{}).then(()=>cache.write(value));return persisting;}
 function schedule(){clearTimeout(timer);if(!disposed)timer=setTimeout(()=>{sync();},600);}
 function error(error){state.status=error?.message||'Offline · changes waiting on this device';state.issue=state.status;emit();}
 function integrate(remote){
  if(!Number.isSafeInteger(remote.revision)||remote.revision<state.revision)throw Error('Unable to verify shared data. Retry sync.');
  if(remote.data==null){
   if(state.joined){if(state.revision===0&&state.base==null){state.mode='active';return;}throw Error('Shared data is unavailable. Your device copy is kept.');}
   state.mode='unpublished';state.issue=null;state.status='Saved on this device · not shared yet';state.remote=remote;return;
  }
  validateWorkspace(remote.data);
  if(!state.joined){
   if(meaningful(state.local)){state.mode='join';state.issue=null;state.remote=remote;state.status='A shared roster is ready. Choose which copy to open.';return;}
   state.local=structuredClone(remote.data);state.joined=true;
  }else{
   const merged=mergeWorkspace(state.base,state.local,remote.data);state.local=merged.data;state.conflicts=merged.conflicts;
  }
  state.base=structuredClone(remote.data);state.revision=remote.revision;state.updatedAt=remote.updatedAt;state.mode='active';
  if(state.conflicts.length||equal(state.local,state.base))state.issue=null;
  state.status=state.conflicts.length?'Conflicting edits · review below':equal(state.local,state.base)?'Shared · all changes saved':'Syncing changes…';
 }
 async function initialize(){
  try{const saved=await cache.read();if(saved){state={...state,...saved,ready:false,mode:saved.joined?'active':'connecting'};state.local=sharedData(state.local);}}
  catch{state.status='Device backup could not be opened. Shared data will be checked.';}
  state.ready=true;emit();await sync();
 }
 async function sync(){
  if(disposed||running||state.conflicts.length)return;running=true;state.syncing=true;state.status='Syncing…';emit();
  try{
   const remote=await request('GET',state.joined&&state.base?{revision:state.revision}:undefined);if(!remote.unchanged){integrate(remote);await persist();}else{state.status=equal(state.local,state.base)?'Shared · all changes saved':'Syncing changes…';if(equal(state.local,state.base))state.issue=null;}emit();
   if(!state.joined||state.conflicts.length||equal(state.local,state.base))return;
   validateWorkspace(state.local);state.status='Syncing changes…';emit();
   const snapshot=structuredClone(state.local),revision=state.revision;
   await persist();
   const result=await request('POST',{revision,data:snapshot});
   if(result.conflict){integrate(result);await persist();emit();if(!state.conflicts.length)schedule();return;}
   if(!Number.isSafeInteger(result.revision)||result.revision<revision||!equal(result.data,snapshot))throw Error('Save could not be verified. Your edits are waiting on this device.');
   const merged=mergeWorkspace(snapshot,state.local,result.data);
   state.base=structuredClone(result.data);state.local=merged.data;state.revision=result.revision;state.updatedAt=result.updatedAt;state.conflicts=merged.conflicts;state.issue=null;
   state.status=state.conflicts.length?'Conflicting edits · review below':equal(state.local,state.base)?'Shared · all changes saved':'Syncing changes…';await persist();emit();
   if(!equal(state.local,state.base)&&!state.conflicts.length)schedule();
   state.checkedAt=new Date().toISOString();
  }catch(e){error(e);}
  finally{running=false;state.syncing=false;if(!state.issue)state.checkedAt=new Date().toISOString();emit();}
 }
 function update(value){state.local=sharedData(typeof value==='function'?value(state.local):value);state.status='Saving on this device…';emit();persist().then(()=>{state.status=state.joined?'Saved on this device · waiting to sync':'Saved on this device · not shared yet';emit();if(state.joined)schedule();}).catch(()=>error(Error('Device storage is full. Download a backup before closing.')));}
 async function publish(){
  if(running||state.joined||state.mode!=='unpublished')return;
  state.joined=true;state.base=null;state.revision=0;state.mode='active';state.status='Starting shared workspace…';
  try{
   validateWorkspace(state.local);await persist();running=true;
   const snapshot=structuredClone(state.local),result=await request('POST',{revision:0,data:snapshot});
   if(result.conflict){state.joined=false;state.mode='join';state.remote=result;state.status='Another leader started sharing first. Open the shared roster below.';}
   else{if(!Number.isSafeInteger(result.revision)||result.revision<1||!equal(result.data,snapshot))throw Error('Shared save could not be verified. Your device copy is kept.');const merged=mergeWorkspace(snapshot,state.local,result.data);state.base=result.data;state.local=merged.data;state.revision=result.revision;state.updatedAt=result.updatedAt;state.issue=null;state.status='Shared · all changes saved';}
   await persist();emit();
  }catch(e){state.mode='active';error(e);await persist();}
  finally{running=false;}
 }
 async function join(){
  if(!state.remote?.data||running)return;const previous=structuredClone(state);
  try{
   state.deviceBackup=structuredClone(state.local);state.local=structuredClone(state.remote.data);state.base=structuredClone(state.remote.data);state.revision=state.remote.revision;state.updatedAt=state.remote.updatedAt;state.joined=true;state.conflicts=[];delete state.remote;state.mode='active';state.issue=null;state.status='Shared · all changes saved';await persist();emit();schedule();
  }catch(e){state=previous;error(Error('Device backup could not be saved. Download your copy before trying again.'));}
 }
 async function resolve(side){
  if(!['mine','shared'].includes(side)||!state.conflicts.length)return;const previous=structuredClone(state);
  try{state.local=resolveConflicts(state.local,state.conflicts,side);state.conflicts=[];state.status='Syncing resolved changes…';await persist();emit();schedule();}
  catch(e){state=previous;error(e);}
 }

 return {initialize,sync,update,publish,join,resolve,getState:()=>structuredClone(state),dispose(){disposed=true;clearTimeout(timer);}};
}
export function workspaceCache(){
 const db=new Promise((resolve,reject)=>{const request=indexedDB.open('caroline-3739-workspace',1);request.onupgradeneeded=()=>request.result.createObjectStore('workspace');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
 return {
  async read(){const database=await db;return new Promise((resolve,reject)=>{const tx=database.transaction('workspace'),r=tx.objectStore('workspace').get('3739-leaders');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});},
  async write(value){const database=await db;return new Promise((resolve,reject)=>{const tx=database.transaction('workspace','readwrite');tx.objectStore('workspace').put(value,'3739-leaders');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Device save interrupted'));});},
 };
}
export async function workspaceRequest(method,input){
 let body;
 if(input&&method==='POST'){
  if(typeof CompressionStream!=='undefined'){
   const stream=new Blob([JSON.stringify(input.data)]).stream().pipeThrough(new CompressionStream('gzip'));
   const bytes=new Uint8Array(await new Response(stream).arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=16384)binary+=String.fromCharCode(...bytes.subarray(i,i+16384));body=JSON.stringify({revision:input.revision,encoded:btoa(binary)});
  }else body=JSON.stringify(input);
  if(body.length>4*1024*1024)throw Error('This save is too large for this browser. Your device copy is kept; download a backup.');
 }
 const response=await fetch('/api/workspace'+(method==='GET'&&input?.revision!=null?'?revision='+input.revision:''),{method,credentials:'same-origin',headers:method==='POST'?{'Content-Type':'application/json'}:undefined,body,signal:AbortSignal.timeout(30000)});
 const data=await response.json();
 if(response.status===401)window.dispatchEvent(new Event('roster:locked'));
 if(!response.ok&&response.status!==409)throw Error(data.error||'Offline · changes waiting on this device');return data;
}
