import {useState} from 'react';
import {C} from '../../../utils/constants.js';
import {activeStateId} from '../../../services/stateWorkspaceService.js';
import {arenaTeam,compareArenaTeams,placeArenaHero} from '../../../services/arenaComparisonService.js';
import {useArenaResults} from '../../../hooks/useArenaResults.js';
import {ArenaPlayerFetch} from './ArenaPlayerFetch.jsx';
import {ArenaHolgerBonuses} from './ArenaHolgerBonuses.jsx';
import {ArenaFormation} from './ArenaFormation.jsx';
import {ArenaTeamEditor} from './ArenaTeamEditor.jsx';
import {ArenaGearComparison} from './ArenaGearComparison.jsx';
import {ArenaAssessment} from './ArenaAssessment.jsx';
import {ArenaBattleLog} from './ArenaBattleLog.jsx';
import {arenaButton,arenaCard,arenaInput} from './arenaStyles.js';
export function ArenaComparePanel({players,onViewPlayer,onClose}){
 const stateId=activeStateId();
 const [left,setLeft]=useState(null),[right,setRight]=useState(null),[fetched,setFetched]=useState({}),[versions,setVersions]=useState({left:0,right:0});
 const {results,record,remove,message}=useArenaResults(stateId);
 const yours=fetched.left || players.find(p=>p.id===left?.playerId),theirs=fetched.right || players.find(p=>p.id===right?.playerId);
 // Never continue comparing a trial after its roster identity changed or was removed.
 const a=yours && String(yours.fid)===left.fid?left:null,b=theirs && String(theirs.fid)===right.fid?right:null;
 const assessment=compareArenaTeams(a,b);
 function choose(id,set,side){const p=players.find(p=>p.id===id);setFetched(prev=>({...prev,[side]:null}));setVersions(prev=>({...prev,[side]:prev[side]+1}));set(p?arenaTeam(p,stateId):null)}
 function receive(player,set,side,previous){const next=arenaTeam(player,stateId);if(previous?.fid===next.fid)next.holger=previous.holger;setFetched(prev=>({...prev,[side]:player}));set(next)}
 function reload(player,team,set){const next=arenaTeam(player,stateId);next.holger=team.holger;set(next)}
 return <section style={{position:'fixed',inset:0,zIndex:600,overflowY:'auto',overscrollBehavior:'contain',boxSizing:'border-box',maxWidth:480,margin:'0 auto',background:C.bg,padding:'12px 16px 32px',color:C.white}}><header style={{position:'sticky',top:0,zIndex:1,background:C.bg,display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}><h2 style={{fontSize:20}}>Arena comparison</h2><button onClick={onClose} style={arenaButton}>Back to Intel</button></header><p style={{fontSize:12,color:C.icy}}>State {stateId} · Exploration Arena</p><p style={{fontSize:12,color:C.muted,lineHeight:1.5}}>Fetch both players’ recorded heroes and gear, then rearrange your attack team against their defence. Fetches and trial edits stay in this comparison; player records are kept. Trials reset when you leave. Expedition Arena uses different rules and is not supported here.</p>
 <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>{[['Your player',a,setLeft,b?.fid,'left'],['Opponent',b,setRight,a?.fid,'right']].map(([label,team,set,other,side])=><label key={label} style={{fontSize:12,minWidth:0}}>{label}<select aria-label={label} value={team?.playerId || ''} onChange={e=>choose(e.target.value,set,side)} style={arenaInput}><option value="">Choose saved player</option>{fetched[side] && <option value={fetched[side].id}>{fetched[side].username} · fetched</option>}{players.filter(p=>String(p.fid)!==other).map(p=><option key={p.id} value={p.id}>[{p.allianceTag || '—'}] {p.username || p.fid}</option>)}</select></label>)}</div>
 <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}><ArenaPlayerFetch label="Your" stateId={stateId} selectionVersion={versions.left} selectedFid={a?.fid} onFetched={p=>receive(p,setLeft,'left',a)}/><ArenaPlayerFetch label="Opponent" stateId={stateId} selectionVersion={versions.right} selectedFid={b?.fid} onFetched={p=>receive(p,setRight,'right',b)}/></div><p style={{fontSize:11,color:C.muted}}>Officer sign-in required. Enter in-game IDs from State {stateId}; an opponent does not need to be in Members. Results may be cached. The API returns defence heroes, not every owned hero.</p>
 {a && b && <div style={{...arenaCard,display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}><ArenaFormation team={a} label={`${yours.username || 'Your team'} · Attack`}/><ArenaFormation team={b} label={`${theirs.username || 'Opponent'} · Defence`}/></div>}
 {[[a,yours,'Your team',setLeft],[b,theirs,'Opponent',setRight]].map(([team,player,label,set])=>team && <ArenaTeamEditor key={`${label}:${team.playerId}`} label={label} player={player} team={team} onChange={set} onReload={()=>reload(player,team,set)} onViewPlayer={players.some(p=>p.id===player.id)?onViewPlayer:null} defence={label==='Opponent'}/>)}
 {a && b && <ArenaHolgerBonuses yours={a} theirs={b} onYourChange={setLeft} onTheirChange={setRight}/>}
 {a && b && <ArenaGearComparison yours={a} theirs={b}/>}
 <ArenaAssessment assessment={assessment} onSwap={([front,back])=>setLeft(placeArenaHero(a,front,a.slots[back]))}/>
 <ArenaBattleLog stateId={stateId} yours={a} theirs={b} assessment={assessment} results={results} record={record} remove={remove} message={message}/>
 </section>;
}
