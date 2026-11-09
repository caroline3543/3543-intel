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
export function TalTab({value,players,onChange,onRefreshLegion,legionRefresh,onMessage}){
 const [selected,setSelected]=useState(()=>{try{return window.sessionStorage.getItem('tal:selected-legion')||'';}catch{return '';}});
 const [check,setCheck]=useState('all');
 const [search,setSearch]=useState('');
 const [timeFilters,setTimeFilters]=useState([]);
 const [timeMode,setTimeMode]=useState('any');
 const [sort,setSort]=useState('name');
 const [registrationFilter,setRegistrationFilter]=useState('all');
 const [adding,setAdding]=useState(false);
 const [addQuery,setAddQuery]=useState('');
 const [removeId,setRemoveId]=useState('');
 const [actionsId,setActionsId]=useState('');
 const [previewOpen,setPreviewOpen]=useState(false);
 const [tournamentConfirm,setTournamentConfirm]=useState('');
 const [copying,setCopying]=useState(false);
 const [listLimit,setListLimit]=useState(40);
 const playersAnchor=useRef(null);
 const teams=(value?.teams||[]).filter(t=>['HOT','ARC','RKG'].includes(String(t.host||'').toUpperCase()));
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
 const ready=entries.filter(e=>e.check.status==='in-host').length;
 const move=entries.filter(e=>e.check.status==='move').length;
 const unverified=entries.filter(e=>e.check.status==='unknown').length;
 const percent=entries.length?Math.round(ready/entries.length*100):0;
 const times=(Array.isArray(value?.times)&&value.times.length?value.times:DEFAULT_TIMES).map(String);
 const availabilityFor=player=>{
  const raw=value?.availability?.[player.id]??value?.availability?.[String(player.fid)]??value?.records?.[player.id]?.times??[];
  return Array.isArray(raw)?[...new Set(raw.map(String))].sort((a,b)=>a.localeCompare(b)):[];
 };
 const matchesTime=player=>!timeFilters.length||(timeMode==='all'?timeFilters.every(t=>availabilityFor(player).includes(t)):timeFilters.some(t=>availabilityFor(player).includes(t)));
 const matchesSearch=player=>!search||[player.username,player.alias,player.fid].some(v=>String(v||'').toLowerCase().includes(search.toLowerCase()));
 const roster=entries.filter(e=>(check==='all'||e.check.status===check)&&matchesSearch(e.player)&&matchesTime(e.player)&&(registrationFilter==='all'||registrationFilter==='unregistered'&&e.member&&!e.member.registered||registrationFilter==='registered'&&e.member?.registered)).sort((a,b)=>{
  if(sort==='troop'){const score=p=>numeric(value?.records?.[p.id]?.troopPower);const av=score(a.player),bv=score(b.player);return av===null&&bv===null?compareNames(a.player,b.player):av===null?1:bv===null?-1:bv-av||compareNames(a.player,b.player);}
  if(sort==='city'){const av=numeric(a.player.power??a.player.providerStats?.power),bv=numeric(b.player.power??b.player.providerStats?.power);return av===null&&bv===null?compareNames(a.player,b.player):av===null?1:bv===null?-1:bv-av||compareNames(a.player,b.player);}
  if(sort==='labyrinth'){const av=numeric(a.player.providerRankings?.labyrinth?.rank),bv=numeric(b.player.providerRankings?.labyrinth?.rank);return av===null&&bv===null?compareNames(a.player,b.player):av===null?1:bv===null?-1:av-bv||compareNames(a.player,b.player);}
  if(sort==='joiner')return comparePriority(a.player,b.player);
  return compareNames(a.player,b.player);
 });
 const movePreview=moveText(entries);
 const addCandidates=team?players.filter(p=>!plannedMemberIds(team).has(p.id)&&(!addQuery||[p.username,p.alias,p.fid].some(v=>String(v||'').toLowerCase().includes(addQuery.toLowerCase())))&&matchesTime(p)).sort(compareNames).slice(0,30):[];
 const anyFilter=check!=='all'||timeFilters.length>0||registrationFilter!=='all'||search.trim();
 useEffect(()=>{try{window.sessionStorage.setItem('tal:selected-legion',effectiveSelection);}catch{}},[effectiveSelection]);
 function chooseLegion(id){setSelected(id);setCheck('all');setRegistrationFilter('all');setAdding(false);setRemoveId('');setActionsId('');setPreviewOpen(false);setTournamentConfirm('');setListLimit(40);}
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
    <div role="progressbar" aria-label="Players in the correct host alliance" aria-valuemin={0} aria-valuemax={entries.length||1} aria-valuenow={ready} style={{height:8,background:C.border,borderRadius:20,overflow:'hidden',margin:'12px 0 10px'}}><div style={{height:'100%',width:percent+'%',background:C.green}}/></div>
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
   {team&&<section   </section>
   {team&&<section style={{background:C.card,border:'1px solid '+C.border,borderRadius:12,padding:12,marginBottom:14}}>
    <div style={{display:'flex',justifyContent:'space-between',gap:8,alignItems:'center'}}><strong style={{fontSize:15}}>{legionLabel(team)} · {tournamentStatus(team)==='eliminated'?'Eliminated':'Active'}</strong><button type="button" style={{...button,fontSize:12,padding:'7px 9px',minHeight:36}} onClick={()=>setTournamentConfirm(tournamentConfirm?'':'open')}>{tournamentStatus(team)==='eliminated'?'Correct result':'Record a loss'}</button></div>
    {tournamentStatus(team)==='eliminated'&&<p style={{...muted,margin:'8px 0 0'}}>This legion is eliminated. Its roster and match history remain visible. Player assignments are read-only.</p>}
    {tournamentConfirm&&<div style={{marginTop:10}}>
     <p style={{...muted,margin:'0 0 10px'}}>{tournamentStatus(team)==='eliminated'?'Restore this legion to active? Only do this to correct an incorrect result.':'Confirm this legion lost its match? It will be marked eliminated, and its roster will remain available for review.'}</p>
     <div style={{display:'flex',gap:8}}><button style={button} onClick={()=>setTournamentConfirm('')}>Cancel</button><button style={{...button,color:tournamentStatus(team)==='eliminated'?C.gold:C.red}} disabled={!!value?.locked} onClick={confirmTournamentResult}>{tournamentStatus(team)==='eliminated'?'Restore active':'Confirm loss'}</button></div>
    </div>}
   </section>}
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
    </div>}
    {team&&<button style={{...button,width:'100%',marginBottom:10,color:C.gold}} disabled={!canEdit} onClick={()=>{setAdding(v=>!v);setRemoveId('');}}>{adding?'Close player picker':'+ Add players'}</button>}
    {adding&&team&&<div style={{background:C.card,border:'1px solid '+C.border,borderRadius:12,padding:12,marginBottom:12}}>
     <label style={{...muted,display:'block',marginBottom:6}}>Add an existing Members profile</label>
     <input aria-label="Find player to add" value={addQuery} onChange={e=>setAddQuery(e.target.value)} placeholder="Name or player ID" style={{...button,width:'100%',boxSizing:'border-box',fontSize:16,marginBottom:10}}/>
     <p style={{...muted,margin:'0 0 8px'}}>Availability filters apply. Players already assigned to another legion cannot be added here.</p>
     {addCandidates.map(p=><div key={p.id} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 0',borderTop:'1px solid '+C.border}}>
       <PlayerAvatar player={p} size={38}/><div style={{flex:1,minWidth:0}}><strong style={{fontSize:14,overflowWrap:'anywhere'}}>{p.username||p.alias||'Unknown'}</strong><div style={muted}>{availabilityFor(p).join(' · ')||'Times not confirmed'}</div></div>
       <button style={{...button,padding:'6px 10px',color:C.gold}} disabled={!canEdit||teams.some(t=>t.id!==team.id&&(t.members||[]).some(m=>m.id===p.id))} onClick={()=>addPlayer(p)}>Add</button>
      </div>)}
     {!addCandidates.length&&<p style={muted}>No matching profiles.</p>}
    </div>}
    {roster.slice(0,listLimit).map(({team:entryTeam,player,check:status,member})=>{
      const available=availabilityFor(player),isMove=status.status==='move',isCorrect=status.status==='in-host';
      const shownStat=sort==='troop'?'TAL troop power '+compact(value?.records?.[player.id]?.troopPower):sort==='city'?'City power '+compact(player.power??player.providerStats?.power):sort==='labyrinth'?'Labyrinth '+(player.providerRankings?.labyrinth?.rank?'#'+player.providerRankings.labyrinth.rank:'Not recorded'):sort==='joiner'?'Joiner strength '+([player.troops?.infantry,player.troops?.lancer,player.troops?.marksman].every(t=>String(t||'').startsWith('Helios'))?'Full Helios':'See troop tiers'):null;
      return <article key={player.id} style={{background:C.card,border:'1px solid '+C.border,borderRadius:12,padding:12,marginBottom:8}}>
       <div style={{display:'flex',alignItems:'center',gap:10}}>
        <PlayerAvatar player={player} size={46}/>
        <div style={{flex:1,minWidth:0}}>
         <div style={{display:'flex',alignItems:'baseline',gap:7,flexWrap:'wrap'}}><strong style={{fontSize:16,overflowWrap:'anywhere'}}>{player.username||player.alias||'Unknown player'}</strong>{player.furnaceLevel&&<span style={{fontSize:12,color:C.gold}}>{player.furnaceLevel}</span>}</div>
         <div style={{...muted,marginTop:3}}>{status.tag||player.allianceTag||'Alliance unknown'} · {legionLabel(entryTeam)}{!member?' · Proposed':''}</div>
        </div>
        {team&&<button aria-label={'Options for '+(player.username||player.alias||'player')} aria-expanded={actionsId===player.id} style={{...button,minWidth:44,padding:8,background:'transparent'}} onClick={()=>{setActionsId(actionsId===player.id?'':player.id);setRemoveId('');}}>•••</button>}
       </div>
       <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap',marginTop:9}}>
        <span style={{fontSize:11,color:C.icy}}>UTC</span>
        {available.length?available.map(t=><span key={t} style={{fontSize:12,padding:'4px 7px',borderRadius:6,background:timeFilters.includes(t)?C.green+'22':C.section,border:'1px solid '+(timeFilters.includes(t)?C.green:C.border),color:timeFilters.includes(t)?C.green:C.icy}}>{t}</span>):<span style={{fontSize:12,color:C.icy}}>Times not confirmed</span>}
       </div>
       <div style={{display:'flex',flexWrap:'wrap',gap:'4px 12px',marginTop:9,alignItems:'center'}}>
        <span style={{fontSize:13,fontWeight:isMove?600:400,color:isMove?C.gold:isCorrect?C.green:C.icy}}>{isMove?'Move '+(status.tag||'No alliance')+' → '+entryTeam.host:isCorrect?'In correct alliance':'Alliance unverified'}</span>
        {member&&!member.registered&&<span style={{fontSize:12,color:C.gold}}>Needs registration</span>}
        {member?.registered&&<span style={{fontSize:12,color:C.green}}>Registered</span>}
       </div>
       {shownStat&&<div style={{...muted,marginTop:7}}>{shownStat}</div>}
       {actionsId===player.id&&team&&<div style={{paddingTop:10,marginTop:10,borderTop:'1px solid '+C.border}}>
        <button style={{...button,color:C.red,width:'100%',textAlign:'left'}} disabled={!canEdit} onClick={()=>setRemoveId(player.id)}>Remove from legion…</button>
        <div style={{...muted,marginTop:6}}>Player ID: {player.fid||'Not recorded'}</div>
       </div>}
       {removeId===player.id&&team&&<div style={{paddingTop:10,marginTop:10,borderTop:'1px solid '+C.border}}>
        <p style={{...muted,margin:'0 0 10px'}}>Remove from {legionLabel(team)}? This keeps the Members profile and availability.</p>
        <div style={{display:'flex',gap:8}}><button style={button} onClick={()=>setRemoveId('')}>Cancel</button><button style={{...button,color:C.red}} disabled={!canEdit} onClick={()=>removePlayer(player)}>Remove player</button></div>
       </div>}
      </article>;
    })}
    {!roster.length&&<div style={{padding:18,background:C.card,borderRadius:12,color:C.icy,fontSize:14}}>No players match the current filters. <button style={{...button,marginTop:10,width:'100%'}} onClick={resetFilters}>Clear filters</button></div>}
    {roster.length>listLimit&&<button style={{...button,width:'100%',marginTop:8}} onClick={()=>setListLimit(n=>n+40)}>Show 40 more players</button>}
   </section>
  </>}
 </section>;
}
