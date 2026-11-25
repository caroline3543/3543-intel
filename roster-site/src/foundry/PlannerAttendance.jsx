import {useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import {PlannerSheet} from './PlannerSheet.jsx';
import {ATTENDANCE_RESULTS,EVENT_NAMES,attendanceOpen,eventStart} from '../../../src/services/eventPlanner.js';

const utc = value => new Date(value).toISOString().slice(0,16).replace('T',' ')+' UTC';

export function PlannerAttendance({kind,alliance,legion,plan,players,onAttendance,onSchedule,onNewEvent,card,button,scheduleTarget}) {
  const [scheduleOpen,setScheduleOpen] = useState(false);
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
  const scheduleTrigger=<button className="planner-button" type="button" onClick={()=>{setDate(plan.date||'');setTime(plan.time||'');setScheduleOpen(true);}}>{currentStart?plan.time+' UTC':'Set UTC start'}</button>;
  return <>
    {scheduleTarget&&createPortal(scheduleTrigger,scheduleTarget)}
    <PlannerSheet open={scheduleOpen} onClose={()=>setScheduleOpen(false)} title="Event schedule" context={EVENT_NAMES[kind]+' · '+alliance+' · Legion '+legion} footer={!started&&<button type="button" className="planner-button planner-primary" disabled={!eventStart(date,time)||(date===plan.date&&time===plan.time)} onClick={()=>{onSchedule(date,time);setScheduleOpen(false);}}>Save schedule</button>}>
      <label className="planner-field">Date
        <span className="planner-native-field" data-empty={!date}>
          <input aria-label="Event date (UTC)" type="date" value={date} disabled={started} onChange={e=>setDate(e.target.value)}/>
          {!date&&<span aria-hidden="true">Choose a date</span>}
        </span>
      </label>
      <label className="planner-field">Start time (UTC)
        <span className="planner-native-field" data-empty={!time}>
          <input aria-label="Event start time (UTC)" type="time" value={time} disabled={started} onChange={e=>setTime(e.target.value)}/>
          {!time&&<span aria-hidden="true">Choose a time</span>}
        </span>
      </label>
      <p className="planner-muted">Attendance opens one hour after the start.</p>
      {started&&<button type="button" className="planner-button" disabled={!attendanceOpen(currentStart,clock)} onClick={()=>{
        if(window.confirm('Start a new event for this legion? The previous attendance and power history are kept.')){setOccurrence('');setScheduleOpen(false);onNewEvent();}
      }}>Start a new event</button>}
    </PlannerSheet>
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
