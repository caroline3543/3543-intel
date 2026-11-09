import {PlayerSearch} from './PlayerSearch.jsx';
import { useState, useEffect } from 'react';
import { C } from '../../utils/constants.js';
import { PlayerCard, comparePriority, getPriorityTier } from './PlayerCard.jsx';
import { ProfileView } from './ProfileView.jsx';
import { PlayerSheet } from './PlayerSheet.jsx';
import { RoleManagerSheet } from './RoleManagerSheet.jsx';
import { RallyLeaderProfileSheet } from './RallyLeaderProfileSheet.jsx';
import FieldRegistry from './FieldRegistry.jsx';
import { RosterFilters } from './RosterFilters.jsx';
import { RosterBulkEditor } from './RosterBulkEditor.jsx';
import { EMPTY_FILTERS, matchesRosterFilters, rosterFilterCount, troopGaps, latestRosterFetch } from '../../services/rosterViewService.js';
const button={minHeight:44,borderRadius:10,border:`1px solid ${C.border}`,background:C.section,color:C.icy,padding:'10px 12px',fontSize:14,fontWeight:600,cursor:'pointer'};

const SORT_FIELDS = [
  ['name','Name'],['labyrinth','Labyrinth rank'],['labyrinthScore','Labyrinth score'],
  ['furnace','Furnace level'],['power','City power'],['kills','Kills'],
  ['progression','Troop strength'],['review','Needs review']
];
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
  if(field==='progression'){
    const tier=getPriorityTier(player);
    return {label:'Troop strength',value:tier===1?'Full Helios':tier===2?'Partial Helios':'Other troops'};
  }
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
  if(field==='progression'){
    // Existing progression comparator ranks strongest first. Reverse it only for ascending.
    return comparePriority(a,b)*(direction==='asc'?-1:1) || fallback();
  }
  const av=rosterSortValue(a,field), bv=rosterSortValue(b,field);
  if(av===null && bv===null)return fallback();
  if(av===null)return 1; // Keep unknown rankings and stats at the bottom in both directions.
  if(bv===null)return -1;
  return (av-bv)*order || fallback();
}

export function RosterTab({initialPlayerId,onInitialPlayerOpened,players,events,roles,onSaveCustomRoles,onSavePlayer,onUpdatePlayers,onDeletePlayer,onGoToIntel,showToast,onLoadAlliance,legionPlan,onRefreshLegion,legionRefresh}) {
  const [search,setSearch]=useState('');
  const [filters,setFilters]=useState({...EMPTY_FILTERS});
  const [filtersOpen,setFiltersOpen]=useState(false);
  const [optionsOpen,setOptionsOpen]=useState(false);
  const [grouped,setGrouped]=useState(false);
  const [sort,setSort]=useState('name');
  const [sortDirection,setSortDirection]=useState('asc');
  const [viewingPlayer,setViewingPlayer]=useState(null);
  const [profileOpen,setProfileOpen]=useState(false);
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
  const visible=players.filter(p=>matchesRosterFilters(p,search,filters)).sort((a,b)=>compareRosterPlayers(a,b,sort,sortDirection,events));
  const filterCount=rosterFilterCount(filters);
  const allianceTags=[...new Set(players.map(p=>p.allianceTag).filter(Boolean))].sort();
  const lastFetch=latestRosterFetch(players);
  function toggle(id){setSelected(prev=>{const next=new Set(prev);next.has(id)?next.delete(id):next.add(id);return next;});}
  function stopSelection(){setSelecting(false);setSelected(new Set());setEditingSelection(false);}
  function openProfile(player){setViewingPlayer(player);setProfileOpen(true);}
  function savePlayer(player){onSavePlayer(player);setViewingPlayer(player);}
  async function copyRoster(){
    try{
      await navigator.clipboard.writeText(visible.map(p=>`${p.username||p.alias||'Unknown'} · ${p.fid||'ID unknown'} · [${p.allianceTag||'?'}] · ${['infantry','lancer','marksman'].map(k=>`${k}: ${p.troops?.[k]||'Unknown'}`).join(' · ')}`).join('\n'));
      showToast?.(`Copied ${visible.length} players`);
    }catch{showToast?.('Unable to copy. Try again.','error');}
  }
  function card(player){return <PlayerCard key={player.id} player={player} sortDetail={sortDetail(player,sort)} sortField={sort} detail={null} roles={roles} onClick={()=>selecting?toggle(player.id):openProfile(player)} onDelete={onDeletePlayer} missingCount={(filters.review||sort==='review')?troopGaps(player).length+!player.fid+!player.allianceTag:0} onOpenFields={()=>openProfile(player)} bulkMode={selecting} isSelected={selected.has(player.id)} onToggleRallyLead={()=>onSavePlayer({...player,roles:player.roles?.includes('Rally Lead')?(player.roles||[]).filter(r=>r!=='Rally Lead'):[...(player.roles||[]),'Rally Lead']})}/>;}
  const groups=[
    {name:'Rally leaders',members:visible.filter(p=>p.roles?.includes('Rally Lead')&&!p.blacklisted)},
    {name:'Joiners',members:visible.filter(p=>!p.roles?.includes('Rally Lead')&&!p.blacklisted)},
    {name:'Excluded from battle plans',members:visible.filter(p=>p.blacklisted)},
  ];
  return <div style={{padding:'16px 20px 0'}}>
    {players.length>0 && <>
      <p style={{fontSize:13,color:C.icy,margin:'0 0 12px'}}>Latest roster fetch: {lastFetch?new Date(lastFetch).toISOString().slice(0,16).replace('T',' ')+' UTC':'Not recorded'}</p>
      <PlayerSearch label="Search roster" players={players} value={search} onChange={setSearch} onSelect={p=>{setSearch(p.fid||p.username||p.alias);openProfile(p);}}/>
      <div role="group" aria-label="Filter by alliance" style={{display:'flex',gap:8,overflowX:'auto',paddingBottom:6,marginBottom:10}}>
        {[['','All alliances'],...allianceTags.map(tag=>[tag,`[${tag}]`])].map(([tag,label])=><button key={tag||'all'} aria-pressed={filters.alliance===tag} onClick={()=>{setFilters({...filters,alliance:filters.alliance===tag?'':tag});}} style={{...button,flexShrink:0,color:filters.alliance===tag?C.gold:C.icy,borderColor:filters.alliance===tag?C.gold:C.border}}>{label}{tag?` · ${players.filter(p=>p.allianceTag===tag).length}`:''}</button>)}
      </div>
      <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:10}}>
        <button style={button} aria-expanded={filtersOpen} onClick={()=>setFiltersOpen(true)}>Filters{filterCount?` (${filterCount})`:''}</button>
        <label style={{flex:1,minWidth:0}}><span style={{position:'absolute',width:1,height:1,overflow:'hidden'}}>Sort by</span><select aria-label="Sort by" value={sort} onChange={e=>{const field=e.target.value;setSort(field);setSortDirection(field==='name'||field==='labyrinth'?'asc':'desc');}} style={{...button,width:'100%',fontSize:14}}>{SORT_FIELDS.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
        <button style={{...button,minWidth:44,padding:'10px 8px',flexShrink:0}} aria-label={sortDirection==='asc'?'Sort ascending. Tap for descending':'Sort descending. Tap for ascending'} title={sortDirection==='asc'?'Ascending · switch to descending':'Descending · switch to ascending'} onClick={()=>setSortDirection(d=>d==='asc'?'desc':'asc')}>{sortDirection==='asc'?'↑':'↓'} <span style={{fontSize:12}}>{sortDirection==='asc'?'Asc':'Desc'}</span></button>
        <button style={button} onClick={()=>{if(selecting)stopSelection();else setSelecting(true);}}>{selecting?'Done':'Select'}</button>
      </div>
      <button style={{...button,width:'100%',marginBottom:10}} aria-expanded={optionsOpen} onClick={()=>setOptionsOpen(!optionsOpen)}>Roster options {optionsOpen?'▴':'▾'}</button>
      {optionsOpen && <div style={{display:'grid',gap:8,padding:12,background:C.card,borderRadius:12,marginBottom:12}}>
        <button style={button} onClick={()=>{setGrouped(!grouped);setOptionsOpen(false);}}>{grouped?'Show list':'Group by role'}</button>
        <button style={button} onClick={()=>{setFieldsOpen(true);setOptionsOpen(false);}}>Update player details</button>
        <button style={button} onClick={copyRoster} disabled={!visible.length}>Copy filtered roster ({visible.length})</button>
      </div>}
      {sort==='progression' && <p style={{fontSize:13,color:C.icy}}>Sorts by Helios troops and furnace level. Gear, stats and heroes are not included.</p>}
      {(sort==='labyrinth'||sort==='labyrinthScore') && <p style={{fontSize:13,color:C.icy}}>State Labyrinth {sort==='labyrinth'?'rank':'score'} from Whiteout Stats. Missing values appear last.</p>}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,marginBottom:10}}><span role="status" style={{color:C.icy,fontSize:14}}>{visible.length} of {players.length} players</span>{(filterCount>0||search) && <button style={button} onClick={()=>{setSearch('');setFilters({...EMPTY_FILTERS});}}>Clear filters</button>}</div>
      {selecting && <section style={{padding:12,background:C.card,borderRadius:12,marginBottom:12}}>
        <div role="status" style={{fontSize:14,marginBottom:8}}>{selected.size} selected across this roster</div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button style={button} onClick={()=>setSelected(prev=>new Set([...prev,...visible.map(p=>p.id)]))}>Select shown</button><button style={button} onClick={()=>setSelected(new Set())}>Clear selection</button><button style={{...button,color:C.gold}} disabled={!selected.size} onClick={()=>setEditingSelection(!editingSelection)}>Update selected</button></div>
      </section>}
      {selecting&&editingSelection&&selected.size>0 && <RosterBulkEditor players={players} selected={selected} onOpenFields={()=>setFieldsOpen(true)} onApply={updated=>{onUpdatePlayers(updated);showToast?.(`Updated ${updated.length} players`);stopSelection();}}/>}
    </>}
    {!players.length && <section style={{textAlign:'center',padding:'32px 0'}}><h2 style={{fontSize:20}}>Load your alliance roster</h2><p style={{fontSize:16,color:C.icy,lineHeight:1.5}}>Choose an alliance to retrieve its players and available game data.</p><button style={{...button,background:C.gold,color:C.bg}} onClick={onLoadAlliance}>Load alliance</button></section>}
    {players.length>0&&!visible.length && <p style={{textAlign:'center',padding:24,color:C.icy}}>No players match. Clear filters or try another search.</p>}
    {grouped?groups.filter(g=>g.members.length).map(group=><section key={group.name}><h3 style={{fontSize:16,color:C.icy}}>{group.name} · {group.members.length}</h3>{group.members.map(card)}</section>):visible.map(card)}
    {filtersOpen && <RosterFilters players={players} roles={roles} filters={filters} onChange={next=>{if(next.alliance!==filters.alliance){}setFilters(next);}} onClose={()=>setFiltersOpen(false)} count={visible.length}/>}
    <ProfileView player={currentPlayer} roles={roles} open={profileOpen} onClose={()=>setProfileOpen(false)} onEdit={()=>{setProfileOpen(false);setEditingPlayer(currentPlayer);}} events={events} onOpenLeaderProfile={()=>setLeaderOpen(true)} onSave={savePlayer}/>
    <RallyLeaderProfileSheet player={currentPlayer} open={leaderOpen} onClose={()=>setLeaderOpen(false)} onSave={savePlayer}/>
    <PlayerSheet open={!!editingPlayer} player={editingPlayer} roles={roles} onClose={()=>setEditingPlayer(null)} onSave={savePlayer} existingTags={[...new Set(players.map(p=>p.allianceTag).filter(Boolean))]} existingPlayers={players} onOpenExisting={openProfile} onGoToIntel={onGoToIntel}/>
    <RoleManagerSheet open={rolesOpen} onClose={()=>setRolesOpen(false)} roles={roles} onSaveCustomRoles={onSaveCustomRoles} players={players} onUpdatePlayers={onUpdatePlayers}/>
    {fieldsOpen && <div style={{position:'fixed',inset:0,zIndex:600,background:C.bg}}><FieldRegistry players={players} onUpdatePlayer={onSavePlayer} onClose={()=>setFieldsOpen(false)}/></div>}
  </div>;
}
