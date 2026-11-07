import {useEffect,useRef,useState} from 'react';
import {createSharedWorkspace,workspaceCache,workspaceRequest} from './sharedWorkspace.js';
export function useSharedWorkspace(initial){
 const [data,setData]=useState(initial),[sync,setSync]=useState({mode:'connecting',status:'Opening shared workspace…',ready:false,conflicts:[]});
 const controller=useRef(null);
 useEffect(()=>{
  const client=createSharedWorkspace({initial,cache:workspaceCache(),request:workspaceRequest,onChange:setData,onStatus:setSync});controller.current=client;client.initialize();
  const refresh=()=>{if(document.visibilityState!=='hidden')client.sync();};
  const timer=setInterval(refresh,5000);window.addEventListener('focus',refresh);window.addEventListener('online',refresh);document.addEventListener('visibilitychange',refresh);
  return()=>{client.dispose();clearInterval(timer);window.removeEventListener('focus',refresh);window.removeEventListener('online',refresh);document.removeEventListener('visibilitychange',refresh);};
 },[]);
 return {data,setData:value=>controller.current?.update(value),sync,publish:()=>controller.current?.publish(),join:()=>controller.current?.join(),retry:async()=>{await controller.current?.sync();return controller.current?.getState();},resolve:side=>controller.current?.resolve(side)};
}
