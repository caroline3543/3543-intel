import {ProfileTeamwork} from './ProfileTeamwork.jsx';
import { ProfileTalCapacity } from './ProfileTalCapacity.jsx';
import {ProfileSheetImport} from './ProfileSheetImport.jsx';
import {CopyPlayerId} from './CopyPlayerId.jsx';
import { useEffect, useRef, useState } from 'react';
import { C, ALLIANCE_RANKS, TROOP_POWER_EVENTS } from '../../utils/constants.js';
import { roleColor } from '../../utils/roles.js';
import { fmtDateShort } from '../../utils/dates.js';
import { calcMetrics } from '../../data/metrics.js';
import { PlayerAvatar } from './PlayerAvatar.jsx';
import { ProfileSection, ProfileDetails, profileButton } from './ProfileParts.jsx';
import { ProfileOrderedSections } from './ProfileOrderedSections.jsx';
import { membershipFreshness } from '../../services/profileFreshness.js';
import { ProfileMovementSummary } from './ProfileMovementSummary.jsx';
import { ProfileIdentity } from './ProfileIdentity.jsx';
import { ProfileRoles, ProfileNotes } from './ProfilePlanning.jsx';
import { ProfileJoiners } from './ProfileJoiners.jsx';
import { PlayerEquipmentSection } from './PlayerEquipmentSection.jsx';
import { ProviderStatsSection } from './ProviderStatsSection.jsx';
import { PlayerRankingsSection } from './PlayerRankingsSection.jsx';
import { PlayerHistorySection } from './PlayerHistorySection.jsx';
import { TroopPowerChart } from './TroopPowerChart.jsx';
function relativeProfileAge(raw){
 if(!raw)return 'Update date unavailable';
 const ms=Date.parse(raw);if(!Number.isFinite(ms))return 'Update date unavailable';
 const minutes=Math.max(0,Math.floor((Date.now()-ms)/60000));
 if(minutes<1)return 'Updated just now';
 if(minutes<60)return 'Updated '+minutes+' minute'+(minutes===1?'':'s')+' ago';
 const hours=Math.floor(minutes/60);if(hours<24)return 'Updated '+hours+' hour'+(hours===1?'':'s')+' ago';
 const days=Math.floor(hours/24);if(days===1)return 'Updated yesterday';
 if(days<7)return 'Updated '+days+' days ago';
 const weeks=Math.floor(days/7);if(days<28)return 'Updated '+weeks+' week'+(weeks===1?'':'s')+' ago';
 const months=Math.floor(days/30);if(days<365)return 'Updated '+Math.max(1,months)+' month'+(months===1?'':'s')+' ago';
 const years=Math.floor(days/365);return 'Updated '+years+' year'+(years===1?'':'s')+' ago';
}
export function ProfileView({player,roles=[],open,onClose,events=[],onOpenLeaderProfile,onSave,players=[],teamworkPreferences={},onSaveTeamworkPreferences,playerLookup,onCheckPlayerName,onApplyCheckedName}) {
  const panel=useRef(null);
  const [headerCompact, setHeaderCompact] = useState(false);
  const close=useRef(onClose);close.current=onClose;
  useEffect(()=>{
    if(!open)return;
    const previous=document.activeElement;
    const section=panel.current;
    section?.querySelector('button')?.focus();
    const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
    function handler(event){
      if(event.key==='Escape'){event.preventDefault();close.current();}
      if(event.key==='Tab'){
        const controls=[...section.querySelectorAll('button,input,select,textarea,summary,[tabindex="0"]')].filter(el=>!el.disabled&&el.getClientRects().length);
        const first=controls[0],last=controls.at(-1);
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
      }
    }
    section?.addEventListener('keydown',handler);
    return ()=>{section?.removeEventListener('keydown',handler);document.body.style.overflow=overflow;previous?.focus();};
  },[open]);
  if(!open||!player)return null;
  const name=player.username||player.alias||'Unknown';
  const metrics=calcMetrics(player,events);
  const snaps=events.flatMap(ev=>(ev.snapshots||[]).filter(s=>s.playerId===player.id).map(s=>({...s,eventName:ev.name||ev.type,eventDate:ev.date}))).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  const troopPowerHistory=events.filter(ev=>TROOP_POWER_EVENTS.includes(ev.type)).flatMap(ev=>(ev.snapshots||[]).filter(s=>s.playerId===player.id&&s.troopPower!=null).map(s=>({date:ev.date,value:s.troopPower}))).sort((a,b)=>new Date(a.date)-new Date(b.date)).map(p=>({label:fmtDateShort(p.date),value:p.value}));
  function setAllianceRank(rank){onSave({...player,allianceRank:player.allianceRank===rank?null:rank,profileLastUpdated:new Date().toISOString()});}
  return <div onClick={onClose} style={{position:'fixed',inset:0,background:C.bg+'dd',zIndex:300,display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
    <section ref={panel} onScroll={e=>setHeaderCompact(e.currentTarget.scrollTop>56)} role="dialog" aria-modal="true" aria-label={`Player profile: ${name}`} onClick={e=>e.stopPropagation()} style={{background:C.card,borderRadius:'20px 20px 0 0',width:'100%',maxWidth:480,height:'min(94dvh, 94vh)',minHeight:0,overflowY:'scroll',WebkitOverflowScrolling:'touch',touchAction:'pan-y',boxSizing:'border-box',padding:'0 16px max(110px, env(safe-area-inset-bottom))',overscrollBehavior:'contain'}}>
      <header style={{position:'sticky',top:0,zIndex:1,background:C.card,padding:headerCompact?'8px 0':'16px 0 12px',display:'flex',gap:12,alignItems:'center',borderBottom:`1px solid ${C.border}`,marginBottom:16}}>
        <PlayerAvatar player={player} size={40} color={roleColor(player.roles?.[0],roles)} bordered/>
        <div style={{flex:1,minWidth:0}}><h2 style={{fontSize:headerCompact?16:20,color:C.white,margin:0,overflowWrap:'anywhere'}}>{name}</h2>{!headerCompact&&player.alias&&player.username&&<div style={{fontSize:14,color:C.icy,marginTop:3}}>{player.alias}</div>}{!headerCompact&&<div style={{fontSize:14,color:C.icy,marginTop:4}}>{[player.allianceTag?`[${player.allianceTag}]`:null,player.furnaceLevel].filter(Boolean).join(' · ')}</div>}{!headerCompact&&<CopyPlayerId fid={player.fid}/>}{!headerCompact&&<div title={player.profileLastUpdated?new Date(player.profileLastUpdated).toLocaleString():undefined} style={{fontSize:12,color:C.icy,marginTop:5}}>{relativeProfileAge(player.profileLastUpdated)} · Profile edited</div>}{!headerCompact&&<div title={player.membershipLastSuccessfulAt?new Date(player.membershipLastSuccessfulAt).toLocaleString():undefined} style={{fontSize:12,color:C.icy}}>{membershipFreshness(player).label}</div>}{!headerCompact&&player.providerStats?.retrievedAt&&<div title={new Date(player.providerStats.retrievedAt).toLocaleString()} style={{fontSize:12,color:C.icy}}>API data · {relativeProfileAge(player.providerStats.retrievedAt).replace(/^Updated /,'')}</div>}</div>
        <button style={profileButton} aria-label="Close profile" onClick={onClose}>✕</button>
      </header>
      <ProfileOrderedSections key={player.id} player={player} onSave={onSave} players={players} preferences={teamworkPreferences} onSavePreferences={onSaveTeamworkPreferences} events={events}/>
      <ProfileDetails title="Identity administration"><ProfileIdentity key={`identity:${player.id}`} player={player} onSave={onSave}/></ProfileDetails>
      <ProfileDetails title="Officer tools"><ProfileSection title="Check username with API">
        <p style={{fontSize:13,color:C.icy,margin:'0 0 10px'}}>Look up this Player ID directly. This checks the provider separately from the alliance roster and won't change saved data without confirmation.</p>
        <button type="button" style={profileButton} disabled={!player.fid||playerLookup?.status==='loading'} onClick={()=>onCheckPlayerName?.(player)}>{playerLookup?.status==='loading'?'Checking…':'Refresh player name'}</button>
        {playerLookup?.fid===String(player.fid)&&playerLookup.status==='error'&&<p role="alert" style={{fontSize:13,color:C.red}}>{playerLookup.message}</p>}
        {playerLookup?.fid===String(player.fid)&&playerLookup.status==='success'&&<div role="status" style={{marginTop:12,padding:12,borderRadius:10,border:`1px solid ${C.border}`,fontSize:13,color:C.icy}}>
          <div>Saved name: <strong>{player.username||'Unknown'}</strong></div>
          <div>Direct API name: <strong>{playerLookup.name}</strong></div>
          <div style={{marginTop:6,fontSize:12}}>Retrieved: {playerLookup.retrievedAt?new Date(playerLookup.retrievedAt).toLocaleString():'Not provided'}</div>
          <div style={{fontSize:12}}>Provider cache timestamp: {playerLookup.cachedAt?new Date(playerLookup.cachedAt).toLocaleString():'Not provided'}</div>
          {playerLookup.name!==player.username?<button type="button" style={{...profileButton,marginTop:10}} onClick={()=>onApplyCheckedName?.(player)}>Use API username</button>:<p style={{margin:'8px 0 0'}}>The direct API returned the saved username. If the game shows a different name, the provider may be behind.</p>}
        </div>}
      </ProfileSection>
      {player.blacklisted&&<p style={{fontSize:14,color:C.red}}>Excluded from battle plans{player.blacklistReason?`: ${player.blacklistReason}`:''}</p>}
      <ProfileSection title="Alliance rank"><p style={{fontSize:14,color:C.icy,margin:'0 0 12px'}}>Tap a rank to set it. Tap again to clear.</p><div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{ALLIANCE_RANKS.map(rank=><button key={rank} style={{...profileButton,color:player.allianceRank===rank?C.gold:C.icy,borderColor:player.allianceRank===rank?C.gold:C.border}} aria-pressed={player.allianceRank===rank} onClick={()=>setAllianceRank(rank)}>{rank}</button>)}</div></ProfileSection>
      <ProfileRoles key={`roles:${player.id}`} player={player} roles={roles} onSave={onSave}/>
      <ProfileSheetImport player={player}/></ProfileDetails>
      <button onClick={onClose} style={{...profileButton,width:'100%',marginBottom:'env(safe-area-inset-bottom)'}}>Done</button>
    </section>
  </div>;
}
