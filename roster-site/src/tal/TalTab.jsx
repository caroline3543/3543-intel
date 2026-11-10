import {TalBulkEditor} from './TalBulkEditor.jsx';
import {useEffect,useRef,useState} from 'react';
import {DEFAULT_TIMES} from './planner.js';
import {PlayerAvatar} from '../../../src/components/players/PlayerAvatar.jsx';
import {plannedMemberIds,allianceCheck,legionLabel} from '../../../src/services/talRosterService.js';
import {comparePriority} from '../../../src/components/players/PlayerCard.jsx';
import {C} from '../../../src/utils/constants.js';

const button={minHeight:44,padding:'10px 12px',fontSize:14,fontWeight:600,borderRadius:10,border:'1px solid '+C.border,background:C.section,color:C.icy,cursor:'pointer'};
const muted={fontSize:12,color:C.icy,lineHeight:1.45};
const compareNames=(a,b)=>(a.username||a.alias||'').localeCompare(b.username||b.alias||'',undefined,{sensitivity:'base',numeric:true});
const numeric=value=>{const n=Number(value);return value===null||value===undefined||value===''||!Number.isFinite(n)?null:n;};
const compact=n=>n==null?'Not recorded':Number(n).toLocaleString('en-US',{notation:'compact',maximumFractionDigits:1});
const tournamentStatus=t=>t.tournamentStatus==='eliminated'||t.eliminated===true?'eliminated':'active';
const matchLabel=team=>team?legionLabel(team):'All legions';
function moveText(rows){
 const groups=new Map();
 for(const {team,player,check} of rows){
  if(check.status!=='move'||!player)continue;
  const origin=check.tag||'No alliance',destination=team.host;
  const key=origin+'|'+destination;
  if(!groups.has(key))groups.set(key,{origin,destination,players:[]});
  groups.get(key).players.push(player.username||player.alias||String(player.fid||'Unknown player'));
 }
 return [...groups.values()].sort((a,b)=>a.destination.localeCompare(b.destination)||a.origin.localeCompare(b.origin)).map(g=>
  (g.origin==='No alliance'?'No alliance → '+g.destination:g.origin+' → '+g.destination)+'\n'+g.players.sort((a,b)=>a.localeCompare(b,undefined,{sensitivity:'base'})).map(name=>'• '+name).join('\n')
 ).join('\n\n');
}
export function TalTab({value,players,onChange,onOpenPlayer,onRefreshLegion,legionRefresh,onMessage,workspace,onBulkApply}){
 const [selected,setSelected]=useState(()=>{try{return window.sessionStorage.getItem('tal:selected-legion')||'';}catch{return '';}});
 const [check,setCheck]=useState('all');
 const [search,setSearch]=useState('');
 const [timeFilters,setTimeFilters]=useState([]);
 const [timeMode,setTimeMode]=useState('any');
 const [sort,setSort]=useState('name');
 const [registrationFilter,setRegistrationFilter]=useState('all');
 const [adding,setAdding]=useState(false);
 const [addQuery,setAddQuery]=useState('');
 const [addSearch,setAddSearch]=useState('');
 const [addTimes,setAddTimes]=useState([]);
 const [batchStatus,setBatchStatus]=useState('needs');
 const [timeMerge,setTimeMerge]=useState('add');
 const [addSelected,setAddSelected]=useState([]);
 const [swipeId,setSwipeId]=useState('');
 const gesture=useRef(null);
 const [editingTimes,setEditingTimes]=useState('');
 const [timesDraft,setTimesDraft]=useState({});
 const [addingReview,setAddingReview]=useState(false);
 const [removeId,setRemoveId]=useState('');
 const [actionsId,setActionsId]=useState('');
 const [previewOpen,setPreviewOpen]=useState(false);
 const [tournamentConfirm,setTournamentConfirm]=useState('');
 const [copying,setCopying]=useState(false);
 const [listLimit,setListLimit]=useState(40);
 const [missingFilter,setMissingFilter]=useState('');
 const playersAnchor=useRef(null);
 const teams=(value?.teams||[]).filter(t=>['GLR'].includes(String(t.host||'').toUpperCase()));
 const team=teams.find(t=>t.id===selected);
 const effectiveSelection=team?selected:'';
 const shownTeams=team?[team]:teams;
 const byId=new Map(players.map(p=>[String(p.id),p]));
 const entries=[];
 const seen=new Set();
 for(const assignedTeam of shownTeams){
  for(const id of plannedMemberIds(assignedTeam)){
   const player=byId.get(String(id));
   if(player&&!seen.has(String(id))){entries.push({team:assignedTeam,player,check:allianceCheck(player,assignedTeam),member:(assignedTeam.members||[]).find(m=>String(m.id)===String(id))});seen.add(String(id));}
  }
 }
 const activeCount=teams.filter(t=>tournamentStatus(t)==='active').length;
 const eliminatedCount=teams.length-activeCount;
 const ready=entries.filter(e=>e.member&&e.check.status==='in-host').length;
 const move=entries.filter(e=>e.member&&e.check.status==='move').length;
 const unverified=entries.filter(e=>e.member&&e.check.status==='unknown').length;
 const activeEntryCount=entries.filter(e=>e.member).length;
 const percent=activeEntryCount?Math.round(ready/activeEntryCount*100):0;
 const times=(Array.isArray(value?.times)&&value.times.length?value.times:DEFAULT_TIMES).map(String);
 const availabilityFor=player=>{
  const raw=value?.availability?.[player.id]??value?.availability?.[String(player.fid)]??value?.records?.[player.id]?.times??[];
  return Array.isArray(raw)?[...new Set(raw.map(String))].sort((a,b)=>a.localeCompare(b)):[];
 };
 const matchesTime=player=>!timeFilters.length||(timeMode==='all'?timeFilters.every(t=>availabilityFor(player).includes(t)):timeFilters.some(t=>availabilityFor(player).includes(t)));
 const matchesSearch=player=>!search||[player.username,player.alias,player.fid].some(v=>String(v||'').toLowerCase().includes(search.toLowerCase()));
 const missingTroopTypes=player=>['infantry','lancer','marksman'].filter(t=>!player.troops?.[t]||String(player.troops[t]).toLowerCase()==='unknown');
 const missingAvailability=player=>{
  const r=value?.records?.[player.id];
  return !availabilityFor(player).length&&!Array.isArray(r?.unavailableTimes)&&r?.status!=='unavailable'&&!r?.availabilitySubmitted;
 };
 const missingTroopPlayers=entries.filter(e=>missingTroopTypes(e.player).length);
 const missingAvailabilityPlayers=entries.filter(e=>missingAvailability(e.player));
 const gameLanguages=player=>[...new Set([player.gameLanguage,...(Array.isArray(player.languages)?player.languages:[])].filter(x=>typeof x==='string'&&x.trim()).map(x=>x.trim()))];
 const tierChips=player=>[['infantry','Inf',C.inf],['lancer','Lan',C.lan],['marksman','Mar',C.mar]].filter(([key])=>player.troops?.[key]&&String(player.troops[key]).toLowerCase()!=='unknown');
 const roster=entries.filter(e=>(check==='all'||e.check.status===check)&&matchesSearch(e.player)&&matchesTime(e.player)&&(!missingFilter||(missingFilter==='tiers'?missingTroopTypes(e.player).length:missingAvailability(e.player)))&&(registrationFilter==='all'||registrationFilter==='unregistered'&&e.member&&!e.member.registered||registrationFilter==='registered'&&e.member?.registered)).sort((a,b)=>{
  if(sort==='troop'){const score=p=>numeric(value?.records?.[p.id]?.troopPower);const av=score(a.player),bv=score(b.player);return av===null&&bv===null?compareNames(a.player,b.player):av===null?1:bv===null?-1:bv-av||compareNames(a.player,b.player);}
  if(sort==='city'){const av=numeric(a.player.power??a.player.providerStats?.power),bv=numeric(b.player.power??b.player.providerStats?.power);return av===null&&bv===null?compareNames(a.player,b.player):av===null?1:bv===null?-1:bv-av||compareNames(a.player,b.player);}
  if(sort==='labyrinth'){const av=numeric(a.player.providerRankings?.labyrinth?.rank),bv=numeric(b.player.providerRankings?.labyrinth?.rank);return av===null&&bv===null?compareNames(a.player,b.player):av===null?1:bv===null?-1:av-bv||compareNames(a.player,b.player);}
  if(sort==='joiner')return comparePriority(a.player,b.player);
  return compareNames(a.player,b.player);
 });
 const movePreview=moveText(entries);
 const otherAssigned=new Set(teams.filter(t=>t.id!==team?.id).flatMap(t=>[...plannedMemberIds(t)].map(String)));
 const alreadyHere=new Set(team?[...plannedMemberIds(team)].map(String):[]);
 const addMatches=team?players.filter(p=>!alreadyHere.has(String(p.id))&&!p.blacklisted&&(!addSearch||[p.username,p.alias,p.fid,p.id].some(v=>String(v||'').toLowerCase().includes(addSearch.trim().toLowerCase())))).sort(compareNames):[];
 const addEligible=addMatches.filter(p=>!otherAssigned.has(String(p.id)));
 const selectedAdd=addSelected.filter(id=>players.some(p=>String(p.id)===id&&!p.blacklisted)&&!alreadyHere.has(id)&&!otherAssigned.has(id));
 const remaining=team?Math.max(0,50-(team.members||[]).length):0;
 const countedAdd=batchStatus==='considering'?0:selectedAdd.length;
 const combatantSlots=team?Math.max(0,30-(team.members||[]).filter(m=>m.role==='combatant').length):0;
 const substituteSlots=team?Math.max(0,20-(team.members||[]).filter(m=>m.role==='substitute').length):0;
 const canBatch=!!team&&!value?.locked&&tournamentStatus(team)!=='eliminated'&&selectedAdd.length>0&&countedAdd<=remaining&&(batchStatus!=='registered'||countedAdd<=combatantSlots+substituteSlots);
 const anyFilter=check!=='all'||timeFilters.length>0||registrationFilter!=='all'||search.trim()||!!missingFilter;
 useEffect(()=>{try{window.sessionStorage.setItem('tal:selected-legion',effectiveSelection);}catch{}},[effectiveSelection]);
 function chooseLegion(id){setSelected(id);setCheck('all');setRegistrationFilter('all');setAdding(false);setAddSelected([]);setAddSearch('');setAddTimes([]);setBatchStatus('needs');setTimeMerge('add');setRemoveId('');setActionsId('');setSwipeId('');setEditingTimes('');setPreviewOpen(false);setTournamentConfirm('');setListLimit(40);}
 function focusPlayers(){playersAnchor.current?.scrollIntoView({behavior:'smooth',block:'start'});}
 function chooseReadiness(next){setCheck(current=>current===next?'all':next);setListLimit(40);focusPlayers();}
 function resetFilters(){setCheck('all');setSearch('');setTimeFilters([]);setRegistrationFilter('all');setListLimit(40);}
 function changeTime(time){setTimeFilters(old=>old.includes(time)?old.filter(t=>t!==time):[...old,time]);setListLimit(40);}
 function updateTeam(nextTeam){onChange?.({...value,teams:(value?.teams||[]).map(t=>t.id===nextTeam.id?nextTeam:t)});}
 function addPlayer(player){
  if(!team||value?.locked||tournamentStatus(team)==='eliminated')return;
  if(teams.some(t=>t.id!==team.id&&(t.members||[]).some(m=>m.id===player.id))){onMessage?.('Player is selected in another legion. Move them there first.');return;}
  if((team.members||[]).length>=50){onMessage?.('This legion has 50 selected players. Remove someone first.');return;}
  updateTeam({...team,members:[...(team.members||[]),{id:player.id,role:'pending',registered:false}],candidates:(team.candidates||[]).filter(c=>c.id!==player.id)});
  setAddQuery('');onMessage?.('Added to '+legionLabel(team)+'. Confirm availability and in-game registration.');
 }
 function batchAddPlayers(){
  if(!canBatch)return;
  const ids=new Set(selectedAdd),considering=batchStatus==='considering';
  if(teams.some(t=>t.id!==team.id&&(t.members||[]).some(m=>ids.has(String(m.id))))){onMessage?.('A selected player is assigned to another legion. Review the selection.');return;}
  if(!considering&&(team.members||[]).length+ids.size>50){onMessage?.('Not enough legion spaces. Review the selection.');return;}
  const records={...(value?.records||{})},availability={...(value?.availability||{})};
  selectedAdd.forEach(id=>{
    const player=players.find(p=>String(p.id)===id);if(!player)return;
    const existing=Array.isArray(availabilityFor(player))?availabilityFor(player):[];
    const updated=timeMerge==='replace'?addTimes:[...new Set([...existing,...addTimes])];
    records[id]={...(records[id]||{}),times:updated,status:updated.length?'available':records[id]?.status||'pending'};
    availability[id]=updated;
  });
  const nextMembers=considering?[...(team.members||[])]:[...(team.members||[]),...selectedAdd.map((id,i)=>({id,role:batchStatus==='registered'?(i<combatantSlots?'combatant':'substitute'):'pending',registered:batchStatus==='registered'}))];
  const nextCandidates=considering?[...(team.candidates||[]).filter(c=>!ids.has(String(c.id))),...selectedAdd.map(id=>({id,role:'candidate',registered:false}))]:(team.candidates||[]).filter(c=>!ids.has(String(c.id)));
  onChange?.({...value,records,availability,teams:(value?.teams||[]).map(t=>t.id===team.id?{...t,members:nextMembers,candidates:nextCandidates}:t)});
  setAddSelected([]);setAdding(false);setAddingReview(false);
  onMessage?.(ids.size+' player'+(ids.size===1?'':'s')+' '+(considering?'added for consideration.':'added to '+legionLabel(team)+'.'));
 }
  function promoteCandidate(entryTeam,playerId,registered){
  if(!entryTeam||value?.locked||tournamentStatus(entryTeam)==='eliminated')return;
  const candidate=(entryTeam.candidates||[]).find(c=>String(c.id)===String(playerId));
  if(!candidate)return;
  if((entryTeam.members||[]).length>=50){onMessage?.('Legion is full. Remove someone before promoting this candidate.');return;}
  const combatants=entryTeam.members.filter(m=>m.role==='combatant').length;
  const substitutes=entryTeam.members.filter(m=>m.role==='substitute').length;
  const role=registered?(combatants<30?'combatant':substitutes<20?'substitute':null):'pending';
  if(!role){onMessage?.('All combatant and substitute places are full.');return;}
  onChange?.({...value,teams:(value?.teams||[]).map(t=>t.id===entryTeam.id?{...t,candidates:(t.candidates||[]).filter(c=>String(c.id)!==String(playerId)),members:[...(t.members||[]),{id:String(playerId),role,registered}]}:t)});
  setActionsId('');
  onMessage?.(registered?'Candidate confirmed as registered.':'Candidate moved to registration list.');
 }
  function setRegistration(entryTeam,playerId,registered){
  if(!entryTeam||value?.locked||tournamentStatus(entryTeam)==='eliminated')return;
  const combatants=(entryTeam.members||[]).filter(m=>m.role==='combatant').length;
  const substitutes=(entryTeam.members||[]).filter(m=>m.role==='substitute').length;
  const current=entryTeam.members?.find(m=>String(m.id)===String(playerId));
  const nextRole=registered&&current?.role==='pending'?(combatants<30?'combatant':substitutes<20?'substitute':null):current?.role;
  if(registered&&!nextRole){onMessage?.('Combatant and substitute places are full. Choose a role before confirming registration.');return;}
  onChange?.({...value,teams:(value?.teams||[]).map(t=>t.id!==entryTeam.id?t:{...t,members:(t.members||[]).map(m=>String(m.id)===String(playerId)?{...m,role:nextRole,registered}:m)})});
  setSwipeId('');setActionsId('');
  onMessage?.(registered?'Registration confirmed.':'Registration marked pending.');
 }
 function beginEditTimes(player){
  const record=value?.records?.[player.id]||{};
  const yes=new Set(availabilityFor(player));
  const no=new Set(record.unavailableTimes||[]);
  setTimesDraft(Object.fromEntries(times.map(t=>[t,yes.has(t)?'available':no.has(t)?'unavailable':'unknown'])));
  setEditingTimes(String(player.id));setActionsId('');setSwipeId('');
 }
 function saveTimes(player){
  if(value?.locked)return;
  const yes=times.filter(t=>timesDraft[t]==='available'),no=times.filter(t=>timesDraft[t]==='unavailable');
  const old=value?.records?.[player.id]||{};
  const nextRecord={...old,times:yes,unavailableTimes:no,status:yes.length?'available':'pending'};
  onChange?.({...value,records:{...(value?.records||{}),[player.id]:nextRecord},availability:{...(value?.availability||{}),[player.id]:yes}});
  setEditingTimes('');onMessage?.('Updated '+(player.username||player.alias||'player')+' availability.');
 }
 function onSwipeDown(e,id){if(e.pointerType==='mouse'&&e.button!==0)return;gesture.current={id,x:e.clientX,y:e.clientY};}
 function onSwipeUp(e,id,canReveal){
  const p=gesture.current;gesture.current=null;
  if(!p||p.id!==id||!canReveal)return;
  const dx=e.clientX-p.x,dy=e.clientY-p.y;
  if(Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy)*1.4){
   setSwipeId(dx<0?id:'');setActionsId('');setEditingTimes('');
  }
 }
  function removePlayer(player){
  if(!team||value?.locked||tournamentStatus(team)==='eliminated')return;
  updateTeam({...team,members:(team.members||[]).filter(m=>m.id!==player.id),candidates:(team.candidates||[]).filter(c=>c.id!==player.id),captain:team.captain===player.id?'':team.captain});
  setRemoveId('');setActionsId('');onMessage?.('Removed from '+legionLabel(team)+'. Members profile and availability retained.');
 }
 function confirmTournamentResult(){
  if(!team||value?.locked)return;
  const next=tournamentStatus(team)==='eliminated'?'active':'eliminated';
  updateTeam({...team,tournamentStatus:next,tournamentUpdatedAt:new Date().toISOString()});
  setTournamentConfirm('');
  onMessage?.(next==='eliminated'?legionLabel(team)+' marked eliminated. Roster and history preserved.':legionLabel(team)+' restored to active. Verify the match record.');
 }
 async function copyMovePreview(){
  if(!movePreview)return;
  setCopying(true);
  try{await navigator.clipboard.writeText(movePreview);onMessage?.('Copied the reviewed move list.');}
  catch{onMessage?.('Copy failed. Try again.');}
  finally{setCopying(false);}
 }
 const canEdit=!!team&&!value?.locked&&tournamentStatus(team)!=='eliminated';
 return <section style={{padding:'12px 20px 32px'}}>
  <h2 style={{fontSize:22,margin:'0 0 12px'}}>TAL planner</h2>
  <TalBulkEditor data={workspace||{players,talPlan:value}} onApply={onBulkApply}/>
  {!teams.length?<div style={{padding:16,background:C.section,borderRadius:12}}><strong>No legions assigned</strong><p style={{fontSize:14,color:C.icy,lineHeight:1.5}}>Saved TAL legion assignments will appear when available. Existing plan data is retained.</p></div>:<>
   <section aria-label="Choose TAL legion" style={{marginBottom:12}}>
    <div style={{fontSize:12,fontWeight:700,color:C.icy,marginBottom:8}}>LEGIONS</div>
    <div role="group" aria-label="Select a legion to view its data" style={{display:'flex',gap:8,overflowX:'auto',paddingBottom:6,scrollSnapType:'x proximity'}}>
     {[{id:'',label:'All legions',status:'all'},...teams.map(t=>({id:t.id,label:legionLabel(t),status:tournamentStatus(t)}))].map(item=>{
      const active=item.id===effectiveSelection,grey=item.status==='eliminated',dot=grey?C.icy:C.green;
      return <button key={item.id||'all'} type="button" aria-pressed={active} onClick={()=>chooseLegion(item.id)} style={{flex:'0 0 150px',width:150,minWidth:150,minHeight:74,padding:11,textAlign:'left',display:'flex',flexDirection:'column',justifyContent:'center',gap:8,scrollSnapAlign:'start',border:'1px solid '+(active?C.gold:C.border),borderRadius:12,background:active?C.gold+'13':C.section,color:grey?C.icy:C.white,cursor:'pointer'}}>
       <span style={{fontSize:14,fontWeight:700,whiteSpace:'nowrap'}}>{item.label}</span>
       <span style={{display:'flex',alignItems:'center',gap:7,fontSize:12,color:dot}}><span aria-hidden="true" style={{width:7,height:7,flexShrink:0,borderRadius:'50%',background:dot}}/>{item.status==='all'?'Overview':grey?'Eliminated':'Active'}</span>
      </button>;
     })}
    </div>
   </section>
   <section aria-label="Alliance readiness" style={{background:C.card,border:'1px solid '+C.border,borderRadius:12,padding:12,marginBottom:14}}>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
     <div><strong style={{fontSize:15}}>Alliance readiness</strong><div style={{...muted,marginTop:4}}>{matchLabel(team)}</div></div>
     <strong style={{fontSize:19,color:C.green}}>{percent}%</strong>
    </div>
    <div role="progressbar" aria-label="Players in the correct host alliance" aria-valuemin={0} aria-valuemax={activeEntryCount||1} aria-valuenow={ready} style={{height:8,background:C.border,borderRadius:20,overflow:'hidden',margin:'12px 0 10px'}}><div style={{height:'100%',width:percent+'%',background:C.green}}/></div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:7}}>
     {[{id:'in-host',count:ready,label:'In alliance',color:C.green},{id:'move',count:move,label:'Need to move',color:C.gold},{id:'unknown',count:unverified,label:'Unverified',color:C.icy}].map(item=>
      <button key={item.id} type="button" aria-pressed={check===item.id} onClick={()=>chooseReadiness(item.id)} style={{...button,minWidth:0,minHeight:70,padding:8,textAlign:'left',borderColor:check===item.id?item.color:C.border,background:check===item.id?item.color+'17':C.section}}>
       <strong style={{display:'block',fontSize:19,color:item.color}}>{item.count}</strong><span style={{display:'block',fontSize:11,color:C.icy,marginTop:3}}>{item.label}</span>
      </button>
     )}
    </div>
    <button type="button" aria-expanded={previewOpen} onClick={()=>setPreviewOpen(v=>!v)} style={{...button,width:'100%',marginTop:10,textAlign:'left',display:'flex',justifyContent:'space-between',alignItems:'center',color:C.gold}}>
     <span>Review move list ({move})</span><span aria-hidden="true">{previewOpen?'▴':'▾'}</span>
    </button>
    {previewOpen&&<div style={{marginTop:10}}>
      <p style={{...muted,margin:'0 0 8px'}}>Preview exactly what will be copied. Players are grouped by their current and destination alliances.</p>
      {movePreview?<><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',fontFamily:'inherit',fontSize:13,lineHeight:1.6,padding:12,borderRadius:10,background:C.section,maxHeight:300,overflowY:'auto',margin:'0 0 8px'}}>{movePreview}</pre><button type="button" style={{...button,width:'100%',color:C.gold}} disabled={copying} onClick={copyMovePreview}>{copying?'Copying…':'Copy reviewed list ('+move+')'}</button></>:<p style={muted}>No players need to move in this view.</p>}
     </div>}
   </section>
   {team&&<section style={{background:C.card,border:'1px solid '+C.border,borderRadius:12,padding:12,marginBottom:14}}>
    <div style={{display:'flex',justifyContent:'space-between',gap:8,alignItems:'center'}}><strong style={{fontSize:15}}>{legionLabel(team)} · {tournamentStatus(team)==='eliminated'?'Eliminated':'Active'}</strong><button type="button" style={{...button,fontSize:12,padding:'7px 9px',minHeight:36}} onClick={()=>setTournamentConfirm(tournamentConfirm?'':'open')}>{tournamentStatus(team)==='eliminated'?'Correct result':'Record a loss'}</button></div>
    {tournamentStatus(team)==='eliminated'&&<p style={{...muted,margin:'8px 0 0'}}>This legion is eliminated. Its roster and match history remain visible. Player assignments are read-only.</p>}
    {tournamentConfirm&&<div style={{marginTop:10}}>
     <p style={{...muted,margin:'0 0 10px'}}>{tournamentStatus(team)==='eliminated'?'Restore this legion to active? Only do this to correct an incorrect result.':'Confirm this legion lost its match? It will be marked eliminated, and its roster will remain available for review.'}</p>
     <div style={{display:'flex',gap:8}}><button style={button} onClick={()=>setTournamentConfirm('')}>Cancel</button><button style={{...button,color:tournamentStatus(team)==='eliminated'?C.gold:C.red}} disabled={!!value?.locked} onClick={confirmTournamentResult}>{tournamentStatus(team)==='eliminated'?'Restore active':'Confirm loss'}</button></div>
    </div>}
   </section>}
   <section style={{background:C.card,border:'1px solid '+C.border,borderRadius:12,padding:12,marginBottom:12}} aria-label="Missing TAL information">
    <strong style={{fontSize:15}}>Missing information</strong>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:10}}>
     <button type="button" aria-pressed={missingFilter==='tiers'} style={{...button,padding:9,textAlign:'left',minHeight:65,borderColor:missingFilter==='tiers'?C.gold:C.border}} onClick={()=>{setMissingFilter(v=>v==='tiers'?'':'tiers');setListLimit(40);focusPlayers();}}><strong style={{display:'block',fontSize:20,color:C.gold}}>{missingTroopPlayers.length}</strong><span style={muted}>Missing troop tiers</span></button>
     <button type="button" aria-pressed={missingFilter==='availability'} style={{...button,padding:9,textAlign:'left',minHeight:65,borderColor:missingFilter==='availability'?C.gold:C.border}} onClick={()=>{setMissingFilter(v=>v==='availability'?'':'availability');setListLimit(40);focusPlayers();}}><strong style={{display:'block',fontSize:20,color:C.gold}}>{missingAvailabilityPlayers.length}</strong><span style={muted}>Availability not recorded</span></button>
    </div>
    {!!missingFilter&&<button type="button" style={{...button,width:'100%',marginTop:8,color:C.gold}} onClick={()=>setMissingFilter('')}>Show all players</button>}
   </section>
      <section ref={playersAnchor} id="tal-players" aria-label="TAL players" style={{scrollMarginTop:16}}>
    <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',gap:8,marginBottom:10}}><h3 style={{fontSize:18,margin:0}}>Players</h3><span role="status" style={{fontSize:13,color:C.icy}}>{roster.length} of {entries.length} players</span></div>
    <input aria-label="Search players" placeholder="Search name or player ID" value={search} onChange={e=>{setSearch(e.target.value);setListLimit(40);}} style={{...button,width:'100%',boxSizing:'border-box',fontSize:16,marginBottom:10}}/>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:7,gap:8}}>
     <strong style={{fontSize:12,color:C.icy}}>AVAILABLE · UTC</strong>
     {!!timeFilters.length&&<button type="button" style={{border:0,background:'transparent',color:C.gold,fontSize:12,minHeight:32,cursor:'pointer'}} onClick={()=>{setTimeFilters([]);setListLimit(40);}}>Clear</button>}
    </div>
    <div role="group" aria-label="Filter available UTC times" style={{display:'grid',gridTemplateColumns:'repeat(5,minmax(0,1fr))',gap:5,marginBottom:timeFilters.length>1?8:12}}>
     {times.map(t=><button key={t} type="button" aria-pressed={timeFilters.includes(t)} onClick={()=>changeTime(t)} style={{...button,minWidth:0,minHeight:44,padding:'8px 1px',fontSize:11,color:timeFilters.includes(t)?C.green:C.icy,borderColor:timeFilters.includes(t)?C.green:C.border,background:timeFilters.includes(t)?C.green+'1b':C.section}}>{t}</button>)}
    </div>
    {timeFilters.length>1&&<div role="group" aria-label="Availability matching" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginBottom:12}}>
     {[['any','Any selected time'],['all','Every selected time']].map(([id,label])=><button key={id} type="button" aria-pressed={timeMode===id} style={{...button,minWidth:0,minHeight:40,fontSize:12,padding:6,color:timeMode===id?C.gold:C.icy,borderColor:timeMode===id?C.gold:C.border}} onClick={()=>setTimeMode(id)}>{label}</button>)}
    </div>}
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10}}>
     <label style={{minWidth:0,fontSize:12,color:C.icy}}>Registration<select aria-label="Filter registration" value={registrationFilter} onChange={e=>{setRegistrationFilter(e.target.value);setListLimit(40);}} style={{...button,width:'100%',minWidth:0,marginTop:5,padding:'8px 6px',fontSize:13}}><option value="all">All registrations</option><option value="unregistered">Needs registration</option><option value="registered">Registered</option></select></label>
     <label style={{minWidth:0,fontSize:12,color:C.icy}}>Sort by<select aria-label="Sort players" style={{...button,width:'100%',minWidth:0,marginTop:5,padding:'8px 6px',fontSize:13}} value={sort} onChange={e=>setSort(e.target.value)}><option value="name">Name A–Z</option><option value="troop">TAL troop power</option><option value="city">City power</option><option value="labyrinth">Labyrinth rank</option><option value="joiner">Joiner strength</option></select></label>
    </div>
    {anyFilter&&<div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:10}}>
      {check!=='all'&&<button style={{...button,minHeight:34,padding:'5px 9px',fontSize:12,color:C.gold}} onClick={()=>setCheck('all')}>{check==='move'?'Need to move':check==='in-host'?'In alliance':'Unverified'} ×</button>}
      {timeFilters.map(t=><button key={t} style={{...button,minHeight:34,padding:'5px 9px',fontSize:12,color:C.gold}} onClick={()=>changeTime(t)}>{t} UTC ×</button>)}
      {registrationFilter!=='all'&&<button style={{...button,minHeight:34,padding:'5px 9px',fontSize:12,color:C.gold}} onClick={()=>setRegistrationFilter('all')}>{registrationFilter==='registered'?'Registered':'Needs registration'} ×</button>}
      {search&&<button style={{...button,minHeight:34,padding:'5px 9px',fontSize:12}} onClick={()=>setSearch('')}>Clear search ×</button>}
      {missingFilter&&<button style={{...button,minHeight:34,padding:'5px 9px',fontSize:12,color:C.gold}} onClick={()=>setMissingFilter('')}>{missingFilter==='tiers'?'Missing troop tiers':'Missing availability'} ×</button>}
    </div>}
    {teams.length>0&&<button type="button" style={{...button,width:'100%',marginBottom:10,color:C.gold,background:'#243B4F'}} disabled={!!value?.locked||(!team&&teams.every(t=>tournamentStatus(t)==='eliminated'))} onClick={()=>{if(!team){const target=teams.find(t=>tournamentStatus(t)!=='eliminated');if(!target)return;chooseLegion(target.id);setAdding(true);}else{setAdding(v=>!v);}setRemoveId('');}}>{adding?'Close add players':'+ Add from Members'}</button>}
    {adding&&team&&<section aria-label="Add TAL players from Members" style={{background:C.card,borderRadius:12,padding:12,marginBottom:12}}>
     <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,marginBottom:10}}>
      <strong style={{fontSize:16}}>Add from Members</strong><span style={muted}>{remaining} spaces left</span>
     </div>
     <input aria-label="Search Members to add" value={addSearch} onChange={e=>{setAddSearch(e.target.value);setAddingReview(false);}} placeholder="Search name or player ID" style={{...button,width:'100%',boxSizing:'border-box',fontSize:16,marginBottom:12}}/>
     <p style={{...muted,margin:'0 0 12px'}}>Select Members first, then assign their times and TAL status. Times do not filter the player list.</p>
     <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:8}}>
      <span role="status" style={{...muted}}>{addEligible.length} eligible · {selectedAdd.length} selected</span>
      <div style={{display:'flex',gap:6}}>
       <button type="button" style={{...button,padding:'7px 9px',minHeight:38,fontSize:12}} onClick={()=>setAddSelected(old=>[...new Set([...old,...addEligible.map(p=>String(p.id))])])}>Select matches</button>
       <button type="button" style={{...button,padding:'7px 9px',minHeight:38,fontSize:12}} onClick={()=>setAddSelected([])}>Clear</button>
      </div>
     </div>
     <div style={{maxHeight:310,overflowY:'auto',overscrollBehavior:'contain'}}>
      {addMatches.map(p=>{const blocked=otherAssigned.has(String(p.id)),checked=selectedAdd.includes(String(p.id));return <label key={p.id} style={{display:'flex',alignItems:'center',gap:10,minHeight:55,padding:'6px 0',borderBottom:'1px solid '+C.border,opacity:blocked?.55:1,cursor:blocked?'not-allowed':'pointer'}}>
       <input type="checkbox" disabled={blocked||!canEdit} checked={checked} onChange={e=>{const id=String(p.id);setAddSelected(old=>e.target.checked?[...new Set([...old,id])]:old.filter(v=>v!==id));setAddingReview(false);}} style={{height:21,width:21,flexShrink:0,accentColor:C.gold}}/>
       <PlayerAvatar player={p} size={36}/><span style={{flex:1,minWidth:0}}><strong style={{fontSize:14,display:'block',overflowWrap:'anywhere'}}>{p.username||p.alias||p.fid}</strong><span style={muted}>{blocked?'Assigned to another legion':availabilityFor(p).join(' · ')||'Availability unknown'}</span></span>
      </label>})}
      {!addMatches.length&&<p style={{...muted,padding:'12px 0'}}>No matching Members. Add profiles in Members first.</p>}
     </div>
     <div style={{borderTop:'1px solid '+C.border,marginTop:12,paddingTop:12}}>
      <strong style={{fontSize:14}}>Assign available times · UTC</strong>
      <div role="group" aria-label="Times to assign to selected players" style={{display:'grid',gridTemplateColumns:'repeat(5,minmax(0,1fr))',gap:5,margin:'9px 0'}}>
       {times.map(t=><button type="button" key={t} aria-pressed={addTimes.includes(t)} onClick={()=>{setAddTimes(old=>old.includes(t)?old.filter(x=>x!==t):[...old,t]);setAddingReview(false)}} style={{...button,padding:'8px 2px',minHeight:44,fontSize:11,minWidth:0,color:addTimes.includes(t)?C.green:C.icy,borderColor:addTimes.includes(t)?C.green:C.border}}>{t}</button>)}
      </div>
      <div role="group" aria-label="Existing availability" style={{display:'flex',gap:8,marginBottom:12}}>
       {[['add','Add to existing times'],['replace','Replace times']].map(([id,label])=><button type="button" key={id} aria-pressed={timeMerge===id} style={{...button,flex:1,fontSize:12,padding:7,color:timeMerge===id?C.gold:C.icy,borderColor:timeMerge===id?C.gold:C.border}} onClick={()=>{setTimeMerge(id);setAddingReview(false)}}>{label}</button>)}
      </div>
      <strong style={{fontSize:14}}>TAL status</strong>
      <div role="radiogroup" aria-label="TAL status for selected players" style={{display:'grid',gap:6,margin:'8px 0'}}>
       {[['considering','Considering for team'],['needs','Needs registration'],['registered','Registered in game']].map(([id,label])=><label key={id} style={{display:'flex',alignItems:'center',gap:9,minHeight:38,fontSize:14}}><input type="radio" checked={batchStatus===id} onChange={()=>{setBatchStatus(id);setAddingReview(false)}} style={{width:18,height:18,accentColor:C.gold}}/>{label}</label>)}
      </div>
      <p role="status" style={{...muted,margin:'4px 0 8px',color:countedAdd>remaining?C.red:C.icy}}>{selectedAdd.length} selected · {remaining} confirmed roster spaces{countedAdd>remaining?' · Reduce selection to continue.':''}</p>
     </div>
     {addingReview&&<div role="region" aria-label="Review batch addition" style={{padding:10,background:C.section,borderRadius:9,margin:'10px 0'}}>
      <strong style={{fontSize:14}}>Review {selectedAdd.length} players</strong>
      <p style={{...muted}}>{batchStatus==='considering'?'Considering, no roster slots consumed':batchStatus==='registered'?'Registered in game':'Needs registration'} · {addTimes.length?addTimes.join(', ')+' UTC':'No times chosen'} · {timeMerge==='add'?'Keep existing times':'Replace existing times'}</p>
      <div style={{fontSize:13,maxHeight:125,overflowY:'auto'}}>{selectedAdd.map(id=><div key={id}>{players.find(p=>String(p.id)===id)?.username||id}</div>)}</div>
     </div>}
     <button type="button" disabled={!canBatch} style={{...button,width:'100%',background:canBatch?C.gold:C.section,color:canBatch?C.bg:C.icy,marginTop:10}} onClick={()=>addingReview?batchAddPlayers():setAddingReview(true)}>{addingReview?'Confirm add '+selectedAdd.length+' players':'Review '+selectedAdd.length+' selected'}</button>
    </section>}
    {roster.slice(0,listLimit).map(({team:entryTeam,player,check:status,member})=>{
      const available=availabilityFor(player),isMove=status.status==='move',isCorrect=status.status==='in-host';
      const shownStat=sort==='troop'?'TAL troop power '+compact(value?.records?.[player.id]?.troopPower):sort==='city'?'City power '+compact(player.power??player.providerStats?.power):sort==='labyrinth'?'Labyrinth '+(player.providerRankings?.labyrinth?.rank?'#'+player.providerRankings.labyrinth.rank:'Not recorded'):sort==='joiner'?'Joiner strength '+([player.troops?.infantry,player.troops?.lancer,player.troops?.marksman].every(t=>String(t||'').startsWith('Helios'))?'Full Helios':'See troop tiers'):null;
      const editable=!value?.locked&&tournamentStatus(entryTeam)!=='eliminated';
      const revealed=swipeId===String(player.id);
      const selectedEditing=editingTimes===String(player.id);
      const statusText=member?.registered?'Registered':member?'Needs registration':'Considering';
      return <article key={player.id} onPointerDown={e=>onSwipeDown(e,String(player.id))} onPointerUp={e=>onSwipeUp(e,String(player.id),!!member&&editable)} onPointerCancel={()=>{gesture.current=null;}} style={{background:C.card,borderRadius:11,marginBottom:8,overflow:'hidden',touchAction:'pan-y'}}>
       {revealed&&member&&<div role="group" aria-label={'Registration action for '+(player.username||player.alias||'player')} style={{display:'flex',justifyContent:'flex-end',gap:8,alignItems:'center',padding:'9px 11px',background:C.section}}>
        <button type="button" style={{...button,color:member.registered?C.gold:C.green,background:C.card}} disabled={!editable} onClick={()=>setRegistration(entryTeam,player.id,!member.registered)}>{member.registered?'Mark unregistered':'Confirm registered'}</button>
        <button type="button" aria-label="Close swipe actions" style={{...button,minWidth:44,padding:8}} onClick={()=>setSwipeId('')}>✕</button>
       </div>}
       <div style={{display:'flex',alignItems:'center',gap:6,padding:'10px 10px 5px'}}>
        <button type="button" title="Open Members profile" aria-label={'Open profile for '+(player.username||player.alias||'player')} style={{display:'flex',alignItems:'center',flex:1,minWidth:0,gap:10,padding:'4px 0',textAlign:'left',background:'transparent',border:0,color:C.white,cursor:'pointer',minHeight:48}} onClick={()=>{setSwipeId('');setActionsId('');onOpenPlayer?.(player.id)}}>
         <PlayerAvatar player={player} size={44}/>
         <span style={{flex:1,minWidth:0}}>
          <span style={{display:'flex',alignItems:'center',flexWrap:'wrap',gap:7}}><strong style={{fontSize:16,overflowWrap:'anywhere'}}>{player.username||player.alias||'Unknown player'}</strong>{player.furnaceLevel&&<span style={{fontSize:12,color:C.gold}}>{player.furnaceLevel}</span>}</span>
          <span style={{...muted,display:'block',marginTop:3}}>{status.tag||player.allianceTag||'Alliance unknown'} · {legionLabel(entryTeam)}</span>
         </span>
        </button>
        <button type="button" title="Player actions" aria-label={'Actions for '+(player.username||player.alias||'player')} aria-expanded={actionsId===player.id} style={{...button,minWidth:44,padding:7,background:'transparent',border:0,fontSize:20}} onClick={()=>{setActionsId(actionsId===player.id?'':player.id);setSwipeId('');setRemoveId('')}}>•••</button>
       </div>
       {(tierChips(player).length>0||gameLanguages(player).length>0)&&<div style={{display:'flex',alignItems:'center',flexWrap:'wrap',gap:5,padding:'0 11px 5px'}}>
        {tierChips(player).map(([key,label,color])=><span key={key} style={{fontSize:11,fontWeight:600,color,padding:'4px 7px',borderRadius:7,background:color+'17',border:'1px solid '+color+'3a'}}>{label} {player.troops[key]}</span>)}
        {gameLanguages(player).map(language=><span key={language} style={{fontSize:11,color:C.icy,padding:'4px 7px',borderRadius:7,background:C.section}}>{language}</span>)}
       </div>}
              <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',padding:'2px 11px 10px'}}>
        <button type="button" aria-label={'Edit availability for '+(player.username||player.alias||'player')} onClick={()=>beginEditTimes(player)} style={{border:0,background:'transparent',padding:'7px 0',color:C.icy,cursor:'pointer',fontSize:12,textAlign:'left',minHeight:38}}>UTC: {available.length?available.join(' · '):'Unknown'} <span aria-hidden="true" style={{color:C.gold}}>✎</span></button>
        <span style={{marginLeft:'auto',fontSize:12,fontWeight:600,color:member?.registered?C.green:member?C.gold:C.icy}}>{statusText}</span>
       </div>
       {(isMove||shownStat)&&<div style={{display:'flex',gap:8,flexWrap:'wrap',padding:'0 11px 10px',color:isMove?C.gold:C.icy,fontSize:12}}>{isMove&&<span>Move {status.tag||'No alliance'} → {entryTeam.host}</span>}{shownStat&&<span>{shownStat}</span>}</div>}
       {actionsId===player.id&&<div style={{padding:'8px 11px 12px',background:C.section,display:'grid',gap:5}}>
        {!member&&editable&&<><button type="button" style={{...button,textAlign:'left',color:C.gold}} onClick={()=>promoteCandidate(entryTeam,player.id,false)}>Move to needs registration</button><button type="button" style={{...button,textAlign:'left',color:C.green}} onClick={()=>promoteCandidate(entryTeam,player.id,true)}>Confirm registered in game</button></>}
        {member&&<button type="button" style={{...button,textAlign:'left',color:member.registered?C.gold:C.green}} disabled={!editable} onClick={()=>setRegistration(entryTeam,player.id,!member.registered)}>{member.registered?'Mark registration pending':'Confirm registered'}</button>}
        <button type="button" style={{...button,textAlign:'left'}} onClick={()=>beginEditTimes(player)}>Edit available times</button>
        <button type="button" style={{...button,textAlign:'left'}} onClick={()=>{setActionsId('');onOpenPlayer?.(player.id)}}>Open Members profile</button>
        {member&&<button type="button" style={{...button,textAlign:'left',color:C.red}} disabled={!editable} onClick={()=>setRemoveId(player.id)}>Remove from legion…</button>}
       </div>}
       {selectedEditing&&<section aria-label={'Edit availability for '+(player.username||player.alias||'player')} style={{padding:'12px 11px',background:C.section}}>
        <strong style={{fontSize:14}}>Available times · UTC</strong>
        <p style={{...muted,margin:'6px 0 10px'}}>Tap a time to cycle: Unknown → Available → Unavailable.</p>
        <div role="group" aria-label="Set time preferences" style={{display:'grid',gridTemplateColumns:'repeat(5,minmax(0,1fr))',gap:5}}>
         {times.map(t=>{const state=timesDraft[t]||'unknown',next=state==='unknown'?'available':state==='available'?'unavailable':'unknown';return <button key={t} type="button" aria-label={t+' UTC: '+state+'. Change to '+next} aria-pressed={state==='available'} onClick={()=>setTimesDraft(old=>({...old,[t]:next}))} style={{...button,minWidth:0,minHeight:58,padding:'5px 2px',background:state==='available'?C.green+'22':state==='unavailable'?C.red+'17':C.card,borderColor:state==='available'?C.green:state==='unavailable'?C.red:C.border}}>
          <span style={{display:'block',fontSize:11,color:C.white}}>{t}</span><span style={{display:'block',fontSize:10,marginTop:3,color:state==='available'?C.green:state==='unavailable'?C.red:C.icy}}>{state==='available'?'Yes':state==='unavailable'?'No':'Unknown'}</span>
         </button>})}
        </div>
        <div style={{display:'flex',gap:8,marginTop:12}}><button style={{...button,flex:1}} onClick={()=>setEditingTimes('')}>Cancel</button><button style={{...button,flex:1,background:C.gold,color:C.bg}} disabled={!!value?.locked} onClick={()=>saveTimes(player)}>Save times</button></div>
       </section>}
       {removeId===player.id&&member&&<div style={{padding:'10px 11px',background:C.section}}>
        <p style={{...muted,margin:'0 0 10px'}}>Remove from {legionLabel(entryTeam)}? The Members profile and availability will remain.</p>
        <div style={{display:'flex',gap:8}}><button style={button} onClick={()=>setRemoveId('')}>Cancel</button><button style={{...button,color:C.red}} disabled={!editable} onClick={()=>{onChange?.({...value,teams:value.teams.map(t=>t.id===entryTeam.id?{...t,members:t.members.filter(m=>String(m.id)!==String(player.id)),candidates:(t.candidates||[]).filter(c=>String(c.id)!==String(player.id)),captain:t.captain===player.id?'':t.captain}:t)});setRemoveId('');setActionsId('');onMessage?.('Removed from legion. Members profile retained.');}}>Remove</button></div>
       </div>}
      </article>;
    })}
    {!roster.length&&<div style={{padding:18,background:C.card,borderRadius:12,color:C.icy,fontSize:14}}>No players match the current filters. <button style={{...button,marginTop:10,width:'100%'}} onClick={resetFilters}>Clear filters</button></div>}
    {roster.length>listLimit&&<button style={{...button,width:'100%',marginTop:8}} onClick={()=>setListLimit(n=>n+40)}>Show 40 more players</button>}
   </section>
  </>}
 </section>;
}
