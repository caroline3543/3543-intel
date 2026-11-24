import {useEffect,useState} from 'react';
import {ATTENDANCE_RESULTS,attendanceOpen,eventStart} from '../../../src/services/eventPlanner.js';

const utc = value => new Date(value).toISOString().slice(0,16).replace('T',' ')+' UTC';

export function PlannerAttendance({kind,alliance,legion,plan,players,onAttendance,onSchedule,onNewEvent,card,button}) {
  const [clock,setClock] = useState(Date.now);
  const [date,setDate] = useState(plan.date||'');
  const [time,setTime] = useState(plan.time||'');
  const [occurrence,setOccurrence] = useState('');
  useEffect(()=>{
    const tick=()=>setClock(Date.now());
    const interval=setInterval(tick,1000);
    return ()=>clearInterval(interval);
  },[]);
  useEffect(()=>{setDate(plan.date||'');setTime(plan.time||'');},[plan.date,plan.time,plan.occurrenceId]);
  const currentStart = eventStart(plan.date,plan.time);
  const started = currentStart!==null && Date.parse(currentStart)<=clock;
  const choices=new Map(currentStart ? [[plan.occurrenceId,currentStart]] : []);
  const records=players.flatMap(player=>Object.entries(player.plannerAttendance||{})
    .filter(([,record])=>record.kind===kind&&record.alliance===alliance&&record.legion===legion)
    .map(([id,record])=>{choices.set(id,record.startAt);return {id,record,player};}));
  const selected = choices.has(occurrence) ? occurrence : currentStart ? plan.occurrenceId : [...choices.keys()].at(-1);
  const start = choices.get(selected);
  const unlocked = attendanceOpen(start,clock);
  return <>
    <div style={card}>
      <strong>Event schedule · UTC</strong>
      <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:8,margin:'8px 0'}}>
        <label>Date<input aria-label="Event date (UTC)" type="date" value={date} disabled={started} onChange={e=>setDate(e.target.value)} style={{...button,width:'100%',marginTop:4,minWidth:0}}/></label>
        <label>Start time<input aria-label="Event start time (UTC)" type="time" value={time} disabled={started} onChange={e=>setTime(e.target.value)} style={{...button,width:'100%',marginTop:4,minWidth:0}}/></label>
      </div>
      {!started && <button type="button" style={button} disabled={!eventStart(date,time)||(date===plan.date&&time===plan.time)} onClick={()=>onSchedule(date,time)}>Save schedule</button>}
      {currentStart && <p style={{fontSize:12,color:'#a9bfd0',margin:'8px 0 0'}}>Starts {utc(currentStart)}</p>}
      {started&&<button type="button" style={{...button,marginTop:8}} disabled={!attendanceOpen(currentStart,clock)} onClick={()=>{
        if(window.confirm('Start a new event for this legion? The previous attendance and power history are kept.')){setOccurrence('');onNewEvent();}
      }}>Start a new event</button>}
    </div>
    {choices.size>0&&<details style={card}>
      <summary style={{cursor:'pointer',fontWeight:650,minHeight:32}}>Attendance</summary>
      {choices.size>1&&<label style={{display:'block',marginBottom:8}}>Attendance event<select aria-label="Attendance event" value={selected} style={{...button,width:'100%',marginTop:4}} onChange={e=>setOccurrence(e.target.value)}>
        {[...choices].sort((a,b)=>b[1].localeCompare(a[1])).map(([id,time])=><option key={id} value={id}>{utc(time)}{id===plan.occurrenceId?' · Current':''}</option>)}
      </select></label>}
      {start&&!unlocked&&<p style={{fontSize:13,color:'#a9bfd0'}}>Attendance opens {utc(Date.parse(start)+3600000)}.</p>}
      {records.filter(row=>row.id===selected).map(({player,record})=>{
        const isSub=record.role==='sub';
        const playerName=player.username||player.alias||player.id;
        const update=change=>onAttendance({id:String(player.id),occurrenceId:selected,...change});
        return <div key={player.id} style={{borderTop:'1px solid #30465a',padding:'10px 0',display:'grid',gap:6}}>
          <strong>{playerName} <small style={{color:'#a9bfd0'}}>{isSub?'Substitute':'Combatant'}</small></strong>
          {isSub&&<label><input type="checkbox" checked={Boolean(record.calledUp)} disabled={!unlocked} onChange={e=>update({calledUp:e.target.checked})}/> Called up</label>}
          <select aria-label={'Attendance for '+playerName} value={record.result||''} disabled={!unlocked} onChange={e=>update({result:e.target.value})} style={button}>
            <option value="">Pending</option>
            {ATTENDANCE_RESULTS.filter(([id])=>id!=='not-called'||isSub).map(([id,label])=><option key={id} value={id} disabled={isSub&&(id==='no-show'&&!record.calledUp||id==='not-called'&&record.calledUp)}>{label}</option>)}
          </select>
        </div>;
      })}
      {!records.some(row=>row.id===selected)&&<p style={{fontSize:13,color:'#a9bfd0'}}>Add a combatant or substitute to record attendance.</p>}
    </details>}
  </>;
}
