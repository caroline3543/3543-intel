import { monthlyTransferHistory } from '../../services/automaticMembershipPolicy.js';
import { transferNavigation,filterTransferPlayers,normalizeTransferEvents } from '../../services/automaticMembershipTransferView.js';
import { mightpulseRequest } from '../../services/mightpulseService.js';
import { verifiedPlayerLocation } from '../../services/verifiedPlayerLocation.js';
import {PlayerSearch} from './PlayerSearch.jsx';
import { useState, useEffect, useRef } from 'react';
import { C } from '../../utils/constants.js';
import { PlayerCard } from './PlayerCard.jsx';
import { ProfileView } from './ProfileView.jsx';
import { PlayerSheet } from './PlayerSheet.jsx';
import { RoleManagerSheet } from './RoleManagerSheet.jsx';
import { RallyLeaderProfileSheet } from './RallyLeaderProfileSheet.jsx';
import FieldRegistry from './FieldRegistry.jsx';
import { RosterFilters } from './RosterFilters.jsx';
import { RosterBulkEditor } from './RosterBulkEditor.jsx';
import { EMPTY_FILTERS, matchesRosterFilters, rosterFilterCount, troopGaps, latestRosterFetch, suspectedTransferOut, validPlayerFid, archiveStateTransfer, restoreStateTransfer, moveReviewedPlayerToNoAlliance, reassignReviewedPlayer, applyVerifiedMembership } from '../../services/rosterViewService.js';
const button={minHeight:44,borderRadius:10,border:`1px solid ${C.border}`,background:C.section,color:C.icy,padding:'10px 12px',fontSize:14,fontWeight:600,cursor:'pointer'};

const PRIMARY_SORTS=[['name','Name'],['power','City power'],['labyrinth','Labyrinth'],['progression','Troop tiers']];
const EXTRA_SORTS=[['furnace','Furnace'],['kills','Kills'],['labyrinthScore','Labyrinth score'],['review','Needs review']];
const T10=[66,71,76,83,88,94,99,104,110,115,121],T11=[80,86,92,100,106,114,120,126,135,141,148];
function tierPower(raw){
 const x=String(raw||'').trim().toUpperCase();if(!x)return null;
 const fc=Number(x.match(/FC\s*(\d+)/)?.[1]||0);
 if(/T12|EXALTED/.test(x))return 96;
 if(/HELIOS|T11/.test(x))return T11[Math.min(fc,10)]??null;
 if(/FC\s*\d+|T10/.test(x))return T10[Math.min(fc,10)]??null;
 return ({7:28,8:38,9:50})[Number(x.match(/T\s*(\d+)/)?.[1]||0)]??null;
}
function troopScore(p){const n=['infantry','lancer','marksman'].map(k=>tierPower(p.troops?.[k]));return n.every(v=>v!==null)?n.reduce((a,b)=>a+b,0)/3:null;}
const playerName = p => p.username || p.alias || '';
const numeric = value => {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const number = Number(String(value).replace(/,/g,''));
  return Number.isFinite(number) ? number : null;
};
const furnaceValue = value => {
  if(!value)return null;
  const match=String(value).match(/(?:FC|F)\s*(\d+)/i);
  return match ? Number(match[1]) : null;
};
function rosterSortValue(player, field) {
  switch(field){
    case 'labyrinth': return numeric(player.providerRankings?.labyrinth?.rank);
    case 'progression': return troopScore(player);
    case 'labyrinthScore': return numeric(player.providerRankings?.labyrinth?.score);
    case 'furnace': return furnaceValue(player.furnaceLevel);
    case 'power': return numeric(player.power ?? player.providerStats?.power);
    case 'kills': return numeric(player.kills ?? player.providerStats?.kills);
    case 'review': return troopGaps(player).length + Number(!player.fid) + Number(!player.allianceTag);
    default: return null;
  }
}
function sortDetail(player,field) {
  if(field==='name')return null;
  if(field==='progression'){const n=troopScore(player);return {label:'Troop tier rating',value:n===null?'Incomplete':n.toLocaleString('en-US',{maximumFractionDigits:1})};}
  const value=rosterSortValue(player,field);
  if(field==='furnace')return {label:'Furnace level',value:player.furnaceLevel||'Not recorded'};
  const label=({labyrinth:'Labyrinth rank',labyrinthScore:'Labyrinth score',power:'City power',kills:'Kills',review:'Fields to review'})[field];
  if(!label)return null;
  return {label,value:value===null?'Not recorded':field==='labyrinth'?('#'+value.toLocaleString('en-US')):value.toLocaleString('en-US')};
}
function compareRosterPlayers(a,b,field,direction,events) {
  const order=direction==='asc'?1:-1;
  const fallback=()=>playerName(a).localeCompare(playerName(b),undefined,{numeric:true,sensitivity:'base'}) || String(a.fid||a.id).localeCompare(String(b.fid||b.id));
  if(field==='name')return fallback()*order;
  const av=rosterSortValue(a,field), bv=rosterSortValue(b,field);
  if(av===null && bv===null)return fallback();
  if(av===null)return 1; // Keep unknown rankings and stats at the bottom in both directions.
  if(bv===null)return -1;
  return (av-bv)*order || fallback();
}

export function RosterTab({initialPlayerId,onInitialPlayerOpened,players,events,roles,onSaveCustomRoles,onSavePlayer,onApplyConfirmedProfileSave,onUpdatePlayers,onDeletePlayer,onGoToIntel,showToast,onLoadAlliance,legionPlan,onRefreshLegion,legionRefresh,teamworkPreferences,onSaveTeamworkPreferences,enable3573Tracking=false,transferEvents=[]}) {
  const [search,setSearch]=useState('');
  const [filters,setFilters]=useState({...EMPTY_FILTERS});
  const [filtersOpen,setFiltersOpen]=useState(false);
  const [optionsOpen,setOptionsOpen]=useState(false);
  const [allianceMoreOpen,setAllianceMoreOpen]=useState(false);
  const [trackingView,setTrackingView]=useState('current');
  const [moreSorts,setMoreSorts]=useState(false);
  const [showIds,setShowIds]=useState(false);
  const [visibleCount,setVisibleCount]=useState(20);
  const loadRef=useRef(null);
  const [grouped,setGrouped]=useState(false);
  const [sort,setSort]=useState('name');
  const [sortDirection,setSortDirection]=useState('asc');
  const [viewingPlayer,setViewingPlayer]=useState(null);
  const [profileOpen,setProfileOpen]=useState(false);
  const [playerLookup,setPlayerLookup]=useState({status:'idle'});
  async function checkPlayerName(player){
    const fid=String(player?.fid||'').trim();
    if(!validPlayerFid(fid)){setPlayerLookup({status:'error',message:'This player needs a valid Player ID.'});return;}
    setPlayerLookup({status:'loading',fid});
    try{
      const response=await mightpulseRequest('player',{fid});
      const base=response?.data?.player||response?.data;
      const returnedId=String(base?.chief_id??base?.fid??response?.data?.chief_id??'');
      if(returnedId!==fid)throw Error('Provider returned a different player ID. No changes made.');
      const name=String(base?.nick_name||'').trim();
      if(!name)throw Error('Provider did not return a username. No changes made.');
      setPlayerLookup({status:'success',fid,name,retrievedAt:response.retrieved_at||null,cachedAt:response?.data?.cached_at||base?.cached_at||null});
    }catch(e){setPlayerLookup({status:'error',fid,message:e.message||'Lookup failed'});}
  }
  function applyCheckedName(player){
    if(playerLookup.status!=='success'||playerLookup.fid!==String(player.fid)||!playerLookup.name)return;
    onSavePlayer({...player,username:playerLookup.name,pastUsernames:[...new Set([...(player.pastUsernames||[]),player.username].filter(Boolean))]});
    setPlayerLookup({status:'idle'});
  }

  const [locationChecks,setLocationChecks]=useState({});
  const [onlineChecks,setOnlineChecks]=useState({});
  const [locationBusy,setLocationBusy]=useState(false);
  const [membershipNow,setMembershipNow]=useState(()=>Date.now());
  useEffect(()=>{const timer=setInterval(()=>setMembershipNow(Date.now()),60_000);return ()=>clearInterval(timer);},[]);
  const [reviewDestination,setReviewDestination]=useState('');
  const [reviewOtherTag,setReviewOtherTag]=useState('');
  async function checkLocation(player){
    const fid=String(player.fid||player.playerId||player.id||'').trim();
    if(!validPlayerFid(fid)){setLocationChecks(v=>({...v,[player.id]:{status:'error',message:'Valid player ID required'}}));return;}
    setLocationChecks(v=>({...v,[player.id]:{status:'loading'}}));
    try{
      const response=await mightpulseRequest('player',{fid});
      const found=verifiedPlayerLocation(response,fid);
      const base=response.data.player;
      const online=base.last_online_at??base.last_online??base.last_login_at??base.last_login??base.lastOnline??null;
      setOnlineChecks(v=>({...v,[player.id]:online}));
      setLocationChecks(v=>({...v,[player.id]:found}));
      // Only verified, recent in-state observations can change alliance.
      // External state transfers still require explicit archive confirmation.
      if(found.state==='3573'){
        onSavePlayer(applyVerifiedMembership(player,found));
        if(String(player.allianceTag||'').trim()!==found.tag) showToast?.('API-confirmed alliance: '+(found.tag||'No Alliance'));
      }
    }catch(e){setLocationChecks(v=>({...v,[player.id]:{status:'error',message:e.message||'Location unavailable'}}));}
  }
  async function checkAllLocations(){
    if(locationBusy)return;setLocationBusy(true);
    try{for(const p of players.filter(isReview)){await checkLocation(p);}}finally{setLocationBusy(false);}
  }
  function applyLocation(player){
    const found=locationChecks[player.id];if(found?.status!=='verified')return;
    if(found.state==='3573'){
      onSavePlayer(applyVerifiedMembership(player,found));
      showToast?.('Confirmed in state 3573 · '+(found.tag||'No alliance'));
    }else{
      onSavePlayer(archiveStateTransfer(player,found));
      showToast?.('Transferred-out profile saved · State '+found.state);
    }
  }
  const [editingPlayer,setEditingPlayer]=useState(null);
  const [leaderOpen,setLeaderOpen]=useState(false);
  const [fieldsOpen,setFieldsOpen]=useState(false);
  const [rolesOpen,setRolesOpen]=useState(false);
  const [selecting,setSelecting]=useState(false);
  const [selected,setSelected]=useState(new Set());
  const [editingSelection,setEditingSelection]=useState(false);
  useEffect(()=>{
    if(!initialPlayerId)return;
    const player=players.find(p=>p.id===initialPlayerId);
    if(player){setViewingPlayer(player);setProfileOpen(true);}
    onInitialPlayerOpened?.();
  },[initialPlayerId,players,onInitialPlayerOpened]);
  // Keep open profiles current after API refreshes and manual edits.
  const currentPlayer=players.find(p=>p.id===viewingPlayer?.id)||viewingPlayer;
  const matchesSearch=p=>!search||[p.username,p.alias,p.fid,...(p.pastUsernames||[])].some(v=>String(v||'').toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const isTransferred=p=>p.membershipStatus==='transferred_out';
  const isReview=p=>!isTransferred(p)&&(p.membershipStatus==='transfer_review'||(enable3573Tracking&&suspectedTransferOut(p,membershipNow)));
  const transferView=transferNavigation(transferEvents,membershipNow);
  const transferMonths=monthlyTransferHistory(normalizeTransferEvents(transferEvents));
  const transferredInIds=new Set(filterTransferPlayers(players,transferEvents,'in').map(p=>String(p.fid)));
  const visible=players.filter(p=>!enable3573Tracking?matchesRosterFilters(p,search,filters)&&(filters.alliance?p.membershipStatus!=='unverified':true):trackingView==='transferred_in'?transferredInIds.has(String(p.fid))&&!isTransferred(p)&&matchesSearch(p):trackingView==='transferred'?isTransferred(p)&&matchesSearch(p):trackingView==='review'?isReview(p)&&matchesSearch(p):!isTransferred(p)&&matchesRosterFilters(p,search,filters)).sort((a,b)=>compareRosterPlayers(a,b,sort,sortDirection,events));
  const key=JSON.stringify([search,filters,sort,sortDirection,grouped,trackingView]);
  const displayed=visible.slice(0,visibleCount);
  useEffect(()=>{setVisibleCount(20);},[key]);
  useEffect(()=>{if(!loadRef.current||visibleCount>=visible.length||typeof IntersectionObserver==='undefined')return;
    const ob=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting))setVisibleCount(n=>Math.min(n+20,visible.length));},{rootMargin:'350px 0px'});
    ob.observe(loadRef.current);return()=>ob.disconnect();
  },[key,visibleCount,visible.length]);
  const changeSort=id=>{setMoreSorts(false);if(id===sort)setSortDirection(d=>d==='asc'?'desc':'asc');else{setSort(id);setSortDirection(id==='name'||id==='labyrinth'?'asc':'desc');}};
  const extraSelected=EXTRA_SORTS.some(([id])=>id===sort);
  const filterCount=rosterFilterCount(filters);
  const mainAllianceTags=['ARC','HOT','RKG','WAR','LUN'];
  const allianceTags=[...new Set(players.filter(p=>!isTransferred(p)).map(p=>p.allianceTag).filter(Boolean))].filter(tag=>!mainAllianceTags.includes(tag)).sort();
  const reviewCount=players.filter(p=>isReview(p)).length;
  const onlineLabel=p=>{const value=onlineChecks[p.id]??p.providerStats?.lastOnline??p.providerStats?.last_online_at??p.providerStats?.last_online; if(value===null||value===undefined||value==='')return 'Not provided by API';const n=Number(value);const d=typeof value==='number'||(/^\d{10,13}$/.test(String(value)))?new Date(n<1e12?n*1000:n):new Date(value);return Number.isFinite(d.getTime())?d.toLocaleString():'Not provided by API';};
  function markMembership(player,status){onSavePlayer({...player,membershipStatus:status,membershipReviewedAt:new Date().toISOString(),...(status==='transferred_out'?{lastKnownAlliance:player.allianceTag}:{} )});showToast?.(status==='transferred_out'?'Transfer confirmed':status==='transfer_review'?'Added to transfer review':'Player restored to current roster');}
  const lastFetch=latestRosterFetch(players);
  function toggle(id){setSelected(prev=>{const next=new Set(prev);next.has(id)?next.delete(id):next.add(id);return next;});}
  function stopSelection(){setSelecting(false);setSelected(new Set());setEditingSelection(false);}
  function applyReviewBulk(){
    const chosen=players.filter(p=>selected.has(p.id)&&!isTransferred(p));
    if(!chosen.length)return;
    const destination=reviewDestination==='__no_alliance'?'':reviewDestination==='__other'?reviewOtherTag.trim().toUpperCase():reviewDestination;
    if(destination && !/^[A-Z0-9]{2,12}$/.test(destination)){showToast?.('Enter a valid alliance tag (2–12 letters or digits).','error');return;}
    const reviewedAt=new Date().toISOString();
    onUpdatePlayers(chosen.map(p=>reassignReviewedPlayer(p,destination,reviewedAt)));
    showToast?.(chosen.length+' player(s) reassigned; API warnings remain active');
    stopSelection();
  }
  function openProfile(player){setViewingPlayer(player);setPlayerLookup({status:'idle'});setProfileOpen(true);}
  function savePlayer(player){onSavePlayer(player);setViewingPlayer(player);}
  async function copyRoster(){
    try{
      await navigator.clipboard.writeText(visible.map(p=>`${p.username||p.alias||'Unknown'} · ${p.fid||'ID unknown'} · [${p.allianceTag||'?'}] · ${['infantry','lancer','marksman'].map(k=>`${k}: ${p.troops?.[k]||'Unknown'}`).join(' · ')}`).join('\n'));
      showToast?.(`Copied ${visible.length} players`);
    }catch{showToast?.('Unable to copy. Try again.','error');}
  }
  function card(player){return <PlayerCard key={player.id} player={player} sortDetail={sortDetail(player,sort)} sortField={sort} showId={showIds} roles={roles} onClick={()=>selecting?toggle(player.id):openProfile(player)} onDelete={onDeletePlayer} missingCount={(filters.review||sort==='review')?troopGaps(player).length+!player.fid+!player.allianceTag:0} onOpenFields={()=>openProfile(player)} bulkMode={selecting} isSelected={selected.has(player.id)} onToggleRallyLead={()=>onSavePlayer({...player,roles:player.roles?.includes('Rally Lead')?(player.roles||[]).filter(r=>r!=='Rally Lead'):[...(player.roles||[]),'Rally Lead']})}/>;}
  const groups=[
    {name:'Rally leaders',members:displayed.filter(p=>p.roles?.includes('Rally Lead')&&!p.blacklisted)},
    {name:'Joiners',members:displayed.filter(p=>!p.roles?.includes('Rally Lead')&&!p.blacklisted)},
    {name:'Excluded from battle plans',members:displayed.filter(p=>p.blacklisted)},
  ];
  return <div style={{padding:'5px 16px 0'}}>
    {players.length>0 && <>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',margin:'3px 0 8px'}}><h2 style={{fontSize:20,letterSpacing:'-.03em',margin:0}}>Members</h2><button style={{background:'transparent',border:0,color:C.gold,fontSize:12,fontWeight:650,minHeight:38,padding:'5px 0 5px 10px'}} aria-expanded={optionsOpen} onClick={()=>setOptionsOpen(v=>!v)}>☷ Options</button></div>
      <PlayerSearch label="Search roster" players={players} value={search} onChange={setSearch} onSelect={p=>{setSearch(p.fid||p.username||p.alias);openProfile(p);}}/>
      {enable3573Tracking&&trackingView==='current'&&<div role="group" aria-label="Filter by alliance" style={{display:'flex',gap:6,overflowX:'auto',flexWrap:'nowrap',paddingBottom:4,marginBottom:6,alignItems:'center',scrollbarWidth:'none',WebkitOverflowScrolling:'touch'}}>
        <span style={{fontSize:11,color:C.icy,minWidth:48,flexShrink:0}}>Alliance</span>
        {[['','All'],...mainAllianceTags.map(tag=>[tag,tag]),['__no_alliance','No alliance'],['__more','More']].map(([tag,label])=><button key={tag||'all'} aria-pressed={tag==='__more'?allianceMoreOpen:filters.alliance===tag} onClick={()=>{if(tag==='__more'){setAllianceMoreOpen(v=>!v);return;}setFilters({...filters,alliance:tag});setAllianceMoreOpen(false);}} style={{background:(tag==='__more'?allianceMoreOpen:filters.alliance===tag)?'#45351F':'#182A3F',color:(tag==='__more'?allianceMoreOpen:filters.alliance===tag)?'#F2C47A':C.icy,border:'1px solid transparent',borderRadius:22,padding:'7px 11px',fontSize:12,minHeight:35,whiteSpace:'nowrap',flexShrink:0,cursor:'pointer'}}>{label}{mainAllianceTags.includes(tag)?` · ${players.filter(p=>p.allianceTag===tag&&!isTransferred(p)&&!isReview(p)).length}`:''}{tag==='__more'?' ⌄':''}</button>)}
      </div>}
      {enable3573Tracking&&trackingView==='current'&&transferView.promoted&&<div role="group" aria-label="Recent transfers" style={{display:'flex',gap:6,overflowX:'auto',paddingBottom:7}}>
        {transferView.filters.filter(f=>f.promoted).map(f=><button key={f.key} type="button" style={{...button,whiteSpace:'nowrap',flexShrink:0}} onClick={()=>{setTrackingView(f.key==='transferred_in'?'transferred_in':'transferred');setVisibleCount(20);setAllianceMoreOpen(false);}}>{f.label} · {f.count}</button>)}
      </div>}
      {enable3573Tracking&&trackingView==='current'&&<details style={{marginBottom:9,padding:'8px 10px',background:C.card,borderRadius:12}}>
        <summary style={{cursor:'pointer',color:C.gold}}>Transfer history</summary>
        {transferMonths.length===0&&<p style={{fontSize:12,color:C.icy}}>No confirmed transfers to show.</p>}
        {transferMonths.map(month=><details key={month.month} style={{padding:'8px 0',borderBottom:'1px solid '+C.border}}>
          <summary style={{cursor:'pointer',fontSize:13}}>
            {new Intl.DateTimeFormat(undefined,{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(month.month+'-01T00:00:00Z'))}
            {' · '}{month.in} in · {month.out} out · {month.net>0?'+':''}{month.net} net
          </summary>
          <ul style={{paddingLeft:20,fontSize:12,color:C.icy}}>
            {month.events.map(event=><li key={event.event_key||event.id} style={{padding:'4px 0'}}>
              <strong>{event.username||event.fid}</strong>
              {' · '}{event.fromState}{event.fromAlliance?' ['+event.fromAlliance+']':''}
              {' → '}{event.toState}{event.toAlliance?' ['+event.toAlliance+']':''}
            </li>)}
          </ul>
        </details>)}
      </details>}
      {!enable3573Tracking&&<div role="group" aria-label="Filter by alliance" style={{display:'flex',gap:6,overflowX:'auto',paddingBottom:4,marginBottom:6,alignItems:'center'}}>{[['','All'],...[...new Set(players.map(p=>p.allianceTag).filter(Boolean))].sort().map(tag=>[tag,tag]),['__no_alliance','No alliance'],['__review','Needs review']].map(([tag,label])=><button key={tag||'all'} onClick={()=>setFilters({...filters,alliance:tag})} style={{...button,fontSize:12,whiteSpace:'nowrap',flexShrink:0}}>{label}</button>)}</div>}
      {enable3573Tracking&&trackingView==='current'&&allianceMoreOpen&&<div role="group" aria-label="Other alliances" style={{display:'flex',gap:6,flexWrap:'wrap',background:C.card,borderRadius:12,padding:10,marginBottom:9}}>
        {allianceTags.map(tag=><button key={tag} style={{...button,fontSize:12,background:filters.alliance===tag?C.gold:C.section,color:filters.alliance===tag?C.bg:C.icy}} onClick={()=>{setFilters({...filters,alliance:tag});setAllianceMoreOpen(false);}}>{tag} · {players.filter(p=>p.allianceTag===tag&&!isTransferred(p)&&!isReview(p)).length}</button>)}
        {!allianceTags.length&&<span style={{fontSize:12,color:C.icy}}>No other alliances recorded</span>}
        <div style={{width:'100%',borderTop:'1px solid '+C.border,marginTop:4,paddingTop:8}}>{transferView.transferredIn.length>0&&<button type="button" style={{...button,width:'100%',textAlign:'left',color:C.icy,marginBottom:6}} onClick={()=>{setTrackingView('transferred_in');setAllianceMoreOpen(false);setVisibleCount(20);}}>Transferred in · {transferView.transferredIn.length}</button>}<button type="button" style={{...button,width:'100%',textAlign:'left',color:C.icy}} onClick={()=>{setTrackingView('transferred');setAllianceMoreOpen(false);setFilters({...filters,alliance:''});setVisibleCount(20);}}>Transferred out · {players.filter(isTransferred).length}</button></div>
      </div>}
      {enable3573Tracking&&trackingView==='current'&&reviewCount>0&&<button type="button" onClick={()=>{setTrackingView('review');setVisibleCount(20);setOptionsOpen(false);}} style={{border:0,background:'transparent',color:'#E8B766',padding:'8px 0',minHeight:38,textAlign:'left',fontSize:12,cursor:'pointer'}}>{reviewCount} account{reviewCount===1?'':'s'} need membership review ›</button>}
      {enable3573Tracking&&trackingView!=='current'&&<button type="button" style={{...button,marginBottom:10}} onClick={()=>{setTrackingView('current');setVisibleCount(20);}}>‹ Back to Members</button>}
      {trackingView==='review'&&<button type="button" style={{...button,width:'100%',marginBottom:12}} disabled={locationBusy} onClick={checkAllLocations}>{locationBusy?'Checking locations…':'Find current location for all'}</button>}
      {trackingView!=='current'&&<h3 style={{fontSize:17,margin:'0 0 10px'}}>{trackingView==='review'?'Membership to review':trackingView==='transferred_in'?'Transferred in':'Transferred out'}</h3>}
      {trackingView==='review'&&<p style={{fontSize:12,color:C.icy,margin:'0 0 12px'}}>Players without a valid API membership refresh for over 72 hours need review. Their last confirmed alliance is preserved.</p>}
      <div role="group" aria-label="Sort roster" style={{display:'flex',gap:6,overflowX:'auto',paddingBottom:8,scrollbarWidth:'none',alignItems:'center'}}><span style={{fontSize:11,color:C.icy,minWidth:48,flexShrink:0}}>Sort</span>
        {PRIMARY_SORTS.map(([id,label])=><button key={id} aria-pressed={sort===id} onClick={()=>changeSort(id)} style={{background:sort===id?'#45351F':'#182A3F',color:sort===id?'#F2C47A':C.icy,border:'1px solid transparent',borderRadius:22,padding:'7px 11px',minHeight:35,fontSize:12,whiteSpace:'nowrap',flexShrink:0,cursor:'pointer'}}>{label}{sort===id?(sortDirection==='asc'?' ↑':' ↓'):''}</button>)}
        <button onClick={()=>setMoreSorts(v=>!v)} style={{background:extraSelected?'#45351F':'#182A3F',color:extraSelected?'#F2C47A':C.icy,border:'1px solid transparent',borderRadius:22,padding:'7px 11px',minHeight:35,fontSize:12,whiteSpace:'nowrap',flexShrink:0,cursor:'pointer'}}>{extraSelected?EXTRA_SORTS.find(([id])=>id===sort)?.[1]:'More'} {extraSelected?(sortDirection==='asc'?'↑':'↓'):'⌄'}</button>
      </div>
      {moreSorts&&<div role="group" aria-label="More sorting options" style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:7,marginBottom:10,padding:10,borderRadius:12,background:C.card}}>
        {EXTRA_SORTS.map(([id,label])=><button key={id} style={{...button,background:sort===id?C.gold:C.section,color:sort===id?C.bg:C.icy,fontSize:12}} onClick={()=>changeSort(id)}>{label}{sort===id?(sortDirection==='asc'?' ↑':' ↓'):''}</button>)}
      </div>}
      {optionsOpen&&<div style={{display:'grid',gap:9,padding:12,background:'#15273A',borderRadius:12,marginBottom:10}}>
        <div style={{fontSize:14,fontWeight:700}}>Roster options</div>{enable3573Tracking&&<><button style={button} onClick={()=>{setTrackingView("current");setOptionsOpen(false);}}>Current roster</button><button style={button} onClick={()=>{setTrackingView("review");setOptionsOpen(false);}}>Membership review ({reviewCount})</button>{transferView.transferredIn.length>0&&<button style={button} onClick={()=>{setTrackingView("transferred_in");setOptionsOpen(false);}}>Transferred in ({transferView.transferredIn.length})</button>}<button style={button} onClick={()=>{setTrackingView("transferred");setOptionsOpen(false);}}>Transferred out ({players.filter(isTransferred).length})</button></>}<div style={{display:'flex',gap:7}}><button style={{...button,flex:1}} onClick={()=>setFiltersOpen(true)}>Filters{filterCount?` (${filterCount})`:''}</button><button style={{...button,flex:1}} onClick={()=>selecting?stopSelection():setSelecting(true)}>{selecting?'Done selecting':'Select players'}</button></div>
        <label style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:13,color:C.icy}}>Show player IDs <input type="checkbox" checked={showIds} onChange={e=>setShowIds(e.target.checked)} style={{width:20,height:20,accentColor:C.gold}}/></label>
        <button style={button} onClick={()=>{setGrouped(!grouped);setOptionsOpen(false);}}>{grouped?'Show one list':'Group by role'}</button>
        <button style={button} onClick={()=>{setFieldsOpen(true);setOptionsOpen(false);}}>Update player details</button>
        <button style={button} onClick={copyRoster} disabled={!visible.length}>Copy filtered roster ({visible.length})</button>
      </div>}
      {sort==='progression' && <p style={{fontSize:12,color:C.icy}}>Highest troop tiers first compares recorded Infantry, Lancer and Marksman tiers, including Helios. Missing tiers sort last. Troop counts and combat buffs are excluded.</p>}
      {(sort==='labyrinth'||sort==='labyrinthScore') && <p style={{fontSize:12,color:C.icy}}>State Labyrinth {sort==='labyrinth'?'rank':'score'} from Whiteout Stats. Missing values appear last.</p>}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,marginBottom:10}}><span role="status" style={{color:C.icy,fontSize:12}}>Showing {displayed.length} of {visible.length} players</span>{(filterCount>0||search) && <button style={button} onClick={()=>{setSearch('');setFilters({...EMPTY_FILTERS});}}>Clear filters</button>}</div>
      {selecting && <section style={{padding:12,background:C.card,borderRadius:12,marginBottom:12}}>
        <div role="status" style={{fontSize:14,marginBottom:8}}>{selected.size} selected across this roster</div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button style={button} onClick={()=>setSelected(prev=>new Set([...prev,...visible.map(p=>p.id)]))}>Select shown</button><button style={button} onClick={()=>setSelected(new Set())}>Clear selection</button><button style={{...button,color:C.gold}} disabled={!selected.size} onClick={()=>setEditingSelection(!editingSelection)}>Update selected</button>{enable3573Tracking&&<button style={button} disabled={!selected.size} onClick={()=>{const chosen=players.filter(p=>selected.has(p.id)&&!isTransferred(p));if(!chosen.length)return;onUpdatePlayers(chosen.map(p=>({...p,membershipStatus:'transfer_review',membershipFlaggedAt:new Date().toISOString()})));showToast?.(`${chosen.length} player(s) flagged for transfer review`);stopSelection();}}>Flag possible transfer</button>}</div>
      </section>}
      {enable3573Tracking&&trackingView==='review'&&selecting&&selected.size>0&&<section aria-label="Bulk alliance reassignment" style={{padding:12,background:C.card,borderRadius:12,marginBottom:12,display:'grid',gap:8}}>
        <label htmlFor="review-alliance-target" style={{fontSize:12,color:C.icy}}>Assign {selected.size} selected player(s) to</label>
        <select id="review-alliance-target" value={reviewDestination} onChange={e=>setReviewDestination(e.target.value)} style={{...button,width:'100%'}}>
          <option value="">Choose alliance</option>
          {[...mainAllianceTags,...allianceTags].map(tag=><option key={tag} value={tag}>{tag}</option>)}
          <option value="__no_alliance">No Alliance</option>
          <option value="__other">Another alliance…</option>
        </select>
        {reviewDestination==='__other'&&<input aria-label="Other alliance tag" value={reviewOtherTag} onChange={e=>setReviewOtherTag(e.target.value)} placeholder="Alliance tag" maxLength={12} style={{...button,width:'100%',boxSizing:'border-box'}}/>}
        <button style={button} disabled={!reviewDestination||(reviewDestination==='__other'&&!/^[A-Za-z0-9]{2,12}$/.test(reviewOtherTag.trim()))} onClick={applyReviewBulk}>Apply reassignment</button>
      </section>}
      {selecting&&editingSelection&&selected.size>0 && <RosterBulkEditor players={players} selected={selected} onOpenFields={()=>setFieldsOpen(true)} onApply={updated=>{onUpdatePlayers(updated);showToast?.(`Updated ${updated.length} players`);stopSelection();}}/>}
    </>}
    {!players.length && <section style={{textAlign:'center',padding:'32px 0'}}><h2 style={{fontSize:20}}>Load your alliance roster</h2><p style={{fontSize:16,color:C.icy,lineHeight:1.5}}>Choose an alliance to retrieve its players and available game data.</p><button style={{...button,background:C.gold,color:C.bg}} onClick={onLoadAlliance}>Load alliance</button></section>}
    {players.length>0&&!visible.length && <p style={{textAlign:'center',padding:24,color:C.icy}}>No players match. Clear filters or try another search.</p>}
    {trackingView!=='current'&&displayed.map(p=><div key={p.id} style={{background:C.card,borderRadius:12,padding:12,marginBottom:9}}><div style={{fontWeight:700,overflowWrap:'anywhere'}}>{p.username||p.alias||p.fid||'Unknown player'}</div><div style={{fontSize:12,color:C.icy,margin:'5px 0 10px'}}>ID {p.fid||p.id} · Last known alliance: {p.lastKnownAlliance||p.allianceTag||'Unknown'}{trackingView==='transferred'&&p.transferDestinationState?' · State '+p.transferDestinationState+(p.transferDestinationAlliance?' · '+p.transferDestinationAlliance:''):''}{suspectedTransferOut(p,membershipNow)?' · Needs Review · API membership refresh missing or over 72 hours':''}</div>{trackingView==='review'&&<div style={{fontSize:12,color:C.icy,marginBottom:8}}>Last online: {onlineLabel(p)} · Last successful API refresh: {(p.membershipLastSuccessfulAt||p.membershipObservedAt||p.providerStats?.capturedAt)?new Date(p.membershipLastSuccessfulAt||p.membershipObservedAt||p.providerStats?.capturedAt).toLocaleString():'Unknown'}</div>}{(trackingView==='review'||trackingView==='transferred')&&<div style={{marginBottom:10}}><button type="button" style={button} disabled={locationChecks[p.id]?.status==='loading'} onClick={()=>checkLocation(p)}>{locationChecks[p.id]?.status==='loading'?'Checking…':'Find current location'}</button>{locationChecks[p.id]?.status==='verified'&&<p role="status" style={{fontSize:13,color:C.icy}}>Confirmed: State {locationChecks[p.id].state} · {locationChecks[p.id].tag||'No alliance'} · {new Date(locationChecks[p.id].at).toLocaleString()}</p>}{locationChecks[p.id]?.status==='error'&&<p role="alert" style={{fontSize:12,color:C.red}}>{locationChecks[p.id].message}</p>}{locationChecks[p.id]?.status==='verified'&&<button type="button" style={{...button,marginLeft:7}} onClick={()=>applyLocation(p)}>{locationChecks[p.id].state==='3573'?(locationChecks[p.id].tag?'Confirm current alliance':'Confirm no alliance'):'Confirm transfer to state '+locationChecks[p.id].state}</button>}</div>}<div style={{display:'flex',gap:7,flexWrap:'wrap'}}>{trackingView==='review'&&<button style={button} onClick={()=>{onSavePlayer(moveReviewedPlayerToNoAlliance(p));showToast?.('Moved to No alliance; previous alliance preserved');}}>Move to No alliance</button>}{trackingView==='review'&&<button style={button} disabled={!(locationChecks[p.id]?.status==='verified'&&locationChecks[p.id]?.state!=='3573')} onClick={()=>applyLocation(p)}>Confirm transferred out</button>}<button style={button} onClick={()=>{if(trackingView==='transferred'){const found=locationChecks[p.id];if(found?.status==='verified'&&found.state==='3573')applyLocation(p);else showToast?.('Verify the player has returned to 3573 before restoring.');}else markMembership(p,'active');}}>{trackingView==='transferred'?'Restore after verification':'Keep in 3573'}</button></div></div>)}
    {(!enable3573Tracking||trackingView==='current')&&(grouped?groups.filter(g=>g.members.length).map(group=><section key={group.name}><h3 style={{fontSize:16,color:C.icy}}>{group.name} · {group.members.length}</h3>{group.members.map(card)}</section>):displayed.map(card))}
    {(!enable3573Tracking||trackingView==='current')&&visibleCount<visible.length&&<div ref={loadRef} role="status" style={{textAlign:'center',padding:18,color:C.icy,fontSize:13}}>Showing {displayed.length} of {visible.length} · More players load as you scroll <button style={{...button,marginLeft:8}} onClick={()=>setVisibleCount(n=>Math.min(n+20,visible.length))}>Load more</button></div>}
    {filtersOpen && <RosterFilters players={players} roles={roles} filters={filters} onChange={next=>setFilters(next)} onClose={()=>setFiltersOpen(false)} count={visible.length}/>}
    <ProfileView player={currentPlayer} playerLookup={playerLookup} onCheckPlayerName={checkPlayerName} onApplyCheckedName={applyCheckedName} players={players} teamworkPreferences={teamworkPreferences} onSaveTeamworkPreferences={onSaveTeamworkPreferences} roles={roles} open={profileOpen} onClose={()=>setProfileOpen(false)} onEdit={()=>{setProfileOpen(false);setEditingPlayer(currentPlayer);}} events={events} onOpenLeaderProfile={()=>setLeaderOpen(true)} onSave={savePlayer} onApplyConfirmedProfileSave={onApplyConfirmedProfileSave}/>
    <RallyLeaderProfileSheet player={currentPlayer} open={leaderOpen} onClose={()=>setLeaderOpen(false)} onSave={savePlayer}/>
    <PlayerSheet open={!!editingPlayer} player={editingPlayer} roles={roles} onClose={()=>setEditingPlayer(null)} onSave={savePlayer} existingTags={[...new Set(players.map(p=>p.allianceTag).filter(Boolean))]} existingPlayers={players} onOpenExisting={openProfile} onGoToIntel={onGoToIntel}/>
    <RoleManagerSheet open={rolesOpen} onClose={()=>setRolesOpen(false)} roles={roles} onSaveCustomRoles={onSaveCustomRoles} players={players} onUpdatePlayers={onUpdatePlayers}/>
    {fieldsOpen && <div style={{position:'fixed',inset:0,zIndex:600,background:C.bg}}><FieldRegistry players={players} onUpdatePlayer={onSavePlayer} onClose={()=>setFieldsOpen(false)}/></div>}
  </div>;
}
