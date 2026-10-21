import {useEffect,useRef,useState} from 'react';
import {C} from '../../utils/constants.js';
export function HivePlannerFrame({roster}){
 const frame=useRef(null),latest=useRef(roster),[ready,setReady]=useState(false),[status,setStatus]=useState('Loading Bear Hive…');
 latest.current=roster;
 function sync(){frame.current?.contentWindow?.postMessage({type:'intel:hive-roster',payload:latest.current},window.location.origin)}
 useEffect(()=>{
  function receive(event){
   if(event.origin!==window.location.origin || event.source!==frame.current?.contentWindow || event.data?.stateId!==roster.stateId || event.data?.alliance!==roster.alliance)return;
   if(event.data.type==='hive:ready'){setReady(true);sync()}
   if(event.data.type==='hive:sync-result')setStatus(`Planner roster connected · ${event.data.added} added · ${event.data.updated} matched`);
   if(event.data.type==='hive:error')setStatus(event.data.message);
  }
  window.addEventListener('message',receive);return()=>window.removeEventListener('message',receive);
 },[roster.stateId,roster.alliance]);
 useEffect(()=>{if(ready)sync()},[roster,ready]);
 const url=`/hive/index.html?state=${encodeURIComponent(roster.stateId)}&alliance=${encodeURIComponent(roster.alliance)}`;
 return <div style={{display:'flex',flexDirection:'column',flex:1,minHeight:0}}><div style={{display:'flex',gap:8,alignItems:'center',marginBottom:8}}><button disabled={!ready} onClick={sync} style={{minHeight:44,border:`1px solid ${C.border}`,borderRadius:8,padding:'8px 12px',background:C.section,color:C.icy}}>Update planner roster</button><span role="status" style={{fontSize:11,color:C.muted}}>{status}</span></div><iframe ref={frame} src={url} title={`Bear Hive · State ${roster.stateId} · ${roster.alliance}`} style={{display:'block',width:'100%',height:'100%',flex:1,minHeight:0,border:0,borderRadius:12,background:C.bg}} allow="clipboard-write"/><details style={{fontSize:11,color:C.muted}}><summary style={{minHeight:44,paddingTop:12,cursor:'pointer'}}>Backups &amp; roster updates</summary><p>Plans and attendance save on this device for this state and alliance. Use Plan settings → Download backup to move an existing plan here. Roster updates keep placements and attendance. New players start in Other players.</p></details></div>;
}
