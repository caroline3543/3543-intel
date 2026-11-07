import {C} from '../../utils/constants.js';
import {plannedMemberIds,allianceCheck,legionLabel,utcChecked} from '../../services/talRosterService.js';
const button={minHeight:44,padding:'10px 12px',borderRadius:10,border:`1px solid ${C.border}`,background:C.section,color:C.icy,fontSize:14,fontWeight:600,cursor:'pointer'};
export function RosterLegions({teams,selected,onSelect,players,check,onCheck,onRefresh,refresh}){
 const team=teams.find(t=>t.id===selected),members=team?players.filter(p=>plannedMemberIds(team).has(p.id)):[];
 return <section aria-label="TAL legion filters" style={{marginBottom:12}}>
  <h2 style={{fontSize:14,color:C.icy,margin:'0 0 8px'}}>TAL legions</h2>
  <div role="group" aria-label="Filter by TAL legion" style={{display:'flex',gap:8,flexWrap:'wrap'}}>{[{id:'',label:'All members'},...teams.map(t=>({id:t.id,label:legionLabel(t)}))].map(t=><button key={t.id} aria-pressed={selected===t.id} onClick={()=>onSelect(t.id)} style={{...button,color:selected===t.id?C.gold:C.icy,borderColor:selected===t.id?C.gold:C.border}}>{t.label}</button>)}</div>
  {team&&<div style={{background:C.section,padding:12,borderRadius:12,marginTop:10}}>
   <p style={{fontSize:16,fontWeight:700,margin:'0 0 6px'}}>{legionLabel(team)} · {members.length} players</p>
   {!!team.candidates?.length&&<p style={{fontSize:13,color:C.icy}}>{team.members.length} selected · {members.length-team.members.length} proposed, excluding withdrawn</p>}
   <p style={{fontSize:14,color:C.icy,margin:'0 0 10px'}}>{members.filter(p=>allianceCheck(p,team).status==='in-host').length} last seen in {team.host} · {members.filter(p=>allianceCheck(p,team).status==='move').length} to move · {members.filter(p=>allianceCheck(p,team).status==='unknown').length} unknown</p>
   <label style={{display:'block',fontSize:14,color:C.icy}}>Alliance check<select aria-label="Alliance check" value={check} onChange={e=>onCheck(e.target.value)} style={{...button,width:'100%',margin:'6px 0 10px',fontSize:16}}><option value="all">All players</option><option value="move">Needs to move</option><option value="in-host">In host alliance</option><option value="unknown">Alliance unknown</option></select></label>
   <button disabled={!!refresh} style={{...button,width:'100%',color:C.gold}} onClick={()=>onRefresh(team)}>{refresh?`Refreshing ${refresh.done} of ${refresh.total}…`:'Refresh legion players'}</button>
   <p style={{fontSize:13,color:C.icy,lineHeight:1.5,margin:'8px 0 0'}}>Checks each player by ID. Uses one lookup per player. Game data may be cached for up to an hour. Confirm registration in game.</p>
  </div>}
 </section>;
}
export function LegionPlayerStatus({player,team,previousName}){
 if(!team)return previousName?<div style={{fontSize:14,color:C.icy,marginTop:8,overflowWrap:'anywhere'}}>Previously: {previousName}</div>:null;
 const status=allianceCheck(player,team);
 return <div style={{fontSize:14,lineHeight:1.5,marginTop:10,paddingTop:10,borderTop:`1px solid ${C.border}`}}>
  <div style={{color:C.icy}}>{legionLabel(team)}</div>{team.proposalStatus&&<div style={{color:C.gold}}>Proposed · {team.proposalStatus}</div>}<div style={{color:status.status==='in-host'?C.green:status.status==='move'?C.gold:C.icy}}>{status.label}</div>
  <div style={{fontSize:13,color:C.icy}}>Checked: {utcChecked(status.at)}</div>
  {previousName&&<div style={{color:C.icy,overflowWrap:'anywhere'}}>Previously: {previousName}</div>}
 </div>;
}
