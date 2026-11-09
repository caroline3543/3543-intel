import {C} from '../../utils/constants.js';
import {useState} from 'react';
import {readinessForMatch} from '../../services/talMatchReadiness.js';
import {plannedMemberIds,allianceCheck,legionLabel,utcChecked} from '../../services/talRosterService.js';
const button={minHeight:44,padding:'10px 12px',borderRadius:10,border:`1px solid ${C.border}`,background:C.section,color:C.icy,fontSize:14,fontWeight:600,cursor:'pointer'};
function transferRows(teams,players){
 const byId=new Map(players.map(p=>[String(p.id),p]));
 const assignments=new Map();
 for(const team of teams){
  for(const id of plannedMemberIds(team)){
   const key=String(id);
   if(!assignments.has(key))assignments.set(key,{team,player:byId.get(key)});
  }
 }
 return [...assignments.entries()].map(([id,{team,player}])=>({id,team,player,check:player?allianceCheck(player,team):{status:'unknown',tag:'',at:null}}));
}
function transferText(rows){
 const groups=new Map();
 for(const {team,player,check} of rows){
  if(check.status!=='move'||!player)continue;
  const origin=check.tag||'No alliance',dest=team.host;
  const key=JSON.stringify([origin.toLowerCase(),dest.toLowerCase()]);
  if(!groups.has(key))groups.set(key,{origin,dest,members:[]});
  groups.get(key).members.push({name:player.username||player.alias||'Unknown player'});
 }
 return [...groups.values()].sort((a,b)=>a.dest.localeCompare(b.dest)||a.origin.localeCompare(b.origin)).map(g=>{
  const heading=g.origin==='No alliance'?`Players without an alliance who should join ${g.dest}`:`Players in ${g.origin} alliance who should be in ${g.dest}`;
  return heading+'\n'+g.members.sort((a,b)=>a.name.localeCompare(b.name,undefined,{sensitivity:'base'})).map(m=>`• ${m.name}`).join('\n');
 }).join('\n\n');
}
export function RosterLegions({teams,selected,onSelect,players,check,onCheck,onRefresh,refresh,onCopied,availability={}}){
 const [copying,setCopying]=useState(false);
 const team=teams.find(t=>t.id===selected),members=team?players.filter(p=>plannedMemberIds(team).has(p.id)):[];
 const rows=transferRows(team?[team]:teams,players);
 const correct=rows.filter(r=>r.check.status==='in-host').length;
 const needsMove=rows.filter(r=>r.check.status==='move').length;
 const unknown=rows.length-correct-needsMove;
 const percent=rows.length?Math.round(correct/rows.length*100):0;
 const match=team?.matchTime?readinessForMatch(team,{availability},players):null;
 const matchPercent=match?.attending?Math.round(100*match.correct/match.attending):0;
 async function copyMoves(){
  const message=transferText(rows);
  if(!message)return;
  setCopying(true);
  try{await navigator.clipboard.writeText(message);onCopied?.(`Copied ${needsMove} players who need to move`);}catch{onCopied?.('Unable to copy transfer list','error');}
  finally{setCopying(false);}
 }
 return <section aria-label="TAL legion filters" style={{marginBottom:12}}>
  <h2 style={{fontSize:14,color:C.icy,margin:'0 0 8px'}}>TAL legions</h2>
  <div style={{background:C.section,border:`1px solid ${C.border}`,borderRadius:12,padding:12,marginBottom:12}} aria-label="TAL alliance readiness">
   <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:8,flexWrap:'wrap'}}>
    <strong style={{fontSize:15}}>{team?legionLabel(team):'All TAL legions'} · Alliance readiness</strong>
    <strong style={{color:C.green,fontSize:15}}>{correct} / {rows.length} · {percent}%</strong>
   </div>
   <div role="progressbar" aria-label="Players in correct host alliance" aria-valuemin={0} aria-valuemax={rows.length||1} aria-valuenow={correct} style={{height:9,borderRadius:99,overflow:'hidden',background:C.border,margin:'10px 0'}}>
    <div style={{height:'100%',width:`${percent}%`,background:C.green,borderRadius:99}}/>
   </div>
   <div style={{fontSize:13,color:C.icy,lineHeight:1.6}}>{correct} in correct alliance · {needsMove} need to move · {unknown} unverified</div>
   <button type="button" disabled={!needsMove||copying} onClick={copyMoves} style={{...button,width:'100%',marginTop:10,color:needsMove?C.gold:C.icy}}>{copying?'Copying…':`Copy move list (${needsMove})`}</button>
   <p style={{margin:'8px 0 0',fontSize:12,color:C.icy,lineHeight:1.4}}>Based on last observed alliances. Refresh players before sharing. Unverified players are not included in the move list.</p>
  </div>
  {team&&<div style={{background:C.section,border:`1px solid ${C.border}`,borderRadius:12,padding:12,marginBottom:12}} aria-label="Match-time readiness">
   <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:8,flexWrap:'wrap'}}>
    <strong style={{fontSize:15}}>{team.matchTime?`Match readiness · ${team.matchTime} UTC`:'Match readiness'}</strong>
    {match&&<strong style={{color:C.green,fontSize:15}}>{match.correct} / {match.attending} · {matchPercent}%</strong>}
   </div>
   {match?<>
    <div role="progressbar" aria-label="Available players in the correct host alliance" aria-valuemin={0} aria-valuemax={match.attending||1} aria-valuenow={match.correct} style={{height:9,borderRadius:99,overflow:'hidden',background:C.border,margin:'10px 0'}}>
     <div style={{height:'100%',width:`${matchPercent}%`,background:C.green,borderRadius:99}}/>
    </div>
    <p style={{fontSize:13,color:C.icy,lineHeight:1.6,margin:0}}>{match.pollYes} indicated available in poll · {match.attending} expected · {match.correct} in correct alliance · {match.needMove} need to move · {match.unverified} unverified</p>
    <p style={{fontSize:12,color:C.icy,lineHeight:1.5,margin:'6px 0 0'}}>Expected attendance uses poll answers unless manually changed in the battle plan. This does not confirm a player will attend.</p>
   </>:<p style={{fontSize:13,color:C.icy,lineHeight:1.5,margin:'8px 0 0'}}>Set this legion’s match time in the TAL plan to view poll availability and alliance readiness.</p>}
  </div>}
  <div role="group" aria-label="Filter by TAL legion" style={{display:'flex',gap:8,flexWrap:'wrap'}}>{[{id:'',label:'All members'},...teams.map(t=>({id:t.id,label:legionLabel(t)}))].map(t=><button key={t.id} aria-pressed={selected===t.id} onClick={()=>onSelect(t.id)} style={{...button,color:selected===t.id?C.gold:C.icy,borderColor:selected===t.id?C.gold:C.border}}>{t.label}</button>)}</div>
  {team&&<div style={{background:C.section,padding:12,borderRadius:12,marginTop:10}}>
   <p style={{fontSize:16,fontWeight:700,margin:'0 0 6px'}}>{legionLabel(team)} · {members.length} players</p>
   {!!team.candidates?.length&&<p style={{fontSize:13,color:C.icy}}>{team.members.length} selected · {members.length-team.members.length} proposed, excluding withdrawn</p>}
   <p style={{fontSize:14,color:C.icy,margin:'0 0 10px'}}>{members.filter(p=>allianceCheck(p,team).status==='in-host').length} last seen in {team.host} · {members.filter(p=>allianceCheck(p,team).status==='move').length} to move · {members.filter(p=>allianceCheck(p,team).status==='unknown').length} unknown</p>
   <label style={{display:'block',fontSize:14,color:C.icy}}>Alliance check<select aria-label="Alliance check" value={check} onChange={e=>onCheck(e.target.value)} style={{...button,width:'100%',margin:'6px 0 10px',fontSize:16}}><option value="all">All players</option><option value="move">Needs to move</option><option value="in-host">In host alliance</option><option value="unknown">Alliance unknown</option></select></label>
   {onRefresh&&<button disabled={!!refresh} style={{...button,width:'100%',color:C.gold}} onClick={()=>onRefresh(team)}>{refresh?`Refreshing ${refresh.done} of ${refresh.total}…` :'Refresh legion players'}</button>}
   <p style={{fontSize:13,color:C.icy,lineHeight:1.5,margin:'8px 0 0'}}>Alliance checks use the latest recorded game data. Confirm in-game registration before the match.</p>
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
