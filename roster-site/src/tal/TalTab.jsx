import {useState} from 'react';
import {DEFAULT_TIMES} from './planner.js';
import {RosterLegions} from '../../../src/components/players/RosterLegions.jsx';
import {plannedMemberIds,allianceCheck,legionLabel} from '../../../src/services/talRosterService.js';
import {C} from '../../../src/utils/constants.js';

const button={minHeight:44,padding:'10px 12px',fontSize:14,fontWeight:600,borderRadius:10,border:`1px solid ${C.border}`,background:C.section,color:C.icy,cursor:'pointer'};
const compareNames=(a,b)=>(a.username||a.alias||'').localeCompare(b.username||b.alias||'',undefined,{sensitivity:'base',numeric:true});
export function TalTab({value,players,onChange,onRefreshLegion,legionRefresh,onMessage}){
 const [selected,setSelected]=useState('');
 const [check,setCheck]=useState('all');
 const [search,setSearch]=useState('');
 const [copying,setCopying]=useState(false);
 const teams=(value?.teams||[]).filter(t=>['HOT','ARC','RKG'].includes(String(t.host||'').toUpperCase()));
 const team=teams.find(t=>t.id===selected);
 const shownTeams=team?[team]:teams;
 const assigned=shownTeams.flatMap(t=>[...plannedMemberIds(t)].map(id=>({team:t,player:players.find(p=>p.id===id)})));
 const unique=new Map();
 for(const entry of assigned)if(entry.player&&!unique.has(entry.player.id))unique.set(entry.player.id,entry);
 const [timeFilters,setTimeFilters]=useState([]);
 const [timeMode,setTimeMode]=useState('any');
 const [adding,setAdding]=useState(false);
 const [addQuery,setAddQuery]=useState('');
 const [removeId,setRemoveId]=useState('');
 const times=(Array.isArray(value?.times)&&value.times.length?value.times:DEFAULT_TIMES).map(String);
 const availabilityFor=player=>{const raw=value?.availability?.[player.id]??value?.availability?.[String(player.fid)]??value?.records?.[player.id]?.times??[];return Array.isArray(raw)?[...new Set(raw.map(String))].sort((a,b)=>a.localeCompare(b)):[];};
 const matchesTime=player=>!timeFilters.length||(timeMode==='all'?timeFilters.every(t=>availabilityFor(player).includes(t)):timeFilters.some(t=>availabilityFor(player).includes(t)));
 function changeTime(time){setTimeFilters(old=>old.includes(time)?old.filter(t=>t!==time):[...old,time]);}
 function updateTeam(nextTeam){onChange?.({...value,teams:(value?.teams||[]).map(t=>t.id===nextTeam.id?nextTeam:t)});}
 function addPlayer(player){if(!team||value?.locked)return;const already=team.members.some(m=>m.id===player.id);if(already){onMessage?.('Player is already selected for this legion.');return;}const elsewhere=teams.some(t=>t.id!==team.id&&t.members.some(m=>m.id===player.id));if(elsewhere){onMessage?.('Player is selected in another legion. Move them there first.');return;}if(team.members.length>=50){onMessage?.('This legion has 50 selected players. Remove someone first.');return;}updateTeam({...team,members:[...team.members,{id:player.id,role:'pending',registered:false}],candidates:(team.candidates||[]).filter(c=>c.id!==player.id)});setAddQuery('');onMessage?.(`${player.username||player.alias||'Player'} added to ${legionLabel(team)}. Check availability and registration.`);}
 function removePlayer(player){if(!team||value?.locked)return;updateTeam({...team,members:team.members.filter(m=>m.id!==player.id),candidates:(team.candidates||[]).filter(c=>c.id!==player.id),captain:team.captain===player.id?'':team.captain});setRemoveId('');onMessage?.(`${player.username||player.alias||'Player'} removed from ${legionLabel(team)}. Their Members profile and availability were retained.`);}
 const roster=[...unique.values()].filter(({player,team})=>(check==='all'||allianceCheck(player,team).status===check)&&matchesTime(player)&&(!search||[player.username,player.alias,player.fid].some(v=>String(v||'').toLowerCase().includes(search.toLowerCase())))).sort((a,b)=>compareNames(a.player,b.player));
 const addCandidates=team?players.filter(p=>!plannedMemberIds(team).has(p.id)&&(!addQuery||[p.username,p.alias,p.fid].some(v=>String(v||'').toLowerCase().includes(addQuery.toLowerCase())))&&matchesTime(p)).sort(compareNames).slice(0,30):[];
 async function copyStay(){
  const groups=new Map();
  for(const {team,player} of assigned){
   if(!player||allianceCheck(player,team).status!=='in-host')continue;
   const key=team.id;
   if(!groups.has(key))groups.set(key,{team,names:new Set()});
   groups.get(key).names.add(player.username||player.alias||'Unknown player');
  }
  const content=[...groups.values()].sort((a,b)=>legionLabel(a.team).localeCompare(legionLabel(b.team))).map(({team,names})=>`[${team.host}] staying in ${legionLabel(team)}\n${[...names].sort((a,b)=>a.localeCompare(b,undefined,{sensitivity:'base'})).join('\n')}`).join('\n\n');
  if(!content){onMessage?.('No confirmed stay lists to copy.');return;}
  setCopying(true);try{await navigator.clipboard.writeText(content);onMessage?.('Stay lists copied.');}catch{onMessage?.('Copy unavailable. Try again.');}finally{setCopying(false);}
 }
 return <section style={{padding:'16px 20px 32px'}}>
  <h2 style={{fontSize:22,margin:'0 0 4px'}}>TAL planner</h2>
  <p style={{fontSize:13,color:C.icy,lineHeight:1.5,margin:'0 0 12px'}}>HOT · ARC · RKG</p>
  {!teams.length?<div style={{padding:16,background:C.section,borderRadius:12}}><strong>No legions assigned</strong><p style={{fontSize:14,color:C.icy,lineHeight:1.5}}>Saved TAL legion assignments will appear here when available. Your plan data has not been deleted.</p></div>:<>
   <div role="group" aria-label="Choose TAL legion" style={{display:'flex',gap:6,overflowX:'auto',paddingBottom:6,marginBottom:10}}>{[{id:'',label:'All legions'},...teams.map(t=>({id:t.id,label:legionLabel(t)}))].map(t=><button key={t.id||'all'} style={{...button,padding:'8px 10px',flexShrink:0,color:selected===t.id?C.gold:C.icy,borderColor:selected===t.id?C.gold:C.border}} aria-pressed={selected===t.id} onClick={()=>{setSelected(t.id);setCheck('all');setSearch('');setAdding(false);setRemoveId('');}}>{t.label}</button>)}</div>
   <input aria-label="Search legion players" placeholder="Search player name or ID" value={search} onChange={e=>setSearch(e.target.value)} style={{...button,width:'100%',boxSizing:'border-box',fontSize:16,marginBottom:10}}/>
   <div role="group" aria-label="Filter by available UTC times" style={{marginBottom:12}}>
     <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,marginBottom:6}}><strong style={{fontSize:13,color:C.icy}}>Available times · UTC</strong>{timeFilters.length>0&&<button style={{...button,minHeight:32,padding:'4px 8px',fontSize:12}} onClick={()=>setTimeFilters([])}>Clear times</button>}</div>
     <div style={{display:'flex',flexWrap:'wrap',gap:6}}>{times.map(t=><button key={t} aria-pressed={timeFilters.includes(t)} onClick={()=>changeTime(t)} style={{...button,minHeight:36,padding:'6px 9px',fontSize:13,color:timeFilters.includes(t)?C.gold:C.icy,borderColor:timeFilters.includes(t)?C.gold:C.border}}>{t}</button>)}</div>
     {timeFilters.length>1&&<label style={{display:'flex',alignItems:'center',gap:8,fontSize:12,color:C.icy,marginTop:8}}>Match<select value={timeMode} onChange={e=>setTimeMode(e.target.value)} style={{...button,minHeight:36,padding:6,fontSize:13}}><option value="any">Any selected time</option><option value="all">Every selected time</option></select></label>}
   </div>
   <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:10}}><strong style={{fontSize:16}}>{team?legionLabel(team):'All legion players'}</strong><span role="status" style={{fontSize:13,color:C.icy}}>{roster.length} shown</span></div>
   {team&&<button style={{...button,width:'100%',color:C.gold,marginBottom:10}} disabled={!!value?.locked} onClick={()=>{setAdding(v=>!v);setRemoveId('');}}>{adding?'Close player picker':'+ Add players to this legion'}</button>}
   {adding&&team&&<div style={{background:C.section,border:`1px solid ${C.border}`,borderRadius:12,padding:10,marginBottom:12}}><label style={{display:'block',fontSize:13,color:C.icy,marginBottom:6}}>Find an existing Members profile</label><input aria-label="Find player to add" value={addQuery} onChange={e=>setAddQuery(e.target.value)} placeholder="Name or player ID" style={{...button,width:'100%',fontSize:16,boxSizing:'border-box',marginBottom:8}}/><p style={{fontSize:12,color:C.icy,margin:'0 0 8px'}}>Time filters also apply here. Adding does not change their Members profile.</p>{addCandidates.map(p=><div key={p.id} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 0',borderTop:`1px solid ${C.border}`}}><div style={{flex:1,minWidth:0}}><strong style={{fontSize:14,overflowWrap:'anywhere'}}>{p.username||p.alias||'Unknown'}</strong><div style={{fontSize:12,color:C.icy}}>{p.fid||'ID unknown'} · {availabilityFor(p).length?availabilityFor(p).join(' · ')+' UTC':'No times recorded'}</div></div><button style={{...button,padding:'6px 10px',minHeight:38,color:C.gold}} disabled={teams.some(t=>t.id!==team.id&&t.members.some(m=>m.id===p.id))} onClick={()=>addPlayer(p)}>Add</button></div>)}{!addCandidates.length&&<p style={{fontSize:13,color:C.icy}}>No eligible profiles match your search and time filters.</p>}</div>}
   {roster.map(({team:entryTeam,player})=>{const status=allianceCheck(player,entryTeam),available=availabilityFor(player),active=entryTeam.members.some(m=>m.id===player.id);return <article key={player.id} style={{padding:'11px 12px',marginBottom:8,background:C.card,border:`1px solid ${C.border}`,borderRadius:12}}>
     <div style={{display:'flex',alignItems:'flex-start',gap:8}}><div style={{flex:1,minWidth:0}}><div style={{fontWeight:700,fontSize:16,overflowWrap:'anywhere'}}>{player.username||player.alias||'Unknown player'}</div><div style={{fontSize:12,color:C.icy,marginTop:3}}>{legionLabel(entryTeam)} · {player.fid||'ID missing'}{!active?' · Proposed':''}</div></div>{team&&<button style={{...button,minHeight:36,padding:'5px 9px',fontSize:12,color:C.red}} disabled={!!value?.locked} onClick={()=>setRemoveId(removeId===player.id?'':player.id)} aria-label={`Remove ${player.username||player.alias||'player'} from this legion`}>Remove</button>}</div>
     <div style={{display:'flex',flexWrap:'wrap',gap:5,alignItems:'center',marginTop:8}}>{available.length?available.map(t=><span key={t} style={{fontSize:12,padding:'4px 7px',borderRadius:6,background:timeFilters.includes(t)?C.gold+'22':C.section,color:timeFilters.includes(t)?C.gold:C.icy,border:`1px solid ${timeFilters.includes(t)?C.gold:C.border}`}}>{t}</span>):<span style={{fontSize:12,color:C.icy}}>Availability not recorded</span>}<span style={{fontSize:11,color:C.icy}}>UTC</span></div>
     <div style={{fontSize:12,color:status.status==='move'?C.gold:status.status==='in-host'?C.green:C.icy,marginTop:7}}>{status.label}</div>
     {removeId===player.id&&team&&<div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${C.border}`}}><p style={{fontSize:13,color:C.icy,margin:'0 0 8px'}}>Remove this player from {legionLabel(team)}? Their profile and saved availability will remain.</p><div style={{display:'flex',gap:8}}><button style={button} onClick={()=>setRemoveId('')}>Cancel</button><button style={{...button,color:C.red}} onClick={()=>removePlayer(player)}>Confirm removal</button></div></div>}
   </article>;})}
   {!roster.length&&<p style={{fontSize:14,color:C.icy,padding:'16px 0'}}>No players match. Try clearing the time filters or search.</p>}
   <details style={{marginTop:16,borderTop:`1px solid ${C.border}`,paddingTop:12}}><summary style={{fontSize:14,color:C.gold,cursor:'pointer',minHeight:36}}>Alliance readiness and transfer tools</summary><div style={{paddingTop:10}}><RosterLegions teams={teams} selected={selected} onSelect={id=>{setSelected(id);setCheck('all');setSearch('');}} players={players} check={check} onCheck={setCheck} onRefresh={onRefreshLegion} refresh={legionRefresh} onCopied={onMessage} availability={value?.availability||{}}/><button style={{...button,width:'100%',color:C.gold,marginBottom:14}} disabled={copying} onClick={copyStay}>{copying?'Copying…':'Copy stay lists'}</button></div></details>
  </>}
 </section>;
}
