import './legionRoster.css';
import {RosterScreenshotImport} from './RosterScreenshotImport.jsx';
import {BulkPlayerImport} from '../components/BulkPlayerImport.jsx';
import {foundryShareMessages,foundryMessageStats,FOUNDRY_DEFAULT_INSTRUCTIONS} from './foundryShare.js';
import {useMemo,useState,useRef,useEffect} from 'react';
import {PlayerAvatar} from '../../../src/components/players/PlayerAvatar.jsx';
import {playerSearchFields} from '../../../src/services/playerNames.js';
import {PlannerAttendance} from './PlannerAttendance.jsx';
import {EVENT_NAMES,EVENT_LIMITS,REGISTRATION_ROLES,isParticipant,legionMoveError,TEAM_NAMES,plannerAlliances,eventStart,recentNoShow,resizePlannerTeams,formatPlannerPower} from '../../../src/services/eventPlanner.js';
import {gameLanguageName,gameLanguageCode} from '../../../src/services/gameLanguageService.js';
const supportedLanguageCodes=new Set(['en','ko','zh-TW','zh-CN','tr','ar','ru','es','pl','uk','it','fr','ka','de','pt','ja']);
const languageOptions=['English','Korean','Traditional Chinese','Simplified Chinese','Turkish','Arabic','Russian','Spanish','Polish','Ukrainian','Italian','French','Georgian','German','Portuguese','Japanese'];
const languageAliases={kr:'ko',kor:'ko',eng:'en',tw:'zh-TW',cn:'zh-CN',ua:'uk',jp:'ja',geo:'ka'};
const resolveLanguage=value=>{const raw=String(value||'').trim();if(!raw)return null;const alias=languageAliases[raw.toLowerCase()];const names={'traditional chinese':'zh-TW','simplified chinese':'zh-CN',georgian:'ka'};return alias||names[raw.toLowerCase()]||gameLanguageCode(raw)};
const languageLabel=value=>gameLanguageName(value)||String(value||'');
const teamColors={Blue:'#397DB6',Yellow:'#D8A13C',Green:'#348D68',Pink:'#F05A9D',Purple:'#B28DEC',Teal:'#50B4BD'};
const standardBuildings={Blue:['Prototype Site I','Boiler Room'],Yellow:['Prototype Site II','Central Transit Station'],Green:['Repair Facility I','Repair Facility III'],Pink:['Repair Facility II','Repair Facility IV']};
const anchorBuildings=['Prototype Site I','Prototype Site II','Repair Facility I'];
// Prototype I and Boiler must have separate team anchors.
const anchorTeams=['Blue','Yellow','Green'];
const allBuildings=Object.values(standardBuildings).flat();
const style={background:'#142438',border:'1px solid #30465a',borderRadius:16,padding:12,marginBottom:10};
const btn={border:'1px solid #40546a',borderRadius:12,background:'#21354b',color:'#e9f2fa',padding:'9px 12px',minHeight:40,fontWeight:650,cursor:'pointer'};
const name=p=>p.username||p.alias||p.name||String(p.fid||p.id);
const power=(p,kind)=>kind==='foundry'
 ?p.lastFoundryTroopPower??p.troopPower??p.lastTroopPower
 :p.lastCanyonClashTroopPower??p.lastCanyonTroopPower;
const alliance=p=>String(p.alliance||p.homeAlliance||p.allianceTag||p.alliance_name||'Unassigned').trim()||'Unassigned';
const rank=p=>{const r=String(p.allianceRank??p.rank??p.alliance_rank??'').toUpperCase();return /^R[1-5]$/.test(r)?r:'Unranked'};

const T10=[66,71,76,83,88,94,99,104,110,115,121],T11=[80,86,92,100,106,114,120,126,135,141,148];
const tierValue=raw=>{const x=String(raw||'').trim().toUpperCase();if(!x)return null;const fc=Number(x.match(/FC\s*(\d+)/)?.[1]||0);if(/T12|EXALTED/.test(x))return 96;if(/HELIOS|T11/.test(x))return T11[Math.min(fc,10)]??null;if(/FC\s*\d+|T10/.test(x))return T10[Math.min(fc,10)]??null;return ({7:28,8:38,9:50})[Number(x.match(/T\s*(\d+)/)?.[1]||0)]??null;};
const tierScore=p=>{const scores=['infantry','lancer','marksman'].map(k=>tierValue(p.troops?.[k]));return scores.every(x=>x!==null)?Math.round(scores.reduce((a,b)=>a+b,0)/3*10)/10:null;};
function NoShow(){return <small style={{display:'flex',alignItems:'center',gap:4,color:'#f0b1b8'}}>
 <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21 4 13a5 5 0 0 1 7-7l1 1 1-1a5 5 0 0 1 7 7l-8 8ZM12 7l-2 5h4l-2 5"/></svg>
 Recent no-show</small>;}

function InlinePower({player,onSave,metric,onClose}){
 const [value,setValue]=useState(String(player.power??''));
 const [focused,setFocused]=useState(false);
 const [error,setError]=useState(false);
 const cancel=useRef(false);
 const latest=player.hasPower?String(player.power):'';
 const commit=()=>{
   setFocused(false);
   if(cancel.current){cancel.current=false;setError(false);onClose();return;}
   const raw=value.replace(/,/g,'').trim();
   if(!raw){onClose();return;}
   const number=Number(raw);
   if(!Number.isSafeInteger(number)||number<0){setError(true);return;}
   setError(false);
   if(!player.hasPower||number!==player.power)onSave(player.id,number);
   onClose();
 };
 return <div style={{width:112,maxWidth:"100%"}}>
  <input autoFocus id={'foundry-power-'+player.id} aria-label={metric+' for '+player.name} inputMode="numeric" type="text" value={focused?value:latest} onFocus={()=>{setValue(latest);setFocused(true)}} onChange={e=>{setValue(e.target.value);setError(false)}} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();if(e.key==='Escape'){cancel.current=true;setValue(latest);e.currentTarget.blur()}}} style={{width:'100%',boxSizing:'border-box',height:32,minHeight:32,padding:'4px 6px',fontSize:13,fontWeight:600,textAlign:'center',fontVariantNumeric:'tabular-nums',color:'#eef5fc',background:'#20344a',border:'1px solid '+(error?'#f1a9a9':'#496077'),borderRadius:999}} placeholder="0"/>
  {error&&<span role="alert" style={{fontSize:10,color:'#f1a9a9'}}>Whole number only</span>}
 </div>;
}
export function FoundryTab({players=[],attendancePlayers=players,kind='foundry',chosen,legion,changeSelection,sharedFoundry={},
  otherPlan,otherLegion,onMoveLegion,onSaveScreenshotPowers,onSaveFoundry,onSaveTroopPower,onAttendance,onNewEvent,teamworkPreferences={},onSaveTeamworkPreferences,onUpdatePlayerLanguage,onOpenPlayerProfile}){
 const title=EVENT_NAMES[kind],isFoundry=kind==='foundry',metric=isFoundry?'Troop power':'Canyon Clash power';
 const limits=EVENT_LIMITS[kind];
 const colours=TEAM_NAMES.slice(0,sharedFoundry.teamCount||4);
 const buildings={...standardBuildings, Purple:allBuildings,Teal:allBuildings,
  ...(colours.length===3?{Green:[...standardBuildings.Green,...standardBuildings.Pink]}:{})};
 const format=n=>formatPlannerPower(n,kind);
 const saved=sharedFoundry||{};
 const [view,setView]=useState('players'),[query,setQuery]=useState('');
 const [paste,setPaste]=useState(''),[showPaste,setShowPaste]=useState(false),[notice,setNotice]=useState(''),[selected,setSelected]=useState(null);
 const [showScreenshot,setShowScreenshot]=useState(false);
 const [undo,setUndo]=useState(null);
 const teamRefs=useRef({});
 const jumpToTeam=c=>{setFocusTeam(c);teamRefs.current[c]?.scrollIntoView({behavior:'smooth',block:'start'});};
 const [focusTeam,setFocusTeam]=useState('Blue'),[moving,setMoving]=useState(null),[confirmGenerate,setConfirmGenerate]=useState(false);
 const [addRole,setAddRole]=useState('join');
 const [managing,setManaging]=useState(null);
 const [participantsOnly,setParticipantsOnly]=useState(false),[rosterSearch,setRosterSearch]=useState('');
 const [rosterSort,setRosterSort]=useState('rank'),[editingPower,setEditingPower]=useState(null),[confirmMove,setConfirmMove]=useState(null);
 const [roleFilter,setRoleFilter]=useState('all'),[bulkMode,setBulkMode]=useState(false),[bulkSelected,setBulkSelected]=useState([]),[rankExpanded,setRankExpanded]=useState({R5:true,R4:true,R3:true,R2:true,R1:true});
 const [editIds,setEditIds]=useState(null);
 const [bulkAction,setBulkAction]=useState(''),[bulkLanguage,setBulkLanguage]=useState(''),[bulkRelationshipMode,setBulkRelationshipMode]=useState('add'),[teammateQuery,setTeammateQuery]=useState(''),[teammateIds,setTeammateIds]=useState([]);
 const [expanded,setExpanded]=useState({});
 const [teamMessage,setTeamMessage]=useState(null),[teamMessageOpen,setTeamMessageOpen]=useState(false);
 const [teamNames,setTeamNames]=useState(()=>saved.teamNames||{});
 const [instructions,setInstructions]=useState(()=>saved.shareInstructions||FOUNDRY_DEFAULT_INSTRUCTIONS);
 const [dragging,setDragging]=useState(null);
 const touchDrag=useRef(null);
 const finishTouchDrag=e=>{const source=touchDrag.current;touchDrag.current=null;if(!source)return;const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-foundry-building]');const destination=target?.getAttribute('data-foundry-building');if(destination&&destination!==source.building)move(source.id,destination);setDragging(null);};
 useEffect(()=>setTeamNames(saved.teamNames||{}),[saved.teamNames]);
 useEffect(()=>setInstructions(saved.shareInstructions||FOUNDRY_DEFAULT_INSTRUCTIONS),[saved.shareInstructions]);
 const avatarFor=p=>players.find(x=>String(x.id??x.fid??name(x))===p.id)||{username:p.name};
 const entries=useMemo(()=>{
  const map=new Map(players.map(p=>{const id=String(p.id??p.fid??name(p));const reading=saved.powerByPlayer?.[id]??power(p,kind);return [id,{id,name:name(p),power:Number(reading)||0,hasPower:reading!=null&&reading!==''&&Number.isFinite(Number(reading)),rank:rank(p),alliance:alliance(p),matched:true,tierScore:tierScore(p),furnaceLevel:p.furnaceLevel??p.furnace??p.furnace_level??null,cityPower:p.cityPower??p.powerLevel??p.power??null,language:String(p.gameLanguage||p.language||p.languages?.[0]||'').trim(),searchFields:[...playerSearchFields(p),p.id,p.nickname].filter(Boolean).map(String),recentNoShow:recentNoShow(p.plannerAttendance,eventStart(saved.date,saved.time))}]}));
  for(const p of saved.imports||[]){const current=map.get(p.id);map.set(p.id,current?{...current,power:saved.powerByPlayer?.[p.id]??p.power??current.power,hasPower:(saved.powerByPlayer?.[p.id]??p.power)!=null||current.hasPower}:{...p,hasPower:p.power!=null,alliance:p.alliance||'Unassigned',matched:false});}
  return [...map.values()].sort((a,b)=>b.power-a.power||a.name.localeCompare(b.name));
 },[players,kind,saved.imports,saved.powerByPlayer,saved.date,saved.time]);
 const alliances=plannerAlliances([...entries.map(p=>p.alliance),chosen]);
 const registrations=saved.registrations||{},teams=saved.teams||{},assignments=saved.assignments||{},registeredUnder=saved.registeredUnder||{};
 const joined=entries.filter(p=>registrations[p.id]==='join'&&registeredUnder[p.id]===chosen),subs=entries.filter(p=>registrations[p.id]==='sub'&&registeredUnder[p.id]===chosen);
 const otherRole=id=>otherPlan.registeredUnder[id]===chosen&&isParticipant(otherPlan.registrations[id])?otherPlan.registrations[id]:'';
 const activeRole=id=>registeredUnder[id]===chosen?registrations[id]||'':'';
 const active=joined.filter(p=>teams[p.id]&&colours.includes(teams[p.id]));
 const teammateNames=p=>{const prefs=teamworkPreferences||{};const related=new Set();for(const pair of prefs.pairs||[]){if(!Array.isArray(pair)||pair.length<2)continue;const ids=pair.map(String);if(ids.includes(p.id))ids.filter(id=>id!==p.id).forEach(id=>related.add(id));}for(const group of prefs.groups||[]){const ids=(group.memberIds||[]).map(String);if(ids.includes(p.id))ids.filter(id=>id!==p.id).forEach(id=>related.add(id));}return active.filter(other=>other.id!==p.id&&teams[other.id]===teams[p.id]&&related.has(other.id)).map(other=>other.name);};

 const validAssignments=isFoundry?Object.fromEntries(active.map(p=>[p.id,buildings[teams[p.id]].includes(assignments[p.id])?assignments[p.id]:buildings[teams[p.id]][0]])):{};
 const update=(patch,msg,powers)=>{setUndo(saved);onSaveFoundry?.({...saved,...patch},powers);setNotice(msg||'Updated · syncing across devices');};
 const setStatus=(id,status)=>{const current=registeredUnder[id]===chosen?registrations[id]:'';const next=status===current?'':status;
  if(isParticipant(next)&&otherRole(id)){setNotice('Already assigned to Legion '+otherLegion+'. Open the player’s role to move them.');return}
  if(next==='join'&&joined.length>=limits.join){setNotice(limits.join+' combatant slots are full');return}
  if(next==='sub'&&subs.length>=limits.sub){setNotice(limits.sub+' substitute slots are full');return}
  if(registrations[id]&&registeredUnder[id]!==chosen){setNotice('Already registered under '+registeredUnder[id]+'. Remove that registration before moving.');return}
  const nextRegs={...registrations,[id]:next},nextUnder={...registeredUnder,[id]:chosen},nextTeams={...teams},nextAssignments={...assignments};
  if(next!=='join'){delete nextTeams[id];delete nextAssignments[id]}
  update({registrations:nextRegs,registeredUnder:nextUnder,teams:nextTeams,assignments:nextAssignments},'Registration updated');
 };
 const autoTeams=(mode='all')=>{
  setConfirmGenerate(false);
  const next=mode==='add'?{...teams}:{},alloc=mode==='add'?{...validAssignments}:{};
  const totals=Object.fromEntries(colours.map(c=>[c,0])),members=Object.fromEntries(colours.map(c=>[c,[]]));
  const attending=[...joined].sort((a,b)=>b.power-a.power||a.name.localeCompare(b.name));
  const prefs=teamworkPreferences||{},pairs=Array.isArray(prefs.pairs)?prefs.pairs:[],groups=Array.isArray(prefs.groups)?prefs.groups:[];
  const affinity=(a,b)=>{
   const linked=pairs.some(pair=>Array.isArray(pair)&&pair.map(String).includes(a.id)&&pair.map(String).includes(b.id))||groups.some(g=>Array.isArray(g.memberIds)&&g.memberIds.map(String).includes(a.id)&&g.memberIds.map(String).includes(b.id));
   return (linked?2:0)+(a.language&&a.language.toLowerCase()===b.language?.toLowerCase()?1:0);
  };
  const put=(p,c)=>{next[p.id]=c;totals[c]+=p.power;members[c].push(p)};
  if(mode==='add')attending.forEach(p=>{if(colours.includes(next[p.id]))put(p,next[p.id])});
  const ranked=attending.filter(p=>p.power>0);
  const anchors=ranked.slice(0,3);
  if(mode==='all'&&isFoundry){
   anchors.forEach((p,i)=>{const building=anchorBuildings[i];const c=anchorTeams[i];put(p,c);alloc[p.id]=building});
  }
  attending.filter(p=>!next[p.id]).forEach(p=>{
   const available=colours.filter(c=>members[c].length<Math.ceil(attending.length/colours.length));
   const choices=available.length?available:colours;
   const minimum=Math.min(...choices.map(c=>totals[c]));
   const viable=choices.filter(c=>totals[c]<=minimum+Math.max(1,minimum*.05));
   const c=viable.sort((x,y)=>members[y].reduce((n,q)=>n+affinity(p,q),0)-members[x].reduce((n,q)=>n+affinity(p,q),0)||totals[x]-totals[y]||colours.indexOf(x)-colours.indexOf(y))[0];
   put(p,c);
  });
  if(isFoundry)colours.forEach(c=>{
   const bins=buildings[c].map(()=>0);members[c].forEach(p=>{const i=buildings[c].indexOf(alloc[p.id]);if(i>=0)bins[i]+=p.power});
   members[c].filter(p=>!alloc[p.id]).sort((a,b)=>b.power-a.power).forEach(p=>{const i=bins.indexOf(Math.min(...bins));alloc[p.id]=buildings[c][i];bins[i]+=p.power});
  });
  update({teams:next,assignments:alloc},mode==='all'?'Teams regenerated':'Unassigned players added without changing existing assignments');
 };
 const norm=v=>String(v||'').normalize('NFKC').trim().replace(/\\s+/g,' ').toLocaleLowerCase();
 const plain=v=>norm(v).normalize('NFKD').replace(/[\\u0300-\\u036f]/g,'').replace(/[^\\p{L}\\p{N}]/gu,'');
 const fields=p=>[p.name,...(p.searchFields||[]),p.id].filter(v=>String(v||'').trim());
 const searchMatches=query.trim()?entries.filter(p=>p.matched&&fields(p).some(v=>norm(v).includes(norm(query))||(plain(query).length>=3&&plain(v).length>=3&&plain(v).includes(plain(query))))).slice(0,8):[];
 const pastedList=value=>/\\r|\\n/.test(value)||value.split(/\\s*[,;]\\s*/).filter(Boolean).length>=3;
 const onSearchInput=value=>{if(pastedList(value)){setPaste(value.replace(/\\s*;\\s*/g,'\\n'));setShowPaste(true);setQuery('');setNotice('Multiple players detected. Review the pasted list below.')}else setQuery(value)};
 const matchesRoster=p=>!rosterSearch.trim()||fields(p).some(field=>norm(field).includes(norm(rosterSearch)));
 const roster=entries.filter(p=>activeRole(p.id)||otherRole(p.id)||p.alliance===chosen);
 const sortedRoster=roster.filter(p=>matchesRoster(p)&&(
   roleFilter!=='all'?activeRole(p.id)===roleFilter:
   !participantsOnly||isParticipant(activeRole(p.id))
 )).sort((a,b)=>rosterSort==='name'?a.name.localeCompare(b.name):
   Number(b.hasPower)-Number(a.hasPower)||b.power-a.power||a.name.localeCompare(b.name));
 const filteredRegistrations=sortedRoster.filter(p=>activeRole(p.id));
 const groupedRanks=['R5','R4','R3','R2','R1','Unranked'];
 const bulkUpdate=(role)=>{
  const ids=bulkSelected.filter(id=>filteredRegistrations.some(p=>p.id===id));
  if(isParticipant(role)&&ids.some(otherRole)){setNotice('Move players assigned to the other legion individually.');return}
  const nextRegs={...registrations},nextTeams={...teams},nextAssignments={...assignments};
  for(const id of ids){
   nextRegs[id]=role;
   if(role!=='join'){delete nextTeams[id];delete nextAssignments[id]}
  }
  if(Object.values(nextRegs).filter(value=>value===role).length>(limits[role]??Infinity)){
   setNotice('Not enough registration slots for this change');return;
  }
  update({registrations:nextRegs,teams:nextTeams,assignments:nextAssignments},ids.length+' registration roles updated');
  setBulkSelected([]);setBulkMode(false);
 };
 const selectedIds=()=>editIds||bulkSelected.filter(id=>filteredRegistrations.some(p=>p.id===id));
 const closeEditor=()=>{setBulkAction('');setEditIds(null);setTeammateQuery('');setTeammateIds([])};
 const openEditor=(kind,ids)=>{setEditIds(ids);setBulkAction(kind);setBulkLanguage('');setTeammateQuery('');setTeammateIds([]);setBulkRelationshipMode(ids.length>1?'each':'others')};
 const applyBulkLanguage=()=>{const ids=selectedIds(),code=resolveLanguage(bulkLanguage);if(!code||!supportedLanguageCodes.has(code)){setNotice('Choose a recognised, specific language');return;}onUpdatePlayerLanguage?.(ids,code);setNotice('Language updated for '+ids.length+' players');closeEditor();setBulkSelected([]);setBulkMode(false)};
 const applyBulkRelationships=()=>{const ids=selectedIds();if(!ids.length)return;const existing=Array.isArray(teamworkPreferences.pairs)?teamworkPreferences.pairs:[];const key=p=>Array.isArray(p)?p.map(String).sort().join('|'):'';const additions=[];if(bulkRelationshipMode==='each'){for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++)additions.push([ids[i],ids[j]])}else{for(const id of ids)for(const teammate of teammateIds)if(id!==teammate)additions.push([id,teammate])}if(!additions.length){setNotice('Choose at least one teammate');return}const keys=new Set(existing.map(key));const pairs=[...existing];for(const pair of additions){if(!keys.has(key(pair))){pairs.push(pair);keys.add(key(pair))}}onSaveTeamworkPreferences?.({...teamworkPreferences,pairs});setNotice('Teammate preferences updated');closeEditor();setBulkSelected([]);setBulkMode(false)};
 const removeTeammate=(a,b)=>{const pairs=(teamworkPreferences.pairs||[]).filter(pair=>!Array.isArray(pair)||!(pair.map(String).includes(String(a))&&pair.map(String).includes(String(b))));const groups=[];const pairKeys=new Set(pairs.map(pair=>pair.map(String).sort().join('|')));for(const group of teamworkPreferences.groups||[]){const ids=(group.memberIds||[]).map(String);if(!ids.includes(String(a))||!ids.includes(String(b))){groups.push(group);continue}for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){const pair=[ids[i],ids[j]],key=pair.slice().sort().join('|');if(key!==[String(a),String(b)].sort().join('|')&&!pairKeys.has(key)){pairs.push(pair);pairKeys.add(key)}}}onSaveTeamworkPreferences?.({...teamworkPreferences,pairs,groups})};
 const relatedTo=id=>[...new Set((teamworkPreferences.pairs||[]).filter(pair=>Array.isArray(pair)&&pair.map(String).includes(String(id))).flatMap(pair=>pair.map(String).filter(other=>other!==String(id))))];
 const teammateMatches=teammateQuery.trim()?entries.filter(p=>p.matched&&!selectedIds().includes(p.id)&&!teammateIds.includes(p.id)&&fields(p).some(field=>norm(field).includes(norm(teammateQuery)))).sort((a,b)=>{const score=p=>p.id===teammateQuery.trim()?0:norm(p.name)===norm(teammateQuery)?1:fields(p).some(v=>norm(v).startsWith(norm(teammateQuery)))?2:3;return score(a)-score(b)||a.name.localeCompare(b.name)}).slice(0,6):[];
 const bulkRemove=()=>{const ids=bulkSelected.filter(id=>filteredRegistrations.some(p=>p.id===id));const nextRegs={...registrations},nextTeams={...teams},nextAssignments={...assignments};ids.forEach(id=>{delete nextRegs[id];delete nextTeams[id];delete nextAssignments[id]});update({registrations:nextRegs,teams:nextTeams,assignments:nextAssignments},ids.length+' removed from registration');setBulkSelected([]);setBulkMode(false)};
 const add=(id,role=addRole)=>{
  const p=entries.find(x=>x.id===id);
  if(!p||!p.matched){setNotice('Select a matched player profile');return}
  if(registrations[id]&&registeredUnder[id]!==chosen){setNotice('Already registered under '+registeredUnder[id]);return}
  if(registrations[id]===role&&registeredUnder[id]===chosen){setNotice(p.name+' is already registered');return}
  if(otherRole(id)){
   setRoleFilter('all');setParticipantsOnly(false);setRosterSearch(p.name);setManaging(id);setQuery('');
   return;
  }
  setStatus(id,role);setQuery('');
 };
 const confirmBulkImport=rows=>{
  const ids=new Set(),nextRegs={...registrations},nextUnder={...registeredUnder};
  const nextTeams={...teams},nextAssignments={...assignments},imports=[...(saved.imports||[])];
  let joins=joined.length,substitutes=subs.length,added=0,already=0;
  for(const row of rows){
   const id=String(row.id),p=entries.find(x=>x.id===id&&x.matched);
   if(!p)return {error:'A selected player is no longer in the roster. Review the import.'};
   if(ids.has(id))return {error:'Duplicate Player ID. Review the import.'};ids.add(id);
   if(isParticipant(addRole)&&otherRole(id))return {error:p.name+' is assigned to Legion '+otherLegion+'. Move them from the roster first.'};
   const current=nextRegs[id],under=nextUnder[id];
   if(current&&under!==chosen)return {error:p.name+' is registered under '+under+'. Review before importing.'};
   if(current===addRole&&under===chosen){already++;}
   else {
    if(current==='join')joins--;if(current==='sub')substitutes--;
    if(addRole==='join')joins++;else if(addRole==='sub')substitutes++;
    if(joins>limits.join||substitutes>limits.sub)return {error:'Not enough '+(addRole==='join'?'combatant':'substitute')+' slots. Adjust registration before importing.'};
    nextRegs[id]=addRole;nextUnder[id]=chosen;
    if(addRole!=='join'){delete nextTeams[id];delete nextAssignments[id]}
    added++;
   }
   if(row.power!==null){
    if(!Number.isSafeInteger(row.power)||row.power<0)return {error:'Invalid troop power for '+p.name};
    const record={id,name:p.name,power:row.power,rank:p.rank,alliance:p.alliance,matched:true};
    const index=imports.findIndex(x=>x.id===id);if(index>=0)imports[index]=record;else imports.push(record);
   }
  }
  update({imports,registrations:nextRegs,registeredUnder:nextUnder,teams:nextTeams,assignments:nextAssignments},added+' registered · '+already+' already registered',rows.filter(row=>row.power!==null).map(row=>({id:String(row.id),value:row.power})));
  return {message:added+' registered · '+already+' already registered'};
 };
 const assign=(id,colour)=>{const nextTeams={...teams,[id]:colour};const nextAlloc={...assignments};if(isFoundry&&!buildings[colour].includes(nextAlloc[id]))nextAlloc[id]=buildings[colour][0];update({teams:nextTeams,assignments:nextAlloc},'Team updated')};
 const move=(id,building)=>{const colour=buildings[focusTeam]?.includes(building)?focusTeam:colours.find(c=>buildings[c].includes(building));if(!colour)return;update({teams:{...teams,[id]:colour},assignments:{...assignments,[id]:building}},'Building updated');setSelected(null)};
 const generatedTeamMessage=()=>colours.map(c=>c.toUpperCase()+' TEAM\n'+joined.filter(p=>teams[p.id]===c).sort((a,b)=>b.power-a.power||a.name.localeCompare(b.name)).map(p=>p.name).join(', ')).join('\n\n');
 const copyTeamMessage=async()=>{const message=teamMessage===null?generatedTeamMessage():teamMessage;try{await navigator.clipboard.writeText(message);setNotice('Team message copied')}catch{setNotice('Copy failed. Select the text and copy manually.')}};
 const teamTitle=c=>(teamNames[c]||c).trim()||c;
 const shareMessages=foundryShareMessages({teamNames,buildings,active,teams,assignments:validAssignments,instructions,colours});
 const messageStats=foundryMessageStats;
 const copyShare=async message=>{try{await navigator.clipboard.writeText(message);setNotice('Message copied')}catch{setNotice('Copy failed. Select the preview and copy manually.')}};
 const saveTeamName=(c,value)=>{const next={...teamNames,[c]:value};setTeamNames(next);update({teamNames:next},'Team name updated')};
 const saveInstructions=value=>{setInstructions(value);update({shareInstructions:value},'Instructions updated')};
 const total=arr=>arr.reduce((n,p)=>n+p.power,0);
 const teamTotals=Object.fromEntries(colours.map(c=>[c,total(active.filter(p=>teams[p.id]===c))]));
 const assignedCount=active.length;
 const average=assignedCount?Object.values(teamTotals).reduce((a,b)=>a+b,0)/colours.length:0;
 const missingPower=joined.filter(p=>!p.hasPower);
 const balanceSpread=average?Math.round((Math.max(...Object.values(teamTotals))-Math.min(...Object.values(teamTotals)))/average*100):0;
 const renderRosterPlayer=p=>{
  const role=activeRole(p.id),other=otherRole(p.id);
  const elsewhere=other&&!isParticipant(role);
  const label=elsewhere?'Legion '+otherLegion+' · '+REGISTRATION_ROLES.find(([id])=>id===other)[1]:
    REGISTRATION_ROLES.find(([id])=>id===role)?.[1]||'Unassigned';
  const selectedForMove=confirmMove===p.id;
  const moveError=selectedForMove?legionMoveError(otherPlan,saved,p.id,other):'';
  return <div key={p.id} className="legion-player">
    <div className="legion-player-main">
      <div className="legion-player-identity">
        {bulkMode&&role&&<input type="checkbox" aria-label={'Select '+p.name} checked={bulkSelected.includes(p.id)} onChange={()=>setBulkSelected(ids=>ids.includes(p.id)?ids.filter(id=>id!==p.id):[...ids,p.id])}/>}
        <PlayerAvatar player={avatarFor(p)} size={34}/>
        <div style={{minWidth:0}}>
          <button type="button" className="legion-player-name" aria-label={'Open profile for '+p.name} onClick={()=>onOpenPlayerProfile?.(p.id)}>{p.name}</button>
          <small className="legion-player-context">{p.alliance} · {p.rank}{!p.matched?' · Needs matching':''}{p.language?' · '+languageLabel(p.language):''}</small>
          {editingPower===p.id?<InlinePower player={p} metric={metric} onClose={()=>setEditingPower(null)} onSave={(id,value)=>{onSaveTroopPower?.(id,value);setNotice('Troop power updated for '+p.name)}}/>:
            <button type="button" className="legion-player-power" aria-label={'Edit '+metric.toLowerCase()+' for '+p.name} onClick={()=>setEditingPower(p.id)}>{p.hasPower?format(p.power):'Add power'}</button>}
          {p.recentNoShow&&<NoShow/>}
        </div>
      </div>
      {!bulkMode&&<button type="button" className="legion-role" data-role={elsewhere?'other':role} aria-label={p.name+' · '+label} aria-expanded={managing===p.id} onClick={()=>{setManaging(managing===p.id?null:p.id);setConfirmMove(null)}}>{label}</button>}
    </div>
    {!bulkMode&&managing===p.id&&<div style={{display:'grid',gap:8,marginTop:10}}>
      {elsewhere?<div style={{display:'grid',gap:8}}>
        <button type="button" style={btn} onClick={()=>changeSelection(chosen,otherLegion)}>Switch to Legion {otherLegion}</button>
        {!selectedForMove?<button type="button" style={btn} onClick={()=>setConfirmMove(p.id)}>Move here</button>:
          <div role="group" aria-label="Confirm legion move" style={{display:'grid',gap:8}}>
            <span>Move {p.name} to Legion {legion} as {REGISTRATION_ROLES.find(([id])=>id===other)[1].toLowerCase()}?</span>
            {moveError&&<small role="alert" style={{color:'#f0b1b8'}}>{moveError}</small>}
            {!moveError&&p.matched&&<button type="button" style={btn} onClick={()=>{onMoveLegion(p.id,other);setConfirmMove(null);setManaging(null);setUndo(null)}}>Confirm move</button>}
            <button type="button" style={btn} onClick={()=>setConfirmMove(null)}>Cancel</button>
          </div>}
      </div>:<>
        <label style={{display:'flex',alignItems:'center',gap:6,minHeight:40}}>
          <input type="checkbox" aria-label={'Opted in: '+p.name} checked={isParticipant(role)} onChange={e=>{if(!e.target.checked)setStatus(p.id,'out');else setStatus(p.id,'join')}}/> Opted in
        </label>
        <div role="group" aria-label={'Registration role for '+p.name} style={{display:'flex',gap:6,flexWrap:'wrap'}}>
          {REGISTRATION_ROLES.map(([value,text])=><button key={value} type="button" aria-pressed={role===value} style={btn} onClick={()=>{if(role!==value)setStatus(p.id,value);setManaging(null)}}>{text}</button>)}
        </div>
        {role&&<button type="button" style={btn} onClick={()=>{setStatus(p.id,role);setManaging(null)}}>Remove from {title}</button>}
        {p.matched&&<><button type="button" style={btn} onClick={()=>{openEditor('language',[p.id]);setManaging(null)}}>Language</button>
          <button type="button" style={btn} onClick={()=>{openEditor('relationships',[p.id]);setManaging(null)}}>Works well with</button></>}
      </>}
    </div>}
  </div>;
 };
 return <section style={{padding:'10px 16px 110px',color:'#eef5fc'}}>
  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,marginBottom:9}}><div><h1 style={{fontSize:25,margin:'0 0 2px'}}>{title}</h1></div><button style={btn} onClick={()=>{if(undo){onSaveFoundry?.(undo);setUndo(null);setNotice('Last change undone')}}} disabled={!undo}>Undo</button></div>
  <div className="legion-context">
    <label>Registration alliance<select aria-label={title+' registration alliance'} value={chosen} onChange={e=>changeSelection(e.target.value,legion)} style={{...btn,width:'100%',marginTop:4}}>{alliances.map(a=><option key={a}>{a}</option>)}</select></label>
    <fieldset><legend>Legion</legend><div className="legion-switch">{[1,2].map(number=><button key={number} type="button" aria-pressed={legion===number} onClick={()=>changeSelection(chosen,number)} style={{...btn,padding:'6px 3px',borderColor:legion===number?'#a3cbef':'#40546a',background:legion===number?'#2b4660':'#21354b'}}>Legion {number}</button>)}</div></fieldset>
  </div>
  <div style={{display:'grid',gridTemplateColumns:'repeat('+(isFoundry?3:2)+',minmax(0,1fr))',gap:6,marginBottom:10}}>{[['players','Players'],['teams','Teams'],...(isFoundry?[['buildings','Buildings']]:[])].map(([id,label])=><button key={id} onClick={()=>setView(id)} style={{...btn,background:view===id?'#f5ad38':'#172a3e',color:view===id?'#101b28':'#e9f2fa',padding:'8px 3px',minHeight:40}}>{label}</button>)}</div>
  {notice&&<div role="status" style={{...style,fontSize:13,color:'#f5bd5b'}}>{notice}</div>}
  {view==='players'&&<>
   <div style={{...style,display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:8}}>
     {[['join','Combatants',joined.length],['sub','Substitutes',subs.length]].map(([role,label,count])=><button key={role} type="button" aria-pressed={roleFilter===role} onClick={()=>{setRoleFilter(roleFilter===role?'all':role);setBulkSelected([])}} style={{...btn,textAlign:'left',minHeight:60,borderColor:roleFilter===role?'#a3cbef':'#40546a'}}>
       <strong style={{display:'block',fontSize:19,color:role==='join'?'#a0e2bf':'#b7dbff'}}>{count}/{limits[role]}</strong>{label}
     </button>)}
     <div style={{gridColumn:'1 / -1',fontSize:13,color:'#adc2d6'}}>Combatant power <strong style={{color:'#eef5fc'}}>{joined.length>0&&joined.length===missingPower.length?'—':format(total(joined))}</strong>{missingPower.length>0&&<span> · {missingPower.length} missing</span>}</div>
   </div>
   <PlannerAttendance kind={kind} alliance={chosen} legion={legion} plan={saved} players={attendancePlayers}
    onSchedule={(date,time)=>update({date,time},'Schedule saved')} onNewEvent={()=>{setUndo(null);onNewEvent();}} onAttendance={onAttendance} card={style} button={btn}/>
   <details style={{...style,padding:11}}>
     <summary style={{cursor:'pointer',fontWeight:650}}>Add players</summary>
     <div style={{display:'flex',alignItems:'center',gap:8,margin:'7px 0',flexWrap:'wrap'}}>
       <div role="group" aria-label="Registration role" style={{display:'flex',gap:4,flexWrap:'wrap',background:'#0d1b2c',borderRadius:10,padding:3}}>
         {REGISTRATION_ROLES.map(([role,label])=><button key={role} type="button" aria-pressed={addRole===role} onClick={()=>setAddRole(role)} style={{...btn,minHeight:32,padding:'5px 9px',fontSize:12,borderRadius:9,border:'none',background:addRole===role?'#344c63':'transparent'}}>{label}</button>)}
       </div>
     </div>
     <div style={{display:'flex',alignItems:'center',gap:9,background:'#20344a',border:'1px solid #496077',borderRadius:12,padding:'0 12px'}}>
       <span aria-hidden="true" style={{fontSize:20,color:'#eeb85a'}}>⊕</span>
       <input aria-label="Search and add player by name or ID" value={query} onChange={e=>onSearchInput(e.target.value)} placeholder="Search name or Player ID to add" style={{background:'transparent',color:'#eef5fc',border:0,outline:'none',minHeight:42,width:'100%',fontSize:14}}/>
       {query&&<button type="button" aria-label="Clear search" onClick={()=>setQuery('')} style={{...btn,padding:'4px 8px',minHeight:32}}>×</button>}
     </div>
     <button type="button" style={{...btn,background:'transparent',border:0,padding:'5px 2px',minHeight:30,color:'#a9c4dc',fontSize:13}} onClick={()=>setShowPaste(v=>!v)}>{showPaste?'Hide bulk import':'＋ Paste multiple players'}</button>
   {query.trim()&&<div style={style}>{searchMatches.length?searchMatches.map(p=><button key={p.id} onClick={()=>add(p.id)} style={{...btn,width:'100%',display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6,textAlign:'left'}}><span><strong>{p.name}</strong><small style={{display:'block',color:'#a9bfd0'}}>{p.alliance} · {format(p.power)} · {metric}</small>{p.recentNoShow&&<NoShow/>}</span><span>{registrations[p.id]&&registeredUnder[p.id]===chosen?'✓':'＋'}</span></button>):<div style={{fontSize:13,color:'#a9bfd0'}}>No matching profile. Check the name or Player ID.</div>}</div>}
   <button type="button" style={{...btn,margin:'6px 0 6px 8px'}} aria-expanded={showScreenshot}
     onClick={()=>setShowScreenshot(value=>!value)}>{showScreenshot?'Hide screenshot reader':'Read screenshot'}</button>
   {showScreenshot&&<RosterScreenshotImport title={title} alliance={chosen} players={entries.filter(p=>p.matched)}
     occurrenceIds={{[legion]:saved.occurrenceId,[otherLegion]:otherPlan.occurrenceId}} onSave={onSaveScreenshotPowers}/>}
   {showPaste&&<BulkPlayerImport players={entries.filter(p=>p.matched)} alliance={chosen} roleLabel={REGISTRATION_ROLES.find(([role])=>role===addRole)[1]} context={title} initialText={paste} onConfirm={confirmBulkImport} onClose={()=>{setPaste('');setShowPaste(false)}}/>}
   </details>
   <div style={{...style,padding:12}}>
     <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}>
       <h2 style={{fontSize:16,margin:0}}>Legion {legion} roster</h2>
       <button type="button" style={{...btn,background:bulkMode?'#344c63':'#21354b'}} onClick={()=>{setBulkMode(v=>!v);setBulkSelected([])}}>{bulkMode?'Done':'Select'}</button>
     </div>
     <div className="legion-roster-tools">
       <input type="search" aria-label="Search roster" placeholder="Search roster" style={btn} value={rosterSearch} onChange={e=>{setRosterSearch(e.target.value);setBulkSelected([])}}/>
       <select aria-label="Sort roster" value={rosterSort} onChange={e=>setRosterSort(e.target.value)} style={btn}>
         <option value="power">Highest power</option><option value="name">Name A–Z</option><option value="rank">Rank, then power</option>
       </select>
       <label><input type="checkbox" checked={participantsOnly} onChange={e=>{setParticipantsOnly(e.target.checked);setRoleFilter('all');setBulkSelected([])}}/> Participants only</label>
       {roleFilter!=='all'&&<button type="button" style={btn} onClick={()=>{setRoleFilter('all');setBulkSelected([])}}>Clear role filter</button>}
     </div>
     {bulkMode&&<div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',fontSize:12,color:'#b9cad9'}}><span>{bulkSelected.length} selected</span><button style={btn} onClick={()=>setBulkSelected(filteredRegistrations.map(p=>p.id))}>Select all</button></div>}
     {sortedRoster.length===0&&<p style={{color:'#adc2d6'}}>{rosterSearch?'No matching players.':'No players in this view.'}</p>}
     {(rosterSort==='rank'?groupedRanks:[null]).map(group=>{
       const rows=group?sortedRoster.filter(p=>p.rank===group):sortedRoster;
       if(!rows.length)return null;
       const groupCount=roster.filter(p=>p.rank===group).length;
       return <div key={group||'all'} data-roster-rank={group||undefined}>
         {group&&<button type="button" aria-expanded={rankExpanded[group]!==false} onClick={()=>setRankExpanded(v=>({...v,[group]:v[group]===false}))} style={{...btn,width:'100%',display:'flex',justifyContent:'space-between'}}>
           <span>{group}</span><span>{rows.length}/{groupCount} {rankExpanded[group]===false?'⌄':'⌃'}</span>
         </button>}
         {rankExpanded[group]!==false&&rows.map(renderRosterPlayer)}
       </div>;
     })}
     {(editIds||(bulkMode&&bulkSelected.length>0))&&<div role={editIds?'dialog':undefined} aria-label={editIds?'Edit Foundry player preferences':undefined} style={{position:editIds?'fixed':'sticky',left:editIds?0:undefined,right:editIds?0:undefined,bottom:editIds?0:75,zIndex:editIds?100:4,background:'#26384d',border:'1px solid #eab14f',borderRadius:12,padding:12,marginTop:12,maxHeight:editIds?'75vh':undefined,overflowY:editIds?'auto':undefined,boxShadow:editIds?'0 -12px 50px #0009':undefined}}>
       <div style={{display:'flex',alignItems:'center',gap:8}}><strong style={{flex:1,fontSize:13}}>{editIds?entries.find(p=>p.id===editIds[0])?.name:bulkSelected.length+' selected'}</strong>{editIds?<button style={btn} onClick={closeEditor}>Close</button>:<><button style={{...btn,minHeight:34,padding:'5px 10px'}} onClick={()=>{setBulkSelected([]);closeEditor()}}>Clear</button><button style={{...btn,minHeight:34,padding:'5px 10px'}} onClick={()=>{setEditIds(null);setBulkAction(v=>v==='actions'?'':'actions')}}>Actions {bulkAction?'⌃':'⌄'}</button></>}</div>
       {bulkAction&&<div style={{maxHeight:'55vh',overflowY:'auto',marginTop:8,display:'grid',gap:8}}>
         {bulkAction==='actions'&&[['join','Set as combatants'],['sub','Set as substitutes'],['out','Set as not participating'],['language','Language'],['relationships','Works well with'],['remove','Remove from registration']].map(([key,label])=><button key={key} style={{...btn,textAlign:'left'}} onClick={()=>openEditor(key,selectedIds())}>{label} ›</button>)}
         {REGISTRATION_ROLES.some(([role])=>role===bulkAction)&&<button style={btn} onClick={()=>bulkUpdate(bulkAction)}>Apply to {bulkSelected.length} players</button>}
         {bulkAction==='language'&&<><label style={{fontSize:12,color:'#b9cad9'}}>Language<input aria-label="Language" value={bulkLanguage} onChange={e=>setBulkLanguage(e.target.value)} placeholder="Type a language or code, e.g. ko" style={{...btn,width:'100%',boxSizing:'border-box',marginTop:5}}/></label>{bulkLanguage.trim()&&languageOptions.filter(n=>n.toLowerCase().includes(bulkLanguage.toLowerCase())||resolveLanguage(bulkLanguage)===resolveLanguage(n)).slice(0,6).map(n=><button key={n} style={{...btn,textAlign:'left'}} onClick={()=>setBulkLanguage(n)}>{n}</button>)}<button style={btn} onClick={applyBulkLanguage}>Apply language</button></>}
         {bulkAction==='relationships'&&<>
           {selectedIds().length>1&&<div style={{display:'grid',gap:5}}><label style={{fontSize:12}}><input type="radio" checked={bulkRelationshipMode==='each'} onChange={()=>setBulkRelationshipMode('each')}/> Link selected players to each other</label><label style={{fontSize:12}}><input type="radio" checked={bulkRelationshipMode==='others'} onChange={()=>setBulkRelationshipMode('others')}/> Add teammates to all selected players</label></div>}
           {(bulkRelationshipMode==='others'||selectedIds().length===1)&&<><input aria-label="Find teammates" placeholder="Search username or Player ID" value={teammateQuery} onChange={e=>setTeammateQuery(e.target.value)} style={{...btn,width:'100%',boxSizing:'border-box'}}/>{teammateMatches.map(p=><button key={p.id} style={{...btn,textAlign:'left'}} onClick={()=>{setTeammateIds(v=>[...v,p.id]);setTeammateQuery('')}}>+ {p.name} · {p.id}</button>)}{teammateIds.map(id=><div key={id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',fontSize:12}}><span>{entries.find(p=>p.id===id)?.name}</span><button aria-label={'Remove '+id} style={btn} onClick={()=>setTeammateIds(v=>v.filter(x=>x!==id))}>×</button></div>)}</>}
           {selectedIds().length===1&&relatedTo(selectedIds()[0]).map(id=><div key={id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',fontSize:12}}><span>{entries.find(p=>p.id===id)?.name||id}</span><button style={btn} aria-label={'Unlink '+id} onClick={()=>removeTeammate(selectedIds()[0],id)}>×</button></div>)}
           <button style={btn} onClick={applyBulkRelationships}>Save teammates</button>
         </>}
         {bulkAction==='remove'&&<><span style={{fontSize:12}}>Remove {bulkSelected.length} registrations? Profiles are retained.</span><button style={{...btn,color:'#f1a9a9'}} onClick={bulkRemove}>Confirm removal</button></>}
       </div>}
     </div>}
   </div>
  </>}
  {(view==='teams'||view==='buildings')&&<>
   <div style={{...style,padding:12}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}><strong>Team balance</strong><span style={{fontSize:12,color:'#a9bfd0'}}>{assignedCount}/{joined.length} assigned</span></div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(68px,1fr))',gap:7}}>{colours.map(c=><button key={c} onClick={()=>{setMoving(null);setSelected(null);if(view==='teams')jumpToTeam(c);else setFocusTeam(c)}} style={{...btn,minWidth:0,padding:'10px 3px',borderColor:focusTeam===c?teamColors[c]:'#40546a',background:focusTeam===c?'#263b50':'#1a2b40'}}><div style={{height:4,background:teamColors[c],borderRadius:4,marginBottom:8}}/><div style={{fontSize:11}}>{c}</div><div style={{fontSize:13,marginTop:3}}>{teamTotals[c]?format(teamTotals[c]):'—'}</div></button>)}</div>
    <div style={{fontSize:12,color:'#a9bfd0',marginTop:10}}>{!assignedCount?'Generate teams to see balance':missingPower.length?'Missing troop power for '+missingPower.length+' player(s). Balance is provisional.':balanceSpread+'% spread between strongest and weakest team'}</div>
   </div>
   {view==='teams'&&<>
    <label style={{display:'block',marginBottom:10}}>Teams per legion <select aria-label="Teams per legion" value={colours.length} style={btn} onChange={e=>{const count=Number(e.target.value);update(resizePlannerTeams(saved,count),'Team count updated');if(!TEAM_NAMES.slice(0,count).includes(focusTeam))setFocusTeam('Blue');}}>{[3,4,5,6].map(n=><option key={n}>{n}</option>)}</select></label>
    <div style={{display:'flex',justifyContent:'flex-end',marginBottom:10}}><button style={{...btn,padding:'8px 12px',background:'#263b50'}} onClick={()=>setConfirmGenerate(v=>!v)}>⚙ Generate teams</button></div>
    <p style={{fontSize:12,color:'#9ab1c3',margin:'0 0 14px'}}>Balances troop power while considering language and preferred teammates.</p>
    {confirmGenerate&&<div style={style}><strong>Team generation</strong><p style={{fontSize:13,color:'#a9bfd0'}}>{isFoundry&&'The strongest three combatants anchor the first three colour zones. '}Adding unassigned players keeps existing assignments.</p>{missingPower.length>0&&<p style={{fontSize:12,color:'#f5bd5b'}}>{missingPower.length} player(s) have missing troop power.</p>}<div style={{display:'grid',gap:8}}><button style={{...btn,background:'#32694d'}} onClick={()=>autoTeams('add')}>Add unassigned players only</button><button style={{...btn,background:'#70521f'}} onClick={()=>{autoTeams('all')}}>Regenerate all teams{isFoundry?' and buildings':''}</button><button style={btn} onClick={()=>setConfirmGenerate(false)}>Cancel</button></div></div>}
    {joined.some(p=>!teams[p.id])&&<div style={{...style,borderColor:'#B78B45'}}><h3 style={{margin:'0 0 12px'}}>Unallocated players <span style={{fontSize:13,color:'#a9bfd0'}}>({joined.filter(p=>!teams[p.id]).length})</span></h3>{joined.filter(p=>!teams[p.id]).map(p=><div key={p.id} style={{display:'flex',gap:8,alignItems:'center',marginBottom:8}}><div style={{flex:1,minWidth:0}}><div style={{display:'flex',gap:9,alignItems:'center'}}><PlayerAvatar player={avatarFor(p)} size={36}/><div><strong style={{fontSize:14}}>{p.name}</strong><div style={{fontSize:12,color:'#a9bfd0'}}>{p.power?format(p.power)+' '+metric.toLowerCase():'Missing troop power'}{p.tierScore!==null?' · Tier score '+p.tierScore:''}</div></div></div></div><select aria-label={'Assign '+p.name+' to team'} defaultValue="" onChange={e=>{if(e.target.value)assign(p.id,e.target.value)}} style={{...btn,maxWidth:130}}><option value="" disabled>Assign</option>{colours.map(c=><option key={c} value={c}>{c}</option>)}</select></div>)}</div>}
    {colours.map(c=><div key={c} data-team-card={c} ref={el=>{teamRefs.current[c]=el}} style={{...style,scrollMarginTop:20,borderTop:'4px solid '+teamColors[c]}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}><div onClick={()=>setExpanded(v=>({...v,[c]:v[c]===false}))} style={{cursor:'pointer'}}><h2 style={{fontSize:19,margin:0,color:teamColors[c]}}>{teamTitle(c)} team {expanded[c]!==false?'⌃':'⌄'}</h2><span style={{fontSize:12,color:'#a9bfd0'}}>{active.filter(p=>teams[p.id]===c).length} players · {format(teamTotals[c])} power</span></div><button style={{...btn,padding:'8px'}} onClick={()=>{navigator.clipboard?.writeText(active.filter(p=>teams[p.id]===c).map(p=>p.name).join('\n'));setNotice(c+' team copied')}}>Copy</button></div>
    <label style={{display:'block',fontSize:12,color:'#a9bfd0',marginBottom:8}}>Team name<input aria-label={'Name for '+c+' team'} value={teamNames[c]??c} onChange={e=>setTeamNames(v=>({...v,[c]:e.target.value}))} onBlur={e=>saveTeamName(c,e.target.value)} style={{...btn,width:'100%',boxSizing:'border-box',marginTop:4}}/></label>{expanded[c]!==false&&active.filter(p=>teams[p.id]===c).map(p=><div key={p.id} style={{borderTop:'1px solid #30465a',padding:'12px 0'}}><div style={{display:'flex',alignItems:'center',gap:8}}><PlayerAvatar player={avatarFor(p)} size={38}/><div style={{flex:1,minWidth:0}}><strong style={{fontSize:14}}>{p.name}</strong><div style={{fontSize:12,color:p.power>0?'#a9bfd0':'#f5bd5b'}}>{p.power>0?format(p.power)+' '+metric.toLowerCase():'Missing troop power'}</div>{p.tierScore!==null&&<div style={{fontSize:12,color:'#83B5CE'}}>Tier strength score · {p.tierScore}</div>}{p.language&&<span style={{display:'inline-block',marginTop:4,padding:'2px 6px',borderRadius:6,background:'#263b50',color:'#c8d7e4',fontSize:11}}>{languageLabel(p.language)}</span>}{teammateNames(p).length>0&&<div title={'Preferred teammates: '+teammateNames(p).join(', ')} style={{fontSize:11,color:'#83d3ac',marginTop:4}}>✓ Works well with {teammateNames(p).join(', ')}</div>}</div><button aria-label={'Move '+p.name+' to another team'} style={{...btn,padding:'8px 10px'}} onClick={()=>setMoving(moving===p.id?null:p.id)}>⇄</button></div>{moving===p.id&&<div role="group" aria-label={'Move '+p.name+' to'} style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:10}}>{colours.filter(x=>x!==c).map(x=><button key={x} style={{...btn,padding:'8px',borderColor:teamColors[x]}} onClick={()=>{assign(p.id,x);setMoving(null);jumpToTeam(x)}}>{x}</button>)}</div>}</div>)}
    {expanded[c]!==false&&!active.some(p=>teams[p.id]===c)&&<p style={{fontSize:13,color:'#a9bfd0'}}>No players assigned to this team.</p>}</div>)}
    <div style={{...style,padding:14}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,flexWrap:'wrap'}}>
        <div><h2 style={{fontSize:17,margin:'0 0 4px'}}>Team message</h2><span style={{fontSize:12,color:'#a9bfd0'}}>Edit before copying to alliance chat</span></div>
        <button type="button" style={{...btn,minHeight:36}} onClick={()=>{setTeamMessage(generatedTeamMessage());setTeamMessageOpen(true)}}>↻ Regenerate</button>
      </div>
      <button type="button" aria-expanded={teamMessageOpen} style={{...btn,width:'100%',marginTop:12,textAlign:'left',background:'#20344a'}} onClick={()=>setTeamMessageOpen(v=>!v)}>{teamMessageOpen?'Hide editable message':'Show editable message'}</button>
      {teamMessageOpen&&<><textarea aria-label="Editable team message" rows={12} value={teamMessage===null?generatedTeamMessage():teamMessage} onChange={e=>setTeamMessage(e.target.value)} style={{...btn,width:'100%',boxSizing:'border-box',resize:'vertical',marginTop:10,whiteSpace:'pre-wrap',lineHeight:1.6,fontWeight:500}}/>{teamMessage!==null&&teamMessage!==generatedTeamMessage()&&<p style={{fontSize:12,color:'#a9bfd0'}}>Custom edits remain until you regenerate.</p>}</>}
      <button type="button" style={{...btn,width:'100%',marginTop:10,background:'#f5ad38',color:'#101b28',borderColor:'#eab14f'}} onClick={copyTeamMessage}>Copy team message</button>
    </div>
   </>}
   {view==='buildings'&&isFoundry&&<>
    <p style={{fontSize:12,color:'#9ab1c3',margin:'0 0 12px'}}>Drag a player into a building, or select their name and choose a destination.</p>
    <h2 style={{fontSize:19,color:teamColors[focusTeam],margin:'0 0 12px'}}>{focusTeam} team · opening assignments</h2>
    {buildings[focusTeam].map(b=>{const list=active.filter(p=>teams[p.id]===focusTeam&&validAssignments[p.id]===b);return <div key={b} data-foundry-building={b} onDragOver={e=>{if(dragging)e.preventDefault()}} onDrop={e=>{e.preventDefault();if(dragging){move(dragging,b);setDragging(null)}}} style={{...style,borderColor:dragging?teamColors[focusTeam]:selected?teamColors[focusTeam]:'#30465a'}}><div style={{display:'flex',justifyContent:'space-between',gap:8,alignItems:'center'}}><strong>{b}</strong><span style={{fontSize:12,color:'#a9bfd0'}}>{list.length} players · {format(total(list))}</span></div><div style={{display:'flex',gap:7,flexWrap:'wrap',marginTop:12}}>{list.map(p=><button key={p.id} draggable onDragStart={e=>{setDragging(p.id);e.dataTransfer.setData('text/plain',p.id)}} onDragEnd={()=>setDragging(null)} onClick={()=>setSelected(selected===p.id?null:p.id)} style={{...btn,padding:'8px 10px',userSelect:'none',WebkitUserSelect:'none',touchAction:'manipulation',borderColor:selected===p.id?teamColors[focusTeam]:'#40546a'}}><span aria-hidden="true" onPointerDown={e=>{if(e.pointerType==='touch'){e.stopPropagation();touchDrag.current={id:p.id,building:b};e.currentTarget.setPointerCapture(e.pointerId);setDragging(p.id)}}} onPointerUp={e=>{if(e.pointerType==='touch'){e.stopPropagation();finishTouchDrag(e)}}} onPointerCancel={()=>{touchDrag.current=null;setDragging(null)}} style={{display:'inline-block',padding:'3px 7px',touchAction:'none',cursor:'grab',userSelect:'none',WebkitUserSelect:'none'}}>⠿</span> {p.name}</button>)}</div>{selected&&active.some(p=>p.id===selected&&validAssignments[p.id]!==b)&&<button style={{...btn,width:'100%',marginTop:10}} onClick={()=>move(selected,b)}>Move selected player here</button>}</div>})}
    {joined.some(p=>!validAssignments[p.id])&&<div style={style}><strong>Unallocated players</strong><div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:10}}>{joined.filter(p=>!validAssignments[p.id]).map(p=><button key={p.id} style={{...btn,padding:'8px',borderColor:selected===p.id?teamColors[focusTeam]:'#40546a'}} onClick={()=>setSelected(p.id)}>{p.name}</button>)}</div></div>}
    <div style={style}><h2 style={{fontSize:18,margin:'0 0 8px'}}>Share assignments</h2><p style={{fontSize:12,color:'#a9bfd0'}}>Messages for alliance chat. Previews follow your current building assignments.</p>{shareMessages.map(([label,message],index)=>{const stats=messageStats(message);return <div key={label} style={{borderTop:'1px solid #30465a',padding:'12px 0'}}><div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}><strong>Message {index+1} · {label}</strong><button style={btn} onClick={()=>copyShare(message)}>Copy</button></div>{index===2&&<label style={{display:'block',fontSize:12,color:'#a9bfd0',marginTop:10}}>Edit instructions<textarea aria-label="Foundry instructions" value={instructions} onChange={e=>setInstructions(e.target.value)} onBlur={e=>saveInstructions(e.target.value)} rows={3} style={{...btn,width:'100%',boxSizing:'border-box',marginTop:5,resize:'vertical'}}/></label>}<pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',fontFamily:'inherit',fontSize:12,lineHeight:1.65,background:'#0d1b2c',padding:12,borderRadius:10}}>{message}</pre><div style={{fontSize:12,color:'#a9bfd0',textAlign:'right'}}>{stats.characters} characters · {stats.lines} lines</div></div>})}</div>
   </>}
  </>}
 </section>;
}
