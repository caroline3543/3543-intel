import {useMemo,useState} from 'react';
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
const norah=p=>Boolean(p.joinerHeroes?.some?.(h=>/norah/i.test(typeof h==='string'?h:h.name||'')&&((typeof h==='string')||Number(h.skillLevel||h.topRightSkill||0)>=5))||p.norahSkill5);
function textOfTeams(groups,playersById) {
 return groups.map(g=>{
  const leader=playersById.get(String(g.leader));
  const names=g.members.map(id=>name(playersById.get(String(id))||{id}));
  return (g.color?COLORS.find(c=>c.id===g.color)?.name+' Team\n':'')+'Leader: '+(leader?name(leader):'Not assigned')+'\n* '+names.join(', ');
 }).join('\n\n');
}
const initialGroups=()=>COLORS.map((c,i)=>({key:i+1,color:c.id,leader:null,members:[]}));
export function TalTeamsTab({value,players=[]}){
 const legions=(value?.teams||[]).filter(t=>['GLR'].includes(String(t.host||'').toUpperCase()));
 const [legionId,setLegionId]=useState(legions[0]?.id||'');
 const selectedLegion=legions.find(t=>t.id===legionId)||legions[0];
 const [matchTime,setMatchTime]=useState('14:00');
 const [step,setStep]=useState('teams');
 const [groups,setGroups]=useState(initialGroups);
 const [chosen,setChosen]=useState([]);
 const [powers,setPowers]=useState({});
 const [bulk,setBulk]=useState('');
 const [showBulk,setShowBulk]=useState(false);
 const [mode,setMode]=useState('stack');
 const [assignment,setAssignment]=useState({});
 const [picked,setPicked]=useState('');
 const [activeColour,setActiveColour]=useState('blue');
 const [dragId,setDragId]=useState('');
 const [preview,setPreview]=useState(false);
 const [copyMessage,setCopyMessage]=useState('');
 const [confirmed,setConfirmed]=useState(false);
 const [locked,setLocked]=useState([]);
 const [manual,setManual]=useState(true);
 const [editingTeam,setEditingTeam]=useState(null);
 const byId=useMemo(()=>new Map(players.map(p=>[String(p.id),p])),[players]);
 const pool=useMemo(()=>{
  if(!selectedLegion)return [];
  const ids=[...plannedMemberIds(selectedLegion)];
  return ids.map(id=>byId.get(String(id))).filter(Boolean).filter(p=>{
   const avail=value?.availability?.[p.id]??value?.availability?.[String(p.fid)]??value?.records?.[p.id]?.times??[];
   return Array.isArray(avail)&&avail.map(String).includes(matchTime);
  });
 },[selectedLegion,value,byId,matchTime]);
 const selectedIds=chosen.filter(id=>pool.some(p=>String(p.id)===String(id)));
 const selectedPlayers=selectedIds.map(id=>byId.get(String(id))).filter(Boolean);
 const leaderCandidates=[...selectedPlayers].filter(p=>p.roles?.some?.(r=>/rally lead/i.test(String(r)))||p.rallyLeader||p.leaderProfile?.role==='leader');
 const powerOf=id=>valueNumber(powers[String(id)]??value?.records?.[id]?.troopPower);
 const teamPower=g=>[g.leader,...g.members].reduce((sum,id)=>sum+(powerOf(id)||0),0);
 const allAssigned=groups.flatMap(g=>[g.leader,...g.members]).filter(Boolean).map(String);
 const missing=selectedIds.filter(id=>!allAssigned.includes(String(id)));
 const activePlayers=groups.flatMap(g=>[g.leader,...g.members].filter(Boolean).map(id=>({id:String(id),g})));
 const assignedCount=activePlayers.filter(({id})=>assignment[id]).length;
 const teamFor=id=>groups.find(g=>String(g.leader)===String(id)||g.members.some(m=>String(m)===String(id)));
 function resetForMatch(nextLegion=legionId,nextTime=matchTime){setLegionId(nextLegion);setMatchTime(nextTime);setChosen([]);setPowers({});setBulk('');setGroups(initialGroups());setAssignment({});setPicked('');setStep('teams');setConfirmed(false);setLocked([]);setPreview(false);}
 function chooseAll(){setChosen(pool.map(p=>String(p.id)));}
 function toggle(id){const key=String(id);setChosen(old=>old.includes(key)?old.filter(x=>x!==key):[...old,key]);}
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
  if(selectedPlayers.length<4){setCopyMessage('Select at least four players before generating teams.');return;}
  const unknown=selectedPlayers.filter(p=>powerOf(p.id)===null);
  if(unknown.length){setCopyMessage('Enter troop power for '+unknown.length+' selected player'+(unknown.length===1?'':'s')+' before generating. Unknown power cannot be counted as zero.');return;}
  const sorted=[...selectedPlayers].sort((a,b)=>powerOf(b.id)-powerOf(a.id));
  const eligible=sorted.filter(p=>leaderCandidates.some(l=>String(l.id)===String(p.id)));
  // Preview supports a manual fallback when leadership has not yet been recorded.
  if(eligible.length<4){setCopyMessage('Four rally leaders are required. Set Rally Lead on player profiles before generating, or choose the four leaders manually below.');return;}
  const leads=eligible.slice(0,4),used=new Set(leads.map(p=>String(p.id)));
  const joiners=sorted.filter(p=>!used.has(String(p.id)));
  const next=initialGroups().map((g,i)=>({...g,leader:String(leads[i].id)}));
  if(mode==='stack'){
   joiners.forEach((p,index)=>{
    const groupIndex=Math.min(3,Math.floor(index/(Math.ceil(joiners.length/4)||1)));
    next[groupIndex].members.push(String(p.id));
   });
  }else{
   const cap=Math.ceil(joiners.length/4);
   joiners.forEach(p=>{
    const target=[...next].filter(g=>g.members.length<cap).sort((a,b)=>teamPower(a)-teamPower(b)||a.members.length-b.members.length)[0];
    target.members.push(String(p.id));
   });
  }
  setGroups(next);setAssignment({});setConfirmed(false);setStep('teams');setCopyMessage('Generated four '+(mode==='stack'?'power-stacked':'power-balanced')+' teams. Review before confirming.');
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
  const colour=COLORS.find(c=>c.id===g.color);
  if(!colour?.buildings.includes(building)){setCopyMessage('This building belongs to another colour team. Reassign the player’s team first.');return;}
  setAssignment(old=>({...old,[String(id)]:building}));
  setPicked('');
 }
 function autoAssign(){
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
 const teamText=textOfTeams(groups,byId);
 return <section style={{padding:'14px 20px 35px'}}>
  <h2 style={{fontSize:25,letterSpacing:'-.4px',margin:'0 0 8px'}}>TAL Teams</h2>
  <p style={{...small,margin:'0 0 12px'}}>Build teams, then allocate every player to a building. Drafts aren't shared between devices.</p>
  {!legions.length?<p style={{...panel,...small}}>No legions in your TAL plan. Assign players in TAL Planner first.</p>:<>
   <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
    <label style={small}>Legion<select value={selectedLegion?.id||''} onChange={e=>resetForMatch(e.target.value,matchTime)} style={{...btn,width:'100%',marginTop:5}}>{legions.map(t=><option value={t.id} key={t.id}>{legionLabel(t)}</option>)}</select></label>
    <label style={small}>Match time · UTC<select value={matchTime} onChange={e=>resetForMatch(legionId,e.target.value)} style={{...btn,width:'100%',marginTop:5}}>{(value?.times||DEFAULT_TIMES).map(t=><option key={t}>{t}</option>)}</select></label>
   </div>
   <div role="tablist" aria-label="TAL team planning phase" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
    <button role="tab" aria-selected={step==='teams'} style={{...btn,color:step==='teams'?C.gold:C.icy,borderColor:step==='teams'?C.gold:C.border}} onClick={()=>setStep('teams')}>1 · Colour teams</button>
    <button role="tab" aria-selected={step==='buildings'} style={{...btn,color:step==='buildings'?C.gold:C.icy,borderColor:step==='buildings'?C.gold:C.border}} onClick={()=>{setStep('buildings');setPicked('')}}>2 · Initial assignments</button>
   </div>
   {step==='teams'&&<>
    <section style={{...panel,marginBottom:12}}>
     <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}><strong>Available player pool</strong><span style={small}>{selectedIds.length} selected · {pool.length} available</span></div>
     <p style={{...small,margin:'6px 0'}}>Availability comes from the selected legion and UTC time. This is not confirmed attendance.</p>
     <button style={{...btn,marginBottom:8}} onClick={chooseAll}>Select all available</button>
     <div style={{maxHeight:195,overflowY:'auto',borderTop:'1px solid '+C.border}}>
      {pool.map(p=><label key={p.id} style={{display:'flex',alignItems:'center',gap:9,minHeight:40,borderBottom:'1px solid '+C.border,fontSize:13}}><input type="checkbox" checked={selectedIds.includes(String(p.id))} onChange={()=>toggle(p.id)} style={{width:18,height:18}}/><span style={{flex:1,overflowWrap:'anywhere'}}>{name(p)}</span><span style={{...small,whiteSpace:'nowrap'}}>{powerFormat(powerOf(p.id))}</span></label>)}
      {!pool.length&&<p role="status" style={small}>{!players.length?'No GLR roster loaded. Open Members and load GLR first.':!selectedLegion?.members?.length?'No one is assigned to this legion. Add players in TAL Planner first.':'No selected players have recorded availability at '+matchTime+' UTC. Missing availability is not the same as unavailable. Update the poll records or choose another time.'}</p>}
     </div>
    </section>
    <section style={{...panel,marginBottom:12}}>
     <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}><strong>Troop power</strong><button style={{...btn,minHeight:35}} onClick={()=>setShowBulk(v=>!v)}>{showBulk?'Close':'Batch paste'}</button></div>
     <p style={{...small,margin:'6px 0 10px'}}>Enter power individually or paste lines formatted as Username, Troop power. Preview values are not written to player profiles.</p>
     {showBulk&&<div style={{marginBottom:10}}><textarea aria-label="Paste troop power" placeholder={'Erth, 8997\nVanellope, 4717'} value={bulk} onChange={e=>setBulk(e.target.value)} rows={5} style={{...btn,width:'100%',boxSizing:'border-box',fontSize:16,resize:'vertical'}}/><button style={{...btn,width:'100%',marginTop:6,color:C.gold}} onClick={saveBatch}>Validate and apply</button></div>}
     <div style={{maxHeight:185,overflowY:'auto'}}>{selectedPlayers.map(p=><label key={p.id} style={{display:'flex',alignItems:'center',gap:8,marginBottom:6,fontSize:13}}><span style={{flex:1,minWidth:0,overflowWrap:'anywhere'}}>{name(p)}</span><input type="number" inputMode="numeric" min="0" aria-label={'Troop power for '+name(p)} value={powers[String(p.id)]??value?.records?.[p.id]?.troopPower??''} onChange={e=>setPowers(old=>({...old,[String(p.id)]:e.target.value}))} placeholder="Power" style={{...btn,width:105,minHeight:38,fontSize:16}}/></label>)}</div>
    </section>
    <section style={{...panel,marginBottom:12}}>
     <strong>Generate teams</strong>
     <div style={{display:'flex',gap:8,marginTop:10}}>{[['stack','Power-stacked'],['balanced','Balanced']].map(([id,label])=><button key={id} style={{...btn,flex:1,borderColor:mode===id?C.gold:C.border,color:mode===id?C.gold:C.icy}} aria-pressed={mode===id} onClick={()=>setMode(id)}>{label}</button>)}</div>
     <button style={{...btn,width:'100%',marginTop:9,background:C.gold,color:C.bg}} onClick={generate}>Auto-generate four teams</button>
     
    </section>
    <div style={{...small,marginBottom:9}}>{selectedIds.length} participants · {missing.length} not yet placed in a team</div>
    {groups.map((g,i)=>{
     const col=COLORS.find(c=>c.id===g.color),ids=[g.leader,...g.members].filter(Boolean),ps=ids.map(id=>byId.get(id)).filter(Boolean),other=groups.flatMap(t=>[t.leader,...t.members].filter(Boolean)).map(String);
     const isEmpty=!g.leader&&!g.members.length,editing=editingTeam===g.key;
     return <section key={g.key} style={{background:isEmpty?'#17293A':'#192E41',borderRadius:12,padding:'12px 12px 10px',marginBottom:9,borderLeft:'3px solid '+col.color}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10}}>
       <div style={{minWidth:0,display:'flex',alignItems:'center',gap:9}}><span style={{width:10,height:10,borderRadius:'50%',background:col.color,flexShrink:0}}/><strong style={{color:isEmpty?col.color:C.white,fontSize:16}}>{col.name} Team</strong></div>
       <span style={{fontSize:13,fontVariantNumeric:'tabular-nums',fontWeight:600,color:ids.length?C.white:C.icy}}>{ids.length?powerFormat(teamPower(g))+' power':'0 players'}</span>
      </div>
      {isEmpty&&!editing?<div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,marginTop:9}}>
       <span style={{...small,fontSize:13}}>No leader assigned</span>
       <button type="button" style={{...btn,minHeight:44,color:C.gold,background:'transparent',borderColor:'#415365'}} onClick={()=>setEditingTeam(g.key)}>Assign leader</button>
      </div>:<>
       {!!ids.length&&<div style={{display:'flex',flexWrap:'wrap',gap:13,margin:'9px 0',fontSize:12,color:'#CAD7E0'}}>
        <span>{ids.length} players</span><span>FC8 {ps.filter(p=>fcNumber(p)===8).length}</span><span>Helios {ps.filter(helios).length}</span><span>Norah {g.members.map(id=>byId.get(id)).filter(p=>p&&norah(p)).length}</span>
       </div>}
       {g.leader&&<div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,padding:'6px 0',fontSize:14}}><span style={{minWidth:0,overflowWrap:'anywhere'}}><span aria-hidden="true" style={{color:C.gold,marginRight:7}}>♛</span><strong>{name(byId.get(String(g.leader))||{id:g.leader})}</strong></span><span style={{...small,fontVariantNumeric:'tabular-nums'}}>{powerFormat(powerOf(g.leader))}</span></div>}
       {g.members.map(id=><div key={id} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 0',borderTop:'1px solid #304355'}}>
        <span style={{fontSize:14,flex:1,minWidth:0,overflowWrap:'anywhere'}}>{name(byId.get(String(id))||{id})}</span>
        <span style={{...small,fontVariantNumeric:'tabular-nums'}}>{powerFormat(powerOf(id))}</span>
        <select aria-label={'Move '+name(byId.get(String(id))||{id})+' to another team'} value={g.key} onChange={e=>moveMember(id,Number(e.target.value))} style={{...btn,width:82,padding:6,fontSize:12,minHeight:38}}>{groups.map(t=><option key={t.key} value={t.key}>{COLORS.find(c=>c.id===t.color)?.name}</option>)}</select>
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
    <button style={{...btn,width:'100%',background:C.gold,color:C.bg,marginBottom:10}} disabled={missing.length>0||groups.some(g=>!g.leader)} onClick={()=>{setConfirmed(true);setStep('buildings')}}>Confirm teams · Assign buildings</button>
    <details style={{...panel}}><summary style={{color:C.gold,cursor:'pointer'}}>Preview copy teams</summary><pre style={{whiteSpace:'pre-wrap',fontFamily:'inherit',fontSize:13}}>{teamText}</pre><button style={btn} onClick={()=>copy(teamText)}>Copy teams</button></details>
   </>}
   {step==='buildings'&&<>
    <section style={{...panel,marginBottom:12}}>
     <div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'center'}}><strong>Initial assignments</strong><strong style={{color:assignedCount===activePlayers.length?C.green:C.gold}}>{assignedCount} / {activePlayers.length} assigned</strong></div>
     <p style={{...small,margin:'6px 0 10px'}}>Drag players by their handle into another building in the same colour territory. On mobile you can also tap a player, then tap the destination building.</p>
     <div style={{display:'flex',gap:7}}><button style={{...btn,flex:1,color:C.gold}} onClick={autoAssign} disabled={!activePlayers.length}>Auto-allocate</button><button style={{...btn,flex:1}} onClick={()=>setAssignment({})}>Clear buildings</button></div>
     {!!missing.length&&<p style={{...small,color:C.gold,marginBottom:0}}>There are {missing.length} players missing from the four teams. Return to Colour teams to place them first.</p>}
    </section>
    <div style={{display:'flex',overflowX:'auto',gap:7,marginBottom:12,paddingBottom:5}}>{COLORS.map(c=><button key={c.id} onClick={()=>{setActiveColour(c.id);setPicked('')}} style={{...btn,flex:'0 0 105px',borderColor:activeColour===c.id?c.color:C.border,background:activeColour===c.id?c.bg:C.section,color:activeColour===c.id?c.color:C.icy}}>{c.name} · {activePlayers.filter(p=>p.g.color===c.id).length}</button>)}</div>
    {(() => {
     const col=COLORS.find(c=>c.id===activeColour);
     const teamPlayers=activePlayers.filter(p=>p.g.color===activeColour);
     const unallocated=teamPlayers.filter(p=>!assignment[p.id]);
     const moveWithin=(id,building)=>{assign(id,building);setDragId('');};
     return <section style={{...panel,background:col.bg,borderColor:col.color+'77',marginBottom:12}}>
      <strong style={{color:col.color}}>{col.name} Team · {teamPlayers.length} players</strong>
      {unallocated.length>0&&<div style={{marginTop:10}}><p style={{...small,color:col.color,margin:'0 0 7px'}}>Unallocated · {unallocated.length}</p>{unallocated.map(({id})=><button key={id} draggable="true" onDragStart={e=>{e.dataTransfer.setData('text/plain',id);setDragId(id)}} onDragEnd={()=>setDragId('')} onClick={()=>setPicked(id)} style={{...btn,width:'100%',textAlign:'left',marginBottom:5,borderColor:picked===id?col.color:C.border}}>⠿ {name(byId.get(id)||{id})}</button>)}</div>}
      <div style={{display:'grid',gap:10,marginTop:12}}>
       {col.buildings.map(building=>{
        const placed=teamPlayers.filter(p=>assignment[p.id]===building);
        return <div key={building} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();moveWithin(e.dataTransfer.getData('text/plain')||dragId,building)}} style={{background:C.bg+'aa',border:'1px dashed '+col.color+'99',borderRadius:11,padding:10,minHeight:96}}>
         <button onClick={()=>picked&&moveWithin(picked,building)} disabled={!picked} style={{...btn,width:'100%',textAlign:'left',border:0,background:'transparent',padding:'4px 0',minHeight:30,color:col.color}}><strong>{building}</strong> · {placed.length}{picked?' · Tap to place selected player':''}</button>
         {placed.length?placed.map(({id})=><button key={id} type="button" draggable="true" onDragStart={e=>{e.dataTransfer.setData('text/plain',id);setDragId(id)}} onDragEnd={()=>setDragId('')} onClick={()=>setPicked(picked===id?'':id)} style={{...btn,display:'flex',alignItems:'center',gap:8,width:'100%',marginTop:5,textAlign:'left',borderColor:picked===id?col.color:C.border}}><span aria-hidden>⠿</span><span style={{flex:1}}>{name(byId.get(id)||{id})}</span>{picked===id?'✓':''}</button>):<p style={small}>Drop a player here</p>}
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
   {copyMessage&&<div role="status" style={{...panel,color:C.gold,fontSize:12,marginTop:10,display:'flex',gap:10,justifyContent:'space-between'}}>{copyMessage}<button style={{...btn,minHeight:30,padding:'3px 7px'}} onClick={()=>setCopyMessage('')}>×</button></div>}
  </>}
 </section>;
}