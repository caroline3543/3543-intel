import {labyrinth,labyrinthLabel} from './labyrinth.js';
import {PowerEntry} from './PowerEntry.jsx';
import {PowerSummary} from './PowerSummary.jsx';
import {comparePlayers,fmtPower,troopPower,top20Ids} from './power.js';
import {playerSearchFields} from '../../../src/services/playerNames.js';
import {useEffect,useRef,useState} from 'react';
import {Card,Hint,TimeButtons,button,field,C} from './ui.jsx';
import {LegionIntake} from './LegionIntake.jsx';
import {AssignmentEditor} from './AssignmentEditor.jsx';
import {assignedTeam,coverage,eligible,overlap,playerLabel,record,suggest,teamIssues,unassign} from './planner.js';
export function Legions({plan,players,onChange,onMessage,onRefreshLab,refreshingLab}){
 const live=useRef({plan,players});live.current={plan,players};
 const [previewing,setPreviewing]=useState(false),[labFailed,setLabFailed]=useState(false);
 const [memberSort,setMemberSort]=useState('labyrinth');
 const [powerTeam,setPowerTeam]=useState(''),[powerPlayer,setPowerPlayer]=useState('');
 function enterPower(team,id=''){setPowerTeam(team.id);setPowerPlayer(id);}
 const [draft,setDraft]=useState(null),[open,setOpen]=useState(''),[editing,setEditing]=useState(''),[query,setQuery]=useState(''),[showPool,setShowPool]=useState(false),[limit,setLimit]=useState(20);
 const [editingTarget,setEditingTarget]=useState(''),[removing,setRemoving]=useState('');
 function editPlayer(id,target=''){setEditingTarget(target);setEditing(id);}
 const poolAnchor=useRef(null);
 useEffect(()=>{if(showPool)poolAnchor.current?.scrollIntoView?.({block:'start'});},[showPool]);
 const assigned=new Set(plan.teams.flatMap(t=>t.members.map(m=>m.id))),unplaced=players.filter(p=>record(plan,p).status==='available'&&!assigned.has(p.id));
 function update(id,patch){setDraft(null);onChange({...plan,teams:plan.teams.map(t=>t.id===id?{...t,...patch}:t)});}
 const pool=unplaced.filter(p=>playerSearchFields(p).some(v=>String(v||'').toLowerCase().includes(query.trim().toLowerCase()))).sort(comparePlayers(plan,memberSort));
 async function createPreview(){
  if(previewing||plan.locked)return;
  if(!plan.teams.length){onMessage('Choose host alliances in Setup first.');return;}
  setPreviewing(true);setLabFailed(false);const version=JSON.stringify(plan);
  try{
   let source=players;
   if(onRefreshLab&&!players.some(p=>{const v=labyrinth(p);return v.rank!=null||v.score!=null;})){
    const refreshed=await onRefreshLab();
    if(!refreshed){setLabFailed(true);onMessage('Labyrinth could not be loaded. Retry the refresh or preview with saved data.');return;}
    source=refreshed;
    if(!source.some(p=>{const v=labyrinth(p);return v.rank!=null||v.score!=null;}))onMessage('No Labyrinth entries were returned for these players. Saved troop power is the fallback.');
   }
   if(JSON.stringify(live.current.plan)!==version){onMessage('The plan changed. Preview the teams again.');return;}
   setDraft(suggest(plan,source));
  }finally{setPreviewing(false);}
 }

 return <>
  <Card title="Build your legions"><Hint>Suggestions fill empty places. Your existing assignments stay in place. Availability comes first, then Labyrinth rank and score from the API. Troop power is a fallback when Labyrinth is tied or missing.</Hint>{onRefreshLab&&<button style={{...button,width:'100%',marginBottom:8}} disabled={refreshingLab||plan.locked} onClick={onRefreshLab}>{refreshingLab?'Refreshing Labyrinth…':'Refresh Labyrinth ranks'}</button>}<button style={{...button,color:C.gold,width:'100%'}} disabled={plan.locked||previewing||refreshingLab||!plan.teams.length} onClick={createPreview}>{previewing?'Fetching Labyrinth…':'Preview suggested teams'}</button>{labFailed&&<button style={{...button,width:'100%',marginTop:8}} disabled={plan.locked} onClick={()=>{setDraft(suggest(plan,players));setLabFailed(false);}}>Preview with saved data</button>}<Hint>{assigned.size} assigned · {unplaced.length} taking part and unassigned</Hint></Card>
  {plan.teams.some(t=>t.id===powerTeam)&&<PowerEntry key={`${powerTeam}:${powerPlayer}`} plan={plan} team={plan.teams.find(t=>t.id===powerTeam)} players={players} initialPlayerId={powerPlayer} onChange={onChange} onClose={()=>setPowerTeam('')}/>}
  {draft&&<Card title="Review the suggestion"><Hint>{draft.teams.flatMap(t=>t.members).length-assigned.size} players will be added. Existing assignments are kept.</Hint>{draft.teams.map(t=><div key={t.id} style={{marginBottom:12}}><strong>[{t.host}] Legion {t.number}</strong><Hint>{t.slots.join(' · ')} UTC · {t.members.filter(m=>m.role==='combatant').length} combatants · {t.members.filter(m=>m.role==='substitute').length} substitutes</Hint>{coverage(draft,t,players).map(c=><div key={c.time} style={{fontSize:14,color:C.icy,marginBottom:4}}>{c.time}: {c.combatants} combatants + {c.substitutes} substitutes available</div>)}{teamIssues(draft,t,players).map(issue=><p key={issue} style={{fontSize:14,color:C.gold}}>{issue}</p>)}</div>)}<div style={{display:'flex',gap:8}}><button style={{...button,flex:1}} onClick={()=>setDraft(null)}>Cancel</button><button style={{...button,flex:1,background:C.gold,color:C.bg}} disabled={plan.locked} onClick={()=>{let next=draft;for(const p of players.filter(p=>!assigned.has(p.id)&&assignedTeam(draft,p.id)))next={...next,records:{...next.records,[p.id]:record(next,p)}};onChange(next);setDraft(null);onMessage('Suggestions applied. Review coverage and choose each captain.');}}>Apply suggestion</button></div></Card>}
  {editing&&players.some(p=>p.id===editing)&&<AssignmentEditor key={`${editing}:${editingTarget}`} initialTargetId={editingTarget} plan={plan} players={players} player={players.find(p=>p.id===editing)} onChange={next=>{setDraft(null);onChange(next);}} onMessage={onMessage} onClose={()=>setEditing('')}/>}
  {!plan.teams.length&&<Hint>Start in Setup to choose host alliances.</Hint>}
  {plan.teams.map(team=>{
   const expanded=open===team.id,issues=teamIssues(plan,team,players),topIds=top20Ids(plan,team,players);
   return <Card key={team.id}><button style={{...button,width:'100%',textAlign:'left',padding:0,border:0,background:'none'}} aria-expanded={expanded} onClick={()=>setOpen(expanded?'':team.id)}><strong style={{fontSize:18,color:C.white}}>[{team.host}] Legion {team.number}</strong><span style={{display:'block',fontSize:14,marginTop:6}}>{team.members.filter(m=>m.role==='combatant').length}/30 combatants · {team.members.filter(m=>m.role==='substitute').length}/20 substitutes</span><span style={{display:'block',fontSize:14,color:issues.length?C.gold:C.green,marginTop:6}}>{issues.length?`${issues.length} items to check`:'Plan checks passed'}</span></button>
    {expanded&&<div style={{marginTop:14}}><strong style={{fontSize:14}}>Three battle times · UTC</strong><Hint>Tap a selected time to remove it, then choose another. Existing players stay assigned; conflicts appear below.</Hint><TimeButtons times={plan.times} selected={team.slots} max={3} disabled={plan.locked} onToggle={time=>update(team.id,{slots:team.slots.includes(time)?team.slots.filter(s=>s!==time):[...team.slots,time]})}/>
     <div style={{margin:'14px 0'}}>{coverage(plan,team,players).map(c=><div key={c.time} style={{display:'flex',justifyContent:'space-between',gap:10,padding:'8px 0',borderBottom:`1px solid ${C.border}`,fontSize:14}}><strong>{c.time}</strong><span style={{color:c.combatants<plan.targetCombatants?C.gold:C.icy}}>{c.combatants} combatants + {c.substitutes} substitutes</span></div>)}</div>
     <label>Captain<select style={{...field,margin:'6px 0 12px'}} disabled={plan.locked} value={team.captain} onChange={e=>update(team.id,{captain:e.target.value})}><option value="">Choose a captain</option>{team.members.map(m=><option key={m.id} value={m.id}>{playerLabel(players.find(p=>p.id===m.id))}</option>)}</select></label>
     <label>R4/R5 handling registration<input style={{...field,margin:'6px 0 12px'}} disabled={plan.locked} value={team.officer} placeholder="Officer name" onChange={e=>update(team.id,{officer:e.target.value})}/></label>
     <label>Confirmed match time · UTC<select style={{...field,margin:'6px 0 12px'}} disabled={plan.locked} value={team.matchTime} onChange={e=>update(team.id,{matchTime:e.target.value})}><option value="">Not announced</option>{team.slots.map(s=><option key={s}>{s}</option>)}</select></label>
     {issues.map(issue=><p key={issue} style={{fontSize:14,color:C.gold}}>{issue}</p>)}
     <PowerSummary key={team.id} plan={plan} team={team} players={players} onChange={onChange}/>
     <button style={{...button,width:'100%',color:C.gold,marginBottom:12}} disabled={plan.locked} onClick={()=>enterPower(team)}>Enter troop powers</button>
     <LegionIntake plan={plan} players={players} team={team} onChange={next=>{setDraft(null);onChange(next);}} onMove={editPlayer}/>
     <label>Order players<select aria-label={`Order players in ${team.id}`} style={{...field,margin:'6px 0 12px'}} value={memberSort} onChange={e=>setMemberSort(e.target.value)}><option value="labyrinth">Labyrinth rank · best first</option><option value="troop">Troop power · highest first</option><option value="city">City power · highest first</option><option value="name">Name A–Z</option></select></label>
     <Hint>Numbers follow this list order. “Top 20 recorded” uses TAL troop power, including substitutes. Missing powers may change who is included.</Hint>
     {[...team.members].sort((a,b)=>comparePlayers(plan,memberSort)(players.find(p=>p.id===a.id)||{id:a.id},players.find(p=>p.id===b.id)||{id:b.id})).map((member,index)=>{const p=players.find(p=>p.id===member.id);if(!p)return <div key={member.id} style={{padding:"12px 0"}}><p style={{color:C.red,fontSize:14}}>Player no longer in roster · {member.id}</p><button style={button} disabled={plan.locked} onClick={()=>{setDraft(null);onChange(unassign(plan,member.id));}}>Unassign missing player</button></div>;return <div key={member.id} style={{borderTop:`1px solid ${C.border}`,padding:'12px 0'}}><div style={{display:'flex',justifyContent:'space-between',gap:8,alignItems:'center'}}><div><strong style={{fontSize:15}}>{index+1}. {playerLabel(p)}</strong>{topIds.has(p.id)&&<span style={{display:'block',fontSize:13,color:C.gold,marginTop:4}}>Top 20 recorded</span>}<div style={{fontSize:13,color:C.icy,marginTop:4}}>{labyrinthLabel(p)} · City power: {fmtPower(p.power??p.providerStats?.power)}</div><div style={{fontSize:13,color:C.icy,marginTop:4}}>Home [{record(plan,p).homeAlliance||'?'}] · {member.role}</div><div style={{fontSize:13,color:eligible(plan,p,team)?C.icy:C.red,marginTop:4}}>{overlap(plan,p,team)} of 3 times{record(plan,p).note?' · '+record(plan,p).note:''}</div></div><div style={{display:'flex',gap:6,flexWrap:'wrap',justifyContent:'flex-end'}}><button style={button} disabled={plan.locked} onClick={()=>editPlayer(p.id)}>Move / role</button><button style={{...button,color:C.red}} disabled={plan.locked} aria-label={`Remove ${playerLabel(p)} from this legion`} onClick={()=>setRemoving(removing===p.id?'':p.id)}>Remove</button></div></div>{removing===p.id&&<div role="group" aria-label={`Confirm removal of ${playerLabel(p)}`} style={{marginTop:12,padding:12,background:C.bg,borderRadius:10}}><Hint>Remove {playerLabel(p)} from this legion? Their member profile and availability stay saved.</Hint><div style={{display:'flex',gap:8}}><button style={button} onClick={()=>setRemoving('')}>Cancel</button><button style={{...button,color:C.red}} disabled={plan.locked} onClick={()=>{setDraft(null);onChange(unassign(plan,p.id));setRemoving('');if(editing===p.id)setEditing('');onMessage('Removed from legion. Member profile and availability kept.');}}>Remove from legion</button></div></div>}<div style={{display:'flex',gap:8,alignItems:'center',justifyContent:'space-between',marginTop:10}}><span style={{fontSize:14,color:C.icy}}>{p.allianceRank||'Rank unknown'} · Troop power: {fmtPower(troopPower(plan,p))}</span><button style={button} disabled={plan.locked} onClick={()=>enterPower(team,p.id)} aria-label={`Edit troop power for ${playerLabel(p)}`}>Edit power</button></div></div>;})}
    </div>}
   </Card>;
  })}
  <div ref={poolAnchor}><Card title={`Unassigned · ${unplaced.length}`}><button style={{...button,width:'100%'}} onClick={()=>setShowPool(!showPool)} aria-expanded={showPool}>{showPool?'Hide players':'Choose players to assign'}</button>{showPool&&<><input aria-label="Search unassigned players" style={{...field,margin:'12px 0'}} placeholder="Search name or ID" value={query} onChange={e=>{setQuery(e.target.value);setLimit(20);}}/>{pool.slice(0,limit).map((p,index)=><div key={p.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,padding:'10px 0',borderTop:`1px solid ${C.border}`}}><div><strong>{index+1}. {playerLabel(p)}</strong><div style={{fontSize:13,color:C.icy,marginTop:4}}>{labyrinthLabel(p)} · Troop: {fmtPower(troopPower(plan,p))} · City: {fmtPower(p.power??p.providerStats?.power)}</div><div style={{fontSize:13,color:C.icy,marginTop:4}}>[{record(plan,p).homeAlliance||'?'}] · {record(plan,p).times.join(' · ')||'Times needed'}</div><div style={{fontSize:13,color:C.icy,marginTop:4}}>{plan.teams.filter(t=>eligible(plan,p,t)).length} matching legions</div></div><button style={button} disabled={plan.locked||!plan.teams.length} onClick={()=>editPlayer(p.id)}>Assign</button></div>)}{pool.length>limit&&<button style={button} onClick={()=>setLimit(limit+20)}>Show 20 more</button>}</>}</Card></div>
 </>;
}
