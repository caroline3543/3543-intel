import {useState} from 'react';
import {C} from '../../../utils/constants.js';
import {activeStateId} from '../../../services/stateWorkspaceService.js';
import {arenaTeam,compareArenaTeams,placeArenaHero} from '../../../services/arenaComparisonService.js';
import {useArenaResults} from '../../../hooks/useArenaResults.js';
import {ArenaFormation} from './ArenaFormation.jsx';
import {ArenaTeamEditor} from './ArenaTeamEditor.jsx';
import {ArenaGearComparison} from './ArenaGearComparison.jsx';
import {ArenaAssessment} from './ArenaAssessment.jsx';
import {ArenaBattleLog} from './ArenaBattleLog.jsx';
import {arenaButton,arenaCard,arenaInput} from './arenaStyles.js';
export function ArenaComparePanel({players,onViewPlayer,onClose}){
 const stateId=activeStateId();
 const [left,setLeft]=useState(null),[right,setRight]=useState(null);
 const {results,record,remove,message}=useArenaResults(stateId);
 const yours=players.find(p=>p.id===left?.playerId),theirs=players.find(p=>p.id===right?.playerId);
 // Never continue comparing a trial after its roster identity changed or was removed.
 const a=yours && String(yours.fid)===left.fid?left:null,b=theirs && String(theirs.fid)===right.fid?right:null;
 const assessment=compareArenaTeams(a,b);
 function choose(id,set){const p=players.find(p=>p.id===id);set(p?arenaTeam(p,stateId):null)}
 return <section style={{position:'fixed',inset:0,zIndex:600,overflowY:'auto',overscrollBehavior:'contain',boxSizing:'border-box',maxWidth:480,margin:'0 auto',background:C.bg,padding:'12px 16px 32px',color:C.white}}><header style={{position:'sticky',top:0,zIndex:1,background:C.bg,display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}><h2 style={{fontSize:20}}>Arena comparison</h2><button onClick={onClose} style={arenaButton}>Back to Intel</button></header><p style={{fontSize:12,color:C.icy}}>State {stateId} · Exploration Arena</p><p style={{fontSize:12,color:C.muted,lineHeight:1.5}}>Compare recorded defence heroes and test a lineup. Trial edits do not change player records and reset when you leave. Expedition Arena uses different rules and is not supported here.</p>
 <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>{[['Your player',a,setLeft,b?.playerId],['Opponent',b,setRight,a?.playerId]].map(([label,team,set,other])=><label key={label} style={{fontSize:12,minWidth:0}}>{label}<select aria-label={label} value={team?.playerId || ''} onChange={e=>choose(e.target.value,set)} style={arenaInput}><option value="">Choose player</option>{players.filter(p=>p.id!==other).map(p=><option key={p.id} value={p.id}>[{p.allianceTag || '—'}] {p.username || p.fid}</option>)}</select></label>)}</div>
 {a && b && <div style={{...arenaCard,display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}><ArenaFormation team={a} label={yours.username || 'Your team'}/><ArenaFormation team={b} label={theirs.username || 'Opponent'}/></div>}
 {[[a,yours,'Your team',setLeft],[b,theirs,'Opponent',setRight]].map(([team,player,label,set])=>team && <ArenaTeamEditor key={`${label}:${team.playerId}`} label={label} player={player} team={team} onChange={set} onReload={()=>set(arenaTeam(player,stateId))} onViewPlayer={onViewPlayer}/>)}
 {a && b && <ArenaGearComparison yours={a} theirs={b}/>}
 <ArenaAssessment assessment={assessment} onSwap={([front,back])=>setLeft(placeArenaHero(a,front,a.slots[back]))}/>
 <ArenaBattleLog stateId={stateId} yours={a} theirs={b} assessment={assessment} results={results} record={record} remove={remove} message={message}/>
 </section>;
}
