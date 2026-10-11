import {useState} from 'react';
import {uid,utcTime,duration,switching,clock} from '../../../services/castleTimingService.js';
import {Button,Field,Warning,panel} from './CommandUI.jsx';
export function SwitchingFight({battle,players,now,draft,onDraft,onSequence}) {
 const f={date:battle.date,counter:'',entry:'',enemy:'',departure:'',march:'',buffer:'',delay:'0',counterLeader:'',garrisonLeader:'',...draft};
 const set=(k,v)=>onDraft({...f,[k]:v}); const [error,setError]=useState('');
 let c,g,e,departure,buffer,delay;try{c=utcTime(f.date,f.counter);}catch{}try{e=utcTime(f.date,f.enemy);}catch{}
 try{buffer=duration(f.buffer);delay=duration(f.delay);if(f.departure){departure=utcTime(f.date,f.departure);g=departure+duration(f.march)*1000+delay*1000;}else g=utcTime(f.date,f.entry)+delay*1000;}catch{}
 const result=switching(c,g,e,buffer||0,now,departure);
 function save(){try{if(![c,g,e,buffer,delay].every(Number.isFinite))throw Error('Complete timings and an explicit safety buffer');const id=uid();onSequence([
 {id,name:'Our counter',type:'Rally',playerId:f.counterLeader,plannedAt:c,status:'Planned',dependency:{mode:'fixed'}},
 {id:uid(),name:'Main garrison',type:'Garrison',playerId:f.garrisonLeader,plannedAt:g,startAt:departure,status:'Planned',dependency:{mode:'relative',parentId:id,offsetSeconds:(g-c)/1000},captureDependent:true},
 {id:uid(),name:'Enemy follow-up',type:'Enemy',plannedAt:e,status:'Planned',dependency:{mode:'fixed'}}]);setError('');}catch(err){setError(err.message);}}
 return <div style={panel}><h3>Switching Fight</h3><Field label="UTC date" type="date" value={f.date} onChange={v=>set('date',v)}/>
 {['counter','entry','enemy'].map(k=><Field key={k} label={{counter:'Our counter impact · HHMMSS',entry:'Garrison entry · HHMMSS',enemy:'Enemy follow-up · HHMMSS'}[k]} value={f[k]} onChange={v=>set(k,v)}/>)}
 <details><summary style={{minHeight:44}}>Calculate entry from departure</summary><Field label="Departure · HHMMSS (overrides entry)" value={f.departure} onChange={v=>set('departure',v)}/><Field label="March · seconds or m:ss" value={f.march} onChange={v=>set('march',v)}/></details>
 <Field label="Safety buffer · seconds" value={f.buffer} onChange={v=>set('buffer',v)}/><Field label="Setup / entry delay · seconds" value={f.delay} onChange={v=>set('delay',v)}/>
 {['counterLeader','garrisonLeader'].map(k=><Field key={k} label={k==='counterLeader'?'Counter leader':'Garrison leader'} value={f[k]} onChange={v=>set(k,v)}><option value="">Unassigned</option>{players.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</Field>)}
 {result.window!=null&&<div><p>Switch window: <b>{result.window}s</b><br/>Defensive margin: <b>{result.margin}s</b><br/>Effective margin: <b>{result.effective}s</b><br/>Projected entry: {clock(g)} UTC</p></div>}
 {result.warnings.map(w=><Warning key={w}>{w}</Warning>)}<Warning>Estimated timings. Capture and holding require confirmation.</Warning>{error&&<Warning>{error}</Warning>}<Button onClick={save}>Add linked sequence</Button>
 </div>;
}
