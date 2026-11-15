import {useMemo,useState} from 'react';
const colours=['Blue','Yellow','Green','Pink'];
const buildings={Blue:['Prototype I','Boiler Room'],Yellow:['Prototype II','Transit Station'],Green:['Repair Facility I','Repair Facility III'],Pink:['Repair Facility II','Repair Facility IV']};
const style={background:'#142438',border:'1px solid #30465a',borderRadius:14,padding:14,marginBottom:12};
const btn={border:'1px solid #40546a',borderRadius:10,background:'#21354b',color:'#e9f2fa',padding:'10px 12px',minHeight:42,fontWeight:650,cursor:'pointer'};
const name=p=>p.username||p.alias||p.name||String(p.fid||p.id);
const power=p=>Number(p.troopPower??p.lastFoundryTroopPower??p.lastTroopPower??0)||0;
const alliance=p=>String(p.alliance||p.homeAlliance||p.allianceTag||p.alliance_name||'Unassigned').trim()||'Unassigned';
const rank=p=>{const r=String(p.allianceRank??p.rank??p.alliance_rank??'').toUpperCase();return /^R[1-5]$/.test(r)?r:'Unranked'};
const format=n=>Math.round(n).toLocaleString();
export function FoundryTab({players=[],sharedFoundry={},onSaveFoundry,teamworkPreferences={}}){
 const saved=sharedFoundry||{};
 const [view,setView]=useState('players'),[query,setQuery]=useState('');
 const [paste,setPaste]=useState(''),[showPaste,setShowPaste]=useState(false),[notice,setNotice]=useState(''),[selected,setSelected]=useState(null);
 const [undo,setUndo]=useState(null);
 const [allianceFilter,setAllianceFilter]=useState(()=>localStorage.getItem('caroline3573_foundry_alliance')||'');
 const [addRole,setAddRole]=useState('join');
 const [pasteIssues,setPasteIssues]=useState([]);
 const entries=useMemo(()=>{
  const map=new Map(players.map(p=>{const id=String(p.id??p.fid??name(p));return [id,{id,name:name(p),power:power(p),rank:rank(p),alliance:alliance(p),matched:true,language:String(p.gameLanguage||p.language||p.languages?.[0]||'').trim()}]}));
  for(const p of saved.imports||[]){const current=map.get(p.id);map.set(p.id,current?{...current,power:p.power||current.power}:{...p,alliance:p.alliance||'Unassigned',matched:false});}
  return [...map.values()].sort((a,b)=>b.power-a.power||a.name.localeCompare(b.name));
 },[players,saved.imports]);
 const alliances=useMemo(()=>[...new Set(entries.map(p=>p.alliance).filter(a=>a!=='Unassigned'))].sort(),[entries]);
 const chosen=allianceFilter||alliances[0]||'Unassigned';
 const registrations=saved.registrations||{},teams=saved.teams||{},assignments=saved.assignments||{},registeredUnder=saved.registeredUnder||{};
 const joined=entries.filter(p=>registrations[p.id]==='join'&&registeredUnder[p.id]===chosen),subs=entries.filter(p=>registrations[p.id]==='sub'&&registeredUnder[p.id]===chosen);
 const active=joined.filter(p=>teams[p.id]&&colours.includes(teams[p.id]));
 const update=(patch,msg)=>{setUndo(saved);onSaveFoundry?.({...saved,...patch});setNotice(msg||'Updated · syncing across devices');};
 const setStatus=(id,status)=>{const current=registeredUnder[id]===chosen?registrations[id]:'';const next=status===current?'':status;
  if(next==='join'&&joined.length>=30&&current!=='join'){setNotice('30 combatant slots are full');return}
  if(next==='sub'&&subs.length>=10&&current!=='sub'){setNotice('10 substitute slots are full');return}
  if(registrations[id]&&registeredUnder[id]!==chosen){setNotice('Already registered under '+registeredUnder[id]+'. Remove that registration before moving.');return}
  const nextRegs={...registrations,[id]:next},nextUnder={...registeredUnder,[id]:chosen},nextTeams={...teams},nextAssignments={...assignments};
  if(next!=='join'){delete nextTeams[id];delete nextAssignments[id]}
  update({registrations:nextRegs,registeredUnder:nextUnder,teams:nextTeams,assignments:nextAssignments},'Registration updated');
 };
 const autoTeams=()=>{
  const next={},totals=Object.fromEntries(colours.map(c=>[c,0])),members=Object.fromEntries(colours.map(c=>[c,[]]));
  const attending=[...joined].sort((a,b)=>b.power-a.power);
  const prefs=teamworkPreferences||{};
  const pairs=Array.isArray(prefs.pairs)?prefs.pairs:[];
  const groups=Array.isArray(prefs.groups)?prefs.groups:[];
  const affinity=(a,b)=>{
   const linked=pairs.some(pair=>Array.isArray(pair)&&pair.map(String).includes(a.id)&&pair.map(String).includes(b.id))
     ||groups.some(g=>Array.isArray(g.memberIds)&&g.memberIds.map(String).includes(a.id)&&g.memberIds.map(String).includes(b.id));
   return (linked?2:0)+(a.language&&a.language===b.language?1:0);
  };
  attending.forEach((p,index)=>{
   const available=colours.filter(c=>members[c].length<Math.ceil(attending.length/4));
   const choices=available.length?available:colours;
   const minimum=Math.min(...choices.map(c=>totals[c]));
   const tolerance=Math.max(1,minimum*0.05);
   const viable=choices.filter(c=>totals[c]<=minimum+tolerance);
   const c=viable.sort((a,b)=>{
    const affinityA=members[a].reduce((n,x)=>n+affinity(p,x),0);
    const affinityB=members[b].reduce((n,x)=>n+affinity(p,x),0);
    return affinityB-affinityA||totals[a]-totals[b]||colours.indexOf(a)-colours.indexOf(b);
   })[0];
   next[p.id]=c;totals[c]+=p.power;members[c].push(p);
  });
  const alloc={};colours.forEach(c=>{const group=members[c].sort((a,b)=>b.power-a.power),bins=[0,0];group.forEach(p=>{const i=bins[0]<=bins[1]?0:1;alloc[p.id]=buildings[c][i];bins[i]+=p.power})});
  update({teams:next,assignments:alloc},'Teams generated using power, language and cooperation preferences');
 };
 const norm=v=>String(v||'').normalize('NFKC').trim().replace(/\\s+/g,' ').toLocaleLowerCase();
 const searchMatches=query.trim()?entries.filter(p=>p.matched&&(norm(p.name).includes(norm(query))||String(p.id)===query.trim())).slice(0,8):[];
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
  for(const raw of paste.split(/\\r?\\n/)){
   const line=raw.trim();if(!line)continue;
   const match=line.match(/^(.*?)(?:[,\\t]\\s*([\\d,]+))?$/);
   const n=match?.[1]?.trim(),value=match?.[2],pwr=value?Number(value.replace(/,/g,'')):null;
   if(!n||value&&(!Number.isFinite(pwr)||pwr<0)){issues.push(line+' · invalid format');continue}
   const matches=entries.filter(x=>x.matched&&norm(x.name)===norm(n));
   if(matches.length!==1){issues.push(n+(matches.length?' · multiple profiles':' · no matching profile'));continue}
   const p=matches[0],id=p.id,current=nextRegs[id],under=nextUnder[id];
   if(current&&under!==chosen){issues.push(n+' · registered under '+under);continue}
   if(current===addRole&&under===chosen){updated++;continue}
   if(addRole==='join'&&joins>=30||addRole==='sub'&&substitutes>=10){issues.push(n+' · '+(addRole==='join'?'combatant':'substitute')+' limit reached');continue}
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
 const assign=(id,colour)=>{const nextTeams={...teams,[id]:colour};const nextAlloc={...assignments};if(!buildings[colour].includes(nextAlloc[id]))nextAlloc[id]=buildings[colour][0];update({teams:nextTeams,assignments:nextAlloc},'Team updated')};
 const move=(id,building)=>{const colour=colours.find(c=>buildings[c].includes(building));if(!colour)return;update({teams:{...teams,[id]:colour},assignments:{...assignments,[id]:building}},'Building updated');setSelected(null)};
 const copyText=()=>['INITIAL ASSIGNMENTS',...colours.flatMap(c=>buildings[c].map(b=>'» '+b+': '+active.filter(p=>assignments[p.id]===b).map(p=>p.name).join(', ')))].join('\n');
 const total=arr=>arr.reduce((n,p)=>n+p.power,0);
 return <section style={{padding:'16px 16px 110px',color:'#eef5fc'}}>
  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,marginBottom:16}}><div><div style={{fontSize:12,color:'#f5b74f',fontWeight:800}}>STATE 3573</div><h1 style={{fontSize:25,margin:'4px 0'}}>Foundry</h1><div style={{fontSize:12,color:'#a6bed2'}}>Legion combatants and opening assignments</div></div><button style={btn} onClick={()=>{if(undo){onSaveFoundry?.(undo);setUndo(null);setNotice('Last change undone')}}} disabled={!undo}>Undo</button></div>
  <label style={{display:'block',fontSize:12,color:'#a9bfd0',marginBottom:6}}>Foundry registration alliance</label><select aria-label="Foundry registration alliance" value={chosen} onChange={e=>{setAllianceFilter(e.target.value);localStorage.setItem('caroline3573_foundry_alliance',e.target.value)}} style={{...btn,width:'100%',marginBottom:14}}>{[...new Set([...alliances,chosen])].map(a=><option key={a} value={a}>{a}</option>)}</select>
  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}><div style={style}><div style={{fontSize:12,color:'#a6bed2'}}>Join</div><strong style={{fontSize:23}}>{joined.length}<span style={{color:'#8ea7bd',fontSize:14}}>/30</span></strong></div><div style={style}><div style={{fontSize:12,color:'#a6bed2'}}>Substitutes</div><strong style={{fontSize:23}}>{subs.length}<span style={{color:'#8ea7bd',fontSize:14}}>/10</span></strong></div></div>
  <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:6,marginBottom:14}}>{[['players','Players'],['teams','Teams'],['buildings','Buildings']].map(([id,label])=><button key={id} onClick={()=>setView(id)} style={{...btn,background:view===id?'#f5ad38':'#172a3e',color:view===id?'#101b28':'#e9f2fa',padding:'9px 3px'}}>{label}</button>)}</div>
  {notice&&<div role="status" style={{...style,fontSize:13,color:'#f5bd5b'}}>{notice}</div>}
  {view==='players'&&<>
   <div style={{display:'flex',gap:8,marginBottom:12}}><button style={{...btn,flex:1,background:addRole==='join'?'#32694d':'#21354b'}} onClick={()=>setAddRole('join')}>Add combatant</button><button style={{...btn,flex:1,background:addRole==='sub'?'#725724':'#21354b'}} onClick={()=>setAddRole('sub')}>Add substitute</button></div>
   <input aria-label="Search player name or ID" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search player name or ID to add…" style={{...btn,width:'100%',boxSizing:'border-box',textAlign:'left',marginBottom:10}}/>
   {query.trim()&&<div style={style}>{searchMatches.length?searchMatches.map(p=><button key={p.id} onClick={()=>add(p.id)} style={{...btn,width:'100%',display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6,textAlign:'left'}}><span><strong>{p.name}</strong><small style={{display:'block',color:'#a9bfd0'}}>{p.alliance} · {format(p.power)} troop power</small></span><span>{registrations[p.id]&&registeredUnder[p.id]===chosen?'✓':'＋'}</span></button>):<div style={{fontSize:13,color:'#a9bfd0'}}>No matching profile. Check the name or Player ID.</div>}</div>}
   <button style={{...btn,width:'100%',marginBottom:12}} onClick={()=>setShowPaste(v=>!v)}>＋ Paste player list</button>
   {showPaste&&<div style={style}><label style={{display:'block',fontSize:13,marginBottom:8}}>Paste names or Username, troop power</label><textarea value={paste} onChange={e=>setPaste(e.target.value)} rows={5} placeholder={'Erth, 8997\\nVanellope, 4717\\nLaw'} style={{...btn,width:'100%',boxSizing:'border-box'}}/><button style={{...btn,marginTop:8,width:'100%'}} onClick={importRows}>Match and register players</button>{pasteIssues.length>0&&<div style={{marginTop:10,color:'#f5bd5b',fontSize:12}}><strong>Needs review ({pasteIssues.length})</strong>{pasteIssues.map((issue,i)=><div key={i} style={{paddingTop:5}}>{issue}</div>)}</div>}</div>}
   <div style={style}><h2 style={{fontSize:16,margin:'0 0 10px'}}>Registered players <span style={{float:'right',color:'#a9bfd0',fontSize:13}}>{joined.length+subs.length} total</span></h2>
   {[...joined,...subs].length?[...joined,...subs].map(p=><div key={p.id} style={{display:'flex',alignItems:'center',gap:8,padding:'10px 0',borderBottom:'1px solid #2c4155'}}><div style={{flex:1,minWidth:0}}><strong style={{fontSize:14}}>{p.name}</strong>{!p.matched&&<span style={{color:'#f5bd5b',fontSize:11}}> · Needs matching</span>}<div style={{fontSize:12,color:'#a9bfd0'}}>{format(p.power)} troop power · {registrations[p.id]==='join'?'Combatant':'Substitute'}</div></div><button style={{...btn,padding:'8px'}} onClick={()=>setStatus(p.id,registrations[p.id]==='join'?'sub':'join')}>Change</button><button aria-label={'Remove '+p.name} style={{...btn,padding:'8px'}} onClick={()=>setStatus(p.id,registrations[p.id])}>✕</button></div>):<p style={{fontSize:13,color:'#a9bfd0'}}>No players registered yet. Search above to add one.</p>}</div>
  </>}
  {view==='teams'&&<><button style={{...btn,width:'100%',background:'#70521f',marginBottom:12}} onClick={autoTeams}>Generate teams · power, language + teamwork</button>{colours.map(c=>{const list=active.filter(p=>teams[p.id]===c);return <div key={c} style={style}><h2 style={{fontSize:17,margin:'0 0 8px'}}>{c} team <span style={{float:'right',fontSize:13,color:'#a9bfd0'}}>{format(total(list))}</span></h2>{list.length?list.map(p=><div key={p.id} style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}><span style={{flex:1,fontSize:13}}>{p.name} · {format(p.power)}</span><select aria-label={'Move '+p.name+' to team'} value={c} onChange={e=>assign(p.id,e.target.value)} style={{...btn,maxWidth:100}}>{colours.map(k=><option key={k}>{k}</option>)}</select></div>):<p style={{fontSize:13,color:'#9ab1c3'}}>No players assigned</p>}</div>})}{joined.filter(p=>!teams[p.id]).length>0&&<div style={style}><h3>Unassigned combatants</h3>{joined.filter(p=>!teams[p.id]).map(p=><div key={p.id} style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}><span style={{flex:1}}>{p.name}</span><select value="" onChange={e=>assign(p.id,e.target.value)} style={btn}><option value="">Assign team</option>{colours.map(c=><option key={c}>{c}</option>)}</select></div>)}</div>}</>}
  {view==='buildings'&&<><p style={{fontSize:12,color:'#9ab1c3'}}>Tap a player, then tap a building to move them. Assignments update immediately.</p>{colours.map(c=><div key={c} style={style}><h2 style={{fontSize:17,margin:'0 0 10px'}}>{c} zone</h2>{buildings[c].map(b=>{const list=active.filter(p=>assignments[p.id]===b);return <div key={b} onClick={()=>selected&&move(selected,b)} style={{border:'1px solid #43586b',borderRadius:10,padding:10,marginBottom:10,background:selected?'#233b4b':'#172a3e'}}><strong style={{fontSize:13}}>{b} · {format(total(list))}</strong><div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:9}}>{list.map(p=><button key={p.id} draggable onDragStart={e=>e.dataTransfer.setData('text/plain',p.id)} onClick={e=>{e.stopPropagation();setSelected(selected===p.id?null:p.id)}} style={{...btn,padding:'7px 9px',background:selected===p.id?'#f5ad38':'#294158',color:selected===p.id?'#152131':'white'}}>{p.name}</button>)}</div><div onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();move(e.dataTransfer.getData('text/plain'),b)}} style={{fontSize:11,color:'#9bb3c8',marginTop:8,minHeight:20}}>Drop player here or tap to assign</div></div>})}</div>)}<div style={style}><h3 style={{marginTop:0}}>Unallocated players</h3>{joined.filter(p=>!assignments[p.id]).map(p=><button key={p.id} onClick={()=>setSelected(p.id)} style={{...btn,margin:3,background:selected===p.id?'#f5ad38':'#21354b'}}>{p.name}</button>)}</div><div style={style}><h3 style={{marginTop:0}}>Initial assignments</h3><pre style={{whiteSpace:'pre-wrap',fontSize:12,lineHeight:1.7}}>{copyText()}</pre><button style={btn} onClick={()=>{navigator.clipboard?.writeText(copyText());setNotice('Assignments copied')}}>Copy assignments</button></div></>}
 </section>;
}
