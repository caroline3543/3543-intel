import {useEffect,useRef,useState} from 'react';
import {Card,Hint,button,field,C} from './ui.jsx';
import {record,setRecord,playerLabel} from './planner.js';
import {comparePlayers,parsePower,fmtPower,powerPastePreview} from './power.js';
export function PowerEntry({plan,team,players,onChange,onClose,initialPlayerId=''}){
 const members=players.filter(p=>team.members.some(m=>m.id===p.id));
 const [order,setOrder]=useState(()=>[...members].sort(comparePlayers(plan,'game')).map(p=>p.id));
 const [draft,setDraft]=useState(()=>Object.fromEntries(members.map(p=>[p.id,String(record(plan,p).troopPower??'')])));
 const [mode,setMode]=useState('game'),[paste,setPaste]=useState(''),[preview,setPreview]=useState(null),[error,setError]=useState('');
 const panel=useRef(null),inputs=useRef({});
 useEffect(()=>{const prev=document.activeElement;panel.current?.scrollIntoView?.({block:'start'});(inputs.current[initialPlayerId]||inputs.current[order[0]])?.focus();return()=>{if(prev?.isConnected)prev.focus();};},[]);
 function sorted(nextMode){setMode(nextMode);setOrder([...members].sort(comparePlayers(plan,nextMode)).map(p=>p.id));}
 function save(){
  if(plan.locked)return;let next=plan;
  for(const p of members){
   try{const n=parsePower(draft[p.id]);next=setRecord(next,p,{troopPower:n==null?'':String(n)});}
   catch(e){setError(`${playerLabel(p)}: ${e.message}`);inputs.current[p.id]?.focus();return;}
  }
  onChange(next);onClose();
 }
 return <div ref={panel}><Card title={`Troop power · ${team.host} Legion ${team.number}`}>
  <Hint>Use the Troop Power shown in TAL, such as 3,179. Keep the same units as the legion leaderboard. City power is different.</Hint>
  <label>Entry order<select aria-label="Troop power entry order" style={{...field,margin:'6px 0 10px'}} value={mode} onChange={e=>sorted(e.target.value)}><option value="game">Game order · R5 to R1, then troop power</option><option value="name">Name A–Z</option></select></label>
  <Hint>Unknown ranks and powers appear last. Rows stay still while you type. Press Next to continue.</Hint>
  <details style={{marginBottom:16}}><summary style={{minHeight:44,paddingTop:12,color:C.gold,cursor:'pointer'}}>Paste powers</summary>
   <Hint>One player ID or name and power per line. Use a tab, comma or space between them.</Hint>
   <textarea aria-label="Paste troop powers" placeholder={'681766601\t3,179\nCaroline\t8,643'} disabled={plan.locked} value={paste} onChange={e=>{setPaste(e.target.value);setPreview(null);}} style={{...field,minHeight:110}}/>
   <button style={{...button,marginTop:8}} disabled={plan.locked||!paste.trim()} onClick={()=>setPreview(powerPastePreview(paste,members,plan))}>Check powers</button>
   {preview&&<div><Hint>{preview.filter(r=>!r.error).length} ready · {preview.filter(r=>r.error).length} to fix. Only ready rows will be used.</Hint>{preview.map((r,i)=><p key={i} style={{fontSize:14,color:r.error?C.red:C.icy,overflowWrap:'anywhere'}}>{r.error?`${r.line}: ${r.error}`:`${playerLabel(r.player)} · ${fmtPower(r.before)} → ${fmtPower(r.value)}`}</p>)}<button style={button} disabled={plan.locked||!preview.some(r=>!r.error)} onClick={()=>{const next={...draft};for(const r of preview)if(!r.error)next[r.player.id]=String(r.value);setDraft(next);setPreview(null);setPaste('');setError('');}}>Use ready values</button><Hint>Review below, then Save powers.</Hint></div>}
  </details>
  {order.map((id,index)=>{const p=members.find(p=>p.id===id);if(!p)return null;return <label key={id} style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) minmax(90px,38%)',gap:10,alignItems:'center',padding:'10px 0',borderTop:`1px solid ${C.border}`}}><span style={{overflowWrap:'anywhere',fontSize:15}}>{playerLabel(p)}<span style={{display:'block',fontSize:13,color:C.icy,marginTop:4}}>{p.allianceRank||'Rank unknown'} · {p.fid||'ID missing'}{p.allianceTag?` · ${p.allianceTag}`:''}</span></span><input ref={el=>{inputs.current[id]=el;}} aria-label={`Troop power for ${playerLabel(p)}`} inputMode="decimal" enterKeyHint={index===order.length-1?'done':'next'} disabled={plan.locked} placeholder="Not entered" value={draft[id]||''} onChange={e=>{setDraft({...draft,[id]:e.target.value});setError('');}} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();if(index<order.length-1)inputs.current[order[index+1]]?.focus();else save();}}} style={field}/></label>;})}
  {error&&<p role="alert" style={{color:C.red,fontSize:14}}>{error}</p>}
  <div style={{display:'flex',gap:8,marginTop:12,position:'sticky',bottom:'calc(84px + env(safe-area-inset-bottom, 0px))',padding:'10px 0',background:C.section}}><button style={{...button,flex:1}} onClick={onClose}>Cancel</button><button style={{...button,flex:2,color:C.gold}} disabled={plan.locked} onClick={save}>Save powers</button></div>
 </Card></div>;
}
