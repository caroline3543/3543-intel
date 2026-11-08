import {PlayerSearch} from './PlayerSearch.jsx';
import {RosterLegions,LegionPlayerStatus} from './RosterLegions.jsx';
import {plannedMemberIds,legionForPlayer,allianceCheck,recentNameChanges} from '../../services/talRosterService.js';
import { useState, useEffect } from 'react';
import { C } from '../../utils/constants.js';
import { PlayerCard, comparePriority } from './PlayerCard.jsx';
import { ProfileView } from './ProfileView.jsx';
import { PlayerSheet } from './PlayerSheet.jsx';
import { RoleManagerSheet } from './RoleManagerSheet.jsx';
import { RallyLeaderProfileSheet } from './RallyLeaderProfileSheet.jsx';
import FieldRegistry from './FieldRegistry.jsx';
import { RosterFilters } from './RosterFilters.jsx';
import { RosterBulkEditor } from './RosterBulkEditor.jsx';
import { getCurrentTroopPower } from '../../data/metrics.js';
import { EMPTY_FILTERS, matchesRosterFilters, rosterFilterCount, troopGaps, latestRosterFetch } from '../../services/rosterViewService.js';
const button={minHeight:44,borderRadius:10,border:`1px solid ${C.border}`,background:C.section,color:C.icy,padding:'10px 12px',fontSize:14,fontWeight:600,cursor:'pointer'};
export function RosterTab({initialPlayerId,onInitialPlayerOpened,players,events,roles,onSaveCustomRoles,onSavePlayer,onUpdatePlayers,onDeletePlayer,onGoToIntel,showToast,onLoadAlliance,legionPlan,onRefreshLegion,legionRefresh}) {
  const [legion,setLegion]=useState('');
  const [allianceStatus,setAllianceStatus]=useState('all');
  const activeLegion=legionPlan?.teams?.find(t=>t.id===legion);
  const nameChanges=legionPlan?recentNameChanges(players):[];
  const [search,setSearch]=useState('');
  const [filters,setFilters]=useState({...EMPTY_FILTERS});
  const [filtersOpen,setFiltersOpen]=useState(false);
  const [optionsOpen,setOptionsOpen]=useState(false);
  const [grouped,setGrouped]=useState(false);
  const [sort,setSort]=useState('name');
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
  const visible=players.filter(p=>matchesRosterFilters(p,search,filters)&&(!activeLegion||plannedMemberIds(activeLegion).has(p.id))&&(!activeLegion||allianceStatus==='all'||allianceCheck(p,activeLegion).status===allianceStatus)).sort((a,b)=>{
    if(sort==='progression')return comparePriority(a,b);
    if(sort==='troopPower')return (getCurrentTroopPower(b,events)??-1)-(getCurrentTroopPower(a,events)??-1);
    if(sort==='review')return (troopGaps(b).length+!b.fid+!b.allianceTag)-(troopGaps(a).length+!a.fid+!a.allianceTag);
    return (a.username||a.alias||'').localeCompare(b.username||b.alias||'');
  });
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
  function card(player){return <PlayerCard key={player.id} player={player} detail={legionPlan?<LegionPlayerStatus player={player} team={legionForPlayer(legionPlan,player.id)} previousName={nameChanges.find(c=>c.playerId===player.id)?.before}/>:null} roles={roles} onClick={()=>selecting?toggle(player.id):openProfile(player)} onDelete={onDeletePlayer} missingCount={(filters.review||sort==='review')?troopGaps(player).length+!player.fid+!player.allianceTag:0} onOpenFields={()=>openProfile(player)} bulkMode={selecting} isSelected={selected.has(player.id)} onToggleRallyLead={()=>onSavePlayer({...player,roles:player.roles?.includes('Rally Lead')?(player.roles||[]).filter(r=>r!=='Rally Lead'):[...(player.roles||[]),'Rally Lead']})}/>;}
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
        {[['','All alliances'],...allianceTags.map(tag=>[tag,`[${tag}]`])].map(([tag,label])=><button key={tag||'all'} aria-pressed={filters.alliance===tag} onClick={()=>{setFilters({...filters,alliance:filters.alliance===tag?'':tag});setLegion('');setAllianceStatus('all');}} style={{...button,flexShrink:0,color:filters.alliance===tag?C.gold:C.icy,borderColor:filters.alliance===tag?C.gold:C.border}}>{label}{tag?` · ${players.filter(p=>p.allianceTag===tag).length}`:''}</button>)}
      </div>
      {!!legionPlan?.teams?.length&&<RosterLegions teams={legionPlan.teams} selected={activeLegion?.id||''} onSelect={id=>{setLegion(id);setAllianceStatus('all');setSearch('');setFilters({...EMPTY_FILTERS});}} players={players} check={allianceStatus} onCheck={setAllianceStatus} onRefresh={onRefreshLegion} refresh={legionRefresh}/>}
      <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:10}}>
        <button style={button} aria-expanded={filtersOpen} onClick={()=>setFiltersOpen(true)}>Filters{filterCount?` (${filterCount})`:''}</button>
        <label style={{flex:1,minWidth:0}}><span style={{position:'absolute',width:1,height:1,overflow:'hidden'}}>Sort roster</span><select aria-label="Sort roster" value={sort} onChange={e=>setSort(e.target.value)} style={{...button,width:'100%',fontSize:14}}><option value="name">Name A–Z</option><option value="progression">Troop strength</option><option value="troopPower">Troop power</option><option value="review">Needs review</option></select></label>
        <button style={button} onClick={()=>{if(selecting)stopSelection();else setSelecting(true);}}>{selecting?'Done':'Select'}</button>
      </div>
      <button style={{...button,width:'100%',marginBottom:10}} aria-expanded={optionsOpen} onClick={()=>setOptionsOpen(!optionsOpen)}>Roster options {optionsOpen?'▴':'▾'}</button>
      {optionsOpen && <div style={{display:'grid',gap:8,padding:12,background:C.card,borderRadius:12,marginBottom:12}}>
        <button style={button} onClick={()=>{setGrouped(!grouped);setOptionsOpen(false);}}>{grouped?'Show list':'Group by role'}</button>
        <button style={button} onClick={()=>{setFieldsOpen(true);setOptionsOpen(false);}}>Update player details</button>
        <button style={button} onClick={copyRoster} disabled={!visible.length}>Copy filtered roster ({visible.length})</button>
      </div>}
      {sort==='progression' && <p style={{fontSize:13,color:C.icy}}>Sorts by Helios troops and furnace level. Gear, stats and heroes are not included.</p>}
      {sort==='troopPower' && <p style={{fontSize:13,color:C.icy}}>Uses recorded event troop power. Players without a record appear last.</p>}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,marginBottom:10}}><span role="status" style={{color:C.icy,fontSize:14}}>{visible.length} of {players.length} players</span>{(filterCount>0||search||activeLegion) && <button style={button} onClick={()=>{setSearch('');setFilters({...EMPTY_FILTERS});setLegion('');setAllianceStatus('all');}}>Clear filters</button>}</div>
      {selecting && <section style={{padding:12,background:C.card,borderRadius:12,marginBottom:12}}>
        <div role="status" style={{fontSize:14,marginBottom:8}}>{selected.size} selected across this roster</div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button style={button} onClick={()=>setSelected(prev=>new Set([...prev,...visible.map(p=>p.id)]))}>Select shown</button><button style={button} onClick={()=>setSelected(new Set())}>Clear selection</button><button style={{...button,color:C.gold}} disabled={!selected.size} onClick={()=>setEditingSelection(!editingSelection)}>Update selected</button></div>
      </section>}
      {selecting&&editingSelection&&selected.size>0 && <RosterBulkEditor players={players} selected={selected} onOpenFields={()=>setFieldsOpen(true)} onApply={updated=>{onUpdatePlayers(updated);showToast?.(`Updated ${updated.length} players`);stopSelection();}}/>}
    </>}
    {!players.length && <section style={{textAlign:'center',padding:'32px 0'}}><h2 style={{fontSize:20}}>Load your alliance roster</h2><p style={{fontSize:16,color:C.icy,lineHeight:1.5}}>Choose an alliance to retrieve its players and available game data.</p><button style={{...button,background:C.gold,color:C.bg}} onClick={onLoadAlliance}>Load alliance</button></section>}
    {players.length>0&&!visible.length && <p style={{textAlign:'center',padding:24,color:C.icy}}>No players match. Clear filters or try another search.</p>}
    {grouped?groups.filter(g=>g.members.length).map(group=><section key={group.name}><h3 style={{fontSize:16,color:C.icy}}>{group.name} · {group.members.length}</h3>{group.members.map(card)}</section>):visible.map(card)}
    {filtersOpen && <RosterFilters players={players} roles={roles} filters={filters} onChange={next=>{if(next.alliance!==filters.alliance){setLegion('');setAllianceStatus('all');}setFilters(next);}} onClose={()=>setFiltersOpen(false)} count={visible.length}/>}
    <ProfileView player={currentPlayer} roles={roles} open={profileOpen} onClose={()=>setProfileOpen(false)} onEdit={()=>{setProfileOpen(false);setEditingPlayer(currentPlayer);}} events={events} onOpenLeaderProfile={()=>setLeaderOpen(true)} onSave={savePlayer}/>
    <RallyLeaderProfileSheet player={currentPlayer} open={leaderOpen} onClose={()=>setLeaderOpen(false)} onSave={savePlayer}/>
    <PlayerSheet open={!!editingPlayer} player={editingPlayer} roles={roles} onClose={()=>setEditingPlayer(null)} onSave={savePlayer} existingTags={[...new Set(players.map(p=>p.allianceTag).filter(Boolean))]} existingPlayers={players} onOpenExisting={openProfile} onGoToIntel={onGoToIntel}/>
    <RoleManagerSheet open={rolesOpen} onClose={()=>setRolesOpen(false)} roles={roles} onSaveCustomRoles={onSaveCustomRoles} players={players} onUpdatePlayers={onUpdatePlayers}/>
    {fieldsOpen && <div style={{position:'fixed',inset:0,zIndex:600,background:C.bg}}><FieldRegistry players={players} onUpdatePlayer={onSavePlayer} onClose={()=>setFieldsOpen(false)}/></div>}
  </div>;
}
