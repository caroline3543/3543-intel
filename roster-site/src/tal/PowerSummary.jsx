import {useState} from 'react';
import {Hint,button,field,C} from './ui.jsx';
import {fmtPower,parsePower,teamPower,targetGap} from './power.js';
export function PowerSummary({plan,team,players,onChange}){
 const stats=teamPower(plan,team,players),[target,setTarget]=useState(String(team.targetPower??'')),[error,setError]=useState('');
 let savedTarget=null;try{savedTarget=parsePower(team.targetPower);}catch{}
 function save(){try{const n=parsePower(target);onChange({...plan,teams:plan.teams.map(t=>t.id===team.id?{...t,targetPower:n==null?'':String(n)}:t)});setError('');}catch(e){setError(e.message);}}
 return <section aria-label={`Power summary for ${team.host} Legion ${team.number}`} style={{padding:12,background:C.bg,borderRadius:12,margin:'12px 0'}}>
  <div style={{fontSize:16,fontWeight:700}}>{stats.known?`Planned top 20: ${fmtPower(stats.planned)}`:'Troop power not entered'}</div>
  {stats.known>0&&<div style={{fontSize:14,color:C.icy,marginTop:6}}>Registered top 20: {stats.registeredKnown?fmtPower(stats.confirmed):stats.registeredMissing?'Not entered':fmtPower(stats.confirmed)}</div>}
  <Hint>{stats.known}/{stats.count} powers entered{stats.known>0?` · Total ${fmtPower(stats.total)}`:''}</Hint>
  <details><summary style={{minHeight:44,paddingTop:12,color:C.gold,cursor:'pointer'}}>Power target & calculation{savedTarget!=null?` · ${fmtPower(savedTarget)}`:''}</summary><Hint>Use TAL leaderboard units. Planned power uses the highest 20 recorded selected players; registered power uses players marked registered.</Hint><label>Target troop power<input aria-label={`Power target for ${team.host} Legion ${team.number}`} disabled={plan.locked} value={target} inputMode="decimal" placeholder="e.g. 93,348" onChange={e=>setTarget(e.target.value)} style={{...field,margin:'6px 0 8px'}}/></label><button style={button} disabled={plan.locked} onClick={save}>Save target</button>{error&&<p role="alert" style={{color:C.red,fontSize:14}}>{error}</p>}<Hint>The top 64 legions per zone qualify. A manual target is a guide, not a qualification guarantee.</Hint></details>
  {savedTarget!=null&&(stats.known?<div style={{fontSize:14,lineHeight:1.6,marginTop:8}}><div style={{color:stats.planned<savedTarget?C.gold:C.green}}>Planned: {targetGap(stats.planned,savedTarget)}</div><div style={{color:stats.confirmed<savedTarget?C.gold:C.green}}>Registered: {stats.registeredKnown||!stats.registeredMissing?targetGap(stats.confirmed,savedTarget):'Power not entered'}</div>{stats.missing>0&&<div style={{color:C.icy}}>Partial data · {stats.missing} missing</div>}</div>:<Hint>Enter troop powers to compare with your target.</Hint>)}
 </section>;
}
