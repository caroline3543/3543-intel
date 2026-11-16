import {useMemo,useState,useRef,useEffect} from 'react';
import {PlayerAvatar} from '../../../src/components/players/PlayerAvatar.jsx';
import {playerSearchFields} from '../../../src/services/playerNames.js';
const colours=['Blue','Yellow','Green','Pink'];
const teamColors={Blue:'#397DB6',Yellow:'#D8A13C',Green:'#348D68',Pink:'#F05A9D'};
const buildings={Blue:['Prototype Site I','Boiler Room'],Yellow:['Prototype Site II','Central Transit Station'],Green:['Repair Facility I','Repair Facility III'],Pink:['Repair Facility II','Repair Facility IV']};
const anchorBuildings=['Prototype Site I','Prototype Site II','Repair Facility I'];
// Prototype I and Boiler must have separate team anchors.
const anchorTeams=['Blue','Yellow','Green'];
const style={background:'#142438',border:'1px solid #30465a',borderRadius:16,padding:12,marginBottom:10};
const btn={border:'1px solid #40546a',borderRadius:12,background:'#21354b',color:'#e9f2fa',padding:'9px 12px',minHeight:40,fontWeight:650,cursor:'pointer'};
const name=p=>p.username||p.alias||p.name||String(p.fid||p.id);
const power=p=>Number(p.lastFoundryTroopPower??p.troopPower??p.lastTroopPower??0)||0;
const alliance=p=>String(p.alliance||p.homeAlliance||p.allianceTag||p.alliance_name||'Unassigned').trim()||'Unassigned';
const rank=p=>{const r=String(p.allianceRank??p.rank??p.alliance_rank??'').toUpperCase();return /^R[1-5]$/.test(r)?r:'Unranked'};
const format=n=>Math.round(n).toLocaleString();
const T10=[66,71,76,83,88,94,99,104,110,115,121],T11=[80,86,92,100,106,114,120,126,135,141,148];
const tierValue=raw=>{const x=String(raw||'').trim().toUpperCase();if(!x)return null;const fc=Number(x.match(/FC\s*(\d+)/)?.[1]||0);if(/T12|EXALTED/.test(x))return 96;if(/HELIOS|T11/.test(x))return T11[Math.min(fc,10)]??null;if(/FC\s*\d+|T10/.test(x))return T10[Math.min(fc,10)]??null;return ({7:28,8:38,9:50})[Number(x.match(/T\s*(\d+)/)?.[1]||0)]??null;};
const tierScore=p=>{const scores=['infantry','lancer','marksman'].map(k=>tierValue(p.troops?.[k]));return scores.every(x=>x!==null)?Math.round(scores.reduce((a,b)=>a+b,0)/3*10)/10:null;};
function InlinePower({player,onSave}){
 const [value,setValue]=useState(String(player.power||''));
 const [focused,setFocused]=useState(false);
 const [error,setError]=useState(false);
 const latest=String(player.power||'');
 const commit=()=>{
   setFocused(false);
   const raw=value.replace(/,/g,'').trim();
   if(!raw){setValue(latest);setError(false);return;}
   const number=Number(raw);
   if(!Number.isSafeInteger(number)||number<0){setError(true);return;}
   setError(false);
   if(number!==player.power)onSave(player.id,number);
   setValue(String(number));
 };
 return <div style={{width:98,flexShrink:0}}>
  <label htmlFor={'foundry-power-'+player.id} style={{display:'block',fontSize:10,color:'#a9bfd0',marginBottom:4}}>Troop power</label>
  <input id={'foundry-power-'+player.id} aria-label={'Troop power for '+player.name} inputMode="numeric" type="text" value={focused?value:latest} onFocus={()=>{setValue(latest);setFocused(true)}} onChange={e=>{setValue(e.target.value);setError(false)}} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();if(e.key==='Escape'){setValue(latest);e.currentTarget.blur()}}} style={{width:'100%',boxSizing:'border-box',minHeight:42,padding:'8px 7px',fontSize:14,fontWeight:650,textAlign:'right',color:'#eef5fc',background:'#20344a',border:'1px solid '+(error?'#f1a9a9':'#496077'),borderRadius:10}} placeholder="0"/>
  {error&&<span role="alert" style={{fontSize:10,color:'#f1a9a9'}}>Whole number only</span>}
 </div>;
}
export function FoundryTab({players=[],sharedFoundry={},onSaveFoundry,onSaveTroopPower,teamworkPreferences={}}){
 const saved=sharedFoundry||{};
 const [view,setView]=useState('players'),[query,setQuery]=useState('');
 const [paste,setPaste]=useState(''),[showPaste,setShowPaste]=useState(false),[notice,setNotice]=useState(''),[selected,setSelected]=useState(null);
 const [undo,setUndo]=useState(null);
 const teamRefs=useRef({});
 const jumpToTeam=c=>{setFocusTeam(c);teamRefs.current[c]?.scrollIntoView({behavior:'smooth',block:'start'});};
 const [focusTeam,setFocusTeam]=useState('Blue'),[moving,setMoving]=useState(null),[confirmGenerate,setConfirmGenerate]=useState(false);
 const [allianceFilter,setAllianceFilter]=useState(()=>localStorage.getItem('caroline3573_foundry_alliance')||'');
 const [addRole,setAddRole]=useState('join');
 const [managing,setManaging]=useState(null);
 const [roleFilter,setRoleFilter]=useState('join'),[bulkMode,setBulkMode]=useState(false),[bulkSelected,setBulkSelected]=useState([]),[confirmRemoval,setConfirmRemoval]=useState(false),[rankExpanded,setRankExpanded]=useState({R5:true,R4:true,R3:true,R2:true,R1:true});
 const [pasteIssues,setPasteIssues]=useState([]);
 const [manualMatches,setManualMatches]=useState({});
 const [editingPower,setEditingPower]=useState(null),[powerInput,setPowerInput]=useState('');
 const [generationMode,setGenerationMode]=useState('all'),[expanded,setExpanded]=useState({Blue:true,Yellow:true,Green:true,Pink:true});
 const [teamMessage,setTeamMessage]=useState(null),[teamMessageOpen,setTeamMessageOpen]=useState(false);
 const [teamNames,setTeamNames]=useState(()=>saved.teamNames||{});
 const [instructions,setInstructions]=useState(()=>saved.shareInstructions||'Save 1 march to refill the closest building, another to join a rally and use the rest to garrison buildings.');
 const [dragging,setDragging]=useState(null);
 const touchDrag=useRef(null);
 const finishTouchDrag=e=>{const source=touchDrag.current;touchDrag.current=null;if(!source)return;const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-foundry-building]');const destination=target?.getAttribute('data-foundry-building');if(destination&&destination!==source.building)move(source.id,destination);setDragging(null);};
 useEffect(()=>setTeamNames(saved.teamNames||{}),[saved.teamNames]);
 useEffect(()=>setInstructions(saved.shareInstructions||'Save 1 march to refill the closest building, another to join a rally and use the rest to garrison buildings.'),[saved.shareInstructions]);
 const avatarFor=p=>players.find(x=>String(x.id??x.fid??name(x))===p.id)||{username:p.name};
 const entries=useMemo(()=>{
  const map=new Map(players.map(p=>{const id=String(p.id??p.fid??name(p));return [id,{id,name:name(p),power:power(p),rank:rank(p),alliance:alliance(p),matched:true,tierScore:tierScore(p),language:String(p.gameLanguage||p.language||p.languages?.[0]||'').trim(),searchFields:[...playerSearchFields(p),p.id,p.nickname].filter(Boolean).map(String)}]}));
  for(const p of saved.imports||[]){const current=map.get(p.id);map.set(p.id,current?{...current,power:current.power||p.power}:{...p,alliance:p.alliance||'Unassigned',matched:false});}
  return [...map.values()].sort((a,b)=>b.power-a.power||a.name.localeCompare(b.name));
 },[players,saved.imports]);
 const alliances=useMemo(()=>[...new Set(entries.map(p=>p.alliance).filter(a=>a!=='Unassigned'))].sort(),[entries]);
 const chosen=allianceFilter||alliances[0]||'Unassigned';
 const registrations=saved.registrations||{},teams=saved.teams||{},assignments=saved.assignments||{},registeredUnder=saved.registeredUnder||{};
 const joined=entries.filter(p=>registrations[p.id]==='join'&&registeredUnder[p.id]===chosen),subs=entries.filter(p=>registrations[p.id]==='sub'&&registeredUnder[p.id]===chosen);
 const active=joined.filter(p=>teams[p.id]&&colours.includes(teams[p.id]));
 const validAssignments=Object.fromEntries(active.map(p=>[p.id,buildings[teams[p.id]].includes(assignments[p.id])?assignments[p.id]:buildings[teams[p.id]][0]]));
 const invalidAssignments=active.filter(p=>!buildings[teams[p.id]].includes(assignments[p.id]));
 useEffect(()=>{if(!invalidAssignments.length||!onSaveFoundry)return;onSaveFoundry({...saved,assignments:{...assignments,...validAssignments}});},[saved,onSaveFoundry,invalidAssignments.map(p=>p.id+':'+teams[p.id]+':'+assignments[p.id]).join('|')]);
 const update=(patch,msg)=>{setUndo(saved);onSaveFoundry?.({...saved,...patch});setNotice(msg||'Updated · syncing across devices');};
 const setStatus=(id,status)=>{const current=registeredUnder[id]===chosen?registrations[id]:'';const next=status===current?'':status;
  if(next==='join'&&joined.length>=30&&current!=='join'){setNotice('30 combatant slots are full');return}
  if(next==='sub'&&subs.length>=10&&current!=='sub'){setNotice('10 substitute slots are full');return}
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
  if(mode==='all'){
   anchors.forEach((p,i)=>{const building=anchorBuildings[i];const c=anchorTeams[i];put(p,c);alloc[p.id]=building});
  }
  attending.filter(p=>!next[p.id]).forEach(p=>{
   const available=colours.filter(c=>members[c].length<Math.ceil(attending.length/4));
   const choices=available.length?available:colours;
   const minimum=Math.min(...choices.map(c=>totals[c]));
   const viable=choices.filter(c=>totals[c]<=minimum+Math.max(1,minimum*.05));
   const c=viable.sort((x,y)=>members[y].reduce((n,q)=>n+affinity(p,q),0)-members[x].reduce((n,q)=>n+affinity(p,q),0)||totals[x]-totals[y]||colours.indexOf(x)-colours.indexOf(y))[0];
   put(p,c);
  });
  colours.forEach(c=>{
   const bins=[0,0];members[c].forEach(p=>{const i=buildings[c].indexOf(alloc[p.id]);if(i>=0)bins[i]+=p.power});
   members[c].filter(p=>!alloc[p.id]).sort((a,b)=>b.power-a.power).forEach(p=>{const i=bins[0]<=bins[1]?0:1;alloc[p.id]=buildings[c][i];bins[i]+=p.power});
  });
  update({teams:next,assignments:alloc},mode==='all'?'Teams regenerated with anchors in their colour zones':'Unassigned players added without changing existing assignments');
 };
 const norm=v=>String(v||'').normalize('NFKC').trim().replace(/\\s+/g,' ').toLocaleLowerCase();
 const plain=v=>norm(v).normalize('NFKD').replace(/[\\u0300-\\u036f]/g,'').replace(/[^\\p{L}\\p{N}]/gu,'');
 const fields=p=>[p.name,...(p.searchFields||[]),p.id].filter(v=>String(v||'').trim());
 const candidateMatches=n=>{
   const raw=norm(n),key=plain(n);
   const exactId=entries.filter(p=>p.matched&&fields(p).some(v=>/^\\d+$/.test(String(v))&&norm(v)===raw));
   if(exactId.length)return exactId;
   const exact=entries.filter(p=>p.matched&&fields(p).some(v=>norm(v)===raw));
   if(exact.length)return exact;
   return key.length>=3?entries.filter(p=>p.matched&&fields(p).some(v=>plain(v).length>=3&&plain(v)===key)):[];
 };
 const suggestions=n=>{const key=plain(n);return key.length<3?[]:entries.filter(p=>p.matched&&fields(p).some(v=>plain(v).length>=3&&(plain(v).includes(key)||key.includes(plain(v))))).slice(0,8);};
 const searchMatches=query.trim()?entries.filter(p=>p.matched&&fields(p).some(v=>norm(v).includes(norm(query))||(plain(query).length>=3&&plain(v).length>=3&&plain(v).includes(plain(query))))).slice(0,8):[];
 const pastedList=value=>/\\r|\\n/.test(value)||value.split(/\\s*[,;]\\s*/).filter(Boolean).length>=3;
 const onSearchInput=value=>{if(pastedList(value)){setPaste(value.replace(/\\s*;\\s*/g,'\\n'));setShowPaste(true);setQuery('');setNotice('Multiple players detected. Review the pasted list below.')}else setQuery(value)};
 const filteredRegistrations=roleFilter==='join'?joined:subs;
 const groupedRanks=['R5','R4','R3','R2','R1','Unranked'];
 const bulkUpdate=(role)=>{const ids=bulkSelected.filter(id=>filteredRegistrations.some(p=>p.id===id));const nextRegs={...registrations},nextTeams={...teams},nextAssignments={...assignments};let joins=joined.length,substitutes=subs.length;for(const id of ids){if(nextRegs[id]===role)continue;if(nextRegs[id]==='join')joins--;else if(nextRegs[id]==='sub')substitutes--;if(role==='join')joins++;else substitutes++;nextRegs[id]=role;if(role!=='join'){delete nextTeams[id];delete nextAssignments[id]}}if(joins>30||substitutes>10){setNotice('Not enough registration slots for this change');return}update({registrations:nextRegs,teams:nextTeams,assignments:nextAssignments},ids.length+' registration roles updated');setRoleFilter(role);setBulkSelected([]);setBulkMode(false)};
 const bulkRemove=()=>{const ids=bulkSelected.filter(id=>filteredRegistrations.some(p=>p.id===id));const nextRegs={...registrations},nextTeams={...teams},nextAssignments={...assignments};ids.forEach(id=>{delete nextRegs[id];delete nextTeams[id];delete nextAssignments[id]});update({registrations:nextRegs,teams:nextTeams,assignments:nextAssignments},ids.length+' removed from Foundry registration');setBulkSelected([]);setBulkMode(false);setConfirmRemoval(false)};
 const add=(id,role=addRole)=>{
  const p=entries.find(x=>x.id===id);
  if(!p||!p.matched){setNotice('Select a matched player profile');return}
  if(registrations[id]&&registeredUnder[id]!==chosen){setNotice('Already registered under '+registeredUnder[id]);return}
  if(registrations[id]===role&&registeredUnder[id]===chosen){setNotice(p.name+' is already registered');return}
  setStatus(id,role);setQuery('');
 };
 const importRows=()=>{
  const imports=[...(saved.imports||[])],nextRegs={...registrations},nextUnder={...registeredUnder};
  const nextTeams={...teams},nextAssignments={...assignments};
  const issues=[];let added=0,updated=0;
  let joins=joined.length,substitutes=subs.length;
  for(const raw of paste.replace(/\\r\\n|\\n|\\r/g,'\n').split(/\r?\n/)){
   const line=raw.trim();if(!line)continue;
   const match=line.match(/^(.*?)(?:[,\t]\s*([\d,]+))?$/);
   const n=match?.[1]?.trim(),value=match?.[2],pwr=value?Number(value.replace(/,/g,'')):null;
   if(!n||value&&(!Number.isFinite(pwr)||pwr<0)){issues.push({name:line,reason:'Invalid format',candidates:[]});continue}
   const matches=manualMatches[n]?entries.filter(x=>x.id===manualMatches[n]&&x.matched):candidateMatches(n);
   if(matches.length!==1){issues.push({name:n,reason:matches.length?'Multiple profiles match':'No exact match',candidates:matches.length?matches:suggestions(n)});continue}
   const p=matches[0],id=p.id,current=nextRegs[id],under=nextUnder[id];
   if(current&&under!==chosen){issues.push({name:n,reason:'Registered under '+under,candidates:[]});continue}
   if(current===addRole&&under===chosen){updated++;continue}
   if((addRole==='join'&&joins>=30&&current!=='join')||(addRole==='sub'&&substitutes>=10&&current!=='sub')){issues.push({name:n,reason:(addRole==='join'?'Combatant':'Substitute')+' limit reached',candidates:[]});continue}
   if(current==='join')joins--;if(current==='sub')substitutes--;
   if(addRole==='join')joins++;else substitutes++;
   nextRegs[id]=addRole;nextUnder[id]=chosen;
   if(addRole!=='join'){delete nextTeams[id];delete nextAssignments[id]}
   if(value){const record={id,name:p.name,power:pwr,rank:p.rank,alliance:p.alliance,matched:true};const idx=imports.findIndex(x=>x.id===id);if(idx>=0)imports[idx]=record;else imports.push(record)}
   added++;
  }
  setPasteIssues(issues);
  if(added){update({imports,registrations:nextRegs,registeredUnder:nextUnder,teams:nextTeams,assignments:nextAssignments},added+' registered'+(updated?' · '+updated+' already registered':'')+(issues.length?' · '+issues.length+' need review':''));}
  else setNotice(issues.length?issues.length+' names need review':'No new players to add');
  if(!issues.length){setPaste('');setShowPaste(false)}
 };
 const savePower=()=>{const value=Number(String(powerInput).replace(/,/g,'').trim());if(!Number.isFinite(value)||value<0||!Number.isInteger(value)||!String(powerInput).trim()){setNotice('Enter a valid whole-number troop power');return;}const p=entries.find(x=>x.id===editingPower);if(!p||!p.matched){setNotice('Player profile not found');return;}onSaveTroopPower?.(editingPower,value);setEditingPower(null);setNotice('Foundry troop power saved to '+p.name+'\'s profile');};
 const assign=(id,colour)=>{const nextTeams={...teams,[id]:colour};const nextAlloc={...assignments};if(!buildings[colour].includes(nextAlloc[id]))nextAlloc[id]=buildings[colour][0];update({teams:nextTeams,assignments:nextAlloc},'Team updated')};
 const move=(id,building)=>{const colour=colours.find(c=>buildings[c].includes(building));if(!colour)return;update({teams:{...teams,[id]:colour},assignments:{...assignments,[id]:building}},'Building updated');setSelected(null)};
 const generatedTeamMessage=()=>colours.map(c=>c.toUpperCase()+' TEAM\n'+joined.filter(p=>teams[p.id]===c).sort((a,b)=>b.power-a.power||a.name.localeCompare(b.name)).map(p=>p.name).join(', ')).join('\n\n');
 const copyTeamMessage=async()=>{const message=teamMessage===null?generatedTeamMessage():teamMessage;try{await navigator.clipboard.writeText(message);setNotice('Team message copied')}catch{setNotice('Copy failed. Select the text and copy manually.')}};
 const teamTitle=c=>(teamNames[c]||c).trim()||c;
 const buildingLabel=b=>({'Prototype Site I':'Prototype I','Prototype Site II':'Prototype II','Boiler Room':'Boiler','Central Transit Station':'Transit','Repair Facility I':'Repair I','Repair Facility II':'Repair II','Repair Facility III':'Repair III','Repair Facility IV':'Repair IV'})[b]||b;
 const teamBlock=c=>[teamTitle(c).toUpperCase()+' · '+({Blue:'Top left',Pink:'Top right',Green:'Bottom left',Yellow:'Bottom right'})[c],...buildings[c].map(b=>buildingLabel(b)+' · '+active.filter(p=>teams[p.id]===c&&validAssignments[p.id]===b).map(p=>p.name).join(', '))].join('\n');
 const shareMessages=[
  ['Blue + Pink',['INITIAL ASSIGNMENTS (1/2)',teamBlock('Blue'),teamBlock('Pink')].join('\n\n')],
  ['Green + Yellow',['INITIAL ASSIGNMENTS (2/2)',teamBlock('Green'),teamBlock('Yellow')].join('\n\n')],
  ['Foundry instructions',['FOUNDRY INSTRUCTIONS',instructions].join('\n\n')]
 ];
 const copyText=()=>shareMessages.map(([,body])=>body).join('\n\n');
 const messageStats=message=>({characters:[...message].length,lines:message.split('\n').length});
 const copyShare=async message=>{try{await navigator.clipboard.writeText(message);setNotice('Message copied')}catch{setNotice('Copy failed. Select the preview and copy manually.')}};
 const saveTeamName=(c,value)=>{const next={...teamNames,[c]:value};setTeamNames(next);update({teamNames:next},'Team name updated')};
 const saveInstructions=value=>{setInstructions(value);update({shareInstructions:value},'Instructions updated')};
 const total=arr=>arr.reduce((n,p)=>n+p.power,0);
 const teamTotals=Object.fromEntries(colours.map(c=>[c,total(active.filter(p=>teams[p.id]===c))]));
 const assignedCount=active.length;
 const average=assignedCount?Object.values(teamTotals).reduce((a,b)=>a+b,0)/4:0;
 const missingPower=joined.filter(p=>p.power<=0);
 const balanceSpread=average?Math.round((Math.max(...Object.values(teamTotals))-Math.min(...Object.values(teamTotals)))/average*100):0;
 return <section style={{padding:'10px 16px 110px',color:'#eef5fc'}}>
  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,marginBottom:9}}><div><h1 style={{fontSize:25,margin:'0 0 2px'}}>Foundry</h1></div><button style={btn} onClick={()=>{if(undo){onSaveFoundry?.(undo);setUndo(null);setNotice('Last change undone')}}} disabled={!undo}>Undo</button></div>
  <label style={{display:'block',fontSize:12,color:'#a9bfd0',marginBottom:6}}>Foundry registration alliance</label><select aria-label="Foundry registration alliance" value={chosen} onChange={e=>{setAllianceFilter(e.target.value);localStorage.setItem('caroline3573_foundry_alliance',e.target.value)}} style={{...btn,width:'100%',marginBottom:10,minHeight:42}}>{[...new Set([...alliances,chosen])].map(a=><option key={a} value={a}>{a}</option>)}</select>
  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10}}>{[['join','Combatants',joined.length,30],['sub','Substitutes',subs.length,10]].map(([key,label,count,limit])=><button key={key} type="button" aria-pressed={roleFilter===key} onClick={()=>{setRoleFilter(key);setView('players');setBulkSelected([]);setBulkMode(false)}} style={{...style,marginBottom:0,textAlign:'left',cursor:'pointer',border:roleFilter===key?'2px solid #eab14f':'1px solid #30465a',background:roleFilter===key?'#24364b':'#142438',minHeight:78,padding:12}}><div style={{fontSize:13,color:'#c2d2e1',display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}><span>{label}</span>{roleFilter===key?<span aria-label="Selected" style={{color:'#eab14f',fontSize:14}}>✓</span>:null}</div><strong style={{fontSize:24,color:'#eef5fc'}}>{count}<span style={{color:'#8ea7bd',fontSize:14}}>/{limit}</span></strong></button>)}</div>
  <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:6,marginBottom:10}}>{[['players','Players'],['teams','Teams'],['buildings','Buildings']].map(([id,label])=><button key={id} onClick={()=>setView(id)} style={{...btn,background:view===id?'#f5ad38':'#172a3e',color:view===id?'#101b28':'#e9f2fa',padding:'8px 3px',minHeight:40}}>{label}</button>)}</div>
  {notice&&<div role="status" style={{...style,fontSize:13,color:'#f5bd5b'}}>{notice}</div>}
  {view==='players'&&<>
   <div style={{...style,padding:11}}>
     <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:7,flexWrap:'wrap'}}>
       <strong style={{fontSize:15}}>Add players</strong>
       <div role="group" aria-label="Registration role" style={{display:'flex',gap:4,background:'#0d1b2c',borderRadius:10,padding:3}}>
         {[['join','Combatant'],['sub','Substitute']].map(([role,label])=><button key={role} type="button" aria-pressed={addRole===role} onClick={()=>setAddRole(role)} style={{...btn,minHeight:32,padding:'5px 9px',fontSize:12,borderRadius:9,border:'none',background:addRole===role?'#344c63':'transparent'}}>{label}</button>)}
       </div>
     </div>
     <div style={{display:'flex',alignItems:'center',gap:9,background:'#20344a',border:'1px solid #496077',borderRadius:12,padding:'0 12px'}}>
       <span aria-hidden="true" style={{fontSize:20,color:'#eeb85a'}}>⊕</span>
       <input aria-label="Search and add player by name or ID" value={query} onChange={e=>onSearchInput(e.target.value)} placeholder="Search name or Player ID to add" style={{background:'transparent',color:'#eef5fc',border:0,outline:'none',minHeight:42,width:'100%',fontSize:14}}/>
       {query&&<button type="button" aria-label="Clear search" onClick={()=>setQuery('')} style={{...btn,padding:'4px 8px',minHeight:32}}>×</button>}
     </div>
     <button type="button" style={{...btn,background:'transparent',border:0,padding:'5px 2px',minHeight:30,color:'#a9c4dc',fontSize:13}} onClick={()=>setShowPaste(v=>!v)}>{showPaste?'Hide bulk import':'＋ Paste multiple players'}</button>
   </div>
   {query.trim()&&<div style={style}>{searchMatches.length?searchMatches.map(p=><button key={p.id} onClick={()=>add(p.id)} style={{...btn,width:'100%',display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6,textAlign:'left'}}><span><strong>{p.name}</strong><small style={{display:'block',color:'#a9bfd0'}}>{p.alliance} · {format(p.power)} troop power</small></span><span>{registrations[p.id]&&registeredUnder[p.id]===chosen?'✓':'＋'}</span></button>):<div style={{fontSize:13,color:'#a9bfd0'}}>No matching profile. Check the name or Player ID.</div>}</div>}
   {showPaste&&<div style={style}><label style={{display:'block',fontSize:13,marginBottom:8}}>Paste names or Username, troop power</label><textarea value={paste} onChange={e=>setPaste(e.target.value)} rows={5} placeholder={'Erth, 8997\nVanellope, 4717\nLaw'} style={{...btn,width:'100%',boxSizing:'border-box'}}/><button style={{...btn,marginTop:8,width:'100%'}} onClick={importRows}>Match and register players</button>{pasteIssues.length>0&&<div style={{marginTop:10,color:'#f5bd5b',fontSize:12}}><strong>Needs review ({pasteIssues.length})</strong>{pasteIssues.map((issue,i)=><div key={i} style={{paddingTop:8}}><div>{issue.name} · {issue.reason}</div>{issue.candidates?.length>0&&<div style={{display:'grid',gap:5,marginTop:6}}>{issue.candidates.map(p=><button key={p.id} style={{...btn,textAlign:'left',fontSize:12}} onClick={()=>{setManualMatches(prev=>({...prev,[issue.name]:p.id}));setNotice('Match selected for '+issue.name+'. Tap Match and register players again.')}}>Use {p.name} · {p.alliance}</button>)}</div>}</div>)}</div>}</div>}
   {editingPower&&<div style={style}><strong>Edit Foundry troop power · {entries.find(p=>p.id===editingPower)?.name}</strong><p style={{fontSize:12,color:'#a9bfd0'}}>Updates the player's profile with today's date.</p><input aria-label="Foundry troop power" inputMode="numeric" value={powerInput} onChange={e=>setPowerInput(e.target.value)} style={{...btn,width:'100%',boxSizing:'border-box',marginBottom:8}} placeholder="Troop power"/><div style={{display:'flex',gap:8}}><button style={{...btn,flex:1}} onClick={()=>setEditingPower(null)}>Cancel</button><button style={{...btn,flex:1,background:'#32694d'}} onClick={savePower}>Save power</button></div></div>}
   <div style={{...style,padding:12}}>
     <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,marginBottom:6}}>
       <div><h2 style={{fontSize:16,margin:'0 0 3px'}}>{roleFilter==='join'?'Combatants':'Substitutes'}</h2><div style={{fontSize:12,color:'#a9bfd0'}}>By alliance rank · Highest troop power first</div></div>
       <button type="button" style={{...btn,background:bulkMode?'#344c63':'#21354b'}} onClick={()=>{setBulkMode(v=>!v);setBulkSelected([]);setConfirmRemoval(false)}}>{bulkMode?'Done':'Select'}</button>
     </div>
     {bulkMode&&<div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',fontSize:12,color:'#b9cad9'}}><span>{bulkSelected.length} selected</span><button style={{...btn,minHeight:34,padding:'6px 10px'}} onClick={()=>setBulkSelected(filteredRegistrations.map(p=>p.id))}>Select all</button></div>}
     {groupedRanks.map(group=>{const ranked=filteredRegistrations.filter(p=>p.rank===group).sort((a,b)=>b.power-a.power||a.name.localeCompare(b.name));const eligible=entries.filter(p=>p.rank===group&&p.alliance===chosen).length;return <div key={group} style={{marginTop:8}}>
       <button type="button" aria-expanded={rankExpanded[group]!==false} onClick={()=>setRankExpanded(v=>({...v,[group]:v[group]===false}))} style={{...btn,width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',background:'#20344a',textAlign:'left',borderRadius:12,minHeight:46}}>
         <span style={{display:'flex',gap:9,alignItems:'center'}}><strong style={{color:'#f0c176'}}>{group}</strong><span style={{fontSize:12,color:'#a9bfd0'}}>{group==='R5'?'Alliance leader':group==='R4'?'Officers':group==='Unranked'?'Rank not recorded':'Members'}</span></span>
         <span style={{fontSize:13,color:'#c8d7e4'}}>{ranked.length}/{group==='R5'&&eligible<=1?1:eligible||ranked.length} {rankExpanded[group]===false?'⌄':'⌃'}</span>
       </button>
       {rankExpanded[group]!==false&&(ranked.length?ranked.map(p=><div key={p.id} style={{borderBottom:'1px solid #2c4155',padding:'12px 0'}}>
         <div style={{display:'flex',alignItems:'center',gap:9}}>
           {bulkMode?<input type="checkbox" aria-label={'Select '+p.name} checked={bulkSelected.includes(p.id)} onChange={e=>setBulkSelected(v=>e.target.checked?[...v,p.id]:v.filter(x=>x!==p.id))} style={{width:22,height:22,accentColor:'#eab14f'}}/>:<PlayerAvatar player={avatarFor(p)} size={38}/>}
           <div style={{flex:1,minWidth:0}}><strong style={{fontSize:14,overflowWrap:'anywhere'}}>{p.name}</strong><div style={{fontSize:11,color:'#a9bfd0'}}>{p.alliance}{!p.matched?' · Needs matching':''}</div></div>
           <InlinePower player={p} onSave={(id,value)=>{onSaveTroopPower?.(id,value);setNotice('Troop power saved for '+p.name)}}/>
           {!bulkMode&&<button aria-label={'Manage '+p.name} aria-expanded={managing===p.id} style={{...btn,minWidth:42,fontSize:20,padding:7}} onClick={()=>setManaging(managing===p.id?null:p.id)}>⋯</button>}
         </div>
         {!bulkMode&&managing===p.id&&<div style={{display:'grid',gap:8,marginTop:10}}>
           <div style={{fontSize:12,color:'#a9bfd0'}}>Registration role</div>
           <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>{[['join','Combatant'],['sub','Substitute']].map(([role,label])=><button key={role} aria-pressed={registrations[p.id]===role} style={{...btn,background:registrations[p.id]===role?'#66502d':'#20344a',borderColor:registrations[p.id]===role?'#eab14f':'#40546a'}} onClick={()=>{if(registrations[p.id]!==role){setStatus(p.id,role);setRoleFilter(role)}setManaging(null)}}>{label}</button>)}</div>
           <button style={{...btn,color:'#f1a9a9',borderColor:'#79525b'}} onClick={()=>{setStatus(p.id,registrations[p.id]);setManaging(null)}}>Remove from Foundry</button>
         </div>}
       </div>):<div style={{padding:'12px 4px',fontSize:12,color:'#839bae'}}>No {roleFilter==='join'?'combatants':'substitutes'} at this rank</div>)}
     </div>})}
     {bulkMode&&bulkSelected.length>0&&<div style={{position:'sticky',bottom:75,zIndex:4,...style,marginTop:14,background:'#26384d',borderColor:'#eab14f'}}>
       <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}><strong>{bulkSelected.length} selected</strong><button style={{...btn,minHeight:32,padding:'5px 10px'}} onClick={()=>setBulkSelected([])}>Clear</button></div>
       <div style={{display:'flex',flexWrap:'wrap',gap:7}}><button style={btn} onClick={()=>bulkUpdate('join')}>Make combatants</button><button style={btn} onClick={()=>bulkUpdate('sub')}>Make substitutes</button><button style={{...btn,color:'#f1a9a9'}} onClick={()=>setConfirmRemoval(true)}>Remove from Foundry</button></div>
       {confirmRemoval&&<div style={{marginTop:10}}><p style={{fontSize:13}}>Remove {bulkSelected.length} registration(s)? Player profiles will be kept.</p><button style={{...btn,color:'#f1a9a9',marginRight:8}} onClick={bulkRemove}>Confirm removal</button><button style={btn} onClick={()=>setConfirmRemoval(false)}>Cancel</button></div>}
     </div>}
   </div>
  </>}
  {(view==='teams'||view==='buildings')&&<>
   <div style={{...style,padding:12}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}><strong>Team balance</strong><span style={{fontSize:12,color:'#a9bfd0'}}>{assignedCount}/{joined.length} assigned</span></div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:7}}>{colours.map(c=><button key={c} onClick={()=>{setMoving(null);setSelected(null);if(view==='teams')jumpToTeam(c);else setFocusTeam(c)}} style={{...btn,minWidth:0,padding:'10px 3px',borderColor:focusTeam===c?teamColors[c]:'#40546a',background:focusTeam===c?'#263b50':'#1a2b40'}}><div style={{height:4,background:teamColors[c],borderRadius:4,marginBottom:8}}/><div style={{fontSize:11}}>{c}</div><div style={{fontSize:13,marginTop:3}}>{teamTotals[c]?format(teamTotals[c]):'—'}</div></button>)}</div>
    <div style={{fontSize:12,color:'#a9bfd0',marginTop:10}}>{!assignedCount?'Generate teams to see balance':missingPower.length?'Missing troop power for '+missingPower.length+' player(s). Balance is provisional.':balanceSpread+'% spread between strongest and weakest team'}</div>
   </div>
   {view==='teams'&&<>
    <div style={{display:'flex',justifyContent:'flex-end',marginBottom:10}}><button style={{...btn,padding:'8px 12px',background:'#263b50'}} onClick={()=>setConfirmGenerate(v=>!v)}>⚙ Generate teams</button></div>
    <p style={{fontSize:12,color:'#9ab1c3',margin:'0 0 14px'}}>Balances troop power while considering language and preferred teammates.</p>
    {confirmGenerate&&<div style={style}><strong>Team generation</strong><p style={{fontSize:13,color:'#a9bfd0'}}>The strongest three combatants anchor Prototype I, Prototype II and Boiler Room when regenerating all. Manual assignments are preserved when adding unassigned players only.</p>{missingPower.length>0&&<p style={{fontSize:12,color:'#f5bd5b'}}>{missingPower.length} player(s) have missing troop power.</p>}<div style={{display:'grid',gap:8}}><button style={{...btn,background:'#32694d'}} onClick={()=>autoTeams('add')}>Add unassigned players only</button><button style={{...btn,background:'#70521f'}} onClick={()=>{setGenerationMode('all');autoTeams('all')}}>Regenerate all teams and buildings</button><button style={btn} onClick={()=>setConfirmGenerate(false)}>Cancel</button></div></div>}
    {joined.some(p=>!teams[p.id])&&<div style={{...style,borderColor:'#B78B45'}}><h3 style={{margin:'0 0 12px'}}>Unallocated players <span style={{fontSize:13,color:'#a9bfd0'}}>({joined.filter(p=>!teams[p.id]).length})</span></h3>{joined.filter(p=>!teams[p.id]).map(p=><div key={p.id} style={{display:'flex',gap:8,alignItems:'center',marginBottom:8}}><div style={{flex:1,minWidth:0}}><div style={{display:'flex',gap:9,alignItems:'center'}}><PlayerAvatar player={avatarFor(p)} size={36}/><div><strong style={{fontSize:14}}>{p.name}</strong><div style={{fontSize:12,color:'#a9bfd0'}}>{p.power?format(p.power)+' troop power':'Missing troop power'}{p.tierScore!==null?' · Tier score '+p.tierScore:''}</div></div></div></div><select aria-label={'Assign '+p.name+' to team'} defaultValue="" onChange={e=>{if(e.target.value)assign(p.id,e.target.value)}} style={{...btn,maxWidth:130}}><option value="" disabled>Assign</option>{colours.map(c=><option key={c} value={c}>{c}</option>)}</select></div>)}</div>}
    {colours.map(c=><div key={c} ref={el=>{teamRefs.current[c]=el}} style={{...style,scrollMarginTop:20,borderTop:'4px solid '+teamColors[c]}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}><div onClick={()=>setExpanded(v=>({...v,[c]:!v[c]}))} style={{cursor:'pointer'}}><h2 style={{fontSize:19,margin:0,color:teamColors[c]}}>{teamTitle(c)} team {expanded[c]?'⌃':'⌄'}</h2><span style={{fontSize:12,color:'#a9bfd0'}}>{active.filter(p=>teams[p.id]===c).length} players · {format(teamTotals[c])} power</span></div><button style={{...btn,padding:'8px'}} onClick={()=>{navigator.clipboard?.writeText(active.filter(p=>teams[p.id]===c).map(p=>p.name).join('\n'));setNotice(c+' team copied')}}>Copy</button></div>
    <label style={{display:'block',fontSize:12,color:'#a9bfd0',marginBottom:8}}>Team name<input aria-label={'Name for '+c+' team'} value={teamNames[c]??c} onChange={e=>setTeamNames(v=>({...v,[c]:e.target.value}))} onBlur={e=>saveTeamName(c,e.target.value)} style={{...btn,width:'100%',boxSizing:'border-box',marginTop:4}}/></label>{expanded[c]&&active.filter(p=>teams[p.id]===c).map(p=><div key={p.id} style={{borderTop:'1px solid #30465a',padding:'12px 0'}}><div style={{display:'flex',alignItems:'center',gap:8}}><PlayerAvatar player={avatarFor(p)} size={38}/><div style={{flex:1,minWidth:0}}><strong style={{fontSize:14}}>{p.name}</strong><div style={{fontSize:12,color:p.power>0?'#a9bfd0':'#f5bd5b'}}>{p.power>0?format(p.power)+' troop power':'Missing troop power'}</div>{p.tierScore!==null&&<div style={{fontSize:12,color:'#83B5CE'}}>Tier strength score · {p.tierScore}</div>}</div><button style={{...btn,padding:'8px 10px'}} onClick={()=>setMoving(moving===p.id?null:p.id)}>⇄</button></div>{moving===p.id&&<div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:10}}>{colours.filter(x=>x!==c).map(x=><button key={x} style={{...btn,padding:'8px',borderColor:teamColors[x]}} onClick={()=>{assign(p.id,x);setMoving(null);jumpToTeam(x)}}>{x}</button>)}</div>}</div>)}
    {expanded[c]&&!active.some(p=>teams[p.id]===c)&&<p style={{fontSize:13,color:'#a9bfd0'}}>No players assigned to this team.</p>}</div>)}
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
   {view==='buildings'&&<>
    <p style={{fontSize:12,color:'#9ab1c3',margin:'0 0 12px'}}>Drag a player into a building, or select their name and choose a destination.</p>
    <h2 style={{fontSize:19,color:teamColors[focusTeam],margin:'0 0 12px'}}>{focusTeam} team · opening assignments</h2>
    {buildings[focusTeam].map(b=>{const list=active.filter(p=>teams[p.id]===focusTeam&&validAssignments[p.id]===b);return <div key={b} data-foundry-building={b} onDragOver={e=>{if(dragging)e.preventDefault()}} onDrop={e=>{e.preventDefault();if(dragging){move(dragging,b);setDragging(null)}}} style={{...style,borderColor:dragging?teamColors[focusTeam]:selected?teamColors[focusTeam]:'#30465a'}}><div style={{display:'flex',justifyContent:'space-between',gap:8,alignItems:'center'}}><strong>{b}</strong><span style={{fontSize:12,color:'#a9bfd0'}}>{list.length} players · {format(total(list))}</span></div><div style={{display:'flex',gap:7,flexWrap:'wrap',marginTop:12}}>{list.map(p=><button key={p.id} draggable onDragStart={e=>{setDragging(p.id);e.dataTransfer.setData('text/plain',p.id)}} onDragEnd={()=>setDragging(null)} onClick={()=>setSelected(selected===p.id?null:p.id)} style={{...btn,padding:'8px 10px',userSelect:'none',WebkitUserSelect:'none',touchAction:'manipulation',borderColor:selected===p.id?teamColors[focusTeam]:'#40546a'}}><span aria-hidden="true" onPointerDown={e=>{if(e.pointerType==='touch'){e.stopPropagation();touchDrag.current={id:p.id,building:b};e.currentTarget.setPointerCapture(e.pointerId);setDragging(p.id)}}} onPointerUp={e=>{if(e.pointerType==='touch'){e.stopPropagation();finishTouchDrag(e)}}} onPointerCancel={()=>{touchDrag.current=null;setDragging(null)}} style={{display:'inline-block',padding:'3px 7px',touchAction:'none',cursor:'grab',userSelect:'none',WebkitUserSelect:'none'}}>⠿</span> {p.name}</button>)}</div>{selected&&active.some(p=>p.id===selected&&validAssignments[p.id]!==b)&&<button style={{...btn,width:'100%',marginTop:10}} onClick={()=>move(selected,b)}>Move selected player here</button>}</div>})}
    {joined.some(p=>!validAssignments[p.id])&&<div style={style}><strong>Unallocated players</strong><div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:10}}>{joined.filter(p=>!validAssignments[p.id]).map(p=><button key={p.id} style={{...btn,padding:'8px',borderColor:selected===p.id?teamColors[focusTeam]:'#40546a'}} onClick={()=>setSelected(p.id)}>{p.name}</button>)}</div></div>}
    <div style={style}><h2 style={{fontSize:18,margin:'0 0 8px'}}>Share assignments</h2><p style={{fontSize:12,color:'#a9bfd0'}}>Three messages for alliance chat. Previews follow your current building assignments.</p>{shareMessages.map(([label,message],index)=>{const stats=messageStats(message);return <div key={label} style={{borderTop:'1px solid #30465a',padding:'12px 0'}}><div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}><strong>Message {index+1} · {label}</strong><button style={btn} onClick={()=>copyShare(message)}>Copy</button></div>{index===2&&<label style={{display:'block',fontSize:12,color:'#a9bfd0',marginTop:10}}>Edit instructions<textarea aria-label="Foundry instructions" value={instructions} onChange={e=>setInstructions(e.target.value)} onBlur={e=>saveInstructions(e.target.value)} rows={3} style={{...btn,width:'100%',boxSizing:'border-box',marginTop:5,resize:'vertical'}}/></label>}<pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',fontFamily:'inherit',fontSize:12,lineHeight:1.65,background:'#0d1b2c',padding:12,borderRadius:10}}>{message}</pre><div style={{fontSize:12,color:'#a9bfd0',textAlign:'right'}}>{stats.characters} characters · {stats.lines} lines</div></div>})}</div>
   </>}
  </>}
 </section>;
}
