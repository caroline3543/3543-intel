import {useState} from 'react';
import {C} from '../../../utils/constants.js';
import {utcTime} from '../../../services/castleTimingService.js';
import {CLOSED,battleCallout} from '../../../services/battleOperationsService.js';
import {fmtSend,uid} from './rallyRoomHelpers.js';
const btn={minHeight:44,padding:'8px 12px',background:C.section,border:`1px solid ${C.border}`,borderRadius:10,color:C.icy,fontSize:14};
const inp={width:'100%',boxSizing:'border-box',minHeight:44,padding:10,background:C.section,border:`1px solid ${C.border}`,borderRadius:8,color:C.white,fontSize:16};
export function TimerActions({timer:t,timers,onSave,onDuplicate,onArchive,now,templates}) {
 const [error,setError]=useState(''),[date,setDate]=useState(()=>new Date((t.actualImpactAtUtc??t.impactAtUtc??now)*1000).toISOString().slice(0,10)),[time,setTime]=useState('');
 const [parent,setParent]=useState(t.dependency?.parentId||''),[offset,setOffset]=useState(String(t.dependency?.offsetSecs??0));
 async function copy(){const text=battleCallout(t,fmtSend,templates);try{await navigator.clipboard.writeText(text);setError('Copied');}catch{setError(text);}}
 function link(){try{if(!parent || !Number.isFinite(Number(offset)))throw Error('Choose parent and offset');onSave({...t,dependency:{mode:'relative',parentId:parent,offsetSecs:Number(offset)}});setError('');}catch(e){setError(e.message);}}
 return <div style={{padding:'0 14px 14px',fontSize:14}}>
 <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
 {!CLOSED.includes(t.status)&&<button style={btn} disabled={!!t.captureHold||!!t.review} onClick={()=>onSave(t.openRallyAtUtc!=null&&['Planned','Ready'].includes(t.status)?{...t,status:'Opened',actualOpenAtUtc:now}:{...t,status:'Confirmed',actualImpactAtUtc:now})}>{t.openRallyAtUtc!=null&&['Planned','Ready'].includes(t.status)?t.rallyType==='Garrison Entry'?'Confirm departed':'Confirm opened':'Confirm arrival'}</button>}
 <button style={btn} onClick={copy}>Copy callout</button></div>
 {(t.review||t.captureHold)&&<div style={{color:C.gold,marginTop:10}}>Hold · {t.review?'Timing requires review':'Await confirmed capture'}</div>}
 <details><summary style={{minHeight:44,paddingTop:12,color:C.icy}}>Outcome, actual time & links</summary>
 <label style={{display:'block',marginBottom:10}}>Status<select style={inp} value={t.status||'Planned'} onChange={e=>onSave({...t,status:e.target.value,...(e.target.value==='Confirmed'?{actualImpactAtUtc:now}:e.target.value==='Opened'?{actualOpenAtUtc:now}:{})})}>{['Planned','Ready','Opened','Reported','Confirmed','Completed','Failed','Cancelled'].map(x=><option key={x}>{x}</option>)}</select></label>
 <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:12}}>{!t.enemy && !['Garrison Entry','Reinforcement'].includes(t.rallyType) && <button style={btn} onClick={()=>onSave({...t,status:'Confirmed',outcome:'captured',actualImpactAtUtc:now})}>Capture confirmed</button>}<button style={{...btn,color:C.red}} onClick={()=>onSave({...t,status:'Failed',outcome:'failed'})}>Failed</button><button style={btn} onClick={()=>onDuplicate({...t,id:uid(),status:'Planned',outcome:null,actualImpactAtUtc:null,actualOpenAtUtc:null,review:false})}>Duplicate</button></div>
 <label style={{display:'block'}}>Actual UTC date<input style={inp} type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label style={{display:'block',marginTop:10}}>Actual HHMMSS<input style={inp} value={time} onChange={e=>setTime(e.target.value)}/></label><button style={{...btn,marginTop:8}} onClick={()=>{try{onSave({...t,status:'Confirmed',actualImpactAtUtc:utcTime(date,time)/1000});setError('');}catch(e){setError(e.message);}}}>Save actual arrival</button>
 <p>{t.dependency?.mode==='relative'?`Relative: ${t.dependency.offsetSecs}s after ${timers.find(x=>x.id===t.dependency.parentId)?.leaderName}`:'Fixed UTC'}</p>
 <label>Link to<select style={inp} value={parent} onChange={e=>setParent(e.target.value)}><option value="">Choose event</option>{timers.filter(x=>x.id!==t.id).map(x=><option key={x.id} value={x.id}>{x.leaderName} · {x.rallyType}</option>)}</select></label><label style={{display:'block',marginTop:10}}>Offset · signed seconds<input style={inp} value={offset} onChange={e=>setOffset(e.target.value)}/></label><button style={btn} onClick={link}>Keep relative offset</button><button style={btn} onClick={()=>onSave({...t,dependency:{mode:'fixed'},captureDependent:false})}>Keep fixed UTC</button>
 <label style={{display:'flex',alignItems:'center',minHeight:44,color:C.icy}}><input type="checkbox" checked={!!t.captureDependent} onChange={e=>onSave({...t,captureDependent:e.target.checked})}/>Requires parent capture</label>
 {timers.filter(x=>x.dependency?.parentId===t.id).map(x=><div key={x.id}>↳ {x.leaderName} · {fmtSend(x.impactAtUtc)} UTC</div>)}
 {t.review&&<button style={btn} onClick={()=>onSave({...t,review:false})}>Reviewed · clear timing hold</button>}
 {CLOSED.includes(t.status)&&<button style={btn} onClick={()=>onArchive(t.id)}>Archive event</button>}
 </details>{error&&<div role="status" style={{color:C.gold,marginTop:8,overflowWrap:'anywhere'}}>{error}</div>}
 </div>;
}
