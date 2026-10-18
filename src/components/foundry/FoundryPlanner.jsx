import { useState, useRef } from 'react';
import { C } from '../../utils/constants.js';
import { uid } from '../../utils/dates.js';
import { newFoundryPlan } from '../../data/playerSchema.js';
import { BUILDINGS, PHASES, TEAM_COLORS } from '../../data/foundry.js';
import { battleSheet, memberLabel, validateFoundry } from '../../services/foundryService.js';
import { foundryImage, downloadFoundry } from '../../services/foundryExport.js';
import { FoundryMap } from './FoundryMap.jsx';
const field={minHeight:44,width:'100%',boxSizing:'border-box',padding:10,borderRadius:8,border:`1px solid ${C.border}`,background:C.bg,color:C.white,font:'inherit'};
const button={...field,width:'auto',cursor:'pointer'};
export function FoundryPlanner({plans,players,onSave,settings,showToast}) {
 const [selected,setSelected]=useState(plans[0]?.id || '');
 const [phase,setPhase]=useState(0),[teamId,setTeamId]=useState(''),[query,setQuery]=useState(''),[busy,setBusy]=useState(false),[remove,setRemove]=useState(false),[text,setText]=useState('');
 const mapRef=useRef();
 const plan=plans.find(p=>p.id===selected)||plans[0];
 const team=plan?.teams.find(t=>t.id===teamId)||plan?.teams[0];
 function save(next){onSave(plans.some(p=>p.id===next.id)?plans.map(p=>p.id===next.id?{...next,updatedAt:new Date().toISOString()}:p):[...plans,next]);}
 function patch(fields){save({...plan,...fields});}
 function patchTeam(fields){patch({teams:plan.teams.map(t=>t.id===team.id?{...t,...fields}:t)});}
 function addPlan(copy=false){const p=newFoundryPlan(copy?{...structuredClone(plan),id:uid(),title:`${plan.title} copy`}:{title:`${settings?.allianceTag || 'Alliance'} Foundry`});save(p);setSelected(p.id);setRemove(false);}
 async function exportImage(share=false){setBusy(true);try{const blob=await foundryImage(mapRef.current.querySelector('svg').outerHTML,plan,players,PHASES[phase]);const file=new File([blob],'foundry-plan.png',{type:'image/png'});if(share && navigator.canShare?.({files:[file]}))await navigator.share({files:[file],title:plan.title});else downloadFoundry(blob,'foundry-plan.png');}catch(e){if(e.name!=='AbortError')showToast(e.message,'error');}finally{setBusy(false);}}
 if(!plan)return <div style={{padding:16}}><h2>Foundry planner</h2><p>Build colour coded teams, assign targets, and export a battle plan.</p><button style={button} onClick={()=>addPlan()}>Create plan</button></div>;
 const used=new Set(plan.teams.flatMap(t=>t.members.map(m=>m.playerId)));
 const results=players.filter(p=>!used.has(p.id)&&!p.blacklisted&&`${p.username} ${p.fid}`.toLowerCase().includes(query.toLowerCase()));
 return <section style={{padding:16,display:'grid',gap:14}}>
  <h2 style={{margin:0}}>Foundry planner</h2>
  <label>Saved plans<select style={field} value={plan.id} onChange={e=>{setSelected(e.target.value);setTeamId('');setRemove(false);}}>{plans.map(p=><option key={p.id} value={p.id}>{p.title} · L{p.legion}</option>)}</select></label>
  <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button style={button} onClick={()=>addPlan()}>New plan</button><button style={button} onClick={()=>addPlan(true)}>Duplicate</button><button style={button} onClick={()=>setRemove(!remove)}>Delete plan</button></div>
  {remove&&<div><p>Delete this plan?</p><button style={{...button,color:C.red}} onClick={()=>{onSave(plans.filter(p=>p.id!==plan.id));setSelected('');setRemove(false);}}>Delete permanently</button><button style={button} onClick={()=>setRemove(false)}>Cancel</button></div>}
  <label>Plan name<input style={field} value={plan.title} onChange={e=>patch({title:e.target.value})}/></label>
  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}><label>Legion<select style={field} value={plan.legion} onChange={e=>patch({legion:e.target.value})}><option>1</option><option>2</option></select></label><label>UTC time<input aria-label="Battle time UTC" type="time" style={field} value={plan.time} onChange={e=>patch({time:e.target.value})}/></label></div>
  <label>UTC date<input type="date" style={field} value={plan.date} onChange={e=>patch({date:e.target.value})}/></label>
  <label>Commander instructions<textarea style={field} value={plan.notes} onChange={e=>patch({notes:e.target.value})}/></label>
  <div style={{display:'flex',gap:4}}>{PHASES.map((p,i)=><button key={p} style={{...button,flex:1,padding:6,borderColor:phase===i?C.gold:C.border}} aria-pressed={phase===i} onClick={()=>setPhase(i)}>{i+1}. {p}</button>)}</div>
  <div ref={mapRef}><FoundryMap plan={plan} phase={phase} onBuilding={id=>{const targets=team.targets.map((a,i)=>i===phase?(a.includes(id)?a.filter(x=>x!==id):[...a,id]):a);patchTeam({targets});}}/></div>
  <label>Editing team<select style={field} value={team.id} onChange={e=>setTeamId(e.target.value)}>{plan.teams.map(t=><option key={t.id} value={t.id}>{t.name}{t.loot?' · Loot patrol':''}</option>)}</select></label>
  <p style={{margin:0,color:C.icy}}>Tap buildings to toggle this team’s targets for phase {phase+1}.</p>
  <div style={{padding:12,border:`2px solid ${TEAM_COLORS[team.colorIndex]}`,borderRadius:12,display:'grid',gap:10}}>
   <label>Team name<input style={field} value={team.name} onChange={e=>patchTeam({name:e.target.value})}/></label>
   <label>Team colour<select style={field} value={team.colorIndex} onChange={e=>patchTeam({colorIndex:Number(e.target.value)})}>{['Blue','Green','Orange','Pink','Steel','Sage','Red','Ice'].map((c,i)=><option key={c} value={i}>{c}</option>)}</select></label>
   <label style={{minHeight:44,display:'flex',alignItems:'center',gap:12}}><input type="checkbox" checked={!!team.loot} onChange={e=>patchTeam({loot:e.target.checked})}/>Loot patrol / support team</label>
   <details><summary style={{minHeight:44,cursor:'pointer'}}>Phase {phase+1} targets ({team.targets[phase].length})</summary>{BUILDINGS.map(b=><label key={b.id} style={{minHeight:44,display:'flex',alignItems:'center',gap:10}}><input type="checkbox" checked={team.targets[phase].includes(b.id)} onChange={()=>patchTeam({targets:team.targets.map((a,i)=>i===phase?(a.includes(b.id)?a.filter(x=>x!==b.id):[...a,b.id]):a)})}/>{b.name}</label>)}</details>
   <label>Phase {phase+1} instructions<textarea style={field} value={team.instructions[phase]} onChange={e=>patchTeam({instructions:team.instructions.map((s,i)=>i===phase?e.target.value:s)})}/></label>
   {team.members.map((m,i)=><div key={m.id} style={{borderTop:`1px solid ${C.border}`,paddingTop:10}}><strong>{memberLabel(m,players)}</strong>
    {!m.playerId&&<input aria-label="Guest player name" style={field} placeholder="Guest player name" value={m.name} onChange={e=>patchTeam({members:team.members.map((x,j)=>j===i?{...x,name:e.target.value}:x)})}/>}
    <select aria-label="Member role" style={field} value={m.role} onChange={e=>patchTeam({members:team.members.map((x,j)=>j===i?{...x,role:e.target.value}:x)})}>{['leader','joiner','looter','substitute'].map(r=><option key={r}>{r}</option>)}</select>
    <input aria-label="Player instructions" style={field} placeholder="Player instructions" value={m.note} onChange={e=>patchTeam({members:team.members.map((x,j)=>j===i?{...x,note:e.target.value}:x)})}/>
    <button style={button} onClick={()=>patchTeam({members:team.members.filter((_,j)=>j!==i)})}>Remove member</button>
   </div>)}
   <label>Find member<input type="search" style={field} value={query} placeholder="Name or player ID" onChange={e=>setQuery(e.target.value)}/></label>
   <select aria-label="Add existing member" style={field} value="" onChange={e=>{if(e.target.value)patchTeam({members:[...team.members,{id:uid(),playerId:e.target.value,role:team.members.length?'joiner':'leader',note:''}]});}}><option value="">Add member ({results.length} available)</option>{results.map(p=><option key={p.id} value={p.id}>{p.username} · {p.furnaceLevel || ''}</option>)}</select>
   <button style={button} onClick={()=>patchTeam({members:[...team.members,{id:uid(),name:'',role:'joiner',note:''}]})}>Add guest</button>
  </div>
  {plan.teams.length<9&&<button style={button} onClick={()=>{const id=uid();patch({teams:[...plan.teams,{id,name:plan.teams.length===4?'Loot patrol':`Team ${plan.teams.length+1}`,loot:plan.teams.length===4,colorIndex:plan.teams.length%8,targets:[[],[],[]],instructions:['','',''],members:[]}]});setTeamId(id);}}>Add team / loot patrol</button>}
  <div role="status" style={{color:C.gold}}>{validateFoundry(plan).map(w=><p key={w}>{w}</p>)}</div>
  <button disabled={busy} style={button} onClick={()=>exportImage()}>{busy?'Preparing image…':'Download colour plan (PNG)'}</button>
  <button disabled={busy} style={button} onClick={()=>exportImage(true)}>Share colour plan</button>
  <button style={button} onClick={async()=>{const sheet=battleSheet(plan,players);try{await navigator.clipboard.writeText(sheet);showToast('Battle sheet copied');}catch{setText(sheet);}}}>Copy battle sheet</button>
  {text&&<textarea aria-label="Copy battle sheet manually" readOnly style={{...field,minHeight:220}} value={text}/>}
  <p style={{color:C.icy,fontSize:12}}>Plans save on this device and are included in JSON backups. Map is schematic. Phase timing follows your instructions.</p>
 </section>;
}
