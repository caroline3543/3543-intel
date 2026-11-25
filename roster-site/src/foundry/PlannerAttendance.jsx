import {useEffect,useState} from 'react';
import {ATTENDANCE_RESULTS,attendanceOpen,eventStart} from '../../../src/services/eventPlanner.js';

const utc = value => new Date(value).toISOString().slice(0,16).replace('T',' ')+' UTC';

export function PlannerAttendance({kind,alliance,legion,plan,players,onAttendance,onSchedule,onNewEvent,card,button}) {
  const [clock,setClock] = useState(Date.now);
  const [date,setDate] = useState(plan.date||'');
  const [time,setTime] = useState(plan.time||'');
  const [occurrence,setOccurrence] = useState('');
  const [dateTouched,setDateTouched] = useState(false);
  const [timeTouched,setTimeTouched] = useState(false);
  useEffect(()=>{
    const tick=()=>setClock(Date.now());
    const interval=setInterval(tick,1000);
    return ()=>clearInterval(interval);
  },[]);
  useEffect(()=>{setDate(plan.date||'');setTime(plan.time||'');setDateTouched(false);setTimeTouched(false);},[plan.date,plan.time,plan.occurrenceId]);
  const currentStart = eventStart(plan.date,plan.time);
  const started = currentStart!==null && Date.parse(currentStart)<=clock;
  const typedDate=date.trim(), typedTime=time.trim();
  const validDate=Boolean(eventStart(typedDate,'00:00'));
  const validTime=Boolean(eventStart('2026-01-01',typedTime));
  const dateError=dateTouched&&typedDate!==''&&!validDate;
  const timeError=timeTouched&&typedTime!==''&&!validTime;
  const canSave=!started&&validDate&&validTime&&(typedDate!==plan.date||typedTime!==plan.time);
  const fieldStyle={...button,display:'block',width:'100%',minWidth:0,maxWidth:'100%',boxSizing:'border-box',marginTop:4,textAlign:'left',fontSize:16,fontVariantNumeric:'tabular-nums'};
  const choices=new Map(currentStart ? [[plan.occurrenceId,currentStart]] : []);
  const records=players.flatMap(player=>Object.entries(player.plannerAttendance||{})
    .filter(([,record])=>record.kind===kind&&record.alliance===alliance&&record.legion===legion)
    .map(([id,record])=>{choices.set(id,record.startAt);return {id,record,player};}));
  const selected = choices.has(occurrence) ? occurrence : currentStart ? plan.occurrenceId : [...choices.keys()].at(-1);
  const start = choices.get(selected);
  const unlocked = attendanceOpen(start,clock);
  return <>
    <details style={card}>
      <summary style={{cursor:'pointer',fontWeight:650}}>
        Event schedule · {currentStart?utc(currentStart):'Set UTC start'}
      </summary>
      <form onSubmit={e=>{e.preventDefault();if(canSave)onSchedule(typedDate,typedTime);}} style={{display:'grid',gap:10,marginTop:8}}>
        <label>Date (YYYY-MM-DD)
          <input aria-label="Event date (UTC)" type="text" autoComplete="off" spellCheck={false}
            placeholder="YYYY-MM-DD" value={date} disabled={started} aria-invalid={dateError||undefined}
            aria-describedby={dateError?'planner-date-error':undefined}
            onChange={e=>setDate(e.target.value)} onBlur={()=>setDateTouched(true)} style={fieldStyle}/>
          {dateError&&<span id="planner-date-error" style={{display:'block',marginTop:4,color:'#f3adad'}}>Enter a valid date in YYYY-MM-DD format.</span>}
        </label>
        <label>Start time (UTC, 24-hour)
          <input aria-label="Event start time (UTC)" type="text" autoComplete="off" spellCheck={false}
            placeholder="HH:MM, e.g. 20:30" value={time} disabled={started} aria-invalid={timeError||undefined}
            aria-describedby={timeError?'planner-time-error':undefined}
            onChange={e=>setTime(e.target.value)} onBlur={()=>setTimeTouched(true)} style={fieldStyle}/>
          {timeError&&<span id="planner-time-error" style={{display:'block',marginTop:4,color:'#f3adad'}}>Enter a UTC time from 00:00 to 23:59.</span>}
        </label>
        {!started&&<button type="submit" style={{...button,justifySelf:'start'}} disabled={!canSave}>Save schedule</button>}
      </form>
      {started&&<button type="button" style={{...button,marginTop:8}} disabled={!attendanceOpen(currentStart,clock)} onClick={()=>{
        if(window.confirm('Start a new event for this legion? The previous attendance and power history are kept.')){setOccurrence('');onNewEvent();}
      }}>Start a new event</button>}
    </details>
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
