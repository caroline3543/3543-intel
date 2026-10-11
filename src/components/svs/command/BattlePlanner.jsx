import {useState} from 'react';
import {uid,utcTime,duration,rallyStart,rallyImpact,clock,resolveEvents} from '../../../services/castleTimingService.js';
import {Button,Field,Warning,panel} from './CommandUI.jsx';
export function BattlePlanner({battle,players,onSave,now,draft,onDraft,editing,onDone}) {
  const defaults=editing?{...editing,time:clock(editing.plannedAt),prep:String(editing.prep||60),travel:String(editing.travel??''),date:new Date(editing.plannedAt).toISOString().slice(0,10),mode:'impact',dependencyMode:editing.dependency?.mode||'fixed',parentId:editing.dependency?.parentId||'',offset:String(editing.dependency?.offsetSeconds||0)}:{name:'',playerId:'',type:'Rally',time:'',prep:'60',travel:'',mode:'impact',date:battle.date,dependencyMode:'fixed',parentId:'',offset:'0'};
  const f=editing?draft||defaults:{...defaults,...draft}; const set=(key,value)=>onDraft({...f,[key]:value});
  const [error,setError]=useState('');
  let result=null;
  try {const travel=duration(f.travel),prep=f.type==='Rally'?duration(f.prep):0;const at=utcTime(f.date,f.time);const impact=f.mode==='impact'?at:rallyImpact(at,prep,travel);result={plannedAt:impact,startAt:rallyStart(impact,prep,travel),prep,travel};}catch{}
  function save(){try {
    if(!f.name.trim())throw Error('Enter an event name');
    if(!result)throw Error('Enter valid UTC time and travel duration');
    const event={...editing,id:editing?.id||uid(),name:f.name,playerId:f.playerId,type:f.type,status:editing?.status||'Planned',...result,dependency:f.dependencyMode==='relative'?{mode:'relative',parentId:f.parentId,offsetSeconds:Number(f.offset)}:{mode:'fixed'},captureDependent:!!f.captureDependent};
    if(event.dependency.mode==='relative' && (!f.parentId || !Number.isFinite(Number(f.offset))))throw Error('Choose parent and offset');
    resolveEvents([...battle.events.filter(e=>e.id!==event.id),event]);onSave(event);onDraft(null);onDone?.();setError('');
  }catch(e){setError(e.message);}}
  return <div style={panel}><h3>{editing?'Edit timer':'Battle Planner'}</h3>
    <Field label="Event name" value={f.name} onChange={v=>set('name',v)}/>
    <Field label="Responsible player" value={f.playerId} onChange={v=>{const p=players.find(p=>p.id===v);onDraft({...f,playerId:v,travel:p?.marchSeconds!=null?String(p.marchSeconds):''});}}><option value="">Unassigned</option>{players.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</Field>
    <Field label="Event type" value={f.type} onChange={v=>set('type',v)}>{['Rally','Garrison','Enemy','Reinforcement','Custom'].map(x=><option key={x}>{x}</option>)}</Field>
    <Field label="UTC date" type="date" value={f.date} onChange={v=>set('date',v)}/>
    <Field label="Calculate from" value={f.mode} onChange={v=>set('mode',v)}><option value="impact">Desired arrival</option><option value="start">Open rally / depart</option></Field>
    <Field label="UTC time · HHMMSS" value={f.time} onChange={v=>set('time',v)}/>
    {f.type==='Rally'&&<Field label="Rally preparation" value={f.prep} onChange={v=>set('prep',v)}>{[60,180,300].map(n=><option key={n} value={n}>{n/60} min</option>)}</Field>}
    <Field label="Travel · seconds or m:ss" value={f.travel} onChange={v=>set('travel',v)}/>
    <Field label="Timing dependency" value={f.dependencyMode} onChange={v=>set('dependencyMode',v)}><option value="fixed">Fixed UTC</option><option value="relative">Relative to another arrival</option></Field>
    {f.dependencyMode==='relative'&&<><Field label="Linked event" value={f.parentId} onChange={v=>set('parentId',v)}><option value="">Choose</option>{battle.events.filter(e=>e.id!==editing?.id).map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</Field><Field label="Offset · signed seconds" value={f.offset} onChange={v=>set('offset',v)}/><label style={{display:'flex',alignItems:'center',minHeight:44}}><input type="checkbox" checked={!!f.captureDependent} onChange={e=>set('captureDependent',e.target.checked)}/>Requires successful capture</label></>}
    {result&&<p>Open / depart {clock(result.startAt)} UTC → arrival {clock(result.plannedAt)} UTC{result.startAt<now&&<Warning>Launch time overdue</Warning>}</p>}
    {error&&<Warning>{error}</Warning>}<Button onClick={save}>Save timer</Button>{editing&&<Button onClick={onDone}>Cancel edit</Button>}
  </div>;
}
