import {useState,useEffect,useRef} from 'react';
import {C} from '../../../utils/constants.js';
import {STATUSES,TERMINAL,clock,countdown,callout,conflicts,utcTime,actionTime} from '../../../services/castleTimingService.js';
import {Button,Field,Warning,panel,row} from './CommandUI.jsx';
export function LiveCommand({battle,players,templates,now,onSave,onEdit,onDuplicate,onBattle,clockWarning}) {
 const [message,setMessage]=useState(''),[notify,setNotify]=useState(false); const notified=useRef(new Set());
 const active=battle.events.filter(e=>!TERMINAL.includes(e.status)).sort((a,b)=>actionTime(a)-actionTime(b));
 const next=active.find(e=>!e.review && (e.status==='Planned'||e.status==='Ready'))||active[0];
 useEffect(()=>{if(!notify||battle.paused||document.hidden)return;for(const e of active){if(!e.review&&['Planned','Ready'].includes(e.status)&&actionTime(e)<=now&&!notified.current.has(e.id)){notified.current.add(e.id);new Notification('Castle Command',{body:callout(e,players,templates)});}}},[now,notify,battle.paused,active,players,templates]);
 async function copy(e){try{await navigator.clipboard.writeText(callout(e,players,templates));setMessage('Callout copied');}catch{setMessage(callout(e,players,templates));}}
 return <><div style={panel}><div style={{fontVariantNumeric:'tabular-nums',fontSize:22}}>{clock(now)} UTC</div>
 <Field label="Battle status" value={battle.status} onChange={v=>onBattle({status:v})}>{['Planning','Active','Holding','Contested','Ended'].map(x=><option key={x}>{x}</option>)}</Field>
 <Warning>{clockWarning}</Warning><div style={row}><Button onClick={()=>onBattle({paused:!battle.paused})}>{battle.paused?'Resume sequence':'Pause sequence'}</Button><Button danger onClick={()=>onBattle({paused:true,events:battle.events.map(e=>['Planned','Ready'].includes(e.status)?{...e,status:'Cancelled'}:e)})}>Cancel planned actions</Button><Button onClick={async()=>{if(!('Notification' in window)){setMessage('Notifications unavailable; keep this screen open.');return;}try{setNotify(await Notification.requestPermission()==='granted');setMessage('Notifications only work while the app is running.');}catch{setMessage('Notifications unavailable');}}}>Enable alerts</Button></div>
 {battle.paused?<Warning>Sequence paused. Timings remain fixed; review overdue actions before resuming.</Warning>:next?<div style={{marginTop:14}}><b>{next.name}</b><div style={{fontSize:36,fontWeight:800,color:(actionTime(next))<now?C.red:C.gold,fontVariantNumeric:'tabular-nums'}}>{countdown(actionTime(next),now)}</div><div>{players.find(p=>p.id===next.playerId)?.name||'Unassigned'} · {next.type==='Rally'?'Open rally':'Arrival / action'}</div><Button onClick={()=>copy(next)}>Copy callout</Button></div>:<p>No active timers</p>}</div>
 {conflicts(battle.events).map(w=><Warning key={w}>{w}</Warning>)}{message&&<Warning>{message}</Warning>}
 { [...battle.events].sort((a,b)=>a.plannedAt-b.plannedAt).map(e=><div key={e.id} style={{borderBottom:`1px solid ${C.border}`,padding:'12px 0',overflowWrap:'anywhere'}}>
 <b>{e.name}</b> · {e.type}<div>{players.find(p=>p.id===e.playerId)?.name||'Unassigned'} · {e.status}</div><div>{e.actualAt!=null?'Confirmed':e.reportedAt!=null?'Reported':'Projected'} arrival {clock(e.actualAt??e.plannedAt)} UTC</div>
 {!TERMINAL.includes(e.status)&&<div style={{fontSize:24,color:e.review?C.gold:C.white,fontVariantNumeric:'tabular-nums'}}>{countdown(e.startAt??e.plannedAt,now)}</div>}
 {e.startAt!=null&&<div>Open / depart {clock(e.startAt)} UTC</div>}{e.review&&<Warning>Requires review. Hold capture-dependent action.</Warning>}
 <div style={row}><Button onClick={()=>onSave({...e,status:'Confirmed',actualAt:now})}>Confirm now</Button><Button onClick={()=>copy(e)}>Copy</Button><Button onClick={()=>onEdit(e)}>Edit</Button></div>
 <details><summary style={{minHeight:44,paddingTop:8}}>Status, actual time & links</summary><Field label="Status" value={e.status} onChange={status=>onSave({...e,status,...(status==='Confirmed'?{actualAt:now}:{})})}>{STATUSES.map(s=><option key={s}>{s}</option>)}</Field>
 <Button onClick={()=>onSave({...e,reportedAt:now})}>Mark reported</Button><Button onClick={()=>onDuplicate(e)}>Duplicate</Button>
 <form onSubmit={ev=>{ev.preventDefault();const form=new FormData(ev.currentTarget);try{onSave({...e,actualAt:utcTime(form.get('date'),form.get('time')),status:'Confirmed'});}catch(err){setMessage(err.message);}}}><label>Actual UTC date<input aria-label="Actual UTC date" name="date" type="date" defaultValue={battle.date} style={{minHeight:44,width:'100%',boxSizing:'border-box'}}/></label><label>Actual HHMMSS<input aria-label="Actual UTC time" name="time" placeholder="HHMMSS" style={{minHeight:44,width:'100%',boxSizing:'border-box'}}/></label><button style={{minHeight:44}}>Save actual time</button></form>
 <p>{e.dependency?.mode==='relative'?`Relative: ${e.dependency.offsetSeconds}s after ${battle.events.find(x=>x.id===e.dependency.parentId)?.name}`:'Fixed UTC'}</p>{battle.events.filter(x=>x.dependency?.parentId===e.id).map(x=><div key={x.id}>↳ {x.name} · {clock(x.plannedAt)} UTC</div>)}
 {e.review&&<Button onClick={()=>onSave({...e,review:false})}>Reviewed; clear hold</Button>}
 </details></div>)}
 </>;
}
