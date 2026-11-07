import {useState} from 'react';
import {Card,Hint,button,C} from './ui.jsx';
import {coverage,record,playerLabel} from './planner.js';
import {comparePlayers,fmtPower,troopPower} from './power.js';
export function ReviewAvailability({plan,players}){
 const [open,setOpen]=useState('');
 return <Card title="Availability at each time">{plan.teams.map(team=><div key={team.id} style={{marginBottom:16}}><strong>[{team.host}] Legion {team.number}</strong><Hint>Captain: {team.captain?playerLabel(players.find(p=>p.id===team.captain)):'Not chosen'} · Match: {team.matchTime?team.matchTime+' UTC':'Not announced'}</Hint>{coverage(plan,team,players).map(c=>{
  const key=`${team.id}:${c.time}`,expanded=open===key;
  const available=team.members.map(m=>({m,p:players.find(p=>p.id===m.id)})).filter(({p})=>p&&record(plan,p).status==='available'&&record(plan,p).times.includes(c.time)).sort((a,b)=>comparePlayers(plan)(a.p,b.p));
  return <div key={c.time}><button aria-label={`Show available players for ${team.host} Legion ${team.number} at ${c.time} UTC`} aria-expanded={expanded} style={{...button,width:'100%',textAlign:'left',marginBottom:8,display:'flex',justifyContent:'space-between',gap:8}} onClick={()=>setOpen(expanded?'':key)}><span>{c.time} UTC{team.matchTime===c.time?' · Match':''}<span style={{display:'block',fontSize:13,marginTop:4}}>{c.combatants} combatants + {c.substitutes} substitutes</span></span><span aria-hidden="true">{expanded?'▴':'▾'}</span></button>{expanded&&<div role="region" aria-label={`Players available at ${c.time} UTC`} style={{padding:'0 8px 12px'}}>{!available.length&&<Hint>No assigned players are available at this time.</Hint>}{['combatant','substitute'].map(role=>{const group=available.filter(r=>r.m.role===role);return group.length>0&&<div key={role}><h4 style={{fontSize:14,color:C.icy,margin:'8px 0'}}>{role==='combatant'?'Combatants':'Substitutes'} · {group.length}</h4>{group.map(({p})=><p key={p.id} style={{fontSize:14,overflowWrap:'anywhere',margin:'8px 0'}}>{playerLabel(p)}<span style={{display:'block',fontSize:13,color:C.icy}}>{p.fid||'ID missing'} · Troop power: {fmtPower(troopPower(plan,p))}</span></p>)}</div>;})}</div>}</div>;
 })}</div>)}</Card>;
}
