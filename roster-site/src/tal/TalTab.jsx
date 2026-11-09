import {useState} from 'react';
import {RosterLegions} from '../../../src/components/players/RosterLegions.jsx';
import {plannedMemberIds,allianceCheck,legionLabel} from '../../../src/services/talRosterService.js';
import {C} from '../../../src/utils/constants.js';

const button={minHeight:44,padding:'10px 12px',fontSize:14,fontWeight:600,borderRadius:10,border:`1px solid ${C.border}`,background:C.section,color:C.icy,cursor:'pointer'};
const compareNames=(a,b)=>(a.username||a.alias||'').localeCompare(b.username||b.alias||'',undefined,{sensitivity:'base',numeric:true});
export function TalTab({value,players,onRefreshLegion,legionRefresh,onMessage}){
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
 const roster=[...unique.values()].filter(({player,team})=>(check==='all'||allianceCheck(player,team).status===check)&&(!search||[player.username,player.alias,player.fid].some(v=>String(v||'').toLowerCase().includes(search.toLowerCase())))).sort((a,b)=>compareNames(a.player,b.player));
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
  <h2 style={{fontSize:24,margin:'0 0 6px'}}>TAL planner</h2>
  <p style={{fontSize:14,color:C.icy,lineHeight:1.5,margin:'0 0 16px'}}>HOT · ARC · RKG legions, alliance moves and readiness.</p>
  {!teams.length?<div style={{padding:16,background:C.section,borderRadius:12}}><strong>No legions assigned</strong><p style={{fontSize:14,color:C.icy,lineHeight:1.5}}>Saved TAL legion assignments will appear here when available. Your plan data has not been deleted.</p></div>:<>
   <RosterLegions teams={teams} selected={selected} onSelect={id=>{setSelected(id);setCheck('all');setSearch('');}} players={players} check={check} onCheck={setCheck} onRefresh={onRefreshLegion} refresh={legionRefresh} onCopied={onMessage} availability={value?.availability||{}}/>
   <button style={{...button,width:'100%',color:C.gold,marginBottom:14}} disabled={copying} onClick={copyStay}>{copying?'Copying…':'Copy stay lists'}</button>
   <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',gap:8,marginBottom:10}}><h3 style={{fontSize:18,margin:0}}>{team?legionLabel(team):'All legion players'}</h3><span style={{fontSize:13,color:C.icy}}>{roster.length} shown</span></div>
   <input aria-label="Search legion players" placeholder="Search name or player ID" value={search} onChange={e=>setSearch(e.target.value)} style={{...button,width:'100%',boxSizing:'border-box',fontSize:16,marginBottom:10}}/>
   {roster.map(({team,player})=>{const status=allianceCheck(player,team);return <div key={player.id} style={{padding:'12px 0',borderBottom:`1px solid ${C.border}`}}><div style={{fontWeight:600,fontSize:15}}>{player.username||player.alias||'Unknown player'}</div><div style={{fontSize:13,color:C.icy,lineHeight:1.6}}>{legionLabel(team)} · {player.fid||'ID missing'}</div><div style={{fontSize:13,color:status.status==='move'?C.gold:status.status==='in-host'?C.green:C.icy}}>{status.label}</div></div>;})}
   {!roster.length&&<p style={{fontSize:14,color:C.icy}}>No players match this selection.</p>}
  </>}
 </section>;
}
