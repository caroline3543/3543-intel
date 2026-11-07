import {ReviewAvailability} from './ReviewAvailability.jsx';
import {RegistrationChecklist} from './RegistrationChecklist.jsx';
import {PowerSummary} from './PowerSummary.jsx';
import {PowerEntry} from './PowerEntry.jsx';
import {useState} from 'react';
import {Card,Hint,button,field,C} from './ui.jsx';
import {coverage,planText,readyIssues,record,transferRows,playerLabel} from './planner.js';
export function Review({plan,players,onChange,onCopy,onExport,onStep}){
 const [powerTeam,setPowerTeam]=useState(''),[powerPlayer,setPowerPlayer]=useState('');
 const [showMoves,setShowMoves]=useState(false),[showAll,setShowAll]=useState(false);
 const issues=readyIssues(plan,players),rows=transferRows(plan,players),moves=rows.filter(r=>r.needsMove),notRegistered=rows.filter(r=>!r.member.registered);
 const pending=players.filter(p=>record(plan,p).status==='pending').length;
 return <>
  <Card title="Registration checklist"><Hint>{issues.length?`${issues.length} planning items to check`:'Planning checks passed'} · {moves.length} alliance moves · {notRegistered.length} registrations to confirm · {pending} no reply</Hint><Hint>The app prepares your plan. R4/R5 must move and register players in game before the deadline.</Hint>{issues.slice(0,showAll?issues.length:6).map((issue,i)=><p key={i} style={{fontSize:14,color:C.gold,lineHeight:1.5}}>{issue}</p>)}{issues.length>6&&<button style={button} onClick={()=>setShowAll(!showAll)}>{showAll?'Show fewer':'Show all items'}</button>}<div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:12}}><button style={button} onClick={()=>onStep('legions')}>Edit legions</button><button style={button} onClick={()=>onCopy(planText(plan,players))}>Copy plan</button><button style={button} onClick={onExport}>Download Excel plan</button></div></Card>
  {plan.teams.some(t=>t.id===powerTeam)&&<PowerEntry key={`${powerTeam}:${powerPlayer}`} plan={plan} team={plan.teams.find(t=>t.id===powerTeam)} players={players} initialPlayerId={powerPlayer} onChange={onChange} onClose={()=>setPowerTeam('')}/>}
  <Card title="Legion power">{plan.teams.map(team=><div key={team.id}><strong>{team.host} Legion {team.number}</strong><PowerSummary plan={plan} team={team} players={players} onChange={onChange}/></div>)}</Card>
  <ReviewAvailability plan={plan} players={players}/>
  <Card title={`Alliance moves · ${moves.length}`}><Hint>Home is the player’s original alliance. “Game alliance” is the last API record; refresh Members to check a move.</Hint><button style={button} aria-expanded={showMoves} onClick={()=>setShowMoves(!showMoves)}>{showMoves?'Hide move list':'Show move list'}</button>{showMoves&&moves.map(r=><p key={r.member.id} style={{fontSize:14,lineHeight:1.6}}><strong>{playerLabel(r.player)}</strong> · {r.player?.fid}<br/>Home [{r.home||'?'}] · Game alliance [{r.player?.allianceTag||'?'}]<br/>Join [{r.team.host}] → Legion {r.team.number} · {r.member.role}</p>)}</Card>
  <RegistrationChecklist plan={plan} players={players} onChange={onChange} onEditPower={(team,id)=>{setPowerTeam(team.id);setPowerPlayer(id);}}/>
  <Card title="Protect your finished plan"><Hint>Locking prevents accidental edits here. It does not change the in-game roster.</Hint><button style={{...button,width:'100%',color:C.gold}} disabled={!plan.locked&&issues.length>0} onClick={()=>onChange({...plan,locked:!plan.locked})}>{plan.locked?'Unlock plan':'Lock plan'}</button>{!plan.locked&&issues.length>0&&<Hint>Resolve the planning items above to lock the plan.</Hint>}</Card>
 </>;
}
