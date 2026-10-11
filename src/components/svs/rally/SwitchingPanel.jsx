import {useState} from 'react';
import {C} from '../../../utils/constants.js';
import {switching,utcTime} from '../../../services/castleTimingService.js';
import {resolveBattleTimers} from '../../../services/battleOperationsService.js';
import {uid,fmtSend} from './rallyRoomHelpers.js';
import {MarchInput} from './SmartInputs.jsx';
const input={width:'100%',boxSizing:'border-box',minHeight:44,background:C.section,border:`1px solid ${C.border}`,borderRadius:10,padding:'10px 12px',color:C.white,fontSize:16};
const button={minHeight:44,borderRadius:10,padding:'8px 14px',background:C.section,border:`1px solid ${C.border}`,color:C.icy,fontSize:14};
function Field({label,children}){return <label style={{display:'block',fontSize:14,color:C.icy,marginBottom:12}}>{label}<div style={{marginTop:6}}>{children}</div></label>;}
export function SwitchingPanel({timers,leaders,draft,onChange,onAdd,now,planDate}) {
 const f={date:planDate||new Date().toISOString().slice(0,10),counterId:'',counterTime:'',entry:'',enemy:'',buffer:'',delay:'0',leaderId:'',mode:'entry',departure:'',marchSecs:null,...draft};
 const set=(key,value)=>onChange({...f,[key]:value});const [error,setError]=useState('');
 const counter=timers.find(t=>t.id===f.counterId);
 let c,g,e,depart;try{c=counter?(counter.actualImpactAtUtc??counter.impactAtUtc)*1000:utcTime(f.date,f.counterTime);}catch{}
 try{const delay=Number(f.delay);if(!Number.isFinite(delay)||delay<0)throw Error();g=utcTime(f.date,f.mode==='entry'?f.entry:f.departure);if(f.mode==='departure'){depart=g;if(f.marchSecs==null)throw Error();g+=f.marchSecs*1000;}g+=delay*1000;}catch{g=undefined;}
 try{e=utcTime(f.date,f.enemy);}catch{}
 const buffer=f.buffer===''?NaN:Number(f.buffer);const result=switching(c,g,e,buffer,now*1000,depart);
 function save(){try{if(![c,g,e,buffer,Number(f.delay)].every(Number.isFinite)||buffer<0||!f.leaderId)throw Error('Complete timings, choose a garrison leader and enter a buffer.');
 const seq=uid(),counterId=counter?.id||uid();const leader=leaders.find(l=>l.id===f.leaderId);const built=[];
 if(!counter)built.push({id:counterId,sequenceId:seq,leaderName:'Our counter',rallyType:'Counter Rally',impactAtUtc:c/1000,status:'Planned',dependency:{mode:'fixed'}});
 else built.push({...counter,sequenceId:seq});
 built.push({id:uid(),sequenceId:seq,leaderName:leader.name,leaderId:leader.playerId||leader.id,rallyType:'Garrison Entry',impactAtUtc:g/1000,openRallyAtUtc:depart==null?null:depart/1000,status:'Planned',captureDependent:true,dependency:{mode:'relative',parentId:counterId,offsetSecs:(g-c)/1000},safetyBufferSecs:buffer});
 built.push({id:uid(),sequenceId:seq,leaderName:'Enemy follow-up',rallyType:'Counter-Counter',enemy:true,impactAtUtc:e/1000,status:'Planned',dependency:{mode:'fixed'}});
 resolveBattleTimers([...timers.filter(t=>t.id!==counterId),...built]);onAdd(built);setError('');}catch(err){setError(err.message);}}
 return <div style={{background:C.card,borderRadius:14,padding:16,marginTop:16}}><h3 style={{fontSize:16,margin:'0 0 14px',color:C.white}}>Switching sequence</h3>
 <Field label="UTC date"><input type="date" style={input} value={f.date} onChange={e=>set('date',e.target.value)}/></Field>
 <Field label="Our counter"><select style={input} value={f.counterId} onChange={e=>set('counterId',e.target.value)}><option value="">Enter impact manually</option>{timers.filter(t=>!t.enemy).map(t=><option key={t.id} value={t.id}>{t.leaderName} · {fmtSend(t.impactAtUtc)}</option>)}</select></Field>
 {!counter&&<Field label="Counter impact · HHMMSS"><input style={input} value={f.counterTime} onChange={e=>set('counterTime',e.target.value)}/></Field>}
 <Field label="Garrison leader"><select style={input} value={f.leaderId} onChange={e=>set('leaderId',e.target.value)}><option value="">Choose saved leader</option>{leaders.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></Field>
 <Field label="Calculate entry from"><select style={input} value={f.mode} onChange={e=>set('mode',e.target.value)}><option value="entry">Projected entry time</option><option value="departure">Departure + march</option></select></Field>
 <Field label={`${f.mode==='entry'?'Entry':'Departure'} · HHMMSS`}><input style={input} value={f.mode==='entry'?f.entry:f.departure} onChange={e=>set(f.mode==='entry'?'entry':'departure',e.target.value)}/></Field>
 {f.mode==='departure'&&<Field label="March · 412 = 4m12s"><MarchInput value={f.marchSecs} onChange={v=>set('marchSecs',v)}/></Field>}
 <Field label="Enemy follow-up · HHMMSS · fixed"><input style={input} value={f.enemy} onChange={e=>set('enemy',e.target.value)}/></Field>
 <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}><Field label="Safety buffer · seconds"><input style={input} type="number" min="0" value={f.buffer} onChange={e=>set('buffer',e.target.value)}/></Field><Field label="Entry delay · seconds"><input style={input} type="number" min="0" value={f.delay} onChange={e=>set('delay',e.target.value)}/></Field></div>
 {result.window!=null&&<div style={{fontSize:14,color:C.white,lineHeight:1.8}}>Window {result.window}s · margin {result.margin}s<br/>After buffer: {Number.isFinite(result.effective)?`${result.effective}s`:'Enter buffer'}</div>}
 {result.warnings.map(w=><div key={w} style={{fontSize:14,color:C.gold,marginTop:8}}>{w}</div>)}<p style={{fontSize:14,color:C.icy}}>Timings are estimates. Confirm capture before entry.</p>
 {error&&<div role="alert" style={{color:C.red,fontSize:14,marginBottom:10}}>{error}</div>}<button onClick={save} style={{...button,width:'100%',background:C.gold,color:C.bg,fontWeight:700}}>Add linked sequence</button></div>;
}
