import {LANGUAGES} from '../../../src/utils/constants.js';
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
function moveText(rows,{time=null,availabilityFor=null}={}){
 const groups=new Map(),seen=new Set();
 for(const {team,player,check,member} of rows){
  if(!member||!player||!team?.host||!['move','unknown'].includes(check.status))continue;
  if(time!==null&&(!availabilityFor||!availabilityFor(player).includes(time)))continue;
  const id=String(player.id),destination=String(team.host).trim();
  const origin=check.status==='unknown'?'unknown alliance':check.tag?String(check.tag).trim():'no alliance';
  const key=origin.toLowerCase()+'|'+destination.toLowerCase();
  if(!groups.has(key))groups.set(key,{origin,destination,players:[]});
  if(seen.has(key+'|'+id))continue;
  seen.add(key+'|'+id);
  groups.get(key).players.push(player.username||player.alias||String(player.fid||player.id));
 }
 return [...groups.values()].sort((a,b)=>a.destination.localeCompare(b.destination)||a.origin.localeCompare(b.origin)).map(g=>{
  const prefix=time===null?'Players who need to move':'Players available at '+time.slice(0,2)+'UTC who need to move';
  return prefix+' from '+g.origin+' to '+g.destination+':\n'+g.players.sort((a,b)=>a.localeCompare(b,undefined,{sensitivity:'base',numeric:true})).map(playerName=>'• '+playerName).join('\n');
 }).join('\n\n');
}
export function TalTab({value,players,onChange,onOpenPlayer,onRefreshLegion,legionRefresh,onMessage,workspace,onBulkApply}){
 const [selected,setSelected]=useState(()=>{try{return window.sessionStorage.getItem('tal:selected-legion')||'';}catch{return '';}});
 const [check,setCheck]=useState('all');
 const [search,setSearch]=useState('');
 const [timeFilters,setTimeFilters]=useState([]);
 const [timeMode,setTimeMode]=useState('any');
 const [sort,setSort]=useState('name');
 const [registrationFilter,setRegistrationFilter]=useState('all');
 const [talView,setTalView]=useState('prep');
 const [roleFilter,setRoleFilter]=useState('all');
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
 const [statusEditor,setStatusEditor]=useState(null);
 const [statusDraft,setStatusDraft]=useState({role:'pending',matchmakingOnly:false,registered:false});
 const [statusApply,setStatusApply]=useState({role:false,matchmakingOnly:false,registered:false});
 const [statusError,setStatusError]=useState('');
 const [previewOpen,setPreviewOpen]=useState(false);
 const [availablePreviewOpen,setAvailablePreviewOpen]=useState(false);
 const [copyTime,setCopyTime]=useState('12:00');
 const [tournamentConfirm,setTournamentConfirm]=useState('');
 const [copying,setCopying]=useState(false);
 const [listLimit,setListLimit]=useState(40);
 const [selecting,setSelecting]=useState(false);
 const [bulkSelected,setBulkSelected]=useState([]);
 const [bulkPanel,setBulkPanel]=useState('');
 const [bulkTimeMode,setBulkTimeMode]=useState('add');
 const [bulkTimes,setBulkTimes]=useState([]);
 const [bulkRegistration,setBulkRegistration]=useState('registered');
 const [bulkLanguage,setBulkLanguage]=useState('English');
 const [bulkLanguageMode,setBulkLanguageMode]=useState('add');
 const [bulkHost,setBulkHost]=useState('HOT');
 const [bulkLegionNumber,setBulkLegionNumber]=useState('1');
 const [bulkReview,setBulkReview]=useState(false);
 const [bulkError,setBulkError]=useState('');
 const [missingFilter,setMissingFilter]=useState('');
 const playersAnchor=useRef(null);
 const teams=(value?.teams||[]);
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
 const roster=entries.filter(e=>(check==='all'||e.check.status===check)&&matchesSearch(e.player)&&matchesTime(e.player)&&(!missingFilter||(missingFilter==='tiers'?missingTroopTypes(e.player).length:missingAvailability(e.player)))&&(registrationFilter==='all'||registrationFilter==='unregistered'&&e.member&&!e.member.registered||registrationFilter==='registered'&&e.member?.registered)&&(roleFilter==='all'||(roleFilter==='matchmaking'?!!e.member?.matchmakingOnly:e.member?.role===roleFilter))).sort((a,b)=>{
  if(sort==='troop'){const score=p=>numeric(value?.records?.[p.id]?.troopPower);const av=score(a.player),bv=score(b.player);return av===null&&bv===null?compareNames(a.player,b.player):av===null?1:bv===null?-1:bv-av||compareNames(a.player,b.player);}
  if(sort==='city'){const av=numeric(a.player.power??a.player.providerStats?.power),bv=numeric(b.player.power??b.player.providerStats?.power);return av===null&&bv===null?compareNames(a.player,b.player):av===null?1:bv===null?-1:bv-av||compareNames(a.player,b.player);}
  if(sort==='labyrinth'){const av=numeric(a.player.providerRankings?.labyrinth?.rank),bv=numeric(b.player.providerRankings?.labyrinth?.rank);return av===null&&bv===null?compareNames(a.player,b.player):av===null?1:bv===null?-1:av-bv||compareNames(a.player,b.player);}
  if(sort==='joiner')return comparePriority(a.player,b.player);
  return compareNames(a.player,b.player);
 });
 const selectedCopyTime=times.includes(copyTime)?copyTime:times[0];
 const movePreview=moveText(entries);
 const availableMovePreview=moveText(entries,{time:selectedCopyTime,availabilityFor});
 const moveCopyCount=entries.filter(e=>e.member&&['move','unknown'].includes(e.check.status)).length;
 const availableMoveCount=entries.filter(e=>e.member&&['move','unknown'].includes(e.check.status)&&availabilityFor(e.player).includes(selectedCopyTime)).length;
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
 const anyFilter=check!=='all'||timeFilters.length>0||registrationFilter!=='all'||roleFilter!=='all'||search.trim()||!!missingFilter;
 const registrationMembers=shownTeams.flatMap(t=>(t.members||[]).map(m=>({...m,teamId:t.id})));
 const registrationCount=registrationMembers.filter(m=>m.registered).length;
 const combatantCount=registrationMembers.filter(m=>m.role==='combatant').length;
 const substituteCount=registrationMembers.filter(m=>m.role==='substitute').length;
 const matchmakingCount=registrationMembers.filter(m=>m.matchmakingOnly).length;
 const legionCount=shownTeams.length||1;
 useEffect(()=>{try{window.sessionStorage.setItem('tal:selected-legion',effectiveSelection);}catch{}},[effectiveSelection]);
 function chooseLegion(id){setRoleFilter('all');setSelecting(false);setBulkSelected([]);setBulkPanel('');setSelected(id);setCheck('all');setRegistrationFilter('all');setAdding(false);setAddSelected([]);setAddSearch('');setAddTimes([]);setBatchStatus('needs');setTimeMerge('add');setRemoveId('');setActionsId('');setSwipeId('');setEditingTimes('');setPreviewOpen(false);setTournamentConfirm('');setListLimit(40);}
 function focusPlayers(){playersAnchor.current?.scrollIntoView({behavior:'smooth',block:'start'});}
 function chooseReadiness(next){setCheck(current=>current===next?'all':next);setListLimit(40);focusPlayers();}
 function resetFilters(){setCheck('all');setSearch('');setTimeFilters([]);setRegistrationFilter('all');setRoleFilter('all');setMissingFilter('');setListLimit(40);}
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
 function openStatusEditor(entryTeam,playerId){
  const member=entryTeam?.members?.find(m=>String(m.id)===String(playerId));
  if(!member||value?.locked||tournamentStatus(entryTeam)==='eliminated')return;
  setStatusEditor({kind:'single',teamId:entryTeam.id,playerId:String(playerId)});
  setStatusDraft({role:member.role||'pending',matchmakingOnly:!!member.matchmakingOnly,registered:!!member.registered});
  setStatusApply({role:true,matchmakingOnly:true,registered:true});
  setStatusError('');setActionsId('');setSwipeId('');
 }
 function openBulkStatusEditor(){
  if(!selectedBulkIds.length||value?.locked)return;
  setStatusEditor({kind:'bulk',ids:[...selectedBulkIds]});
  setStatusDraft({role:'pending',matchmakingOnly:false,registered:false});
  setStatusApply({role:false,matchmakingOnly:false,registered:false});
  setStatusError('');setBulkPanel('');setBulkReview(false);
 }
 function saveStatusEditor(){
  if(!statusEditor||value?.locked)return;
  const targets=statusEditor.kind==='single'?[statusEditor.playerId]:statusEditor.ids;
  if(statusEditor.kind==='bulk'&&!Object.values(statusApply).some(Boolean)){setStatusError('Choose at least one setting to update.');return;}
  const ids=new Set(targets.map(String));
  const affected=teams.filter(t=>t.members?.some(m=>ids.has(String(m.id))));
  if(!affected.length){setStatusError('No current legion members were selected.');return;}
  if(affected.some(t=>tournamentStatus(t)==='eliminated')){setStatusError('An eliminated legion cannot be edited.');return;}
  const nextTeams=teams.map(t=>{
   if(!affected.some(item=>item.id===t.id))return t;
   return {...t,members:(t.members||[]).map(m=>ids.has(String(m.id))?{
    ...m,
    ...(statusApply.role?{role:statusDraft.role}:{}),
    ...(statusApply.matchmakingOnly?{matchmakingOnly:statusDraft.matchmakingOnly}:{}),
    ...(statusApply.registered?{registered:statusDraft.registered}:{})
   }:m)};
  });
  for(const t of nextTeams){
   const combatants=(t.members||[]).filter(m=>m.role==='combatant').length;
   const substitutes=(t.members||[]).filter(m=>m.role==='substitute').length;
   if(combatants>30||substitutes>20){setStatusError(legionLabel(t)+': '+(combatants>30?'Combatants exceed 30':'Substitutes exceed 20')+'. Choose another roster role.');return;}
   if((t.members||[]).length>50){setStatusError(legionLabel(t)+' exceeds the 50-player registration limit.');return;}
  }
  onChange?.({...value,teams:nextTeams});
  onMessage?.('TAL status saved for '+targets.length+' player'+(targets.length===1?'':'s')+'.');
  setStatusEditor(null);setStatusError('');
  if(statusEditor.kind==='bulk'){setBulkSelected([]);setSelecting(false);setBulkPanel('');}
 }
 function setMemberRole(entryTeam,playerId,role){
  if(value?.locked||tournamentStatus(entryTeam)==='eliminated')return;
  if(!['combatant','substitute','pending'].includes(role))return;
  const max=role==='combatant'?30:role==='substitute'?20:50;
  if(role!=='pending'&&(entryTeam.members||[]).filter(m=>m.role===role&&String(m.id)!==String(playerId)).length>=max){onMessage?.('All '+role+' places are filled for this legion.');return;}
  if(role==='combatant'&&entryTeam.members?.find(m=>String(m.id)===String(playerId))?.matchmakingOnly)onMessage?.('Matchmaking-only players should normally be substitutes, so starting positions are reserved for active players.');
  updateTeam({...entryTeam,members:(entryTeam.members||[]).map(m=>String(m.id)===String(playerId)?{...m,role}:m)});
  setActionsId('');
 }
 function setMatchmakingOnly(entryTeam,playerId,matchmakingOnly){
  if(value?.locked||tournamentStatus(entryTeam)==='eliminated')return;
  updateTeam({...entryTeam,members:(entryTeam.members||[]).map(m=>String(m.id)===String(playerId)?{...m,matchmakingOnly}:m)});
  setActionsId('');
  if(matchmakingOnly&&entryTeam.members?.find(m=>String(m.id)===String(playerId))?.role==='combatant')onMessage?.('This player occupies an opening combatant slot. Consider assigning them as a substitute.');
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
 async function copyMovePreview(text,label){
  if(!text)return;
  setCopying(true);
  try{await navigator.clipboard.writeText(text);onMessage?.(label+' copied.');}
  catch{onMessage?.('Copy failed. Try again.');}
  finally{setCopying(false);}
 }
 const selectedBulkIds=bulkSelected.filter(id=>entries.some(e=>String(e.player.id)===id));
 const selectedBulkCount=selectedBulkIds.length;
 const filteredIds=roster.map(e=>String(e.player.id));
 function beginBulkPanel(kind){
  setBulkPanel(kind);setBulkReview(false);setBulkError('');
  if(kind==='times'){setBulkTimeMode('add');setBulkTimes([]);}
  if(kind==='language')setBulkLanguageMode('add');
  if(kind==='legion'){setBulkHost(team?.host||teams[0]?.host||'HOT');setBulkLegionNumber(String(team?.number||1));}
 }
 function actionForSelection(){
  if(bulkPanel==='times')return {type:'availability',mode:bulkTimeMode,times:bulkTimes};
  if(bulkPanel==='registration')return {type:'registration',value:bulkRegistration};
  if(bulkPanel==='language')return {type:'language',mode:bulkLanguageMode,language:bulkLanguage};
  if(bulkPanel==='legion')return {type:'allocate',host:bulkHost,number:Number(bulkLegionNumber)};
  if(bulkPanel==='cooperation')return {type:'teamwork',mode:'group'};
  if(bulkPanel==='remove')return {type:'remove',confirm:true};
  return null;
 }
 function commitBulk(){
  if(!selectedBulkCount||!onBulkApply||value?.locked)return;
  const action=actionForSelection();if(!action)return;
  if(!bulkReview){setBulkReview(true);return;}
  try{
   onBulkApply(selectedBulkIds,action);
   setBulkSelected([]);setSelecting(false);setBulkPanel('');setBulkReview(false);setBulkError('');
  }catch(e){setBulkError(e.message||'Unable to save changes.');setBulkReview(false);}
 }
  const canEdit=!!team&&!value?.locked&&tournamentStatus(team)!=='eliminated';
 return <section style={{padding:'12px 20px 32px'}}>
  <h2 style={{fontSize:22,margin:'0 0 12px'}}>TAL planner</h2>
  <div role="group" aria-label="TAL planner sections" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:5,padding:5,marginBottom:14,background:C.section,border:'1px solid '+C.border,borderRadius:15}}>
   {[['registration','Registration'],['prep','TAL Prep']].map(([id,label])=><button type="button" key={id} aria-pressed={talView===id} onClick={()=>{setTalView(id);setAdding(false);setActionsId('');setSelecting(false);setBulkSelected([]);setRoleFilter('all');setMissingFilter('');}} style={{...button,borderRadius:11,borderColor:talView===id?C.gold:'transparent',background:talView===id?C.card:'transparent',color:talView===id?C.white:C.icy,minHeight:46,fontSize:14}}>{label}</button>)}
  </div>
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
   {talView==='registration'&&<section aria-label="TAL registration overview" style={{background:C.card,border:'1px solid '+C.border,borderRadius:13,padding:12,marginBottom:14}}>
    <div style={{fontWeight:700,fontSize:15,marginBottom:10}}>Registration overview</div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:7}}>
     {[{label:'Registered',count:registrationCount,max:50*legionCount},{label:'Combatants',count:combatantCount,max:30*legionCount},{label:'Substitutes',count:substituteCount,max:20*legionCount}].map(item=><div key={item.label} style={{minWidth:0,background:C.section,border:'1px solid '+C.border,borderRadius:11,padding:10}}>
      <div style={{fontSize:11,color:C.icy}}>{item.label}</div><div style={{fontSize:19,fontWeight:750,marginTop:5}}>{item.count}<span style={{fontSize:12,color:C.icy,fontWeight:500}}>/{item.max}</span></div>
     </div>)}
    </div>
    <div style={{...muted,marginTop:10}}>{matchmakingCount} matchmaking only · Registered players remain in TAL Prep automatically. Combatants start on the field; substitutes can enter after 3 minutes.</div>
   </section>}
   {talView==='prep'&&<>
   <section aria-label="Alliance readiness" style={{background:C.card,border:'1px solid '+C.border,borderRadius:12,padding:12,marginBottom:14}}>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
     <div><strong style={{fontSize:15}}>Host alliance</strong><div style={{...muted,marginTop:4}}>{ready} of {activeEntryCount} assigned players in the correct alliance</div></div>
     <strong style={{fontSize:19,color:C.green}}>{activeEntryCount?percent+"%":"—"}</strong>
    </div>
    <div role="progressbar" aria-label="Assigned players in the correct host alliance" aria-valuemin={0} aria-valuemax={activeEntryCount||1} aria-valuenow={ready} style={{height:8,background:C.border,borderRadius:20,overflow:'hidden',margin:'12px 0 10px'}}><div style={{height:'100%',width:percent+'%',background:C.green}}/></div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:7}}>
     {[{id:'in-host',count:ready,label:'In alliance',color:C.green},{id:'move',count:move,label:'Need to move',color:C.gold},{id:'unknown',count:unverified,label:'Unverified',color:C.icy}].map(item=>
      <button key={item.id} type="button" aria-pressed={check===item.id} onClick={()=>chooseReadiness(item.id)} style={{...button,minWidth:0,minHeight:70,padding:8,textAlign:'left',borderColor:check===item.id?item.color:C.border,background:check===item.id?item.color+'17':C.section}}>
       <strong style={{display:'block',fontSize:19,color:item.color}}>{item.count}</strong><span style={{display:'block',fontSize:11,color:C.icy,marginTop:3}}>{item.label}</span>
      </button>
     )}
    </div>
    <div style={{display:'grid',gap:12,marginTop:14}}>
     <div style={{borderTop:'1px solid '+C.border,paddingTop:12}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,marginBottom:5}}>
       <strong style={{fontSize:14}}>Players who need to move</strong><span style={muted}>{moveCopyCount} players</span>
      </div>
      <p style={{...muted,margin:'0 0 10px'}}>Grouped by current alliance and destination. Includes confirmed no-alliance and unknown-alliance players.</p>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
       <button type="button" disabled={!movePreview||copying} style={{...button,color:movePreview?C.gold:C.icy}} onClick={()=>copyMovePreview(movePreview,'Move list')}>Copy list</button>
       <button type="button" aria-expanded={previewOpen} style={{...button,color:C.gold}} onClick={()=>setPreviewOpen(v=>!v)}>{previewOpen?'Hide preview ▴':'Preview ▾'}</button>
      </div>
      {previewOpen&&<div style={{marginTop:9}}>
       {movePreview?<pre aria-label="Move list preview" style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',fontFamily:'inherit',fontSize:13,lineHeight:1.6,padding:12,borderRadius:10,background:C.section,maxHeight:300,overflowY:'auto',margin:0}}>{movePreview}</pre>:<p style={muted}>No players need to move.</p>}
      </div>}
     </div>
     <div style={{borderTop:'1px solid '+C.border,paddingTop:12}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,marginBottom:5}}>
       <strong style={{fontSize:14}}>Available players who need to move</strong><span style={muted}>{availableMoveCount} players</span>
      </div>
      <p style={{...muted,margin:'0 0 10px'}}>Only players who recorded availability at this event time.</p>
      <label style={{...muted,display:'block',marginBottom:10}}>Event time · UTC
       <select aria-label="Copy list event time" value={selectedCopyTime} onChange={e=>setCopyTime(e.target.value)} style={{...button,display:'block',width:'100%',marginTop:5,fontSize:15}}>{times.map(t=><option key={t} value={t}>{t} UTC</option>)}</select>
      </label>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
       <button type="button" disabled={!availableMovePreview||copying} style={{...button,color:availableMovePreview?C.gold:C.icy}} onClick={()=>copyMovePreview(availableMovePreview,'Available move list')}>Copy list</button>
       <button type="button" aria-expanded={availablePreviewOpen} style={{...button,color:C.gold}} onClick={()=>setAvailablePreviewOpen(v=>!v)}>{availablePreviewOpen?'Hide preview ▴':'Preview ▾'}</button>
      </div>
      {availablePreviewOpen&&<div style={{marginTop:9}}>
       {availableMovePreview?<pre aria-label="Available move list preview" style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',fontFamily:'inherit',fontSize:13,lineHeight:1.6,padding:12,borderRadius:10,background:C.section,maxHeight:300,overflowY:'auto',margin:0}}>{availableMovePreview}</pre>:<p style={muted}>No available players need to move at {selectedCopyTime} UTC.</p>}
      </div>}
     </div>
    </div>
   </section>
   {team&&<section style={{background:C.card,border:'1px solid '+C.border,borderRadius:12,padding:12,marginBottom:14}}>
    <div style={{display:'flex',justifyContent:'space-between',gap:8,alignItems:'center'}}><strong style={{fontSize:15}}>{legionLabel(team)} · {tournamentStatus(team)==='eliminated'?'Eliminated':'Active'}</strong><button type="button" style={{...button,fontSize:12,padding:'7px 9px',minHeight:36}} onClick={()=>setTournamentConfirm(tournamentConfirm?'':'open')}>{tournamentStatus(team)==='eliminated'?'Correct result':'Record a loss'}</button></div>
    {tournamentStatus(team)==='eliminated'&&<p style={{...muted,margin:'8px 0 0'}}>This legion is eliminated. Its roster and match history remain visible. Player assignments are read-only.</p>}
    {tournamentConfirm&&<div style={{marginTop:10}}>
     <p style={{...muted,margin:'0 0 10px'}}>{tournamentStatus(team)==='eliminated'?'Restore this legion to active? Only do this to correct an incorrect result.':'Confirm this legion lost its match? It will be marked eliminated, and its roster will remain available for review.'}</p>
     <div style={{display:'flex',gap:8}}><button style={button} onClick={()=>setTournamentConfirm('')}>Cancel</button><button style={{...button,color:tournamentStatus(team)==='eliminated'?C.gold:C.red}} disabled={!!value?.locked} onClick={confirmTournamentResult}>{tournamentStatus(team)==='eliminated'?'Restore active':'Confirm loss'}</button></div>
    </div>}
   </section>}
   </>}
   {talView==='prep'&&<section style={{background:C.card,border:'1px solid '+C.border,borderRadius:12,padding:12,marginBottom:12}} aria-label="Missing TAL information">
    <strong style={{fontSize:15}}>Missing player information</strong>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:10}}>
     <button type="button" aria-pressed={missingFilter==='tiers'} style={{...button,padding:9,textAlign:'left',minHeight:65,borderColor:missingFilter==='tiers'?C.gold:C.border}} onClick={()=>{setMissingFilter(v=>v==='tiers'?'':'tiers');setListLimit(40);focusPlayers();}}><strong style={{display:'block',fontSize:20,color:C.gold}}>{missingTroopPlayers.length}</strong><span style={muted}>Missing troop tiers</span></button>
     <button type="button" aria-pressed={missingFilter==='availability'} style={{...button,padding:9,textAlign:'left',minHeight:65,borderColor:missingFilter==='availability'?C.gold:C.border}} onClick={()=>{setMissingFilter(v=>v==='availability'?'':'availability');setListLimit(40);focusPlayers();}}><strong style={{display:'block',fontSize:20,color:C.gold}}>{missingAvailabilityPlayers.length}</strong><span style={muted}>Missing availability</span></button>
    </div>
    {!!missingFilter&&<button type="button" style={{...button,width:'100%',marginTop:8,color:C.gold}} onClick={()=>setMissingFilter('')}>Show all players</button>}
   </section>}
      <section ref={playersAnchor} id="tal-players" aria-label="TAL players" style={{scrollMarginTop:16}}>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:10}}><h3 style={{fontSize:18,margin:0}}>Players <span style={{...muted,fontWeight:400}}>{roster.length} of {entries.length}</span></h3><button type="button" style={{...button,color:C.gold,minWidth:75}} aria-pressed={selecting} onClick={()=>{setSelecting(v=>!v);setBulkSelected([]);setBulkPanel('');setBulkReview(false)}}>{selecting?'Done':'Select'}</button></div>
    {selecting&&<div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:9}}><strong style={{fontSize:13}}>{selectedBulkCount} selected</strong><div style={{display:'flex',gap:6}}><button type="button" style={{...button,minHeight:36,padding:'5px 9px',fontSize:12}} onClick={()=>setBulkSelected(old=>[...new Set([...old,...filteredIds])])}>Select all matching</button><button type="button" style={{...button,minHeight:36,padding:'5px 9px',fontSize:12}} onClick={()=>setBulkSelected([])}>Clear</button></div></div>}


    <input aria-label="Search players" placeholder="Find a player by name or ID" value={search} onChange={e=>{setSearch(e.target.value);setListLimit(40);}} style={{...button,width:'100%',boxSizing:'border-box',fontSize:16,marginBottom:10}}/>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:7,gap:8}}>
     <strong style={{fontSize:12,color:C.icy}}>FILTER BY AVAILABLE TIME · UTC</strong>
     {!!timeFilters.length&&<button type="button" style={{border:0,background:'transparent',color:C.gold,fontSize:12,minHeight:32,cursor:'pointer'}} onClick={()=>{setTimeFilters([]);setListLimit(40);}}>Clear</button>}
    </div>
    <div role="group" aria-label="Filter available UTC times" style={{display:'grid',gridTemplateColumns:'repeat(5,minmax(0,1fr))',gap:5,marginBottom:timeFilters.length>1?8:12}}>
     {times.map(t=><button key={t} type="button" aria-pressed={timeFilters.includes(t)} onClick={()=>changeTime(t)} style={{...button,minWidth:0,minHeight:44,padding:'8px 1px',fontSize:11,color:timeFilters.includes(t)?C.green:C.icy,borderColor:timeFilters.includes(t)?C.green:C.border,background:timeFilters.includes(t)?C.green+'1b':C.section}}>{t}</button>)}
    </div>
    {timeFilters.length>1&&<div role="group" aria-label="Availability matching" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginBottom:12}}>
     {[['any','Any selected time'],['all','Every selected time']].map(([id,label])=><button key={id} type="button" aria-pressed={timeMode===id} style={{...button,minWidth:0,minHeight:40,fontSize:12,padding:6,color:timeMode===id?C.gold:C.icy,borderColor:timeMode===id?C.gold:C.border}} onClick={()=>setTimeMode(id)}>{label}</button>)}
    </div>}
    <div role="group" aria-label="Filter TAL roles" style={{display:'flex',gap:6,overflowX:'auto',paddingBottom:9,marginBottom:3}}>
     {[['all','All'],['combatant','Combatants'],['substitute','Substitutes'],['matchmaking','Matchmaking only']].map(([id,label])=><button key={id} type="button" aria-pressed={roleFilter===id} onClick={()=>{setRoleFilter(id);setListLimit(40);}} style={{...button,flexShrink:0,minHeight:38,padding:'8px 11px',fontSize:12,borderRadius:12,color:roleFilter===id?C.gold:C.icy,borderColor:roleFilter===id?C.gold:C.border,background:roleFilter===id?C.gold+'16':C.section}}>{label}</button>)}
    </div>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10}}>
     <label style={{minWidth:0,fontSize:12,color:C.icy}}>Registration<select aria-label="Filter registration" value={registrationFilter} onChange={e=>{setRegistrationFilter(e.target.value);setListLimit(40);}} style={{...button,width:'100%',minWidth:0,marginTop:5,padding:'8px 6px',fontSize:13}}><option value="all">All registrations</option><option value="unregistered">Needs registration</option><option value="registered">Registered</option></select></label>
     <label style={{minWidth:0,fontSize:12,color:C.icy}}>Sort by<select aria-label="Sort players" style={{...button,width:'100%',minWidth:0,marginTop:5,padding:'8px 6px',fontSize:13}} value={sort} onChange={e=>setSort(e.target.value)}><option value="name">Name A–Z</option><option value="troop">TAL troop power</option><option value="city">City power</option><option value="labyrinth">Labyrinth rank</option><option value="joiner">Joiner strength</option></select></label>
    </div>
    {anyFilter&&<div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:10}}>
      {check!=='all'&&<button style={{...button,minHeight:34,padding:'5px 9px',fontSize:12,color:C.gold}} onClick={()=>setCheck('all')}>{check==='move'?'Need to move':check==='in-host'?'In alliance':'Unverified'} ×</button>}
      {timeFilters.map(t=><button key={t} style={{...button,minHeight:34,padding:'5px 9px',fontSize:12,color:C.gold}} onClick={()=>changeTime(t)}>{t} UTC ×</button>)}
      {roleFilter!=='all'&&<button style={{...button,minHeight:34,padding:'5px 9px',fontSize:12,color:C.gold}} onClick={()=>setRoleFilter('all')}>{roleFilter==='matchmaking'?'Matchmaking only':roleFilter==='combatant'?'Combatants':'Substitutes'} ×</button>}
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
      const statusText=member?.registered?'Registered in game':member?'Needs registration':'Considering';
      const chosen=selectedBulkIds.includes(String(player.id));
      return <article key={player.id} onClick={e=>{if(selecting&&!e.target.closest('button,input,select,textarea,[data-bulk-ignore]')){const id=String(player.id);setBulkSelected(old=>old.includes(id)?old.filter(x=>x!==id):[...old,id]);setBulkReview(false);}}} onPointerDown={e=>{if(!selecting)onSwipeDown(e,String(player.id))}} onPointerUp={e=>{if(!selecting)onSwipeUp(e,String(player.id),!!member&&editable)}} onPointerCancel={()=>{gesture.current=null;}} style={{background:chosen&&selecting?C.section:C.card,border:'1px solid '+(chosen&&selecting?C.gold:C.border),borderRadius:11,marginBottom:8,overflow:'hidden',touchAction:'pan-y',cursor:selecting?'pointer':'default'}}>
       {!selecting&&revealed&&member&&<div role="group" aria-label={'Registration action for '+(player.username||player.alias||'player')} style={{display:'flex',justifyContent:'flex-end',gap:8,alignItems:'center',padding:'9px 11px',background:C.section}}>
        <button type="button" style={{...button,color:C.gold,background:C.card}} disabled={!editable} onClick={()=>openStatusEditor(entryTeam,player.id)}>Manage TAL status</button>
        <button type="button" aria-label="Close swipe actions" style={{...button,minWidth:44,padding:8}} onClick={()=>setSwipeId('')}>✕</button>
       </div>}
       <div style={{display:'flex',alignItems:'center',gap:6,padding:'10px 10px 5px'}}>{selecting&&<span aria-hidden="true" style={{height:24,width:24,borderRadius:'50%',background:chosen?C.gold:C.bg,border:'2px solid '+(chosen?C.gold:C.icy),flexShrink:0,display:'grid',placeItems:'center',color:C.bg,fontWeight:800}}>{chosen?'✓':''}</span>}
        <button type="button" title="Open Members profile" aria-label={'Open profile for '+(player.username||player.alias||'player')} style={{display:'flex',alignItems:'center',flex:1,minWidth:0,gap:10,padding:'4px 0',textAlign:'left',background:'transparent',border:0,color:C.white,cursor:'pointer',minHeight:48}} onClick={()=>{if(selecting){const id=String(player.id);setBulkSelected(old=>old.includes(id)?old.filter(x=>x!==id):[...old,id]);setBulkReview(false);return;}setSwipeId('');setActionsId('');onOpenPlayer?.(player.id)}}>
         <PlayerAvatar player={player} size={44}/>
         <span style={{flex:1,minWidth:0}}>
          <span style={{display:'flex',alignItems:'center',flexWrap:'wrap',gap:7}}><strong style={{fontSize:16,overflowWrap:'anywhere'}}>{player.username||player.alias||'Unknown player'}</strong>{player.furnaceLevel&&<span style={{fontSize:12,color:C.gold}}>{player.furnaceLevel}</span>}</span>
          <span style={{...muted,display:'block',marginTop:3}}>{String(status.tag||player.allianceTag||'').toUpperCase()===String(entryTeam.host||'').toUpperCase()?legionLabel(entryTeam):(status.tag||player.allianceTag||'Alliance unknown')+' · '+legionLabel(entryTeam)}</span>
         </span>
        </button>
        {!selecting&&<button type="button" title="Edit player planning actions" aria-label={'Edit planning options for '+(player.username||player.alias||'player')} aria-expanded={actionsId===player.id} style={{...button,minWidth:44,padding:7,background:'transparent',border:0,fontSize:20}} onClick={()=>{setActionsId(actionsId===player.id?'':player.id);setSwipeId('');setRemoveId('')}}>•••</button>}
       </div>
       {(tierChips(player).length>0||gameLanguages(player).length>0)&&<div style={{display:'flex',alignItems:'center',flexWrap:'wrap',gap:5,padding:'0 11px 5px'}}>
        {tierChips(player).map(([key,label,color])=><span key={key} style={{fontSize:11,fontWeight:600,color,padding:'4px 7px',borderRadius:7,background:color+'17',border:'1px solid '+color+'3a'}}>{label} {player.troops[key]}</span>)}
        {gameLanguages(player).map(language=><span key={language} style={{fontSize:11,color:C.icy,padding:'4px 7px',borderRadius:7,background:C.section}}>{language}</span>)}
       </div>}
              <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',padding:'2px 11px 10px'}}>
        <button type="button" disabled={selecting} aria-label={'Edit availability for '+(player.username||player.alias||'player')} onClick={()=>beginEditTimes(player)} style={{border:0,background:'transparent',padding:'7px 0',color:C.icy,cursor:'pointer',fontSize:12,textAlign:'left',minHeight:38}}>UTC: {available.length?available.join(' · '):'Unknown'} <span aria-hidden="true" style={{color:C.gold}}>✎</span></button>
        <span style={{marginLeft:'auto',fontSize:12,fontWeight:600,color:member?.registered?C.green:member?C.gold:C.icy}}>{statusText}</span>
       </div>
       {member&&<div style={{display:'flex',alignItems:'center',flexWrap:'wrap',gap:6,padding:'0 11px 10px'}}>
        <span style={{fontSize:11,border:'1px solid '+(member.role==='combatant'?C.green:C.border),borderRadius:8,padding:'4px 7px',color:member.role==='combatant'?C.green:C.icy,background:C.section}}>{member.role==='combatant'?'Combatant':member.role==='substitute'?'Substitute':'Role unassigned'}</span>
        {member.matchmakingOnly&&<span style={{fontSize:11,border:'1px solid '+C.gold,borderRadius:8,padding:'4px 7px',color:C.gold,background:C.gold+'13'}}>Matchmaking only</span>}
       </div>}
       {talView==='registration'&&member&&!selecting&&<div style={{padding:'0 11px 12px'}}>
        <button type="button" aria-label={'Manage TAL status for '+(player.username||player.alias||'player')} disabled={!editable} onClick={()=>openStatusEditor(entryTeam,player.id)} style={{...button,width:'100%',display:'flex',alignItems:'center',justifyContent:'center',gap:8,background:C.section,color:editable?C.gold:C.icy,minHeight:48}}>⚙ Manage TAL status</button>
       </div>}
       {(isMove||shownStat)&&<div style={{display:'flex',gap:8,flexWrap:'wrap',padding:'0 11px 10px',color:isMove?C.gold:C.icy,fontSize:12}}>{isMove&&<span>Move {status.tag||'No alliance'} → {entryTeam.host}</span>}{shownStat&&<span>{shownStat}</span>}</div>}
       {!selecting&&actionsId===player.id&&<div style={{padding:'8px 11px 12px',background:C.section,display:'grid',gap:5}}>
        {!member&&editable&&<><button type="button" style={{...button,textAlign:'left',color:C.gold}} onClick={()=>promoteCandidate(entryTeam,player.id,false)}>Move to needs registration</button><button type="button" style={{...button,textAlign:'left',color:C.green}} onClick={()=>promoteCandidate(entryTeam,player.id,true)}>Confirm registered in game</button></>}
        {member&&<button type="button" style={{...button,textAlign:'left',color:C.gold}} disabled={!editable} onClick={()=>openStatusEditor(entryTeam,player.id)}>Manage TAL status</button>}
        <button type="button" style={{...button,textAlign:'left'}} onClick={()=>beginEditTimes(player)}>Edit available times</button>
        <button type="button" style={{...button,textAlign:'left'}} onClick={()=>{setActionsId('');onOpenPlayer?.(player.id)}}>Open Members profile</button>
        {member&&<button type="button" style={{...button,textAlign:'left',color:C.red}} disabled={!editable} onClick={()=>setRemoveId(player.id)}>Remove from legion…</button>}
       </div>}
       {!selecting&&selectedEditing&&<section aria-label={'Edit availability for '+(player.username||player.alias||'player')} style={{padding:'12px 11px',background:C.section}}>
        <strong style={{fontSize:14}}>Available times · UTC</strong>
        <p style={{...muted,margin:'6px 0 10px'}}>Tap a time to cycle: Unknown → Available → Unavailable.</p>
        <div role="group" aria-label="Set time preferences" style={{display:'grid',gridTemplateColumns:'repeat(5,minmax(0,1fr))',gap:5}}>
         {times.map(t=>{const state=timesDraft[t]||'unknown',next=state==='unknown'?'available':state==='available'?'unavailable':'unknown';return <button key={t} type="button" aria-label={t+' UTC: '+state+'. Change to '+next} aria-pressed={state==='available'} onClick={()=>setTimesDraft(old=>({...old,[t]:next}))} style={{...button,minWidth:0,minHeight:58,padding:'5px 2px',background:state==='available'?C.green+'22':state==='unavailable'?C.red+'17':C.card,borderColor:state==='available'?C.green:state==='unavailable'?C.red:C.border}}>
          <span style={{display:'block',fontSize:11,color:C.white}}>{t}</span><span style={{display:'block',fontSize:10,marginTop:3,color:state==='available'?C.green:state==='unavailable'?C.red:C.icy}}>{state==='available'?'Yes':state==='unavailable'?'No':'Unknown'}</span>
         </button>})}
        </div>
        <div style={{display:'flex',gap:8,marginTop:12}}><button style={{...button,flex:1}} onClick={()=>setEditingTimes('')}>Cancel</button><button style={{...button,flex:1,background:C.gold,color:C.bg}} disabled={!!value?.locked} onClick={()=>saveTimes(player)}>Save times</button></div>
       </section>}
       {!selecting&&removeId===player.id&&member&&<div style={{padding:'10px 11px',background:C.section}}>
        <p style={{...muted,margin:'0 0 10px'}}>Remove from {legionLabel(entryTeam)}? The Members profile and availability will remain.</p>
        <div style={{display:'flex',gap:8}}><button style={button} onClick={()=>setRemoveId('')}>Cancel</button><button style={{...button,color:C.red}} disabled={!editable} onClick={()=>{onChange?.({...value,teams:value.teams.map(t=>t.id===entryTeam.id?{...t,members:t.members.filter(m=>String(m.id)!==String(player.id)),candidates:(t.candidates||[]).filter(c=>String(c.id)!==String(player.id)),captain:t.captain===player.id?'':t.captain}:t)});setRemoveId('');setActionsId('');onMessage?.('Removed from legion. Members profile retained.');}}>Remove</button></div>
       </div>}
      </article>;
    })}
    {!roster.length&&<div style={{padding:18,background:C.card,borderRadius:12,color:C.icy,fontSize:14}}>No players match the current filters. <button style={{...button,marginTop:10,width:'100%'}} onClick={resetFilters}>Clear filters</button></div>}
    {roster.length>listLimit&&<button style={{...button,width:'100%',marginTop:8}} onClick={()=>setListLimit(n=>n+40)}>Show 40 more players</button>}
    {selecting&&<div aria-hidden="true" style={{height:195}}/>}
    {selecting&&<div role="region" aria-label="Bulk player actions" style={{position:'fixed',bottom:'calc(76px + env(safe-area-inset-bottom, 0px))',left:'50%',transform:'translateX(-50%)',width:'min(calc(100vw - 24px), 420px)',boxSizing:'border-box',zIndex:150,background:C.card,border:'1px solid '+C.border,borderRadius:14,padding:12,maxHeight:'min(65dvh, 580px)',overflowY:'auto',boxShadow:'0 -9px 28px '+C.bg+'bb'}}>
     <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:9}}><strong style={{fontSize:14}}>{selectedBulkCount} selected</strong><button type="button" style={{...button,minHeight:34,padding:'5px 9px',fontSize:12}} onClick={()=>{setSelecting(false);setBulkSelected([]);setBulkPanel('')}}>Done</button></div>
     <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:7}}>
      {[['times','◷','Times'],['status','✓','TAL status'],['more','•••','More']].map(([id,icon,label])=><button type="button" key={id} disabled={!selectedBulkCount} aria-pressed={bulkPanel===id} style={{...button,minWidth:0,padding:'9px 4px',borderColor:bulkPanel===id?C.gold:C.border,color:bulkPanel===id?C.gold:C.icy,background:bulkPanel===id?C.gold+'17':C.section,display:'grid',justifyItems:'center',gap:4}} onClick={()=>id==='status'?openBulkStatusEditor():bulkPanel===id?setBulkPanel(''):beginBulkPanel(id)}><span style={{fontSize:18,lineHeight:1}}>{icon}</span><span style={{fontSize:12}}>{label}</span></button>)}
     </div>
     {bulkPanel==='more'&&<div style={{display:'grid',gap:5,marginTop:10,background:C.section,borderRadius:10,padding:7}}>
      {[['legion','Allocate to a legion'],['cooperation','Works well together'],['language','Edit languages'],['remove','Remove from TAL']].map(([id,label])=><button type="button" key={id} style={{...button,textAlign:'left',border:0,color:id==='remove'?C.red:C.white}} onClick={()=>beginBulkPanel(id)}>{label} <span style={{float:'right'}}>›</span></button>)}
     </div>}
     {bulkPanel==='times'&&<div style={{marginTop:10,background:C.section,borderRadius:10,padding:10}}>
      <strong style={{fontSize:14}}>Edit available times · UTC</strong>
      <div role="group" aria-label="Add or remove available times" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7,margin:'10px 0'}}>
       {[['add','Add times'],['remove','Remove times']].map(([id,label])=><button type="button" key={id} aria-pressed={bulkTimeMode===id} style={{...button,color:bulkTimeMode===id?(id==='add'?C.green:C.gold):C.icy,borderColor:bulkTimeMode===id?(id==='add'?C.green:C.gold):C.border}} onClick={()=>{setBulkTimeMode(id);setBulkReview(false)}}>{bulkTimeMode===id?'✓ ':''}{label}</button>)}
      </div>
      <div role="status" style={{...muted,color:bulkTimeMode==='add'?C.green:C.gold,marginBottom:8}}>{bulkTimeMode==='add'?'Adding selected times':'Removing selected times'}</div>
      <div role="group" aria-label="UTC times to update" style={{display:'grid',gridTemplateColumns:'repeat(5,minmax(0,1fr))',gap:5}}>
       {times.map(t=><button type="button" key={t} aria-pressed={bulkTimes.includes(t)} style={{...button,minWidth:0,padding:'8px 2px',fontSize:11,color:bulkTimes.includes(t)?C.gold:C.icy,borderColor:bulkTimes.includes(t)?C.gold:C.border}} onClick={()=>{setBulkTimes(old=>old.includes(t)?old.filter(x=>x!==t):[...old,t]);setBulkReview(false)}}>{t}</button>)}
      </div>
      <p style={muted}>{bulkTimeMode==='add'?'Existing times will be kept.':'Other recorded times will be kept.'}</p>
     </div>}
     {bulkPanel==='registration'&&<div style={{marginTop:10,background:C.section,borderRadius:10,padding:10}}>
      <strong style={{fontSize:14}}>Change registration status</strong>
      <div style={{display:'grid',gap:7,marginTop:8}}>{[['registered','Registered in game'],['needs','Needs registration'],['considering','Considering for team']].map(([id,label])=><label key={id} style={{display:'flex',alignItems:'center',gap:9,fontSize:14,minHeight:38}}><input type="radio" name="bulk-talt-status" checked={bulkRegistration===id} onChange={()=>{setBulkRegistration(id);setBulkReview(false)}} style={{width:18,height:18,accentColor:C.gold}}/>{label}</label>)}</div>
     </div>}
     {bulkPanel==='legion'&&<div style={{marginTop:10,background:C.section,borderRadius:10,padding:10}}>
      <strong style={{fontSize:14}}>Allocate to a legion</strong>
      <p style={muted}>Choose the host alliance and legion number.</p>
      <label style={{fontSize:12,color:C.icy,display:'block'}}>Host alliance<select aria-label="Host alliance" value={bulkHost} onChange={e=>{setBulkHost(e.target.value);setBulkReview(false)}} style={{...button,width:'100%',fontSize:15,margin:'5px 0 10px'}}>
       {[...new Set(['HOT','ARC','RKG',...(value?.teams||[]).map(t=>String(t.host||'').toUpperCase()),...players.map(p=>String(p.allianceTag||'').toUpperCase())].filter(Boolean))].sort().map(a=><option key={a} value={a}>{a}</option>)}
      </select></label>
      <div style={{fontSize:12,color:C.icy,marginBottom:6}}>Legion number</div>
      <div role="group" aria-label="Choose legion number" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>{['1','2'].map(n=><button type="button" key={n} aria-pressed={bulkLegionNumber===n} style={{...button,color:bulkLegionNumber===n?C.gold:C.icy,borderColor:bulkLegionNumber===n?C.gold:C.border}} onClick={()=>{setBulkLegionNumber(n);setBulkReview(false)}}>{bulkLegionNumber===n?'✓ ':''}Legion {n}</button>)}</div>
     </div>}
     {bulkPanel==='cooperation'&&<div style={{marginTop:10,background:C.section,borderRadius:10,padding:10}}><strong style={{fontSize:14}}>Works well together</strong><p style={muted}>Create one shared cooperation group for {selectedBulkCount} players. This will appear on each player's Members profile and help future team generation.</p>{selectedBulkCount<2&&<p style={{color:C.gold,fontSize:12}}>Select at least two players.</p>}</div>}
     {bulkPanel==='language'&&<div style={{marginTop:10,background:C.section,borderRadius:10,padding:10}}>
      <strong style={{fontSize:14}}>Edit languages</strong>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7,margin:'10px 0'}}>{[['add','Add language'],['remove','Remove language']].map(([id,label])=><button type="button" key={id} aria-pressed={bulkLanguageMode===id} onClick={()=>{setBulkLanguageMode(id);setBulkReview(false)}} style={{...button,color:bulkLanguageMode===id?C.gold:C.icy,borderColor:bulkLanguageMode===id?C.gold:C.border}}>{bulkLanguageMode===id?'✓ ':''}{label}</button>)}</div>
      <select aria-label="Communication language" value={bulkLanguage} onChange={e=>{setBulkLanguage(e.target.value);setBulkReview(false)}} style={{...button,width:'100%',fontSize:15}}>{LANGUAGES.map(l=><option key={l} value={l}>{l}</option>)}</select>
      <p style={muted}>The player's game-interface language will not change.</p>
     </div>}
     {bulkPanel==='remove'&&<div style={{marginTop:10,background:C.section,borderRadius:10,padding:10}}><strong style={{fontSize:14,color:C.red}}>Remove from TAL?</strong><p style={muted}>Remove {selectedBulkCount} players from their TAL legions. Members profiles and saved availability will remain.</p></div>}
     {['times','registration','legion','cooperation','language','remove'].includes(bulkPanel)&&<>
      {bulkReview&&<p role="status" style={{fontSize:13,color:bulkPanel==='remove'?C.red:C.gold,lineHeight:1.5}}>Review: {selectedBulkCount} selected players · {bulkPanel==='times'?(bulkTimeMode==='add'?'Add ':'Remove ')+bulkTimes.join(', ')+' UTC':bulkPanel==='registration'?bulkRegistration:bulkPanel==='legion'?bulkHost+' · Legion '+bulkLegionNumber:bulkPanel==='cooperation'?'One shared cooperation group':bulkPanel==='language'?(bulkLanguageMode==='add'?'Add ':'Remove ')+bulkLanguage:'Remove from TAL only'}</p>}
      {bulkError&&<p role="alert" style={{fontSize:13,color:C.red}}>{bulkError}</p>}
      <button type="button" disabled={!!value?.locked||!onBulkApply||!selectedBulkCount||(bulkPanel==='times'&&!bulkTimes.length)||(bulkPanel==='cooperation'&&selectedBulkCount<2)} style={{...button,width:'100%',marginTop:9,background:bulkPanel==='remove'?C.red:C.gold,color:C.bg}} onClick={commitBulk}>{bulkReview?'Confirm '+selectedBulkCount+' players':'Review '+selectedBulkCount+' players'}</button>
      <button type="button" style={{...button,width:'100%',marginTop:6}} onClick={()=>{setBulkPanel('more');setBulkReview(false)}}>Back</button>
     </>}
    </div>}

   </section>
  </>}
  {statusEditor&&<div role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget){setStatusEditor(null);setStatusError('')}}} style={{position:'fixed',inset:0,zIndex:1200,background:'#0009',display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
    <section role="dialog" aria-modal="true" aria-label="Manage TAL status" style={{width:'100%',maxWidth:480,maxHeight:'min(90dvh,900px)',overflowY:'auto',overscrollBehavior:'contain',borderRadius:'22px 22px 0 0',background:C.card,color:C.white,padding:'10px 18px calc(22px + env(safe-area-inset-bottom, 0px))',boxSizing:'border-box',boxShadow:'0 -15px 45px #0006'}}>
      <div aria-hidden="true" style={{width:36,height:5,borderRadius:10,background:C.icy,opacity:.6,margin:'0 auto 12px'}}/>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
        <button type="button" style={{...button,border:0,background:'transparent',padding:'8px 0'}} onClick={()=>{setStatusEditor(null);setStatusError('')}}>Cancel</button>
        <strong style={{fontSize:16}}>Manage TAL status</strong>
        <button type="button" style={{...button,border:0,background:'transparent',color:C.gold,padding:'8px 0'}} onClick={saveStatusEditor}>Save</button>
      </div>
      <p style={{...muted,margin:'7px 0 14px'}}>{statusEditor.kind==='single'?(byId.get(statusEditor.playerId)?.username||byId.get(statusEditor.playerId)?.alias||'Player'):'Editing '+statusEditor.ids.length+' selected players'}. Changes apply only when you save.</p>
      {statusEditor.kind==='bulk'&&<p style={{...muted,background:C.section,borderRadius:10,padding:10}}>Select the settings you want to change. Unticked settings will stay as they are for each player.</p>}
      {[
       {key:'role',title:'Roster role',description:'30 combatants · 20 substitutes',choices:[['combatant','Combatant','Starting roster · Enter at 0:00'],['substitute','Substitute','Reserve roster · Enter at 3:00+'],['pending','Unassigned','Role not decided']]},
       {key:'matchmakingOnly',title:'Battle participation',description:'Who is expected to fight',choices:[[false,'Playing','Expected to join battle'],[true,'Matchmaking only','Registered for matchmaking, excluded from battle teams']]}
      ].map(section=><div key={section.key} style={{marginTop:15,paddingTop:15,borderTop:'1px solid '+C.border}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:9}}>
          <div><strong style={{fontSize:15}}>{section.title}</strong><p style={{...muted,margin:'3px 0 0'}}>{section.description}</p></div>
          {statusEditor.kind==='bulk'&&<label style={{display:'flex',alignItems:'center',gap:7,fontSize:12,color:C.icy,minHeight:44}}><input type="checkbox" checked={statusApply[section.key]} onChange={e=>{setStatusApply(old=>({...old,[section.key]:e.target.checked}));setStatusError('')}} style={{width:20,height:20,accentColor:C.gold}}/>Change</label>}
        </div>
        <div role="radiogroup" aria-label={section.title} style={{display:'grid',gap:7,opacity:statusEditor.kind==='bulk'&&!statusApply[section.key]?.65:1}}>
          {section.choices.map(([choice,label,explanation])=><label key={String(choice)} style={{display:'flex',alignItems:'center',gap:13,minHeight:60,padding:'9px 12px',border:'1px solid '+(statusDraft[section.key]===choice?C.gold:C.border),borderRadius:12,background:statusDraft[section.key]===choice?C.gold+'12':C.section,cursor:'pointer'}}>
            <input type="radio" name={'tal-status-'+section.key} disabled={statusEditor.kind==='bulk'&&!statusApply[section.key]} checked={statusDraft[section.key]===choice} onChange={()=>{setStatusDraft(old=>({...old,[section.key]:choice}));setStatusError('')}} style={{width:22,height:22,flexShrink:0,accentColor:C.gold}}/>
            <span><strong style={{fontSize:14,display:'block'}}>{label}</strong><span style={{...muted,display:'block',marginTop:3}}>{explanation}</span></span>
          </label>)}
        </div>
      </div>)}
      <div style={{marginTop:15,paddingTop:15,borderTop:'1px solid '+C.border}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:9}}>
          <div><strong style={{fontSize:15}}>In-game registration</strong><p style={{...muted,margin:'3px 0 0'}}>Confirm after registering inside Whiteout Survival</p></div>
          {statusEditor.kind==='bulk'&&<label style={{display:'flex',alignItems:'center',gap:7,fontSize:12,color:C.icy,minHeight:44}}><input type="checkbox" checked={statusApply.registered} onChange={e=>{setStatusApply(old=>({...old,registered:e.target.checked}));setStatusError('')}} style={{width:20,height:20,accentColor:C.gold}}/>Change</label>}
        </div>
        <label style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,minHeight:64,padding:'10px 12px',background:C.section,border:'1px solid '+C.border,borderRadius:12,opacity:statusEditor.kind==='bulk'&&!statusApply.registered?.65:1}}>
          <span><strong style={{fontSize:14}}>{statusDraft.registered?'Registered in game':'Needs registration'}</strong><span style={{...muted,display:'block',marginTop:3}}>Registration confirmation</span></span>
          <input type="checkbox" aria-label="Registered in game" checked={statusDraft.registered} disabled={statusEditor.kind==='bulk'&&!statusApply.registered} onChange={e=>{setStatusDraft(old=>({...old,registered:e.target.checked}));setStatusError('')}} style={{height:24,width:24,accentColor:C.gold,flexShrink:0}}/>
        </label>
      </div>
      {statusApply.matchmakingOnly&&statusDraft.matchmakingOnly&&statusApply.role&&statusDraft.role==='combatant'&&<p style={{...muted,color:C.gold}}>Matchmaking-only players are excluded from battle teams. Consider using a substitute slot instead.</p>}
      {statusError&&<p role="alert" style={{color:C.red,fontSize:13,marginTop:12}}>{statusError}</p>}
      <button type="button" style={{...button,width:'100%',background:C.gold,color:C.bg,marginTop:17,minHeight:50,fontSize:15,fontWeight:700}} onClick={saveStatusEditor}>Save changes</button>
      <p style={{...muted,textAlign:'center',margin:'8px 0 0'}}>Cancel discards changes. Existing availability and legion assignments are preserved.</p>
    </section>
  </div>}
 </section>;
}
