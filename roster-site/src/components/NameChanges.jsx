import {PlayerSearch} from '../../../src/components/players/PlayerSearch.jsx';
import {allianceEvidence} from '../../../src/services/allianceEvidenceService.js';
import {useState} from 'react';
import {C} from '../../../src/utils/constants.js';
import {recentNameChanges,recentAllianceMoves,legionForPlayer,legionLabel,utcChecked} from '../../../src/services/talRosterService.js';
import {playerSearchFields} from '../../../src/services/playerNames.js';
import {CopyPlayerId} from '../../../src/components/players/CopyPlayerId.jsx';
const button={minHeight:44,padding:'10px 12px',fontSize:16,borderRadius:10,border:`1px solid ${C.border}`,background:C.section,color:C.white,cursor:'pointer'};
export function NameChanges({players,plan,onOpen}){
 const [query,setQuery]=useState(''),[limit,setLimit]=useState(40),[assignedOnly,setAssignedOnly]=useState(false);
 const q=query.trim().toLocaleLowerCase();
 const rows=[...recentNameChanges(players).map(row=>({...row,type:'name'})),...recentAllianceMoves(players)].sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)||a.id.localeCompare(b.id)).filter(row=>{
  const p=players.find(p=>p.id===row.playerId);
  return (!assignedOnly||legionForPlayer(plan,p.id))&&(!q||[...playerSearchFields(p),row.before,row.after].some(v=>String(v||'').toLocaleLowerCase().includes(q)));
 });
 return <section style={{padding:20}}>
  <h2 style={{fontSize:24,margin:'0 0 8px'}}>Name changes &amp; alliance moves</h2>
  <p style={{fontSize:14,color:C.icy,lineHeight:1.5,margin:'0 0 14px'}}>Latest detected changes first. Dates show when a refresh detected a name change or alliance move, not the exact time it happened.</p>
  <PlayerSearch label="Search changes and alliance moves" players={players} value={query} onChange={value=>{setQuery(value);setLimit(40);}}/>
  <label style={{display:'flex',alignItems:'center',gap:10,minHeight:44,color:C.icy,marginBottom:12,fontSize:14}}><input type="checkbox" checked={assignedOnly} onChange={e=>{setAssignedOnly(e.target.checked);setLimit(40);}} style={{width:22,height:22}}/>TAL players only</label>
  <p role="status" style={{fontSize:14,color:C.icy}}>{rows.length} {rows.length===1?'change':'changes'}</p>
  {rows.slice(0,limit).map(row=>{
   const p=players.find(p=>p.id===row.playerId),team=legionForPlayer(plan,p.id),alliance=allianceEvidence(p);
   return <article key={row.id} style={{padding:14,borderRadius:12,background:C.card,border:`1px solid ${C.border}`,marginBottom:12}}>
    <button aria-label={`Open ${p.username||p.alias||p.fid}`} onClick={()=>onOpen(p.id)} style={{...button,width:'100%',textAlign:'left',padding:0,border:0,background:'none'}}>
     <span style={{display:'block',fontSize:16,fontWeight:700,overflowWrap:'anywhere'}}>{row.type==='alliance'?'Alliance move: ':'Name change: '}{row.before} → {row.after}</span>
     {row.type==='name'&&p.username!==row.after&&<span style={{display:'block',fontSize:14,color:C.icy,marginTop:6}}>Now: {p.username}</span>}
     <span style={{display:'block',fontSize:14,color:C.icy,marginTop:6}}>{team?legionLabel(team):'No legion assigned'}{alliance.noAlliance?' · No alliance':alliance.tag?` · Last seen in ${alliance.tag}`:' · Alliance unknown'}</span>
     <span style={{display:'block',fontSize:13,color:C.icy,marginTop:6}}>Detected: {utcChecked(row.at)}</span>
     <span style={{display:'block',fontSize:14,color:C.gold,marginTop:8}}>View player ›</span>
    </button><CopyPlayerId fid={p.fid}/>
   </article>;
  })}
  {!rows.length&&<div style={{padding:16,background:C.section,borderRadius:12}}><p style={{fontSize:16,fontWeight:600,marginTop:0}}>{query||assignedOnly?'No matching changes':'No changes detected yet'}</p><p style={{fontSize:14,color:C.icy,lineHeight:1.5,marginBottom:0}}>{query||assignedOnly?'Try another search or turn off TAL players only.':'Refresh a legion or alliance to check for changes. Past names without a recorded date remain searchable in Members.'}</p></div>}
  {rows.length>limit&&<button style={{...button,width:'100%'}} onClick={()=>setLimit(limit+40)}>Show more changes</button>}
 </section>;
}
