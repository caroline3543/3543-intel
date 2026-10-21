import {useEffect,useRef,useState} from 'react';
import {C} from '../../utils/constants.js';
export function HivePlannerFrame({roster}){
 const frame=useRef(null),latest=useRef(roster),[ready,setReady]=useState(false),[status,setStatus]=useState('Connecting saved roster…');
 latest.current=roster;
 function sync(){frame.current?.contentWindow?.postMessage({type:'intel:hive-roster',payload:latest.current},window.location.origin)}
 useEffect(()=>{
  function receive(event){
   if(event.origin!==window.location.origin || event.source!==frame.current?.contentWindow || event.data?.stateId!==roster.stateId || event.data?.alliance!==roster.alliance)return;
   if(event.data.type==='hive:ready'){setReady(true);sync()}
   if(event.data.type==='hive:sync-result'){setReady(true);setStatus(`Saved roster connected · ${latest.current.players.length} players · updates automatically`)}
   if(event.data.type==='hive:error')setStatus(event.data.message);
  }
  window.addEventListener('message',receive);return()=>window.removeEventListener('message',receive);
 },[roster.stateId,roster.alliance]);
 useEffect(()=>{if(ready)sync()},[roster,ready]);
 const url=`/hive/index.html?state=${encodeURIComponent(roster.stateId)}&alliance=${encodeURIComponent(roster.alliance)}`;
 return <div style={{display:'flex',flexDirection:'column',flex:1,minHeight:0}}><p role="status" style={{fontSize:11,color:C.muted,margin:'0 0 8px'}}>{status}</p><iframe ref={frame} onLoad={sync} src={url} title={`Bear Hive · State ${roster.stateId} · ${roster.alliance}`} style={{display:'block',width:'100%',height:'100%',flex:1,minHeight:0,border:0,borderRadius:12,background:C.bg}} allow="clipboard-write"/><details style={{fontSize:11,color:C.muted}}><summary style={{minHeight:44,paddingTop:12,cursor:'pointer'}}>Backups &amp; saved roster</summary><p>Plans and attendance save on this device for this state and alliance. Use Plan settings → Download backup to move an existing plan here. Players and recorded coordinates sync automatically from the saved Members roster without fetching game data. Placements and attendance are kept. New players start in Other players. Use Locate all cities to see saved city locations.</p></details></div>;
}
