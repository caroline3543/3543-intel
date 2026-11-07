import {useEffect,useRef,useState} from 'react';
import {Card,Hint,button,field,C} from './ui.jsx';
import {playerLabel,record,transferRows} from './planner.js';
import {comparePlayers,fmtPower,troopPower} from './power.js';
export function RegistrationChecklist({plan,players,onChange,onEditPower}){
 const controls=useRef({}),focusAfter=useRef('');
 useEffect(()=>{if(focusAfter.current){controls.current[focusAfter.current]?.focus({preventScroll:true});focusAfter.current='';}},[plan]);
 const [teamId,setTeamId]=useState(plan.teams[0]?.id||''),[sort,setSort]=useState('troop'),[message,setMessage]=useState('');
 const active=plan.teams.some(t=>t.id===teamId)?teamId:'';
 const rows=transferRows(plan,players).filter(r=>!active||r.team.id===active).sort((a,b)=>comparePlayers(plan,sort)(a.player||{id:a.member.id},b.player||{id:b.member.id}));
 function toggle(row){if(plan.locked)return;const registered=!row.member.registered;const next=registered?rows.find(r=>!r.member.registered&&r.member.id!==row.member.id):row;focusAfter.current=next?`${next.team.id}:${next.member.id}`:`${row.team.id}:${row.member.id}`;onChange({...plan,teams:plan.teams.map(t=>t.id===row.team.id?{...t,members:t.members.map(m=>m.id===row.member.id?{...m,registered}:m)}:t)});setMessage(`${playerLabel(row.player)} ${registered?'marked registered. Moved to completed.':'returned to needs registration.'}`);}
 function row(r){const p=r.player,name=p?playerLabel(p):`Missing player · ${r.member.id}`,done=!!r.member.registered;return <div key={`${r.team.id}:${r.member.id}`} style={{display:'flex',gap:10,alignItems:'flex-start',padding:'12px 0',borderTop:`1px solid ${C.border}`}}>
  <button ref={el=>{controls.current[`${r.team.id}:${r.member.id}`]=el;}} type="button" role="checkbox" aria-checked={done} aria-label={done?`Undo registration for ${name}`:`Mark ${name} registered`} disabled={plan.locked||!p} onClick={()=>toggle(r)} style={{...button,padding:0,width:44,height:44,flexShrink:0,border:0,background:'none',display:'grid',placeItems:'center'}}><span aria-hidden="true" style={{display:'grid',placeItems:'center',height:30,width:30,borderRadius:'50%',border:`2px solid ${done?C.green:C.icy}`,background:done?C.green:'none',color:C.bg,fontSize:20,fontWeight:700}}>{done?'✓':''}</span></button>
  <div style={{flex:1,minWidth:0}}><span style={{fontSize:16,fontWeight:600,textDecoration:done?'line-through':'none',color:done?C.icy:C.white,overflowWrap:'anywhere'}}>{name}</span><div style={{fontSize:14,color:C.icy,marginTop:5}}>Troop power: {p?fmtPower(troopPower(plan,p)):'Not entered'}</div><div style={{fontSize:13,color:C.icy,marginTop:4}}>{p?.fid||'ID missing'} · {r.team.host} Legion {r.team.number} · {r.member.role}</div>{sort==='city'&&<div style={{fontSize:13,color:C.icy,marginTop:4}}>City power: {fmtPower(p?.power??p?.providerStats?.power)}</div>}{p&&record(plan,p).note&&<Hint>{record(plan,p).note}</Hint>}
   {p&&!done&&<button style={{...button,marginTop:6}} disabled={plan.locked} onClick={()=>onEditPower(r.team,p.id)}>Edit troop power</button>}
  </div>{done&&<button style={{...button,flexShrink:0}} disabled={plan.locked} onClick={()=>toggle(r)} aria-label={`Return ${name} to needs registration`}>Undo</button>}
 </div>;}
 return <Card title="Confirm in-game registration"><Hint>Mark a player after an R4/R5 registers them in game. Completed players move below and still count toward confirmed power.</Hint>
  <label>Legion<select aria-label="Registration legion" style={{...field,margin:'6px 0 12px'}} value={active} onChange={e=>setTeamId(e.target.value)}><option value="">All legions</option>{plan.teams.map(t=><option key={t.id} value={t.id}>{t.host} Legion {t.number}</option>)}</select></label>
  <label>Sort by<select aria-label="Sort registration list" style={{...field,margin:'6px 0 12px'}} value={sort} onChange={e=>setSort(e.target.value)}><option value="troop">Troop power · highest first</option><option value="name">Name A–Z</option><option value="city">City power · highest first</option></select></label>
  {message&&<p role="status" style={{fontSize:14,color:C.icy}}>{message}</p>}
  <h4 style={{fontSize:14,color:C.icy}}>Needs registration · {rows.filter(r=>!r.member.registered).length}</h4>{rows.filter(r=>!r.member.registered).map(row)}
  {rows.length>0&&rows.every(r=>r.member.registered)&&<Hint>Everyone in this list is marked registered.</Hint>}
  {rows.some(r=>r.member.registered)&&<><h4 style={{fontSize:14,color:C.icy}}>Completed · {rows.filter(r=>r.member.registered).length}</h4>{rows.filter(r=>r.member.registered).map(row)}</>}
  {!rows.length&&<Hint>No players assigned to this legion.</Hint>}
 </Card>;
}
