import {useState} from 'react';
import {validateBattleTime} from './model.js';
import {button,field,Hint,C} from '../tal/ui.jsx';
export function BattleSchedule({event,onSave}){
 const [base,setBase]=useState({date:event.date,time:event.time}),[date,setDate]=useState(event.date),[time,setTime]=useState(event.time),[error,setError]=useState('');
 const changed=event.date!==base.date||event.time!==base.time;
 function latest(){setDate(event.date);setTime(event.time);setBase({date:event.date,time:event.time});setError('');}
 function save(){try{validateBattleTime(date,time);if(changed)throw Error('Another leader changed the schedule. Use the latest schedule before editing.');onSave({date,time});setBase({date,time});setError('');}catch(e){setError(e.message);}}
 return <div><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))',gap:8}}><label>Date · UTC<input type="date" style={field} value={date} onChange={e=>setDate(e.target.value)}/></label><label>Time · UTC<input type="time" style={field} value={time} onChange={e=>setTime(e.target.value)}/></label></div><button style={{...button,margin:'8px 0'}} onClick={save}>Save schedule</button>{error&&<p role="alert" style={{fontSize:14,color:C.red}}>{error}</p>}{changed&&<><Hint>Shared schedule: {event.date} · {event.time} UTC</Hint><button style={button} onClick={latest}>Use latest schedule</button></>}</div>;
}
