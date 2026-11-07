import {PlayerSearch} from '../../../src/components/players/PlayerSearch.jsx';
import {LegionRoster} from './LegionRoster.jsx';
import {labyrinth,labyrinthLabel} from './labyrinth.js';
import {PowerEntry} from './PowerEntry.jsx';
import {comparePlayers,fmtPower,troopPower} from './power.js';
import {playerSearchFields} from '../../../src/services/playerNames.js';
import {useEffect,useRef,useState} from 'react';
import {Card,Hint,button,field,C} from './ui.jsx';
import {AssignmentEditor} from './AssignmentEditor.jsx';
import {assignedTeam,coverage,eligible,playerLabel,record,suggest,teamIssues} from './planner.js';
export function Legions({plan,players,onChange,onMessage,onRefreshLab,refreshingLab}){
 const live=useRef({plan,players});live.current={plan,players};
 const [previewing,setPreviewing]=useState(false),[labFailed,setLabFailed]=useState(false);
 const [memberSort,setMemberSort]=useState('labyrinth');
 const [powerTeam,setPowerTeam]=useState(''),[powerPlayer,setPowerPlayer]=useState('');
 function enterPower(team,id=''){setPowerTeam(team.id);setPowerPlayer(id);}
 const [draft,setDraft]=useState(null),[open,setOpen]=useState(''),[editing,setEditing]=useState(''),[query,setQuery]=useState(''),[showPool,setShowPool]=useState(false),[limit,setLimit]=useState(20);
 const [editingTarget,setEditingTarget]=useState('');
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
  <Card title="Build your legions"><Hint>Keep existing selections. Fill gaps by availability, then Labyrinth rank.</Hint>{onRefreshLab&&<button style={{...button,width:'100%',marginBottom:8}} disabled={refreshingLab||plan.locked} onClick={onRefreshLab}>{refreshingLab?'Refreshing Labyrinth…':'Refresh Labyrinth ranks'}</button>}<button style={{...button,color:C.gold,width:'100%'}} disabled={plan.locked||previewing||refreshingLab||!plan.teams.length} onClick={createPreview}>{previewing?'Fetching Labyrinth…':'Preview suggested teams'}</button>{labFailed&&<button style={{...button,width:'100%',marginTop:8}} disabled={plan.locked} onClick={()=>{setDraft(suggest(plan,players));setLabFailed(false);}}>Preview with saved data</button>}<Hint>{assigned.size} selected · {unplaced.length} taking part and unassigned</Hint></Card>
  {plan.teams.some(t=>t.id===powerTeam)&&<PowerEntry key={`${powerTeam}:${powerPlayer}`} plan={plan} team={plan.teams.find(t=>t.id===powerTeam)} players={players} initialPlayerId={powerPlayer} onChange={onChange} onClose={()=>setPowerTeam('')}/>}
  {draft&&<Card title="Review the suggestion"><Hint>{draft.teams.flatMap(t=>t.members).length-assigned.size} players will be added. Existing assignments are kept.</Hint>{draft.teams.map(t=><div key={t.id} style={{marginBottom:12}}><strong>[{t.host}] Legion {t.number}</strong><Hint>{t.slots.join(' · ')} UTC · {t.members.filter(m=>m.role==='combatant').length} combatants · {t.members.filter(m=>m.role==='substitute').length} substitutes</Hint>{coverage(draft,t,players).map(c=><div key={c.time} style={{fontSize:14,color:C.icy,marginBottom:4}}>{c.time}: {c.combatants} combatants + {c.substitutes} substitutes available</div>)}{teamIssues(draft,t,players).map(issue=><p key={issue} style={{fontSize:14,color:C.gold}}>{issue}</p>)}</div>)}<div style={{display:'flex',gap:8}}><button style={{...button,flex:1}} onClick={()=>setDraft(null)}>Cancel</button><button style={{...button,flex:1,background:C.gold,color:C.bg}} disabled={plan.locked} onClick={()=>{let next=draft;for(const p of players.filter(p=>!assigned.has(p.id)&&assignedTeam(draft,p.id)))next={...next,records:{...next.records,[p.id]:record(next,p)}};onChange(next);setDraft(null);onMessage('Suggestions applied. Review coverage and choose each captain.');}}>Apply suggestion</button></div></Card>}
  {editing&&players.some(p=>p.id===editing)&&<AssignmentEditor key={`${editing}:${editingTarget}`} initialTargetId={editingTarget} plan={plan} players={players} player={players.find(p=>p.id===editing)} onChange={next=>{setDraft(null);onChange(next);}} onMessage={onMessage} onClose={()=>setEditing('')}/>}
  {!plan.teams.length&&<Hint>Start in Setup to choose host alliances.</Hint>}
  {plan.teams.map(team=>{
   const expanded=open===team.id,issues=teamIssues(plan,team,players);
   return <Card key={team.id}><button style={{...button,width:'100%',textAlign:'left',padding:0,border:0,background:'none'}} aria-expanded={expanded} onClick={()=>setOpen(expanded?'':team.id)}><strong style={{fontSize:18,color:C.white}}>[{team.host}] Legion {team.number}</strong><span style={{display:'block',fontSize:14,marginTop:6}}>{team.members.length} selected · {team.candidates?.length||0} not selected</span><span style={{display:'block',fontSize:13,color:C.icy,marginTop:6}}>{team.members.filter(m=>m.role==='combatant').length} combatants · {team.members.filter(m=>m.role==='substitute').length} substitutes{team.members.some(m=>m.role==='pending')?` · ${team.members.filter(m=>m.role==='pending').length} roles not set`:''}</span><span style={{display:'block',fontSize:14,color:issues.length?C.gold:C.green,marginTop:6}}>{issues.length?`${issues.length} items to check`:'Plan checks passed'}</span></button>
    {expanded&&<LegionRoster plan={plan} team={team} players={players} onChange={next=>{setDraft(null);onChange(next);}} onMessage={onMessage} onRole={editPlayer} onPower={enterPower}/>}
   </Card>;
  })}
  <div ref={poolAnchor}><Card title={`Unassigned · ${unplaced.length}`}><button style={{...button,width:'100%'}} onClick={()=>setShowPool(!showPool)} aria-expanded={showPool}>{showPool?'Hide players':'Choose players to assign'}</button>{showPool&&<><PlayerSearch label="Search unassigned players" players={unplaced} value={query} onChange={value=>{setQuery(value);setLimit(20);}}/>{pool.slice(0,limit).map((p,index)=><div key={p.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,padding:'10px 0',borderTop:`1px solid ${C.border}`}}><div><strong>{index+1}. {playerLabel(p)}</strong><div style={{fontSize:13,color:C.icy,marginTop:4}}>{labyrinthLabel(p)} · Troop: {fmtPower(troopPower(plan,p))} · City: {fmtPower(p.power??p.providerStats?.power)}</div><div style={{fontSize:13,color:C.icy,marginTop:4}}>[{record(plan,p).homeAlliance||'?'}] · {record(plan,p).times.join(' · ')||'Times needed'}</div><div style={{fontSize:13,color:C.icy,marginTop:4}}>{plan.teams.filter(t=>eligible(plan,p,t)).length} matching legions</div></div><button style={button} disabled={plan.locked||!plan.teams.length} onClick={()=>editPlayer(p.id)}>Assign</button></div>)}{pool.length>limit&&<button style={button} onClick={()=>setLimit(limit+20)}>Show 20 more</button>}</>}</Card></div>
 </>;
}
