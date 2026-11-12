import {useEffect,useMemo,useRef,useState} from 'react';
import {C} from '../../../src/utils/constants.js';
import {plannedMemberIds,legionLabel} from '../../../src/services/talRosterService.js';
import {DEFAULT_TIMES} from './planner.js';

const COLORS=[
 {id:'blue',name:'Blue',color:'#69B3FF',bg:'#172E48',buildings:['Proto I','Boiler']},
 {id:'yellow',name:'Yellow',color:'#F6CB65',bg:'#423A24',buildings:['Proto II','Transit']},
 {id:'green',name:'Green',color:'#7ADDAB',bg:'#1C3B30',buildings:['Repair I','Repair III']},
 {id:'pink',name:'Pink',color:'#FC8ECC',bg:'#442A3E',buildings:['Repair II','Repair IV']}
];
const BUILDINGS=['Proto I','Proto II','Repair I','Repair II','Repair III','Repair IV','Boiler','Transit'];
const btn={borderRadius:10,border:'1px solid '+C.border,color:C.icy,background:C.section,padding:'9px 11px',fontSize:13,minHeight:40,fontWeight:600,cursor:'pointer'};
const panel={background:C.card,border:'1px solid '+C.border,borderRadius:13,padding:12};
const small={fontSize:12,color:C.icy,lineHeight:1.45};
const name=p=>p.username||p.alias||String(p.fid||p.id);
const valueNumber=n=>n!==''&&n!=null&&Number.isFinite(Number(String(n).replace(/,/g,'')))?Number(String(n).replace(/,/g,'')):null;
const powerFormat=n=>n==null?'—':Number(n).toLocaleString('en-US');
const fcNumber=p=>Number(String(p.furnaceLevel||'').match(/(?:FC|F)\s*(\d+)/i)?.[1]||0);
const helios=p=>['infantry','lancer','marksman'].every(k=>/helios/i.test(String(p.troops?.[k]||'')));
const norahInfo=p=>{
 const matches=(p?.joinerHeroes||[]).filter(h=>/norah/i.test(typeof h==='string'?h:h.hero||h.name||''));
 if(p?.norahSkill5)return 'Norah · Skill 5';
 if(matches.some(h=>typeof h==='object'&&Number(h.skillLevel||h.topRightSkill||0)>=5&&h.verified))return 'Norah · Skill 5';
 return matches.length?'Norah':null;
};
const norah=p=>norahInfo(p)==='Norah · Skill 5';
const languageInfo=p=>p?.communicationLanguage?[String(p.communicationLanguage).trim()]:[...new Set([p?.gameLanguage,...(Array.isArray(p?.languages)?p.languages:[])].map(x=>typeof x==='string'?x:typeof x?.language==='string'?x.language:'').map(x=>x.trim()).filter(Boolean))];
function textOfTeams(groups,playersById,entryLabel=()=>null) {
 return groups.map(g=>{
  const leader=g.leader?name(playersById.get(String(g.leader))||{id:g.leader}):'Not assigned';
  const label=(COLORS.find(c=>c.id===g.color)?.name||'Team').toUpperCase();
  const ids=[g.leader,...g.members].filter(Boolean).map(String);
  const starters=ids.filter(id=>entryLabel(id)!=='3:00+').map(id=>name(playersById.get(id)||{id}));
  const substitutes=ids.filter(id=>entryLabel(id)==='3:00+').map(id=>name(playersById.get(id)||{id}));
  return label+' TEAM\nLeader: '+leader+'\nSTART 0:00: '+(starters.join(', ')||'None')+(substitutes.length?'\nJOIN 3:00+: '+substitutes.join(', '):'');
 }).join('\n\n');
}
const initialGroups=()=>COLORS.map((c,i)=>({key:i+1,color:c.id,leader:null,members:[]}));
const draftPrefix='caroline-3573-tal-teams-v1:';
export function TalTeamsTab({value,players=[],cooperationPairs=[],cooperationGroups=[],drafts={},onDraftChange,syncReady=false,selectedLegionId}){
 const legions=(value?.teams||[]).filter(t=>['HOT','ARC','RKG'].includes(String(t.host||'').toUpperCase()));
 const [legionId,setLegionId]=useState(()=>{
  try{return JSON.parse(window.localStorage.getItem('caroline-3573-last-tal-match')||'null')?.legion||legions[0]?.id||''}catch{return legions[0]?.id||''}
 });
 const selectedLegion=legions.find(t=>t.id===(selectedLegionId||legionId))||legions[0];
 const [matchTime,setMatchTime]=useState(()=>{
  try{return JSON.parse(window.localStorage.getItem('caroline-3573-last-tal-match')||'null')?.time||'12:00'}catch{return '14:00'}
 });
 const [matchDate,setMatchDate]=useState(()=>{try{return JSON.parse(window.localStorage.getItem('caroline-3573-last-tal-match')||'null')?.date||new Date().toISOString().slice(0,10)}catch{return new Date().toISOString().slice(0,10)}});
 const [roleFilter,setRoleFilter]=useState('all');
 const [attendanceMenu,setAttendanceMenu]=useState('');
 const [step,setStep]=useState('teams');
 const [groups,setGroups]=useState(initialGroups);
 const [chosen,setChosen]=useState([]);
 const [powers,setPowers]=useState({});
 const [bulk,setBulk]=useState('');
 const [showBulk,setShowBulk]=useState(false);
 const [playerSearch,setPlayerSearch]=useState('');
 const [onlyAvailable,setOnlyAvailable]=useState(false);
 const [mode,setMode]=useState('balanced');
 const [leaderStrategy,setLeaderStrategy]=useState('power');
 const [generationError,setGenerationError]=useState('');
 const [generationSuccess,setGenerationSuccess]=useState('');
 const [assignment,setAssignment]=useState({});
 const [picked,setPicked]=useState('');
 const [activeColour,setActiveColour]=useState('blue');
 const [dragId,setDragId]=useState('');
 const [hoverBuilding,setHoverBuilding]=useState('');
 const [undoAssignment,setUndoAssignment]=useState(null);
 const dragRef=useRef(null);
 const [dragPoint,setDragPoint]=useState(null);
 const targetAt=(x,y)=>document.elementFromPoint(x,y)?.closest('[data-tal-building]')?.dataset.talBuilding||'';
 const cancelDrag=()=>{if(dragRef.current?.timer)clearTimeout(dragRef.current.timer);dragRef.current=null;setDragId('');setDragPoint(null);setHoverBuilding('');};
 const dragStart=(e,id)=>{
  if(e.pointerType==='mouse'&&e.button!==0)return;
  e.stopPropagation();
  const d={id:String(id),pointerId:e.pointerId,type:e.pointerType,x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY,active:false,timer:null};
  dragRef.current=d;e.currentTarget.setPointerCapture?.(e.pointerId);
  if(e.pointerType!=='mouse')d.timer=setTimeout(()=>{if(dragRef.current!==d)return;d.active=true;setDragId(d.id);setDragPoint({x:d.x,y:d.y});navigator.vibrate?.(12);},220);
 };
 const dragMove=e=>{
  const d=dragRef.current;if(!d||d.pointerId!==e.pointerId)return;
  d.x=e.clientX;d.y=e.clientY;const delta=Math.hypot(d.x-d.sx,d.y-d.sy);
  if(!d.active){
   if(d.type==='mouse'&&delta>5){d.active=true;setDragId(d.id);}
   else if(d.type!=='mouse'&&delta>12){cancelDrag();return;}
   else return;
  }
  e.preventDefault();setDragPoint({x:d.x,y:d.y});setHoverBuilding(targetAt(d.x,d.y));
  if(d.y>window.innerHeight-75)window.scrollBy(0,14);else if(d.y<85)window.scrollBy(0,-14);
 };
 const dragEnd=e=>{
  const d=dragRef.current;if(!d||d.pointerId!==e.pointerId)return;
  const building=d.active?targetAt(e.clientX,e.clientY):'';
  if(d.active){
   if(building){assign(d.id,building);setCopyMessage(name(byId.get(d.id)||{id:d.id})+' moved to '+building+'.');}
   else setCopyMessage('Move cancelled. Assignments unchanged.');
  }
  cancelDrag();
 };
 const dragHandle=id=>({onPointerDown:e=>dragStart(e,id),onPointerMove:dragMove,onPointerUp:dragEnd,onPointerCancel:cancelDrag});
 const handleStyle={width:52,minWidth:52,minHeight:60,alignSelf:'stretch',display:'flex',alignItems:'center',justifyContent:'center',border:'1px solid '+C.border,borderRadius:9,background:C.section,color:C.icy,fontSize:25,touchAction:'none',userSelect:'none',WebkitUserSelect:'none',WebkitTouchCallout:'none',cursor:'grab',padding:0};
 const dragCard=(id,col)=><div key={id} style={{display:'flex',alignItems:'stretch',gap:8,width:'100%',minHeight:64,marginTop:6,padding:5,border:'1px solid '+(picked===id?col.color:C.border),borderRadius:11,background:C.card,userSelect:'none',WebkitUserSelect:'none',WebkitTouchCallout:'none',opacity:dragId===id?0.45:1}}>
  <button type="button" {...dragHandle(id)} title="Hold and drag" aria-label={'Drag '+name(byId.get(String(id))||{id})+' to a building'} style={handleStyle}>⠿</button>
  <button type="button" onClick={()=>setPicked(picked===id?'':id)} style={{...btn,flex:1,minWidth:0,minHeight:60,textAlign:'left',border:0,background:'transparent',padding:'8px 6px',fontSize:15,overflowWrap:'anywhere',userSelect:'none',WebkitUserSelect:'none'}}>{name(byId.get(String(id))||{id})}{isSubstitute(id)?' · 3:00+':''}{picked===id?' ✓':''}</button>
 </div>;
 const [preview,setPreview]=useState(false);
 const [copyMessage,setCopyMessage]=useState('');
 const [confirmed,setConfirmed]=useState(false);
 const [locked,setLocked]=useState([]);
 const [manual,setManual]=useState(true);
 const [absentIds,setAbsentIds]=useState([]);
 const [lateSearch,setLateSearch]=useState('');
 const [lateId,setLateId]=useState('');
 const [lateTarget,setLateTarget]=useState('blue');
 const [copyDraft,setCopyDraft]=useState('');
 const [copySource,setCopySource]=useState('');
 const [copyOpen,setCopyOpen]=useState(false);
 const [editingTeam,setEditingTeam]=useState(null);
 const [draftLoaded,setDraftLoaded]=useState('');
 const [draftState,setDraftState]=useState('');
 const [focusedTeam,setFocusedTeam]=useState('blue');
 const teamRefs=useRef({});
 const matchKey=String(selectedLegion?.id||'unknown')+':'+matchDate+':'+matchTime;
 const draftKey=draftPrefix+matchKey;
 useEffect(()=>{
  if(!selectedLegion||!matchTime)return;
  try{window.localStorage.setItem('caroline-3573-last-tal-match',JSON.stringify({legion:selectedLegion.id,time:matchTime,date:matchDate}));}catch{}
 },[selectedLegion?.id,matchTime,matchDate]);
 const remoteDraft=drafts?.[matchKey];
 const lastSaved=useRef('');
 const bootstrapped=useRef(new Set());
 const autoSelectionPending=useRef('');
 const remoteApplied=useRef('');
 const byId=useMemo(()=>new Map(players.map(p=>[String(p.id),p])),[players]);
 const legionRoster=useMemo(()=>{
  if(!selectedLegion)return [];
  return [...plannedMemberIds(selectedLegion)].map(id=>byId.get(String(id))).filter(Boolean).sort((a,b)=>name(a).localeCompare(name(b),undefined,{sensitivity:'base'}));
 },[selectedLegion,byId]);
 const memberIds=new Set((selectedLegion?.members||[]).map(m=>String(m.id)));
 const availabilityFor=p=>{
  const raw=value?.availability?.[p.id]??value?.availability?.[String(p.fid)]??value?.records?.[p.id]?.times??[];
  return Array.isArray(raw)?raw.map(String):[];
 };
 const availableForMatch=p=>memberIds.has(String(p.id))&&availabilityFor(p).includes(matchTime);
 const memberById=new Map((selectedLegion?.members||[]).map(m=>[String(m.id),m]));
 const registrationRole=id=>memberById.get(String(id))?.role||'pending';
 const isCombatant=id=>registrationRole(id)==='combatant';
 const isSubstitute=id=>registrationRole(id)==='substitute';
 const isMatchmakingOnly=id=>!!memberById.get(String(id))?.matchmakingOnly;
 const isEligible=id=>!!memberById.get(String(id))?.registered&&!isMatchmakingOnly(id)&&(isCombatant(id)||isSubstitute(id));
 const pool=legionRoster.filter(p=>availableForMatch(p)&&isEligible(p.id));
 const combatantPool=pool.filter(p=>isCombatant(p.id)&&!absentIds.includes(String(p.id)));
 const substitutePool=pool.filter(p=>isSubstitute(p.id)&&!absentIds.includes(String(p.id)));
 const substituteNeed=Math.max(0,30-Math.min(30,combatantPool.length));
 const preferredIds=[...combatantPool.slice(0,30),...substitutePool.slice(0,substituteNeed)].map(p=>String(p.id));
 const visibleRoster=legionRoster.filter(p=>(!onlyAvailable||availableForMatch(p))&&(!playerSearch||[p.username,p.alias,p.fid].some(v=>String(v||'').toLowerCase().includes(playerSearch.trim().toLowerCase())))).sort((a,b)=>Number(availableForMatch(b))-Number(availableForMatch(a))||name(a).localeCompare(name(b),undefined,{sensitivity:'base'}));
  const battlePool=useMemo(()=>players.filter(p=>!p.blacklisted),[players]);
 const snapshot=useMemo(()=>({chosen,powers,groups,assignment,mode,leaderStrategy,confirmed,absentIds,copyDraft,copySource}),[chosen,powers,groups,assignment,mode,leaderStrategy,confirmed,absentIds,copyDraft,copySource]);
 const snapshotSignature=JSON.stringify(snapshot);
 function applyDraft(saved){
  setChosen(Array.isArray(saved?.chosen)?saved.chosen.map(String):[]);
  setPowers(saved?.powers&&typeof saved.powers==='object'?saved.powers:{});
  setGroups(Array.isArray(saved?.groups)&&saved.groups.length===4?saved.groups:initialGroups());
  setAssignment(saved?.assignment&&typeof saved.assignment==='object'?saved.assignment:{});
  setMode(saved?.mode==='stack'?'stack':'balanced');
  setLeaderStrategy(saved?.leaderStrategy==='manual'?'manual':'power');
  setConfirmed(!!saved?.confirmed);
  setAbsentIds(Array.isArray(saved?.absentIds)?saved.absentIds:[]);
  setCopyDraft(typeof saved?.copyDraft==='string'?saved.copyDraft:'');setCopySource(typeof saved?.copySource==='string'?saved.copySource:'');
  lastSaved.current=JSON.stringify({chosen:Array.isArray(saved?.chosen)?saved.chosen.map(String):[],powers:saved?.powers&&typeof saved.powers==='object'?saved.powers:{},groups:Array.isArray(saved?.groups)&&saved.groups.length===4?saved.groups:initialGroups(),assignment:saved?.assignment&&typeof saved.assignment==='object'?saved.assignment:{},mode:saved?.mode==='stack'?'stack':'balanced',leaderStrategy:saved?.leaderStrategy==='manual'?'manual':'power',confirmed:!!saved?.confirmed,absentIds:Array.isArray(saved?.absentIds)?saved.absentIds:[],copyDraft:typeof saved?.copyDraft==='string'?saved.copyDraft:'',copySource:typeof saved?.copySource==='string'?saved.copySource:''});
 }
 useEffect(()=>{
  let saved=null;
  try{const raw=window.localStorage.getItem(draftKey);if(raw)saved=JSON.parse(raw);}catch{}
  const source=remoteDraft||saved;
  autoSelectionPending.current=source?'':draftKey;
  applyDraft(source||{chosen:preferredIds});
  remoteApplied.current=remoteDraft?.updatedAt||'';
  setDraftState(remoteDraft?'Shared draft restored':saved?'Device draft restored':'Available players selected for this time');
  setStep('teams');setPicked('');setEditingTeam(null);setGenerationError('');setDraftLoaded(draftKey);
 // A new legion/time is a distinct draft; avoid resetting for every cloud refresh.
 },[draftKey]);
 useEffect(()=>{
  // Only initialise a new draft when roster data arrives. Never overwrite saved edits.
  if(autoSelectionPending.current!==draftKey||draftLoaded!==draftKey||!pool.length)return;
  autoSelectionPending.current='';
  setChosen(preferredIds);
 },[draftKey,draftLoaded,pool.map(p=>String(p.id)).join('|')]);
 useEffect(()=>{
  if(draftLoaded!==draftKey||!remoteDraft||remoteApplied.current===remoteDraft.updatedAt)return;
  remoteApplied.current=remoteDraft.updatedAt;
  const incoming=JSON.stringify({chosen:remoteDraft.chosen||[],powers:remoteDraft.powers||{},groups:remoteDraft.groups||initialGroups(),assignment:remoteDraft.assignment||{},mode:remoteDraft.mode==='stack'?'stack':'balanced',leaderStrategy:remoteDraft.leaderStrategy==='manual'?'manual':'power',confirmed:!!remoteDraft.confirmed,absentIds:remoteDraft.absentIds||[],copyDraft:remoteDraft.copyDraft||'',copySource:remoteDraft.copySource||''});
  if(incoming===snapshotSignature){lastSaved.current=incoming;return;}
  if(snapshotSignature!==lastSaved.current){
   setDraftState('New shared draft available. Finish or review your unsaved edits.');
   return;
  }
  applyDraft(remoteDraft);
  setDraftState('Updated from another device');
 },[draftKey,draftLoaded,remoteDraft?.updatedAt]);
 useEffect(()=>{
  if(draftLoaded!==draftKey||lastSaved.current===snapshotSignature)return;
  lastSaved.current=snapshotSignature;
  try{
   window.localStorage.setItem(draftKey,JSON.stringify({...snapshot,updatedAt:new Date().toISOString()}));
   setDraftState(syncReady?'Saving to shared workspace…':'Saved on this device · waiting for sync');
  }catch{setDraftState('Could not save device backup.');}
  if(syncReady&&onDraftChange){
   onDraftChange(matchKey,{...snapshot,updatedAt:new Date().toISOString()});
  }
 },[draftKey,draftLoaded,snapshotSignature,syncReady]);
 useEffect(()=>{
  if(!syncReady||!onDraftChange||remoteDraft||draftLoaded!==draftKey||bootstrapped.current.has(matchKey))return;
  const hasPlan=snapshot.chosen.length>0||snapshot.groups.some(g=>g.leader||g.members?.length)||Object.keys(snapshot.assignment).length>0;
  if(!hasPlan)return;
  bootstrapped.current.add(matchKey);
  onDraftChange(matchKey,{...snapshot,updatedAt:new Date().toISOString()});
  setDraftState('Sharing existing device draft');
 },[syncReady,draftKey,draftLoaded,!!remoteDraft]);
  const selectedIds=[...new Set(chosen.map(String))].filter(id=>byId.has(String(id))&&isEligible(id)&&!absentIds.includes(String(id))&&battlePool.some(p=>String(p.id)===String(id)));
 const combatantsSelected=selectedIds.filter(isCombatant).slice(0,30);
 const effectiveIds=[...combatantsSelected,...selectedIds.filter(isSubstitute).slice(0,Math.max(0,30-combatantsSelected.length))];
 const selectedPlayers=effectiveIds.map(id=>byId.get(String(id))).filter(Boolean);
 const leaderCandidates=[...selectedPlayers].filter(p=>p.roles?.some?.(r=>/rally lead/i.test(String(r)))||p.rallyLeader||p.leaderProfile?.role==='leader');
 const powerOf=id=>valueNumber(powers[String(id)]??value?.records?.[id]?.troopPower);
 const teamPower=g=>[g.leader,...g.members].filter(id=>id&&!absentIds.includes(String(id))).reduce((sum,id)=>sum+(powerOf(id)||0),0);
 const groupPairs=cooperationGroups.filter(g=>Array.isArray(g?.ids)&&g.ids.length>1).flatMap(g=>{
  const ids=[...new Set(g.ids.map(String))],pairs=[];
  for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++)pairs.push([ids[i],ids[j]]);
  return pairs;
 });
 const cohesionPairs=[...cooperationPairs.filter(pair=>Array.isArray(pair)&&pair.length===2&&pair[0]!==pair[1]).map(pair=>pair.map(String)),...groupPairs];
 const languageOf=id=>{
  const p=byId.get(String(id));return languageInfo(p).map(l=>l.toLowerCase());
 };
 const preferenceScore=candidateGroups=>{
  let links=0,sharedLanguages=0;
  for(const g of candidateGroups){
   const ids=[g.leader,...g.members].filter(Boolean).map(String);
   for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){
    if(cohesionPairs.some(pair=>pair.includes(ids[i])&&pair.includes(ids[j])))links++;
    const a=languageOf(ids[i]),b=languageOf(ids[j]);
    if(a.length&&b.length&&a.some(l=>b.includes(l)))sharedLanguages++;
   }
  }
  return {links,sharedLanguages};
 };
 const balanceInfo=(candidateGroups)=>{
  const powers=candidateGroups.map(g=>[g.leader,...g.members].filter(Boolean).reduce((n,id)=>n+(powerOf(id)||0),0));
  const mean=powers.reduce((a,b)=>a+b,0)/4;
  const deviation=mean?Math.max(...powers.map(v=>Math.abs(v-mean)/mean))*100:0;
  return {mean,deviation,powers};
 };
 const balanceStats=balanceInfo(groups);
 const compatibilityStats=preferenceScore(groups);
 const allAssigned=groups.flatMap(g=>[g.leader,...g.members]).filter(Boolean).map(String);
 const selectedSet=new Set(effectiveIds);
 const missing=effectiveIds.filter(id=>!allAssigned.includes(String(id)));
 const duplicateAssignments=[...new Set(allAssigned.filter((id,index)=>allAssigned.indexOf(id)!==index))];
 const extraAssignments=[...new Set(allAssigned.filter(id=>!selectedSet.has(id)))];
 const assignmentsValid=allAssigned.length===effectiveIds.length&&!missing.length&&!duplicateAssignments.length&&!extraAssignments.length&&groups.every(g=>!!g.leader);
 const assignedSummary=assignmentsValid?effectiveIds.length+' of '+effectiveIds.length+' eligible players assigned':allAssigned.length+' assigned · '+missing.length+' unassigned'+(duplicateAssignments.length?' · '+duplicateAssignments.length+' duplicated':'')+(extraAssignments.length?' · '+extraAssignments.length+' deselected still assigned':'');
 const activePlayers=groups.flatMap(g=>[g.leader,...g.members].filter(id=>id&&!absentIds.includes(String(id))).map(id=>({id:String(id),g})));
 const allTeamIds=new Set(groups.flatMap(g=>[g.leader,...g.members].filter(Boolean)).map(String));
 const assignedCount=activePlayers.filter(({id})=>assignment[id]).length;
 const teamFor=id=>groups.find(g=>String(g.leader)===String(id)||g.members.some(m=>String(m)===String(id)));
 function resetForMatch(nextLegion=selectedLegion?.id||legionId,nextTime=matchTime){setLegionId(nextLegion);setMatchTime(nextTime);setGenerationError('');setBulk('');setPicked('');setPlayerSearch('');setOnlyAvailable(false);setStep('teams');setLocked([]);setPreview(false);setEditingTeam(null);}
 function chooseAll(){autoSelectionPending.current='';setChosen(preferredIds);setGenerationError('');}
 function toggle(id){
  const key=String(id);if(!pool.some(p=>String(p.id)===key))return;
  autoSelectionPending.current='';
  if(selectedSet.has(key)){
   setChosen(old=>old.filter(x=>String(x)!==key));
   setGroups(old=>old.map(g=>({...g,leader:String(g.leader)===key?null:g.leader,members:g.members.filter(x=>String(x)!==key)})));
   setAssignment(old=>{const next={...old};delete next[key];return next;});
   setCopyMessage('Removed '+name(byId.get(key)||{id:key})+' from this match selection.');
  }else setChosen(old=>[...new Set([...old.map(String),key])]);
  setConfirmed(false);setGenerationError('');
 }
 function saveBatch(){
  const lines=bulk.split(/\r?\n/).filter(s=>s.trim()),updates={},problems=[];
  for(const line of lines){
   const i=line.lastIndexOf(',');if(i<1){problems.push(line);continue;}
   const identifier=line.slice(0,i).trim(),n=valueNumber(line.slice(i+1).trim());
   const matches=pool.filter(p=>[p.fid,p.username,p.alias,p.id].some(v=>String(v||'').toLowerCase()===identifier.toLowerCase()));
   if(matches.length!==1||n===null||n<0){problems.push(identifier);continue;}
   updates[String(matches[0].id)]=n;
  }
  if(problems.length){setCopyMessage('Review unmatched or invalid: '+problems.slice(0,5).join(', '));return;}
  setPowers(p=>({...p,...updates}));setCopyMessage('Updated '+Object.keys(updates).length+' troop power values in this preview.');setShowBulk(false);
 }
 function clearTeams(){
  setGenerationSuccess('');
  if(!groups.some(g=>g.leader||g.members.length)&&!Object.keys(assignment).length){
   setCopyMessage('Teams are already empty. Your player selection and troop power remain available.');
   return;
  }
  if(!window.confirm('Clear all four teams and building assignments? Your selected participants and troop power will be kept.'))return;
  setGroups(initialGroups());setAssignment({});setAbsentIds([]);setConfirmed(false);
  setCopyDraft('');setCopySource('');setCopyOpen(false);setEditingTeam(null);
  setGenerationError('');setStep('teams');
  setGenerationSuccess('All four teams cleared. '+selectedIds.length+' selected participants and their troop power are preserved.');
  setCopyMessage('Teams cleared. Selected participants and troop power are preserved.');
 }
 function generate(){
  setGenerationError('');setGenerationSuccess('');
  if(selectedPlayers.length<4){setGenerationError('Select at least four registered players who can attend.');return;}
  setChosen(effectiveIds);
  const unknown=selectedPlayers.filter(p=>powerOf(p.id)===null);
  if(unknown.length){setGenerationError('Missing troop power for '+unknown.length+' player'+(unknown.length===1?'':'s')+': '+unknown.slice(0,3).map(name).join(', ')+(unknown.length>3?'…':'')+'. Enter power before generating.');return;}
  const sorted=[...selectedPlayers].sort((a,b)=>powerOf(b.id)-powerOf(a.id));
  const manualLeaders=groups.map(g=>String(g.leader||''));
  const usableManual=manualLeaders.every(Boolean)&&new Set(manualLeaders).size===4&&manualLeaders.every(id=>selectedIds.includes(id));
  if(leaderStrategy==='manual'&&!usableManual){setGenerationError('Assign four different selected leaders to the colour teams, or use Highest troop power.');return;}
  const leads=leaderStrategy==='manual'?manualLeaders:sorted.slice(0,4).map(p=>String(p.id));
  const used=new Set(leads);
  const joiners=sorted.filter(p=>!used.has(String(p.id)));
  let next=initialGroups().map((g,i)=>({...g,leader:leads[i]}));
  const teamTotal=g=>[g.leader,...g.members].filter(Boolean).reduce((total,id)=>total+(powerOf(id)||0),0);
  if(mode==='stack'){
   joiners.forEach((p,index)=>next[Math.min(3,Math.floor(index/Math.max(1,Math.ceil(joiners.length/4))))].members.push(String(p.id)));
  }else{
   const targetSize=Math.ceil(selectedPlayers.length/4);
   for(const p of joiners){
    const eligible=next.filter(g=>g.members.length+1<targetSize);
    const candidates=eligible.length?eligible:next;
    candidates.sort((a,b)=>teamTotal(a)-teamTotal(b)||a.members.length-b.members.length||a.key-b.key);
    candidates[0].members.push(String(p.id));
   }
   const objective=gs=>{
    const deviation=balanceInfo(gs).deviation,affinity=preferenceScore(gs);
    return Math.max(0,deviation-5)*10000+deviation*12-affinity.links*28-affinity.sharedLanguages*1.5;
   };
   let currentScore=objective(next);
   for(let pass=0;pass<25;pass++){
    let bestScore=currentScore,best=null;
    for(let a=0;a<4;a++)for(let b=a+1;b<4;b++){
     for(let ia=0;ia<next[a].members.length;ia++)for(let ib=0;ib<next[b].members.length;ib++){
      const trial=next.map(g=>({...g,members:[...g.members]}));
      [trial[a].members[ia],trial[b].members[ib]]=[trial[b].members[ib],trial[a].members[ia]];
      const score=objective(trial);
      if(score<bestScore-0.001){bestScore=score;best=trial;}
     }
    }
    if(!best)break;
    next=best;currentScore=bestScore;
   }
  }
  const ids=next.flatMap(g=>[g.leader,...g.members]).filter(Boolean).map(String);
  if(ids.length!==effectiveIds.length||new Set(ids).size!==effectiveIds.length||ids.some(id=>!selectedSet.has(id))){setGenerationError('Could not assign every selected player exactly once. Existing assignments were preserved.');return;}
  setGroups(next);setAssignment({});setAbsentIds([]);setConfirmed(false);setStep('teams');
  const outcome=balanceInfo(next),affinity=preferenceScore(next);
  setGenerationError('');setGenerationSuccess(effectiveIds.length+' of '+effectiveIds.length+' eligible players assigned across four teams.');
  setCopyMessage(effectiveIds.length+' of '+effectiveIds.length+' eligible players assigned across four teams. Max power deviation '+outcome.deviation.toFixed(1)+'%'+(outcome.deviation>5?' (above 5% target)':'')+'. '+affinity.links+' cooperation pairs together.');
 }
  function addUnassigned(){
  setGenerationError('');setGenerationSuccess('');
  if(groups.some(g=>!g.leader)){setGenerationError('Assign four team leaders first, or choose Regenerate all teams.');return;}
  if(extraAssignments.length||duplicateAssignments.length){setGenerationError('Existing teams contain duplicate or deselected players. Use Regenerate all teams to repair the assignments.');return;}
  const newcomers=missing.map(id=>byId.get(String(id))).filter(Boolean);
  if(!newcomers.length){setCopyMessage('All selected players already have a team.');return;}
  const unknown=newcomers.filter(p=>powerOf(p.id)===null);
  if(unknown.length){setGenerationError('Missing troop power for '+unknown.map(name).join(', ')+'.');return;}
  const next=groups.map(g=>({...g,members:[...g.members]}));
  const sorted=[...newcomers].sort((a,b)=>powerOf(b.id)-powerOf(a.id));
  for(const p of sorted){
   const id=String(p.id);
   const ranked=next.map((_,i)=>{
    const trial=next.map(g=>({...g,members:[...g.members]}));
    trial[i].members.push(id);
    const stats=balanceInfo(trial),affinity=preferenceScore(trial);
    return {i,score:Math.max(0,stats.deviation-5)*10000+stats.deviation*12-affinity.links*28-affinity.sharedLanguages*1.5};
   }).sort((a,b)=>a.score-b.score);
   next[ranked[0].i].members.push(id);
  }
  const ids=next.flatMap(g=>[g.leader,...g.members]).filter(Boolean).map(String);
  if(ids.length!==effectiveIds.length||new Set(ids).size!==effectiveIds.length||ids.some(id=>!selectedSet.has(id))){setGenerationError('Unable to place every selected player exactly once. Existing teams are unchanged.');return;}
  setGroups(next);setConfirmed(false);setGenerationSuccess(ids.length+' of '+effectiveIds.length+' eligible players assigned. Added '+newcomers.length+' without changing existing teams.');
  setCopyMessage('Added '+newcomers.length+' players without reshuffling existing teams. '+ids.length+' of '+effectiveIds.length+' eligible players assigned.');
 }
  function moveMember(id,targetKey){
  const source=teamFor(id);if(!source||String(source.leader)===String(id))return;
  setGroups(old=>old.map(g=>({...g,members:[...g.members.filter(x=>String(x)!==String(id)),...(g.key===targetKey?[String(id)]:[])]})));
  setAssignment(prev=>{const next={...prev};delete next[String(id)];return next;});
 }
 function changeLeader(groupKey,id){
  setGroups(old=>old.map(g=>({...g,leader:g.key===groupKey?String(id):g.leader===String(id)?null:g.leader,members:g.members.filter(x=>String(x)!==String(id))})));
  setConfirmed(false);
 }
 function updateColour(key,color){
  setGroups(old=>old.map(g=>{
   if(g.key===key)return {...g,color};
   if(g.color===color)return {...g,color:old.find(t=>t.key===key)?.color||g.color};
   return g;
  }));
  setAssignment({});
 }
 function assign(id,building){
  const g=teamFor(id);if(!g)return;
  if(!isEligible(id)){setCopyMessage('Only registered playing members may be placed in buildings.');return;}
  const currentTeamPlayers=groups.flatMap(g=>[g.leader,...g.members]).filter(Boolean).filter(x=>!absentIds.includes(String(x)));
  if(isSubstitute(id)&&currentTeamPlayers.filter(isSubstitute).length>Math.max(0,30-currentTeamPlayers.filter(isCombatant).length)){setCopyMessage('Combatants fill the opening roster. Remove excess substitutes before placing this player.');return;}
  const colour=COLORS.find(c=>c.id===g.color);
  if(!colour?.buildings.includes(building)){setCopyMessage('This building belongs to another colour team. Reassign the player’s team first.');return;}
  setAssignment(old=>{setUndoAssignment({id:String(id),before:old[String(id)]||null,after:building});return {...old,[String(id)]:building};});
  setPicked('');
  if(isSubstitute(id))setCopyMessage('Substitute '+name(byId.get(String(id))||{id})+' enters at 3:00+, not at the start.');
 }
 function autoAssign(){
  const next={};
  groups.forEach(g=>{
   const [first,second]=COLORS.find(c=>c.id===g.color).buildings;
   if(g.leader&&isEligible(g.leader))next[String(g.leader)]=first;
   const validMembers=g.members.filter(id=>isEligible(id)&&!absentIds.includes(String(id))&&(!isSubstitute(id)||activePlayers.filter(p=>isSubstitute(p.id)).length<=Math.max(0,30-activePlayers.filter(p=>isCombatant(p.id)).length)));
   validMembers.forEach((id,i)=>next[String(id)]=(i%2===0?first:second));
  });
  setAssignment(next);setCopyMessage('Assigned everyone to a building within their colour area.');
 }
 async function copy(text){try{await navigator.clipboard.writeText(text);setCopyMessage('Copied to clipboard.');}catch{setCopyMessage('Clipboard unavailable. Copy from the preview instead.');}}
 const assignmentText='INITIAL ASSIGNMENTS\n\n'+BUILDINGS.map(b=>'» '+b+': '+activePlayers.filter(({id})=>assignment[id]===b).map(({id})=>name(byId.get(id)||{id})+(isSubstitute(id)?' (3:00+)':'')).join(', ')).join('\n');
 const teamText=textOfTeams(groups.map(g=>({...g,leader:absentIds.includes(String(g.leader))?null:g.leader,members:g.members.filter(id=>!absentIds.includes(String(id)))})),byId,id=>isSubstitute(id)?'3:00+':'0:00');
 const fullBattlePlan='⚔️ TAL · '+legionLabel(selectedLegion)+' · '+matchTime+' UTC\n\n'+teamText+'\n\n'+assignmentText+'\n\nCombatants enter immediately. Assigned substitutes enter after 3 minutes.';
 const copyStale=!!copySource&&copySource!==teamText;
 function openTeamCopy(){if(!copyOpen&&!copyDraft){setCopyDraft(teamText);setCopySource(teamText)}setCopyOpen(v=>!v)}
 function regenerateCopy(){setCopyDraft(teamText);setCopySource(teamText);setCopyMessage('Preview updated from current teams.');}
 function addLatePlayer(){const id=String(lateId);const target=groups.find(g=>g.color===lateTarget);if(!id||!target||!byId.has(id))return;
  if(!isEligible(id)){setCopyMessage('Register this player for a playing role in TAL Registration first.');return;}
  const activeIds=groups.flatMap(g=>[g.leader,...g.members]).filter(Boolean).filter(x=>!absentIds.includes(String(x)));
  if(isSubstitute(id)&&activeIds.filter(isSubstitute).length>=Math.max(0,30-activeIds.filter(isCombatant).length)){setCopyMessage('No additional substitutes needed. Combatants take priority.');return;}
  if(allTeamIds.size>=50){setCopyMessage('The 50-player battle roster is full. Remove someone before adding a late arrival.');return;}
  if(allTeamIds.has(id)){setCopyMessage('This player already has a team. Move them manually.');return;}
  setChosen(old=>[...new Set([...old,id])]);setGroups(old=>old.map(g=>g.key===target.key?{...g,members:[...g.members,id]}:g));setLateId('');setLateSearch('');setCopyMessage('Player assigned to '+(COLORS.find(c=>c.id===lateTarget)?.name||'selected')+' team without reshuffling.');}
 function markAbsent(id){if(groups.some(g=>String(g.leader)===String(id))&&!window.confirm('This is a rally leader. Mark absent and arrange a replacement leader?'))return;
  setAbsentIds(old=>[...new Set([...old,String(id)])]);setAssignment(old=>{const n={...old};delete n[String(id)];return n;});}
 function removeFromBattle(id){if(groups.some(g=>String(g.leader)===String(id))&&!window.confirm('Remove this rally leader? Assign a replacement before copying teams.'))return;
  setGroups(old=>old.map(g=>({...g,leader:String(g.leader)===String(id)?null:g.leader,members:g.members.filter(m=>String(m)!==String(id))})));
  setChosen(old=>old.filter(x=>String(x)!==String(id)));setAbsentIds(old=>old.filter(x=>String(x)!==String(id)));setAssignment(old=>{const n={...old};delete n[String(id)];return n;});}
 return <section style={{padding:'8px 12px 26px',maxWidth:800,margin:'0 auto'}}>
  {!legions.length?<p style={{...panel,...small}}>No TAL legions yet. Assign players in Registration first.</p>:<>
   <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,margin:'2px 0 12px'}}>
    <div style={{minWidth:0}}><h2 style={{fontSize:20,letterSpacing:'-.3px',margin:0,lineHeight:1.2}}>Team preparation</h2><span style={{...small,fontSize:11}}>{legionLabel(selectedLegion)}</span></div>
    <span role="status" style={{fontSize:11,color:draftState.startsWith('Could not')?C.gold:C.icy,maxWidth:'45%',textAlign:'right',lineHeight:1.3}}>{draftState}</span>
   </div>
   <div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) minmax(0,1fr)',gap:8,marginBottom:12}}>
    <label style={{...small,fontSize:11}}>Match date<input type="date" aria-label="TAL match date" value={matchDate} onChange={e=>setMatchDate(e.target.value)} style={{...btn,display:'block',width:'100%',boxSizing:'border-box',marginTop:5,minWidth:0,fontSize:14,minHeight:44,padding:'7px 6px',colorScheme:'dark'}}/></label>
    <label style={{...small,fontSize:11}}>UTC time<select value={matchTime} onChange={e=>resetForMatch(selectedLegion?.id,e.target.value)} style={{...btn,display:'block',width:'100%',boxSizing:'border-box',marginTop:5,minWidth:0,fontSize:14,minHeight:44,padding:'7px 6px'}}>{(value?.times||DEFAULT_TIMES).map(t=><option key={t}>{t}</option>)}</select></label>
   </div>
   <section aria-label="Match availability" style={{...panel,padding:11,marginBottom:10}}>
    <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:8}}>
     {[{label:'Combatants available',count:combatantPool.length,note:'0:00 entry',color:'#83C7FF'},{label:'Substitutes available',count:substitutePool.length,note:'3:00+ entry',color:'#F6CB65'}].map(item=><div key={item.label} style={{background:C.section,borderRadius:10,padding:'10px 11px',minWidth:0}}>
      <span style={{...small,fontSize:11,color:item.color}}>{item.note}</span><div style={{fontSize:24,fontWeight:750,lineHeight:1.2,margin:'3px 0'}}>{item.count}</div><span style={{...small,fontSize:11}}>{item.label}</span>
     </div>)}
    </div>
    <div style={{display:'flex',justifyContent:'space-between',gap:8,marginTop:9,color:C.icy,fontSize:11}}><span>{selectedIds.length} selected</span><span>{absentIds.length} absent</span></div>
   </section>
   <section aria-label="Match participants and power" style={{...panel,padding:'12px 11px',marginBottom:10}}>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:10}}>
     <strong style={{fontSize:16}}>Players</strong><button type="button" style={{...btn,minHeight:40,padding:'7px 10px',fontSize:12}} onClick={()=>setShowBulk(v=>!v)}>{showBulk?'Close paste':'Batch paste'}</button>
    </div>
    <input aria-label="Search players" placeholder="Search name or Player ID" value={playerSearch} onChange={e=>setPlayerSearch(e.target.value)} style={{...btn,width:'100%',boxSizing:'border-box',fontSize:16,minHeight:44,marginBottom:9}}/>
    <div role="group" aria-label="Filter participants" style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:8}}>
     {[['all','All'],['combatant','Combatants'],['substitute','Substitutes'],['absent','Absent']].map(([key,label])=><button key={key} type="button" aria-pressed={roleFilter===key} style={{...btn,minHeight:39,padding:'7px 9px',fontSize:12,background:roleFilter===key?'#314B63':C.section,borderColor:roleFilter===key?C.gold:C.border,color:roleFilter===key?C.white:C.icy}} onClick={()=>setRoleFilter(key)}>{label}</button>)}
    </div>
    {showBulk&&<div style={{marginBottom:10}}><p style={{...small,fontSize:11}}>Paste Username, Troop power on separate lines.</p><textarea aria-label="Paste troop power" placeholder={'LOVE, 4250\nMaliD, 3880'} value={bulk} onChange={e=>setBulk(e.target.value)} rows={4} style={{...btn,width:'100%',boxSizing:'border-box',fontSize:16}}/><button type="button" style={{...btn,width:'100%',marginTop:6,minHeight:44}} onClick={saveBatch}>Apply power</button></div>}
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,marginBottom:3}}>
     <span style={{...small,fontSize:11}}>Match-specific troop power</span>
     <button type="button" style={{border:0,background:'transparent',color:C.icy,fontSize:11,textDecoration:'underline',padding:'8px 2px',minHeight:36,cursor:'pointer'}} onClick={chooseAll}>Reset selection</button>
    </div>
    {visibleRoster.filter(p=>roleFilter==='all'||roleFilter==='absent'&&absentIds.includes(String(p.id))||roleFilter==='combatant'&&isCombatant(p.id)&&!absentIds.includes(String(p.id))||roleFilter==='substitute'&&isSubstitute(p.id)&&!absentIds.includes(String(p.id))).map(p=>{
     const id=String(p.id),absent=absentIds.includes(id),available=availableForMatch(p)&&isEligible(id),checked=effectiveIds.includes(id);
     const role=isCombatant(id)?'Combatant · 0:00':isSubstitute(id)?'Substitute · 3:00+':isMatchmakingOnly(id)?'Matchmaking only':'Not registered';
     return <div key={id} style={{borderBottom:'1px solid '+C.border,padding:'10px 0',opacity:absent?.65:1}}>
      <div style={{display:'flex',gap:7,alignItems:'center',minWidth:0}}>
       <input type="checkbox" aria-label={'Select '+name(p)} checked={checked} disabled={!available||absent} onChange={()=>toggle(id)} style={{width:20,height:20,flex:'0 0 20px',accentColor:C.gold,margin:0}}/>
       <div style={{flex:'1 1 0',minWidth:0}}>
        <div style={{fontSize:14,fontWeight:650,lineHeight:1.25,overflowWrap:'anywhere'}}>{name(p)}{absent&&<span style={{color:C.gold,fontSize:11}}> · Absent</span>}</div>
        <div style={{fontSize:11,lineHeight:1.45,color:isCombatant(id)?'#83C7FF':isSubstitute(id)?'#F6CB65':C.icy,marginTop:3}}>{role}</div>
        <div style={{fontSize:11,lineHeight:1.4,color:C.icy}}>{available?'Available · '+matchTime+' UTC':availabilityFor(p).length?'Unavailable · '+matchTime+' UTC':'Availability unknown'}</div>
       </div>
       <input type="number" inputMode="numeric" min="0" aria-label={'Troop power for '+name(p)} value={powers[id]??''} onChange={e=>setPowers(old=>({...old,[id]:e.target.value}))} placeholder="Power" style={{...btn,flex:'0 0 72px',width:72,minWidth:0,minHeight:44,padding:'7px 5px',fontSize:14,boxSizing:'border-box',fontWeight:400}}/>
       <button type="button" aria-label={'Attendance options for '+name(p)} aria-expanded={attendanceMenu===id} onClick={()=>setAttendanceMenu(v=>v===id?'':id)} style={{border:'none',background:'transparent',color:C.icy,flex:'0 0 36px',width:36,height:44,fontSize:19,cursor:'pointer',padding:0}}>⋯</button>
      </div>
      {attendanceMenu===id&&<div style={{display:'flex',justifyContent:'flex-end',marginTop:6}}><button type="button" style={{...btn,minHeight:44,fontSize:12,color:absent?'#83C7FF':C.gold}} onClick={()=>{setAbsentIds(old=>absent?old.filter(x=>x!==id):[...new Set([...old,id])]);setAttendanceMenu('')}}>{absent?'Mark attending':'Mark absent for this match'}</button></div>}
     </div>;
    })}
    {!visibleRoster.filter(p=>roleFilter==='all'||roleFilter==='absent'&&absentIds.includes(String(p.id))||roleFilter==='combatant'&&isCombatant(p.id)&&!absentIds.includes(String(p.id))||roleFilter==='substitute'&&isSubstitute(p.id)&&!absentIds.includes(String(p.id))).length&&<p style={{...small,padding:'12px 0'}}>No players match this filter.</p>}
   </section>
   <section aria-label="Carry forward match power" style={{...panel,padding:11}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}><strong style={{fontSize:13}}>Troop power</strong><span style={{...small,fontSize:11}}>{Object.values(powers).filter(v=>valueNumber(v)!==null).length} recorded</span></div>
    <button type="button" style={{...btn,width:'100%',marginTop:9,minHeight:44,fontSize:12}} onClick={()=>{
     const prior=Object.entries(drafts||{}).filter(([key,d])=>key.startsWith(String(selectedLegion?.id)+':')&&key!==matchKey&&d?.powers&&Object.keys(d.powers).length).sort((a,b)=>String(b[1]?.updatedAt||'').localeCompare(String(a[1]?.updatedAt||'')))[0];
     if(!prior){setCopyMessage('No previous shared match with troop power was found.');return;}
     setPowers(old=>({...prior[1].powers,...old}));setCopyMessage('Previous match power copied. Existing values were kept.');
    }}>Use previous match's power</button>
    {copyMessage&&<p role="status" style={{...small,fontSize:11,color:C.gold,margin:'8px 0 0'}}>{copyMessage}</p>}
   </section>
  </>}
 </section>;
}