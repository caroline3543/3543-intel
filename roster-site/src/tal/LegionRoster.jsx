import {useRef,useState} from 'react';
import {Hint,button,field,C,TimeButtons} from './ui.jsx';
import {coverage,playerLabel,teamIssues} from './planner.js';
import {comparePlayers,top20Ids} from './power.js';
import {LegionPlayerRow} from './LegionPlayerRow.jsx';
import {PowerSummary} from './PowerSummary.jsx';
import {LegionIntake} from './LegionIntake.jsx';
export function LegionRoster({plan,team,players,onChange,onMessage,onRole,onPower}){
 const filterControl=useRef(null);
 const [sort,setSort]=useState('labyrinth'),[filter,setFilter]=useState('all');
 const members=new Map(team.members.map(m=>[m.id,m])),candidates=new Map((team.candidates||[]).filter(c=>!members.has(c.id)).map(c=>[c.id,c]));
 const listed=players.filter(p=>members.has(p.id)||candidates.has(p.id)).sort(comparePlayers(plan,sort));
 const shown=listed.filter(p=>filter==='all'||filter==='selected'&&members.has(p.id)||filter==='unselected'&&!members.has(p.id)),top=top20Ids(plan,team,players),issues=teamIssues(plan,team,players);
 function update(patch){onChange({...plan,teams:plan.teams.map(t=>t.id===team.id?{...t,...patch}:t)});}
 return <div style={{marginTop:12}}>
  <div style={{display:'grid',gap:6,fontSize:14,color:C.icy,marginBottom:12}}>{coverage(plan,team,players).map(c=><div key={c.time}>{c.time} UTC · {c.combatants+c.substitutes+c.pending} selected players available</div>)}</div>
  <details style={{marginBottom:10}}><summary style={{minHeight:44,paddingTop:12,color:C.icy,cursor:'pointer'}}>Legion settings</summary>{team.importedSource?.notes&&<Hint>{team.importedSource.notes}</Hint>}<strong style={{fontSize:14}}>Three battle times · UTC</strong><TimeButtons times={plan.times} selected={team.slots} max={3} disabled={plan.locked} onToggle={time=>update({slots:team.slots.includes(time)?team.slots.filter(s=>s!==time):[...team.slots,time]})}/><label>Captain<select style={{...field,margin:'8px 0 12px'}} value={team.captain} disabled={plan.locked} onChange={e=>update({captain:e.target.value})}><option value="">Choose a captain</option>{team.members.map(m=><option key={m.id} value={m.id}>{playerLabel(players.find(p=>p.id===m.id))}</option>)}</select></label><label>Registration officer<input style={{...field,margin:'8px 0 12px'}} value={team.officer||''} placeholder="Officer name" disabled={plan.locked} onChange={e=>update({officer:e.target.value})}/></label><label>Match time · UTC<select style={{...field,margin:'8px 0 12px'}} value={team.matchTime||''} disabled={plan.locked} onChange={e=>update({matchTime:e.target.value})}><option value="">Not announced</option>{team.slots.map(t=><option key={t}>{t}</option>)}</select></label></details>
  {!!issues.length&&<details style={{marginBottom:10}}><summary style={{minHeight:44,paddingTop:12,color:C.gold,cursor:'pointer'}}>Checks to review · {issues.length}</summary>{issues.map(issue=><p key={issue} style={{fontSize:14,color:C.icy,lineHeight:1.5}}>{issue}</p>)}</details>}
  <PowerSummary plan={plan} team={team} players={players} onChange={onChange}/>
  <button style={{...button,width:'100%',marginBottom:10,color:C.gold}} disabled={plan.locked} onClick={()=>onPower(team)}>Enter troop powers</button>
  <details style={{marginBottom:12}}><summary style={{minHeight:44,paddingTop:12,color:C.icy,cursor:'pointer'}}>Add players</summary><LegionIntake plan={plan} players={players} team={team} onChange={onChange} onMove={onRole}/></details>
  <Hint>Top 30 are combatants; the rest are substitutes. Recorded troop power ranks first. Missing powers use Labyrinth rank. Roles update automatically while unlocked.</Hint>{team.autoRoleNotice?.registrationIds?.some(id=>team.members.some(m=>m.id===id&&!m.registered))&&<Hint>{team.autoRoleNotice.registrationIds.filter(id=>team.members.some(m=>m.id===id&&!m.registered)).length} changed roles need in-game registration checked again.</Hint>}<h4 style={{fontSize:17,margin:'12px 0 6px'}}>Select players</h4><Hint>A check means selected for this legion. Register players separately in game.</Hint>
  <div role="group" aria-label={`Show players in ${team.id}`} style={{display:'flex',gap:6,overflowX:'auto',marginBottom:10}}>{[['all','All',listed.length],['selected','Selected',team.members.length],['unselected','Not selected',candidates.size]].map(([value,label,count])=><button ref={filter===value?filterControl:null} key={value} style={{...button,flexShrink:0,color:filter===value?C.gold:C.icy}} aria-pressed={filter===value} onClick={()=>setFilter(value)}>{label} · {count}</button>)}</div>
  <label style={{fontSize:14,color:C.icy}}>Sort players<select aria-label={`Order players in ${team.id}`} style={{...field,margin:'6px 0 12px'}} value={sort} onChange={e=>setSort(e.target.value)}><option value="labyrinth">Labyrinth rank · best first</option><option value="troop">Troop power · highest first</option><option value="city">City power · highest first</option><option value="name">Name A–Z</option></select></label>
  {shown.map((p,index)=><LegionPlayerRow key={p.id} plan={plan} team={team} player={p} member={members.get(p.id)} candidate={candidates.get(p.id)} index={index} sort={sort} top20={top.has(p.id)} onChange={onChange} onRole={onRole} onPower={onPower} onSelectionChange={()=>{if(filter!=='all')requestAnimationFrame(()=>filterControl.current?.focus());}}/>)}
  {!shown.length&&<Hint>No players in this view.</Hint>}
  {team.members.filter(m=>!players.some(p=>p.id===m.id)).map(m=><div key={m.id} style={{padding:'12px 0'}}><Hint>Player no longer in roster · {m.id}</Hint><button style={button} disabled={plan.locked} onClick={()=>update({members:team.members.filter(v=>v.id!==m.id),captain:team.captain===m.id?'':team.captain})}>Unassign missing player</button></div>)}
 </div>;
}
