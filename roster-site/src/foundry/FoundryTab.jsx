import {useMemo,useState} from 'react';
const colours=['Blue','Yellow','Green','Pink'];
const buildings={Blue:['Prototype I','Boiler Room'],Yellow:['Prototype II','Transit Station'],Green:['Repair Facility I','Repair Facility III'],Pink:['Repair Facility II','Repair Facility IV']};
const rankOrder=['R5','R4','R3','R2','R1','Unranked'];
const style={background:'#142438',border:'1px solid #30465a',borderRadius:14,padding:14,marginBottom:12};
const btn={border:'1px solid #40546a',borderRadius:10,background:'#21354b',color:'#e9f2fa',padding:'10px 12px',minHeight:42,fontWeight:650,cursor:'pointer'};
const name=p=>p.username||p.alias||p.name||String(p.fid||p.id);
const power=p=>Number(p.troopPower??p.lastFoundryTroopPower??p.lastTroopPower??0)||0;
const alliance=p=>String(p.alliance||p.homeAlliance||p.allianceTag||p.alliance_name||'Unassigned').trim()||'Unassigned';
const rank=p=>{const r=String(p.allianceRank??p.rank??p.alliance_rank??'').toUpperCase();return /^R[1-5]$/.test(r)?r:'Unranked'};
const format=n=>Math.round(n).toLocaleString();
const initial=()=>{try{return JSON.parse(localStorage.getItem('caroline3573_foundry_v1')||'{}')}catch{return {}}};
export function FoundryTab({players=[]}){
 const [saved,setSaved]=useState(initial);
 const [view,setView]=useState('players'),[query,setQuery]=useState(''),[expanded,setExpanded]=useState({R5:true,R4:true,R3:true,R2:true,R1:true,Unranked:true});
 const [paste,setPaste]=useState(''),[showPaste,setShowPaste]=useState(false),[notice,setNotice]=useState(''),[selected,setSelected]=useState(null);
 const [undo,setUndo]=useState(null);
 const [allianceFilter,setAllianceFilter]=useState(()=>localStorage.getItem('caroline3573_foundry_alliance')||'');
 const [crossAlliance,setCrossAlliance]=useState(false);
 const entries=useMemo(()=>{
  const map=new Map(players.map(p=>{const id=String(p.id??p.fid??name(p));return [id,{id,name:name(p),power:power(p),rank:rank(p),alliance:alliance(p),matched:true}]}));
  for(const p of saved.imports||[]){const current=map.get(p.id);map.set(p.id,current?{...current,power:p.power||current.power}:{...p,alliance:p.alliance||'Unassigned',matched:false});}
  return [...map.values()].sort((a,b)=>b.power-a.power||a.name.localeCompare(b.name));
 },[players,saved.imports]);
 const alliances=useMemo(()=>[...new Set(entries.map(p=>p.alliance).filter(a=>a!=='Unassigned'))].sort(),[entries]);
 const chosen=allianceFilter||alliances[0]||'Unassigned';
 const registrations=saved.registrations||{},teams=saved.teams||{},assignments=saved.assignments||{},registeredUnder=saved.registeredUnder||{};
 const joined=entries.filter(p=>registrations[p.id]==='join'&&registeredUnder[p.id]===chosen),subs=entries.filter(p=>registrations[p.id]==='sub'&&registeredUnder[p.id]===chosen);
 const active=joined.filter(p=>teams[p.id]&&colours.includes(teams[p.id]));
 const update=(patch,msg)=>{setUndo(saved);const next={...saved,...patch};setSaved(next);try{localStorage.setItem('caroline3573_foundry_v1',JSON.stringify(next))}catch{}setNotice(msg||'Updated');};
 const setStatus=(id,status)=>{const current=registeredUnder[id]===chosen?registrations[id]:'';const next=status===current?'':status;
  if(next==='join'&&joined.length>=30&&current!=='join'){setNotice('30 combatant slots are full');return}
  if(next==='sub'&&subs.length>=10&&current!=='sub'){setNotice('10 substitute slots are full');return}
  if(registrations[id]&&registeredUnder[id]!==chosen){setNotice('Already registered under '+registeredUnder[id]+'. Remove that registration before moving.');return}
  const nextRegs={...registrations,[id]:next},nextUnder={...registeredUnder,[id]:chosen},nextTeams={...teams},nextAssignments={...assignments};
  if(next!=='join'){delete nextTeams[id];delete nextAssignments[id]}
  update({registrations:nextRegs,registeredUnder:nextUnder,teams:nextTeams,assignments:nextAssignments},'Registration updated');
 };
 const autoTeams=()=>{const next={};const totals=Object.fromEntries(colours.map(c=>[c,0]));[...joined].sort((a,b)=>b.power-a.power).forEach(p=>{const c=colours.reduce((a,b)=>totals[a]<=totals[b]?a:b);next[p.id]=c;totals[c]+=p.power});const alloc={};colours.forEach(c=>{const members=joined.filter(p=>next[p.id]===c).sort((a,b)=>b.power-a.power);const bins=[0,0];members.forEach(p=>{const i=bins[0]<=bins[1]?0:1;alloc[p.id]=buildings[c][i];bins[i]+=p.power})});update({teams:next,assignments:alloc},'Teams and opening buildings generated')};
 const importRows=()=>{
  const imports=[...(saved.imports||[])];let count=0;const issues=[];
  for(const line of paste.split(/\r?\n/)){
   if(!line.trim())continue;
   const match=line.trim().match(/^(.+?)[,\t]\s*([\d,]+)\s*$/);
   if(!match){issues.push(line);continue}
   const n=match[1].trim(),p=Number(match[2].replace(/,/g,''));if(!n||!Number.isFinite(p)){issues.push(line);continue}
   const matches=entries.filter(x=>x.name.toLocaleLowerCase()===n.toLocaleLowerCase());
   if(matches.length>1){issues.push(n+' (multiple matches)');continue}
   const id=matches[0]?.id||'import:'+n.toLocaleLowerCase();
   const record={id,name:n,power:p,rank:matches[0]?.rank||'Unranked',alliance:matches[0]?.alliance||chosen,matched:!!matches[0]};
   const idx=imports.findIndex(x=>x.id===id);if(idx>=0)imports[idx]=record;else imports.push(record);count++;
  }
  if(!count){setNotice('Use Username, troop power. '+(issues.length?issues.length+' rows need correction.':''));return}
  update({imports},count+' players added. '+(issues.length?issues.length+' rows need correction.':''));
  if(!issues.length){setPaste('');setShowPaste(false)}
 };
 const assign=(id,colour)=>{const nextTeams={...teams,[id]:colour};const nextAlloc={...assignments};if(!buildings[colour].includes(nextAlloc[id]))nextAlloc[id]=buildings[colour][0];update({teams:nextTeams,assignments:nextAlloc},'Team updated')};
 const move=(id,building)=>{const colour=colours.find(c=>buildings[c].includes(building));if(!colour)return;update({teams:{...teams,[id]:colour},assignments:{...assignments,[id]:building}},'Building updated');setSelected(null)};
 const copyText=()=>['INITIAL ASSIGNMENTS',...colours.flatMap(c=>buildings[c].map(b=>'» '+b+': '+active.filter(p=>assignments[p.id]===b).map(p=>p.name).join(', ')))].join('\n');
 const total=arr=>arr.reduce((n,p)=>n+p.power,0);
 return <section style={{padding:'16px 16px 110px',color:'#eef5fc'}}>
  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,marginBottom:16}}><div><div style={{fontSize:12,color:'#f5b74f',fontWeight:800}}>STATE 3573</div><h1 style={{fontSize:25,margin:'4px 0'}}>Foundry</h1><div style={{fontSize:12,color:'#a6bed2'}}>Legion combatants and opening assignments</div></div><button style={btn} onClick={()=>{if(undo){setSaved(undo);localStorage.setItem('caroline3573_foundry_v1',JSON.stringify(undo));setUndo(null);setNotice('Last change undone')}}} disabled={!undo}>Undo</button></div>
  <label style={{display:'block',fontSize:12,color:'#a9bfd0',marginBottom:6}}>Foundry registration alliance</label><select aria-label="Foundry registration alliance" value={chosen} onChange={e=>{setAllianceFilter(e.target.value);localStorage.setItem('caroline3573_foundry_alliance',e.target.value)}} style={{...btn,width:'100%',marginBottom:14}}>{[...new Set([...alliances,chosen])].map(a=><option key={a} value={a}>{a}</option>)}</select>
  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}><div style={style}><div style={{fontSize:12,color:'#a6bed2'}}>Join</div><strong style={{fontSize:23}}>{joined.length}<span style={{color:'#8ea7bd',fontSize:14}}>/30</span></strong></div><div style={style}><div style={{fontSize:12,color:'#a6bed2'}}>Substitutes</div><strong style={{fontSize:23}}>{subs.length}<span style={{color:'#8ea7bd',fontSize:14}}>/10</span></strong></div></div>
  <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:6,marginBottom:14}}>{[['players','Players'],['teams','Teams'],['buildings','Buildings']].map(([id,label])=><button key={id} onClick={()=>setView(id)} style={{...btn,background:view===id?'#f5ad38':'#172a3e',color:view===id?'#101b28':'#e9f2fa',padding:'9px 3px'}}>{label}</button>)}</div>
  {notice&&<div role="status" style={{...style,fontSize:13,color:'#f5bd5b'}}>{notice}</div>}
  {view==='players'&&<><input aria-label="Search players" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search or add a player…" style={{...btn,width:'100%',boxSizing:'border-box',textAlign:'left',marginBottom:10}}/><div style={{display:'flex',gap:8,marginBottom:12}}><button style={{...btn,flex:1}} onClick={()=>setShowPaste(!showPaste)}>+ Paste players</button><button style={{...btn,flex:1}} onClick={()=>setCrossAlliance(v=>!v)}>{crossAlliance?'Show alliance only':'Add other alliance'}</button></div>
   {showPaste&&<div style={style}><label style={{display:'block',fontSize:13,marginBottom:8}}>Username, troop power</label><textarea value={paste} onChange={e=>setPaste(e.target.value)} rows={5} placeholder={'Player A, 6500\nPlayer B, 4300'} style={{...btn,width:'100%',boxSizing:'border-box'}}/><button style={{...btn,marginTop:8}} onClick={importRows}>Import players</button></div>}
   {rankOrder.map(r=>{const list=entries.filter(p=>p.rank===r&&(p.alliance===chosen||registeredUnder[p.id]===chosen||crossAlliance)&&p.name.toLowerCase().includes(query.toLowerCase()));if(!list.length)return null;return <div key={r} style={style}><button onClick={()=>setExpanded(x=>({...x,[r]:!x[r]}))} style={{...btn,width:'100%',textAlign:'left',display:'flex',justifyContent:'space-between'}}><span>{r} · {list.length} players</span><span>{expanded[r]?'⌄':'›'}</span></button>{expanded[r]&&list.map(p=><div key={p.id} style={{display:'flex',alignItems:'center',gap:8,padding:'10px 0',borderBottom:'1px solid #2c4155'}}><div style={{minWidth:0,flex:1}}><div style={{fontSize:14,fontWeight:650,overflow:'hidden',textOverflow:'ellipsis'}}>{p.name}{p.alliance!==chosen&&<span style={{fontSize:11,color:'#f5bd5b'}}> · {p.alliance}</span>}{!p.matched&&<span style={{fontSize:11,color:'#f5bd5b'}}> · Needs matching</span>}</div><div style={{fontSize:12,color:'#a9bfd0'}}>Troop power {format(p.power)}</div></div><button aria-label={'Join '+p.name} style={{...btn,background:registrations[p.id]==='join'?'#32694d':'#21354b',padding:'8px'}} onClick={()=>setStatus(p.id,'join')}>{registrations[p.id]==='join'?'Joined':'Join'}</button><button aria-label={'Substitute '+p.name} style={{...btn,background:registrations[p.id]==='sub'?'#725724':'#21354b',padding:'8px'}} onClick={()=>setStatus(p.id,'sub')}>{registrations[p.id]==='sub'?'Sub ✓':'Sub'}</button></div>)}</div>})}
  </>}
  {view==='teams'&&<><button style={{...btn,width:'100%',background:'#70521f',marginBottom:12}} onClick={autoTeams}>Generate balanced teams + buildings</button>{colours.map(c=>{const list=active.filter(p=>teams[p.id]===c);return <div key={c} style={style}><h2 style={{fontSize:17,margin:'0 0 8px'}}>{c} team <span style={{float:'right',fontSize:13,color:'#a9bfd0'}}>{format(total(list))}</span></h2>{list.length?list.map(p=><div key={p.id} style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}><span style={{flex:1,fontSize:13}}>{p.name} · {format(p.power)}</span><select aria-label={'Move '+p.name+' to team'} value={c} onChange={e=>assign(p.id,e.target.value)} style={{...btn,maxWidth:100}}>{colours.map(k=><option key={k}>{k}</option>)}</select></div>):<p style={{fontSize:13,color:'#9ab1c3'}}>No players assigned</p>}</div>})}{joined.filter(p=>!teams[p.id]).length>0&&<div style={style}><h3>Unassigned combatants</h3>{joined.filter(p=>!teams[p.id]).map(p=><div key={p.id} style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}><span style={{flex:1}}>{p.name}</span><select value="" onChange={e=>assign(p.id,e.target.value)} style={btn}><option value="">Assign team</option>{colours.map(c=><option key={c}>{c}</option>)}</select></div>)}</div>}</>}
  {view==='buildings'&&<><p style={{fontSize:12,color:'#9ab1c3'}}>Tap a player, then tap a building to move them. Assignments update immediately.</p>{colours.map(c=><div key={c} style={style}><h2 style={{fontSize:17,margin:'0 0 10px'}}>{c} zone</h2>{buildings[c].map(b=>{const list=active.filter(p=>assignments[p.id]===b);return <div key={b} onClick={()=>selected&&move(selected,b)} style={{border:'1px solid #43586b',borderRadius:10,padding:10,marginBottom:10,background:selected?'#233b4b':'#172a3e'}}><strong style={{fontSize:13}}>{b} · {format(total(list))}</strong><div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:9}}>{list.map(p=><button key={p.id} draggable onDragStart={e=>e.dataTransfer.setData('text/plain',p.id)} onClick={e=>{e.stopPropagation();setSelected(selected===p.id?null:p.id)}} style={{...btn,padding:'7px 9px',background:selected===p.id?'#f5ad38':'#294158',color:selected===p.id?'#152131':'white'}}>{p.name}</button>)}</div><div onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();move(e.dataTransfer.getData('text/plain'),b)}} style={{fontSize:11,color:'#9bb3c8',marginTop:8,minHeight:20}}>Drop player here or tap to assign</div></div>})}</div>)}<div style={style}><h3 style={{marginTop:0}}>Unallocated players</h3>{joined.filter(p=>!assignments[p.id]).map(p=><button key={p.id} onClick={()=>setSelected(p.id)} style={{...btn,margin:3,background:selected===p.id?'#f5ad38':'#21354b'}}>{p.name}</button>)}</div><div style={style}><h3 style={{marginTop:0}}>Initial assignments</h3><pre style={{whiteSpace:'pre-wrap',fontSize:12,lineHeight:1.7}}>{copyText()}</pre><button style={btn} onClick={()=>{navigator.clipboard?.writeText(copyText());setNotice('Assignments copied')}}>Copy assignments</button></div></>}
 </section>;
}
