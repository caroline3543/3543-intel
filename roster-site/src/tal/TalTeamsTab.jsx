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
function textOfTeams(groups,playersById) {
 return groups.map(g=>{
  const leader=g.leader?name(playersById.get(String(g.leader))||{id:g.leader}):'Not assigned';
  const label=(COLORS.find(c=>c.id===g.color)?.name||'Team').toUpperCase();
  const joiners=g.members.map(id=>name(playersById.get(String(id))||{id}));
  return label+' LEADER: '+leader+'\n'+joiners.join(', ');
 }).join('\n\n');
}
const initialGroups=()=>COLORS.map((c,i)=>({key:i+1,color:c.id,leader:null,members:[]}));
const draftPrefix='caroline-3739-tal-teams-v1:';
export function TalTeamsTab({value,players=[],cooperationPairs=[],cooperationGroups=[],drafts={},onDraftChange,syncReady=false}){
 const legions=(value?.teams||[]).filter(t=>['GLR'].includes(String(t.host||'').toUpperCase()));
 const [legionId,setLegionId]=useState(()=>{
  try{return JSON.parse(window.localStorage.getItem('caroline-3739-last-tal-match')||'null')?.legion||legions[0]?.id||''}catch{return legions[0]?.id||''}
 });
 const selectedLegion=legions.find(t=>t.id===legionId)||legions[0];
 const [matchTime,setMatchTime]=useState(()=>{
  try{return JSON.parse(window.localStorage.getItem('caroline-3739-last-tal-match')||'null')?.time||'14:00'}catch{return '14:00'}
 });
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
 const [assignment,setAssignment]=useState({});
 const [picked,setPicked]=useState('');
 const [activeColour,setActiveColour]=useState('blue');
 const [dragId,setDragId]=useState('');
 const [hoverBuilding,setHoverBuilding]=useState('');
 const [undoAssignment,setUndoAssignment]=useState(null);
 const touchDrag=useRef(null);
 const armTouch=(e,id)=>{
  const touch=e.touches?.[0];if(!touch)return;
  const ref={id:String(id),startX:touch.clientX,startY:touch.clientY,active:false,timer:null};
  ref.timer=setTimeout(()=>{if(touchDrag.current===ref){ref.active=true;setDragId(String(id));}},350);
  touchDrag.current=ref;
 };
 const moveTouch=e=>{
  const ref=touchDrag.current,touch=e.touches?.[0];if(!ref||!touch)return;
  if(!ref.active&&Math.hypot(touch.clientX-ref.startX,touch.clientY-ref.startY)>12){clearTimeout(ref.timer);touchDrag.current=null;return;}
  if(ref.active){const el=document.elementFromPoint(touch.clientX,touch.clientY)?.closest('[data-tal-building]');setHoverBuilding(el?.dataset.talBuilding||'');}
 };
 const dropTouch=e=>{
  const ref=touchDrag.current;touchDrag.current=null;if(!ref)return;clearTimeout(ref.timer);
  if(ref.active){const touch=e.changedTouches?.[0];const el=touch&&document.elementFromPoint(touch.clientX,touch.clientY)?.closest('[data-tal-building]');const building=el?.dataset.talBuilding;
   setDragId('');setHoverBuilding('');
   if(building)assign(ref.id,building);
  }
 };
 const [preview,setPreview]=useState(false);
 const [copyMessage,setCopyMessage]=useState('');
 const [confirmed,setConfirmed]=useState(false);
 const [locked,setLocked]=useState([]);
 const [manual,setManual]=useState(true);
 const [coreLock,setCoreLock]=useState(false);
 const [coreSnapshot,setCoreSnapshot]=useState(null);
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
 const matchKey=String(selectedLegion?.id||'unknown')+':'+matchTime;
 const draftKey=draftPrefix+matchKey;
 useEffect(()=>{
  if(!selectedLegion||!matchTime)return;
  try{window.localStorage.setItem('caroline-3739-last-tal-match',JSON.stringify({legion:selectedLegion.id,time:matchTime}));}catch{}
 },[selectedLegion?.id,matchTime]);
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
 const pool=legionRoster.filter(availableForMatch);
 const visibleRoster=legionRoster.filter(p=>(!onlyAvailable||availableForMatch(p))&&(!playerSearch||[p.username,p.alias,p.fid].some(v=>String(v||'').toLowerCase().includes(playerSearch.trim().toLowerCase())))).sort((a,b)=>Number(availableForMatch(b))-Number(availableForMatch(a))||name(a).localeCompare(name(b),undefined,{sensitivity:'base'}));
  const battlePool=useMemo(()=>players.filter(p=>!p.blacklisted),[players]);
 const snapshot=useMemo(()=>({chosen,powers,groups,assignment,mode,leaderStrategy,confirmed,coreLock,coreSnapshot,absentIds,copyDraft,copySource}),[chosen,powers,groups,assignment,mode,leaderStrategy,confirmed,coreLock,coreSnapshot,absentIds,copyDraft,copySource]);
 const snapshotSignature=JSON.stringify(snapshot);
 function applyDraft(saved){
  setChosen(Array.isArray(saved?.chosen)?saved.chosen.map(String):[]);
  setPowers(saved?.powers&&typeof saved.powers==='object'?saved.powers:{});
  setGroups(Array.isArray(saved?.groups)&&saved.groups.length===4?saved.groups:initialGroups());
  setAssignment(saved?.assignment&&typeof saved.assignment==='object'?saved.assignment:{});
  setMode(saved?.mode==='stack'?'stack':'balanced');
  setLeaderStrategy(saved?.leaderStrategy==='manual'?'manual':'power');
  setConfirmed(!!saved?.confirmed);
  const hasValidCore=Array.isArray(saved?.groups)&&saved.groups.length===4&&saved.groups.every(g=>Boolean(g.leader))&&saved.groups.some(g=>g.members?.length>0);
  setCoreLock(!!saved?.coreLock&&hasValidCore);setCoreSnapshot(hasValidCore?saved?.coreSnapshot||null:null);setAbsentIds(Array.isArray(saved?.absentIds)?saved.absentIds:[]);
  setCopyDraft(typeof saved?.copyDraft==='string'?saved.copyDraft:'');setCopySource(typeof saved?.copySource==='string'?saved.copySource:'');
  lastSaved.current=JSON.stringify({chosen:Array.isArray(saved?.chosen)?saved.chosen.map(String):[],powers:saved?.powers&&typeof saved.powers==='object'?saved.powers:{},groups:Array.isArray(saved?.groups)&&saved.groups.length===4?saved.groups:initialGroups(),assignment:saved?.assignment&&typeof saved.assignment==='object'?saved.assignment:{},mode:saved?.mode==='stack'?'stack':'balanced',leaderStrategy:saved?.leaderStrategy==='manual'?'manual':'power',confirmed:!!saved?.confirmed,coreLock:!!saved?.coreLock&&hasValidCore,coreSnapshot:hasValidCore?saved?.coreSnapshot||null:null,absentIds:Array.isArray(saved?.absentIds)?saved.absentIds:[],copyDraft:typeof saved?.copyDraft==='string'?saved.copyDraft:'',copySource:typeof saved?.copySource==='string'?saved.copySource:''});
 }
 useEffect(()=>{
  let saved=null;
  try{const raw=window.localStorage.getItem(draftKey);if(raw)saved=JSON.parse(raw);}catch{}
  const source=remoteDraft||saved;
  autoSelectionPending.current=source?'':draftKey;
  applyDraft(source||{chosen:pool.map(p=>String(p.id))});
  remoteApplied.current=remoteDraft?.updatedAt||'';
  setDraftState(remoteDraft?'Shared draft restored':saved?'Device draft restored':'Available players selected for this time');
  setStep('teams');setPicked('');setEditingTeam(null);setGenerationError('');setDraftLoaded(draftKey);
 // A new legion/time is a distinct draft; avoid resetting for every cloud refresh.
 },[draftKey]);
 useEffect(()=>{
  // Only initialise a new draft when roster data arrives. Never overwrite saved edits.
  if(autoSelectionPending.current!==draftKey||draftLoaded!==draftKey||!pool.length)return;
  autoSelectionPending.current='';
  setChosen(pool.map(p=>String(p.id)));
 },[draftKey,draftLoaded,pool.map(p=>String(p.id)).join('|')]);
 useEffect(()=>{
  if(draftLoaded!==draftKey||!remoteDraft||remoteApplied.current===remoteDraft.updatedAt)return;
  remoteApplied.current=remoteDraft.updatedAt;
  const incoming=JSON.stringify({chosen:remoteDraft.chosen||[],powers:remoteDraft.powers||{},groups:remoteDraft.groups||initialGroups(),assignment:remoteDraft.assignment||{},mode:remoteDraft.mode==='stack'?'stack':'balanced',leaderStrategy:remoteDraft.leaderStrategy==='manual'?'manual':'power',confirmed:!!remoteDraft.confirmed,coreLock:!!remoteDraft.coreLock&&Array.isArray(remoteDraft.groups)&&remoteDraft.groups.length===4&&remoteDraft.groups.every(g=>!!g.leader)&&remoteDraft.groups.some(g=>g.members?.length>0),coreSnapshot:remoteDraft.coreSnapshot||null,absentIds:remoteDraft.absentIds||[],copyDraft:remoteDraft.copyDraft||'',copySource:remoteDraft.copySource||''});
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
  const selectedIds=[...new Set([...chosen,...groups.flatMap(g=>[g.leader,...g.members]).filter(Boolean)])].filter(id=>byId.has(String(id))&&battlePool.some(p=>String(p.id)===String(id)));
 const selectedPlayers=selectedIds.map(id=>byId.get(String(id))).filter(Boolean);
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
 const missing=selectedIds.filter(id=>!allAssigned.includes(String(id)));
 const activePlayers=groups.flatMap(g=>[g.leader,...g.members].filter(id=>id&&!absentIds.includes(String(id))).map(id=>({id:String(id),g})));
 const allTeamIds=new Set(groups.flatMap(g=>[g.leader,...g.members].filter(Boolean)).map(String));
 const assignedCount=activePlayers.filter(({id})=>assignment[id]).length;
 const teamFor=id=>groups.find(g=>String(g.leader)===String(id)||g.members.some(m=>String(m)===String(id)));
 function resetForMatch(nextLegion=legionId,nextTime=matchTime){setLegionId(nextLegion);setMatchTime(nextTime);setGenerationError('');setBulk('');setPicked('');setPlayerSearch('');setOnlyAvailable(false);setStep('teams');setLocked([]);setPreview(false);setEditingTeam(null);}
 function chooseAll(){if(coreLock)return;autoSelectionPending.current='';setChosen(pool.map(p=>String(p.id)));}
 function toggle(id){const key=String(id);if(coreLock||!pool.some(p=>String(p.id)===key))return;
  if(allTeamIds.has(key)){setCopyMessage('Remove this player from their team before deselecting.');return;}
  autoSelectionPending.current='';setChosen(old=>old.includes(key)?old.filter(x=>x!==key):[...old,key]);}
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
 function generate(){
  setGenerationError('');
  if(coreLock){setGenerationError('Unlock the core before regenerating teams.');return;}
  if(selectedPlayers.length<4){setGenerationError('Select at least four available players.');return;}
  const unknown=selectedPlayers.filter(p=>powerOf(p.id)===null);
  if(unknown.length){setGenerationError('Missing troop power for '+unknown.length+' player'+(unknown.length===1?'':'s')+': '+unknown.slice(0,3).map(name).join(', ')+(unknown.length>3?'…':'')+'. Enter power before generating.');return;}
  const sorted=[...selectedPlayers].sort((a,b)=>powerOf(b.id)-powerOf(a.id));
  const manualLeaders=groups.map(g=>String(g.leader||''));
  const usableManual=manualLeaders.every(Boolean)&&new Set(manualLeaders).size===4&&manualLeaders.every(id=>selectedIds.includes(id));
  if(leaderStrategy==='manual'&&!usableManual){setGenerationError('Assign four different selected leaders to the colour teams, or use Highest troop power.');return;}
  const leads=leaderStrategy==='manual'?manualLeaders:sorted.slice(0,4).map(p=>String(p.id));
  const used=new Set(leads);
  const joiners=sorted.filter(p=>!used.has(String(p.id)));
  const next=initialGroups().map((g,i)=>({...g,leader:leads[i]}));
  if(mode==='stack'){
   joiners.forEach((p,index)=>{
    const groupIndex=Math.min(3,Math.floor(index/(Math.ceil(joiners.length/4)||1)));
    next[groupIndex].members.push(String(p.id));
   });
  }else{
   const cap=Math.ceil(joiners.length/4);
   joiners.forEach(p=>{
    const eligible=next.filter(g=>g.members.length<cap);
    eligible.sort((a,b)=>[a.leader,...a.members].reduce((n,id)=>n+(powerOf(id)||0),0)-[b.leader,...b.members].reduce((n,id)=>n+(powerOf(id)||0),0));
    eligible[0]?.members.push(String(p.id));
   });
   // Minimise max deviation first. Within the 5% target, prefer cooperation
   // and shared language. Leaders remain fixed; each joiner appears only once.
   const objective=(gs)=>{
    const deviation=balanceInfo(gs).deviation;
    const affinity=preferenceScore(gs);
    return Math.max(0,deviation-5)*10000 + deviation*12 - affinity.links*28 - affinity.sharedLanguages*1.5;
   };
   let score=objective(next);
   for(let pass=0;pass<40;pass++){
    let best=null,bestScore=score;
    for(let a=0;a<4;a++)for(let b=a+1;b<4;b++){
     for(let ia=0;ia<next[a].members.length;ia++)for(let ib=0;ib<next[b].members.length;ib++){
      const trial=next.map(g=>({...g,members:[...g.members]}));
      [trial[a].members[ia],trial[b].members[ib]]=[trial[b].members[ib],trial[a].members[ia]];
      const value=objective(trial);
      if(value<bestScore-0.001){bestScore=value;best=trial;}
     }
    }
    if(!best)break;
    next=best;score=bestScore;
   }
  }
   if(groups.some(g=>g.leader||g.members.length)&&!window.confirm('Replace the current four team assignments? This preserves your participant selection and troop power, but replaces manual team and building allocations.'))return;
  setGroups(next);setAssignment({});setConfirmed(false);setStep('teams');
  const outcome=balanceInfo(next),affinity=preferenceScore(next);
  setCopyMessage('Generated '+joiners.length+' joiners around '+(leaderStrategy==='manual'?'your four chosen leaders':'the four strongest players')+'. Max deviation '+outcome.deviation.toFixed(1)+'%'+(outcome.deviation>5?' (5% target not achievable with this arrangement)':'')+' · '+affinity.links+' preferred cooperation pair(s) together.');
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
  if(coreLock){setCopyMessage('Unlock core teams before changing team colours.');return;}
  setGroups(old=>old.map(g=>{
   if(g.key===key)return {...g,color};
   if(g.color===color)return {...g,color:old.find(t=>t.key===key)?.color||g.color};
   return g;
  }));
  setAssignment({});
 }
 function assign(id,building){
  const g=teamFor(id);if(!g)return;
  const colour=COLORS.find(c=>c.id===g.color);
  if(!colour?.buildings.includes(building)){setCopyMessage('This building belongs to another colour team. Reassign the player’s team first.');return;}
  setAssignment(old=>{setUndoAssignment({id:String(id),before:old[String(id)]||null,after:building});return {...old,[String(id)]:building};});
  setPicked('');
 }
 function autoAssign(){
  if(coreLock){setCopyMessage('Core teams are locked. Adjust individual building assignments manually or unlock the core to auto-allocate.');return;}
  const next={};
  groups.forEach(g=>{
   const [first,second]=COLORS.find(c=>c.id===g.color).buildings;
   if(g.leader)next[String(g.leader)]=first;
   g.members.forEach((id,i)=>next[String(id)]=(i%2===0?first:second));
  });
  setAssignment(next);setCopyMessage('Assigned everyone to a building within their colour area.');
 }
 async function copy(text){try{await navigator.clipboard.writeText(text);setCopyMessage('Copied to clipboard.');}catch{setCopyMessage('Clipboard unavailable. Copy from the preview instead.');}}
 const assignmentText='INITIAL ASSIGNMENTS\n\n'+BUILDINGS.map(b=>'» '+b+': '+activePlayers.filter(({id})=>assignment[id]===b).map(({id})=>name(byId.get(id)||{id})).join(', ')).join('\n');
 const teamText=textOfTeams(groups.map(g=>({...g,leader:absentIds.includes(String(g.leader))?null:g.leader,members:g.members.filter(id=>!absentIds.includes(String(id)))})),byId);
 const copyStale=!!copySource&&copySource!==teamText;
 function openTeamCopy(){if(!copyOpen&&!copyDraft){setCopyDraft(teamText);setCopySource(teamText)}setCopyOpen(v=>!v)}
 function regenerateCopy(){setCopyDraft(teamText);setCopySource(teamText);setCopyMessage('Preview updated from current teams.');}
 function lockCore(){if(coreLock){if(!window.confirm('Unlock the core? Auto-generation can replace the published team plan.'))return;setCoreLock(false);return;}
  if(groups.some(g=>!g.leader)||missing.length>0||!allAssigned.length){setCopyMessage('Assign four leaders and every selected player before locking the core.');return;}
  setCoreSnapshot(groups.map(g=>({...g,members:[...g.members]})));setCoreLock(true);setCopyMessage('Core locked. Existing teams will not be automatically redistributed.');}
 function addLatePlayer(){const id=String(lateId);const target=groups.find(g=>g.color===lateTarget);if(!id||!target||!byId.has(id))return;
  if(allTeamIds.size>=50){setCopyMessage('The 50-player battle roster is full. Remove someone before adding a late arrival.');return;}
  if(allTeamIds.has(id)){setCopyMessage('This player already has a team. Move them manually.');return;}
  setChosen(old=>[...new Set([...old,id])]);setGroups(old=>old.map(g=>g.key===target.key?{...g,members:[...g.members,id]}:g));setLateId('');setLateSearch('');setCopyMessage('Player assigned to '+(COLORS.find(c=>c.id===lateTarget)?.name||'selected')+' team without reshuffling.');}
 function markAbsent(id){if(groups.some(g=>String(g.leader)===String(id))&&!window.confirm('This is a rally leader. Mark absent and arrange a replacement leader?'))return;
  setAbsentIds(old=>[...new Set([...old,String(id)])]);setAssignment(old=>{const n={...old};delete n[String(id)];return n;});}
 function removeFromBattle(id){if(groups.some(g=>String(g.leader)===String(id))&&!window.confirm('Remove this rally leader? Assign a replacement before copying teams.'))return;
  setGroups(old=>old.map(g=>({...g,leader:String(g.leader)===String(id)?null:g.leader,members:g.members.filter(m=>String(m)!==String(id))})));
  setChosen(old=>old.filter(x=>String(x)!==String(id)));setAbsentIds(old=>old.filter(x=>String(x)!==String(id)));setAssignment(old=>{const n={...old};delete n[String(id)];return n;});}
 return <section style={{padding:'14px 20px 35px'}}>
  <h2 style={{fontSize:25,letterSpacing:'-.4px',margin:'0 0 8px'}}>TAL Teams</h2>
  <p style={{...small,margin:'0 0 10px'}}>{coreLock?'Update live teams without reshuffling the core.':'Choose participants, generate teams, review, then lock your battle plan.'}</p>
  {!legions.length?<p style={{...panel,...small}}>No legions in your TAL plan. Assign players in TAL Planner first.</p>:<>
   <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
    <label style={small}>Legion<select value={selectedLegion?.id||''} onChange={e=>resetForMatch(e.target.value,matchTime)} style={{...btn,width:'100%',marginTop:5}}>{legions.map(t=><option value={t.id} key={t.id}>{legionLabel(t)}</option>)}</select></label>
    <label style={small}>Match time · UTC<select value={matchTime} onChange={e=>resetForMatch(legionId,e.target.value)} style={{...btn,width:'100%',marginTop:5}}>{(value?.times||DEFAULT_TIMES).map(t=><option key={t}>{t}</option>)}</select></label>
   </div>
   <div role="status" style={{fontSize:12,color:draftState.startsWith('Could not')?C.gold:'#B5C8D6',marginBottom:9}}>{draftState}</div>
   <div role="tablist" aria-label="TAL team planning phase" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
    <button role="tab" aria-selected={step==='teams'} style={{...btn,color:step==='teams'?C.gold:C.icy,borderColor:step==='teams'?C.gold:C.border}} onClick={()=>setStep('teams')}>1 · Colour teams</button>
    <button role="tab" aria-selected={step==='buildings'} style={{...btn,color:step==='buildings'?C.gold:C.icy,borderColor:step==='buildings'?C.gold:C.border}} onClick={()=>{setStep('buildings');setPicked('')}}>2 · Initial assignments</button>
   </div>
   {step==='teams'&&<>
    <section style={{background:'#183044',borderRadius:12,padding:12,marginBottom:12}}>
     <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}>
      <span><strong style={{fontSize:15}}>{coreLock?'Battle mode · Core locked':'1 · Prepare teams'}</strong><span style={{...small,display:'block',marginTop:4}}>{coreLock?'Your existing team allocations are protected. You can still make individual changes.':'Select participants, check power, then generate. Lock only when the teams are ready.'}</span></span>
      {coreLock&&<button style={{...btn,color:C.gold,flexShrink:0}} onClick={lockCore}>Unlock core</button>}
     </div>
    </section>
    {!coreLock&&<>
    <section style={{...panel,marginBottom:12}}>
     <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}><strong>Legion participants</strong><span style={small}>{selectedIds.length} selected · {pool.length} available · {legionRoster.length} total</span></div>
     <p style={{...small,margin:'6px 0 10px'}}>Only players available at {matchTime} UTC are selected by default. Others stay visible but greyed out. Use Add to battle for a last-minute override.</p>
     <input aria-label="Search legion participants" placeholder="Search name or Player ID" value={playerSearch} onChange={e=>setPlayerSearch(e.target.value)} style={{...btn,width:'100%',boxSizing:'border-box',fontSize:16,marginBottom:8}}/>
     <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:8}}>
      <label style={{...small,display:'flex',alignItems:'center',gap:7,cursor:'pointer'}}><input type="checkbox" checked={onlyAvailable} onChange={e=>setOnlyAvailable(e.target.checked)} style={{width:18,height:18,accentColor:C.gold}}/> Available only</label>
      <button style={{...btn,minHeight:38,padding:'7px 10px'}} disabled={coreLock} onClick={chooseAll}>Reset to available</button>
     </div>
     <div style={{maxHeight:260,overflowY:'auto',borderTop:'1px solid '+C.border,overscrollBehavior:'contain'}}>
      {visibleRoster.map(p=>{
       const available=availableForMatch(p),assigned=allTeamIds.has(String(p.id)),checked=selectedIds.includes(String(p.id));
       return <label key={p.id} style={{display:'flex',alignItems:'center',gap:9,minHeight:54,borderBottom:'1px solid '+C.border,opacity:available?1:0.46,cursor:available&&!coreLock&&!assigned?'pointer':'default'}}>
        <input type="checkbox" aria-label={'Select '+name(p)} checked={checked} disabled={!available||coreLock||assigned} onChange={()=>toggle(p.id)} style={{width:19,height:19,flexShrink:0,accentColor:C.gold}}/>
        <span style={{flex:1,minWidth:0}}>
         <span style={{fontSize:13,fontWeight:600,display:'block',overflowWrap:'anywhere'}}>{name(p)}</span>
         <span style={{...small,display:'block',marginTop:2}}>{available?'Available at '+matchTime+' UTC':availabilityFor(p).length?availabilityFor(p).join(' · ')+' UTC':'Availability unknown'}{!memberIds.has(String(p.id))?' · Considering':''}{assigned&&!available?' · Battle override':''}</span>
        </span>
        <span style={{...small,whiteSpace:'nowrap',fontVariantNumeric:'tabular-nums'}}>{powerFormat(powerOf(p.id))}</span>
       </label>})}
      {!visibleRoster.length&&<p role="status" style={{...small,padding:10}}>{legionRoster.length?'No matching players. Clear search or turn off Available only.':'No players in this legion yet. Add them in TAL Planner.'}</p>}
     </div>
    </section>
    <section style={{...panel,marginBottom:12}}>
     <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}><strong>Troop power</strong><button style={{...btn,minHeight:35}} onClick={()=>setShowBulk(v=>!v)}>{showBulk?'Close':'Batch paste'}</button></div>
     <p style={{...small,margin:'6px 0 10px'}}>Enter power individually or paste lines formatted as Username, Troop power. Preview values are not written to player profiles.</p>
     {showBulk&&<div style={{marginBottom:10}}><textarea aria-label="Paste troop power" placeholder={'Erth, 8997\nVanellope, 4717'} value={bulk} onChange={e=>setBulk(e.target.value)} rows={5} style={{...btn,width:'100%',boxSizing:'border-box',fontSize:16,resize:'vertical'}}/><button style={{...btn,width:'100%',marginTop:6,color:C.gold}} onClick={saveBatch}>Validate and apply</button></div>}
     <div style={{maxHeight:185,overflowY:'auto'}}>{selectedPlayers.map(p=><label key={p.id} style={{display:'flex',alignItems:'center',gap:8,marginBottom:6,fontSize:13}}><span style={{flex:1,minWidth:0,overflowWrap:'anywhere'}}>{name(p)}</span><input type="number" inputMode="numeric" min="0" aria-label={'Troop power for '+name(p)} value={powers[String(p.id)]??value?.records?.[p.id]?.troopPower??''} onChange={e=>setPowers(old=>({...old,[String(p.id)]:e.target.value}))} placeholder="Power" style={{...btn,width:105,minHeight:38,fontSize:16}}/></label>)}</div>
    </section>
    <section style={{...panel,marginBottom:12}}>
     <strong>2 · Generate teams</strong>
     <p style={{...small,margin:'6px 0 9px'}}>Choose leaders, then distribute everyone around them. Player profiles do not need the Rally Lead role.</p>
     <div role="group" aria-label="Choose leader method" style={{display:'grid',gap:7,marginBottom:9}}>
      <button type="button" aria-pressed={leaderStrategy==='power'} style={{...btn,textAlign:'left',color:leaderStrategy==='power'?C.gold:C.icy,borderColor:leaderStrategy==='power'?C.gold:C.border}} onClick={()=>{setLeaderStrategy('power');setGenerationError('')}}>✓ Highest troop power · default</button>
      <button type="button" aria-pressed={leaderStrategy==='manual'} style={{...btn,textAlign:'left',color:leaderStrategy==='manual'?C.gold:C.icy,borderColor:leaderStrategy==='manual'?C.gold:C.border}} onClick={()=>{setLeaderStrategy('manual');setGenerationError('')}}>Keep four manually assigned leaders</button>
     </div>
     {leaderStrategy==='manual'&&<p style={{...small,margin:'0 0 8px'}}>Assign one leader in each colour team below first. Auto-generate will keep those four leaders in place.</p>}
     <div style={{display:'flex',gap:8,marginTop:10}}>{[['stack','Power-stacked'],['balanced','Balanced']].map(([id,label])=><button key={id} style={{...btn,flex:1,borderColor:mode===id?C.gold:C.border,color:mode===id?C.gold:C.icy}} aria-pressed={mode===id} onClick={()=>setMode(id)}>{label}</button>)}</div>
     <button style={{...btn,width:'100%',marginTop:9,background:C.gold,color:C.bg}} onClick={generate}>Generate four teams · {selectedPlayers.length} selected</button>
     {generationError&&<p role="alert" style={{fontSize:13,color:C.gold,lineHeight:1.5,margin:'9px 0 0'}}>{generationError}</p>}
     
    </section>
    </>}
    <section aria-label="Compare four teams" style={{margin:'5px 0 12px'}}>
     <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,marginBottom:8}}><strong style={{fontSize:14}}>Team comparison</strong><span style={small}>{selectedIds.length} selected · {missing.length} unassigned</span></div>
     {!missing.length&&allAssigned.length>0&&<div style={{...small,marginBottom:7,color:balanceStats.deviation<=5?C.green:C.gold}}>Max deviation {balanceStats.deviation.toFixed(1)}% · Target ±5% · {compatibilityStats.links} preferred pair(s) together</div>}
     <div style={{display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:6}}>
      {groups.map(g=>{const colour=COLORS.find(c=>c.id===g.color);return <button type="button" key={g.key} onClick={()=>{setFocusedTeam(g.color);teamRefs.current[g.key]?.scrollIntoView({behavior:'smooth',block:'center'});}} style={{...btn,padding:'8px 2px',minWidth:0,minHeight:66,borderColor:focusedTeam===g.color?colour.color:C.border,background:'#162B3D'}}>
       <span style={{display:'block',fontSize:12,color:colour.color,marginBottom:4}}>{colour.name}</span>
       <strong style={{fontSize:14,fontVariantNumeric:'tabular-nums',color:C.white}}>{g.leader?powerFormat(teamPower(g)):'—'}</strong>
       <span style={{display:'block',fontSize:11,color:'#C4D2DD',marginTop:2}}>{[g.leader,...g.members].filter(Boolean).length} players</span>
      </button>})}
     </div>
    </section>
        <div style={{...small,marginBottom:9}}>{selectedIds.length} participants · {missing.length} not yet placed in a team</div>
    {groups.map((g,i)=>{
     const col=COLORS.find(c=>c.id===g.color),ids=[g.leader,...g.members].filter(Boolean),ps=ids.map(id=>byId.get(id)).filter(Boolean),other=groups.flatMap(t=>[t.leader,...t.members].filter(Boolean)).map(String);
     const isEmpty=!g.leader&&!g.members.length,editing=editingTeam===g.key;
     return <section ref={node=>{teamRefs.current[g.key]=node}} key={g.key} style={{background:isEmpty?'#17293A':'#192E41',borderRadius:12,padding:'12px 12px 10px',marginBottom:9,borderLeft:'3px solid '+col.color}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10}}>
       <div style={{minWidth:0,display:'flex',alignItems:'center',gap:9}}><span style={{width:10,height:10,borderRadius:'50%',background:col.color,flexShrink:0}}/><strong style={{color:isEmpty?col.color:C.white,fontSize:16}}>{col.name} Team</strong></div>
       <span style={{fontSize:13,fontVariantNumeric:'tabular-nums',fontWeight:600,color:ids.length?C.white:C.icy}}>{ids.length?powerFormat(teamPower(g))+' power':'0 players'}</span>
      </div>
      {isEmpty&&!editing?<div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,marginTop:9}}>
       <span style={{...small,fontSize:13}}>No leader assigned</span>
       <button type="button" style={{...btn,minHeight:44,color:C.gold,background:'transparent',borderColor:'#415365'}} onClick={()=>setEditingTeam(g.key)}>Assign leader</button>
      </div>:<>
       {!!ids.length&&<div style={{display:'flex',flexWrap:'wrap',gap:13,margin:'9px 0',fontSize:12,color:'#CAD7E0'}}>
        <span>{ids.length} players</span><span>FC8 {ps.filter(p=>fcNumber(p)===8).length}</span><span>Helios {ps.filter(helios).length}</span>{g.members.some(id=>norah(byId.get(String(id))))&&<span>Norah Skill 5 {g.members.filter(id=>norah(byId.get(String(id)))).length}</span>}
       </div>}
       {g.leader&&<div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,padding:'6px 0',fontSize:14}}>
        <span style={{minWidth:0,overflowWrap:'anywhere'}}><span aria-hidden="true" style={{color:C.gold,marginRight:7}}>♛</span><strong>{name(byId.get(String(g.leader))||{id:g.leader})}</strong>
        {(languageInfo(byId.get(String(g.leader))).length>0||norahInfo(byId.get(String(g.leader))))&&<span style={{...small,display:'block',marginLeft:22,marginTop:3}}>{[...languageInfo(byId.get(String(g.leader))),norahInfo(byId.get(String(g.leader)))].filter(Boolean).join(' · ')}</span>}
        </span><span style={{...small,fontVariantNumeric:'tabular-nums'}}>{powerFormat(powerOf(g.leader))}</span>
       </div>}
       {g.members.map(id=><div key={id} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 0',borderTop:'1px solid #304355'}}>
        <span style={{flex:1,minWidth:0}}>
         <span style={{fontSize:14,display:'block',overflowWrap:'anywhere'}}>{name(byId.get(String(id))||{id})}{absentIds.includes(String(id))?' · Absent':''}</span>
         {(languageInfo(byId.get(String(id))).length>0||norahInfo(byId.get(String(id))))&&<span style={{...small,display:'block',marginTop:3}}>{[...languageInfo(byId.get(String(id))),norahInfo(byId.get(String(id)))].filter(Boolean).join(' · ')}</span>}
        </span>
        <span style={{...small,fontVariantNumeric:'tabular-nums'}}>{powerFormat(powerOf(id))}</span>
        <button type="button" aria-label={'Mark '+name(byId.get(String(id))||{id})+' absent'} style={{...btn,padding:5,minHeight:38,fontSize:11}} onClick={()=>absentIds.includes(String(id))?setAbsentIds(old=>old.filter(x=>x!==String(id))):markAbsent(id)}>{absentIds.includes(String(id))?'Restore':'Absent'}</button>
        <select aria-label={'Move '+name(byId.get(String(id))||{id})+' to another team'} value={g.key} onChange={e=>moveMember(id,Number(e.target.value))} style={{...btn,width:82,padding:6,fontSize:12,minHeight:38}}>{groups.map(t=><option key={t.key} value={t.key}>{COLORS.find(c=>c.id===t.color)?.name}</option>)}</select>
        <button type="button" title="Remove from active team" aria-label={'Remove '+name(byId.get(String(id))||{id})+' from team'} style={{...btn,padding:6,minHeight:38,color:C.red}} onClick={()=>removeFromBattle(id)}>×</button>
       </div>)}
       <button type="button" aria-expanded={editing} style={{...btn,background:'transparent',border:0,color:C.gold,marginTop:8,padding:'8px 0',minHeight:44}} onClick={()=>setEditingTeam(editing?null:g.key)}>{editing?'Done editing':'Edit team'}</button>
      </>}
      {editing&&<div style={{borderTop:'1px solid #364B5E',paddingTop:10,display:'grid',gap:10}}>
       <label style={small}>Team colour
        <select aria-label={'Colour for team '+g.key} value={g.color} onChange={e=>updateColour(g.key,e.target.value)} style={{...btn,width:'100%',marginTop:5}}>{COLORS.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
       </label>
       <label style={small}>Rally leader
        <select value={g.leader||''} onChange={e=>{changeLeader(g.key,e.target.value);if(e.target.value)setEditingTeam(null)}} style={{...btn,width:'100%',marginTop:5}}>
         <option value="">Choose a leader</option>
         {selectedPlayers.filter(p=>String(p.id)===String(g.leader)||!other.includes(String(p.id))).map(p=><option key={p.id} value={p.id}>{name(p)} · {powerFormat(powerOf(p.id))}</option>)}
        </select>
       </label>
       <label style={small}>Add joiner
        <select value="" onChange={e=>{const id=e.target.value;if(!id)return;setGroups(old=>old.map(t=>t.key===g.key?{...t,members:[...t.members,id]}:t));}} style={{...btn,width:'100%',marginTop:5}}>
         <option value="">Choose player…</option>
         {selectedPlayers.filter(p=>!other.includes(String(p.id))).map(p=><option key={p.id} value={p.id}>{name(p)}</option>)}
        </select>
       </label>
      </div>}
     </section>;
    })}
    {coreLock&&<>
    <section style={{...panel,marginBottom:12}}>
     <strong>Add to battle · Last-minute players</strong>
     <p style={{...small,margin:'6px 0 10px'}}>Choose anyone from Members, even without recorded availability. Existing teams will not be regenerated.</p>
     <input aria-label="Find last-minute player" placeholder="Search name or Player ID" value={lateSearch} onChange={e=>{setLateSearch(e.target.value);setLateId('');}} style={{...btn,width:'100%',boxSizing:'border-box',fontSize:16,marginBottom:8}}/>
     <select aria-label="Select last-minute player" value={lateId} onChange={e=>setLateId(e.target.value)} style={{...btn,width:'100%',fontSize:14,marginBottom:8}}>
      <option value="">Choose unassigned player</option>
      {battlePool.filter(p=>!allTeamIds.has(String(p.id))&&(!lateSearch||[p.username,p.alias,p.fid].some(v=>String(v||'').toLowerCase().includes(lateSearch.toLowerCase())))).slice(0,80).map(p=><option key={p.id} value={p.id}>{name(p)}{languageInfo(p).length?' · '+languageInfo(p).join(', '):''}{norahInfo(p)?' · '+norahInfo(p):''}</option>)}
     </select>
     <div style={{display:'flex',alignItems:'center',gap:8}}>
      <select aria-label="Destination colour team" value={lateTarget} onChange={e=>setLateTarget(e.target.value)} style={{...btn,flex:1}}>{COLORS.map(c=><option key={c.id} value={c.id}>{c.name} Team</option>)}</select>
      <button style={{...btn,color:C.bg,background:lateId?C.gold:C.section}} disabled={!lateId} onClick={addLatePlayer}>Assign player</button>
     </div>
    </section>
    </>}

    {!coreLock&&<section style={{...panel,marginBottom:10}}>
     <strong style={{fontSize:14}}>3 · Finalise teams</strong>
     <p style={{...small,margin:'6px 0 10px'}}>{groups.some(g=>!g.leader)?'Four leaders are required.':missing.length?missing.length+' selected players still need a team.':'All selected players have a team. Review and lock when ready.'}</p>
     <button style={{...btn,width:'100%',background:C.gold,color:C.bg,marginBottom:8}} disabled={!allAssigned.length||missing.length>0||groups.some(g=>!g.leader)} onClick={()=>{setConfirmed(true);setStep('buildings')}}>Confirm teams · Assign buildings</button>
     <button style={{...btn,width:'100%',color:!allAssigned.length||missing.length||groups.some(g=>!g.leader)?C.icy:C.gold}} disabled={!allAssigned.length||missing.length>0||groups.some(g=>!g.leader)} onClick={lockCore}>Lock core teams · Enter battle mode</button>
    </section>}
   </>}
   {step==='buildings'&&<>
    <section style={{...panel,marginBottom:12}}>
     <div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'center'}}><strong>Initial assignments</strong><strong style={{color:assignedCount===activePlayers.length?C.green:C.gold}}>{assignedCount} / {activePlayers.length} assigned</strong></div>
     <p style={{...small,margin:'6px 0 10px'}}>Tap a player, then tap a building to assign them. Or press and hold to drag between buildings.</p>
     {undoAssignment&&<div role="status" style={{display:'flex',alignItems:'center',gap:8,background:C.section,borderRadius:8,padding:8,margin:'8px 0'}}>
      <span style={{...small,flex:1}}>{name(byId.get(undoAssignment.id)||{id:undoAssignment.id})} → {undoAssignment.after}</span>
      <button type="button" style={{...btn,minHeight:36,color:C.gold}} onClick={()=>{const u=undoAssignment;setAssignment(old=>{const n={...old};if(u.before)n[u.id]=u.before;else delete n[u.id];return n;});setUndoAssignment(null)}}>Undo</button>
     </div>}
     <div style={{display:'flex',gap:7}}><button style={{...btn,flex:1,color:C.gold}} onClick={autoAssign} disabled={!activePlayers.length||coreLock}>Auto-allocate</button><button style={{...btn,flex:1}} disabled={coreLock} onClick={()=>{if(window.confirm('Clear every building assignment?'))setAssignment({});}}>Clear buildings</button></div>
     {!!missing.length&&<p style={{...small,color:C.gold,marginBottom:0}}>There are {missing.length} players missing from the four teams. Return to Colour teams to place them first.</p>}
    </section>
    <div style={{display:'flex',overflowX:'auto',gap:7,marginBottom:12,paddingBottom:5}}>{COLORS.map(c=><button key={c.id} onClick={()=>{setActiveColour(c.id);setPicked('')}} style={{...btn,flex:'0 0 105px',borderColor:activeColour===c.id?c.color:C.border,background:activeColour===c.id?c.bg:C.section,color:activeColour===c.id?c.color:C.icy}}>{c.name} · {activePlayers.filter(p=>p.g.color===c.id).length}</button>)}</div>
    {(() => {
     const col=COLORS.find(c=>c.id===activeColour);
     const teamPlayers=activePlayers.filter(p=>p.g.color===activeColour);
     const unallocated=teamPlayers.filter(p=>!assignment[p.id]);
     const moveWithin=(id,building)=>{if(!id)return;assign(id,building);setDragId('');setCopyMessage(name(byId.get(String(id))||{id})+' assigned to '+building+'.');};
     return <section style={{...panel,background:col.bg,borderColor:col.color+'77',marginBottom:12}}>
      <strong style={{color:col.color}}>{col.name} Team · {teamPlayers.length} players</strong>
      {unallocated.length>0&&<div style={{marginTop:10}}><p style={{...small,color:col.color,margin:'0 0 7px'}}>Unallocated · {unallocated.length}</p>{unallocated.map(({id})=><button key={id} onTouchStart={e=>armTouch(e,id)} onTouchMove={moveTouch} onTouchEnd={dropTouch} onTouchCancel={()=>{clearTimeout(touchDrag.current?.timer);touchDrag.current=null;setDragId('');setHoverBuilding('')}} draggable="true" onDragStart={e=>{e.dataTransfer.setData('text/plain',id);setDragId(id)}} onDragEnd={()=>setDragId('')} onClick={()=>setPicked(id)} style={{...btn,width:'100%',textAlign:'left',marginBottom:5,borderColor:picked===id?col.color:C.border}}>⠿ {name(byId.get(id)||{id})}</button>)}</div>}
      <div style={{display:'grid',gap:10,marginTop:12}}>
       {col.buildings.map(building=>{
        const placed=teamPlayers.filter(p=>assignment[p.id]===building);
        return <div key={building} data-tal-building={building} onDragOver={e=>{e.preventDefault();setHoverBuilding(building)}} onDragLeave={()=>setHoverBuilding(v=>v===building?'':v)} onDrop={e=>{e.preventDefault();moveWithin(e.dataTransfer.getData('text/plain')||dragId,building);setHoverBuilding('')}} style={{background:hoverBuilding===building?col.color+'32':C.bg+'aa',border:'2px dashed '+(hoverBuilding===building?col.color:col.color+'99'),borderRadius:11,padding:10,minHeight:96,transition:'background .15s,border-color .15s'}}>
         <button onClick={()=>picked&&moveWithin(picked,building)} disabled={!picked} style={{...btn,width:'100%',textAlign:'left',border:0,background:'transparent',padding:'4px 0',minHeight:30,color:col.color}}><strong>{building}</strong> · {placed.length}{picked?' · Tap to place selected player':''}</button>
         {placed.length?placed.map(({id})=><button key={id} type="button" onTouchStart={e=>armTouch(e,id)} onTouchMove={moveTouch} onTouchEnd={dropTouch} onTouchCancel={()=>{clearTimeout(touchDrag.current?.timer);touchDrag.current=null;setDragId('');setHoverBuilding('')}} draggable="true" onDragStart={e=>{e.dataTransfer.setData('text/plain',id);setDragId(id)}} onDragEnd={()=>setDragId('')} onClick={()=>setPicked(picked===id?'':id)} style={{...btn,display:'flex',alignItems:'center',gap:8,width:'100%',marginTop:5,textAlign:'left',borderColor:picked===id?col.color:C.border}}><span aria-hidden>⠿</span><span style={{flex:1}}>{name(byId.get(id)||{id})}</span>{picked===id?'✓':''}</button>):<p style={small}>Drop a player here</p>}
        </div>;
       })}
      </div>
     </section>;
    })()}
    <section style={{...panel,marginBottom:12}}>
     <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><strong>Copy initial assignments</strong><span style={small}>{assignedCount===activePlayers.length&&missing.length===0?'Ready':'Allocate every player first'}</span></div>
     <pre style={{whiteSpace:'pre-wrap',fontFamily:'inherit',fontSize:13,lineHeight:1.7,overflowWrap:'anywhere',margin:'12px 0'}}>{assignmentText}</pre>
     <button style={{...btn,width:'100%',background:assignedCount===activePlayers.length&&missing.length===0?C.gold:C.section,color:assignedCount===activePlayers.length&&missing.length===0?C.bg:C.icy}} disabled={!activePlayers.length||assignedCount!==activePlayers.length||missing.length>0} onClick={()=>copy(assignmentText)}>Copy initial assignments</button>
    </section>
   </>}
    <section style={{...panel,marginTop:8}}>
     <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:8}}><strong style={{fontSize:14}}>Team instructions</strong><span style={small}>Complete current teams</span></div>
     <button type="button" style={{...btn,width:'100%',background:allAssigned.length?C.gold:C.section,color:allAssigned.length?C.bg:C.icy,marginBottom:8}} disabled={!allAssigned.length} onClick={()=>copy(teamText)}>Copy teams</button>
     <button type="button" aria-expanded={copyOpen} style={{...btn,width:'100%',textAlign:'left',color:C.gold}} onClick={openTeamCopy}>{copyOpen?'Hide editable preview':'Preview / Edit teams ▾'}</button>
     {copyOpen&&<div style={{marginTop:10}}>
      {copyStale&&<p role="status" style={{...small,color:C.gold}}>Team assignments have changed since the preview was generated. Refresh it to include the current complete teams.</p>}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:8}}>
       <strong style={{fontSize:14}}>Editable team message</strong>
       <button type="button" style={{...btn,color:C.gold}} onClick={regenerateCopy}>Regenerate from teams</button>
      </div>
      <textarea aria-label="Editable team copy" rows={10} value={copyDraft} onChange={e=>setCopyDraft(e.target.value)} style={{...btn,width:'100%',boxSizing:'border-box',fontSize:16,lineHeight:1.55,resize:'vertical'}}/>
      <button type="button" style={{...btn,width:'100%',marginTop:10,background:C.gold,color:C.bg}} onClick={()=>copy(copyDraft)} disabled={!copyDraft.trim()||copyStale}>Copy complete team list</button>
     </div>}
    </section>
      {copyMessage&&<div role="status" style={{...panel,color:C.gold,fontSize:12,marginTop:10,display:'flex',gap:10,justifyContent:'space-between'}}>{copyMessage}<button style={{...btn,minHeight:30,padding:'3px 7px'}} onClick={()=>setCopyMessage('')}>×</button></div>}
  </>}
 </section>;
}