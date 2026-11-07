import {useEffect,useRef,useState} from 'react';
import {record,setRecord,playerLabel} from './planner.js';
import {cleanTalNote} from './notes.js';
import {button,field,C} from './ui.jsx';
export function TalNoteEditor({plan,player,onChange,onClose}){
 const current=cleanTalNote(record(plan,player).note),[draft,setDraft]=useState(current),[base,setBase]=useState(current),[conflict,setConflict]=useState(false),input=useRef(null);
 useEffect(()=>{input.current?.focus();},[]);
 function save(force=false){if(plan.locked)return;if(!force&&current!==base&&draft!==current){setConflict(true);return;}onChange(setRecord(plan,player,{note:cleanTalNote(draft)}));onClose();}
 return <div role="group" aria-label={`Edit TAL note for ${playerLabel(player)}`} style={{padding:12,background:C.bg,borderRadius:10,marginTop:10}}>
  <label style={{fontSize:14,color:C.icy}}>TAL note<textarea ref={input} aria-label={`TAL note for ${playerLabel(player)}`} value={draft} disabled={plan.locked} placeholder="Availability limits or instructions" onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();onClose();}if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();save();}}} style={{...field,minHeight:100,margin:'6px 0 10px'}}/></label>
  {conflict&&<div role="alert" style={{fontSize:14,color:C.gold,lineHeight:1.5}}>Another leader changed this note.<p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',color:C.icy}}>{current||'Note removed'}</p><div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:10}}><button style={button} onClick={()=>{setDraft(current);setBase(current);setConflict(false);}}>Use latest note</button><button style={button} disabled={plan.locked} onClick={()=>save(true)}>Keep my note</button></div></div>}
  <div style={{display:'flex',gap:8}}><button style={{...button,flex:1}} onClick={onClose}>Cancel</button><button style={{...button,flex:1,color:C.gold}} disabled={plan.locked} onClick={()=>save()}>Save note</button></div>
 </div>;
}
