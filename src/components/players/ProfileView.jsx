import {ProfileTeamwork} from './ProfileTeamwork.jsx';
import { ProfileTalCapacity } from './ProfileTalCapacity.jsx';
import {ProfileSheetImport} from './ProfileSheetImport.jsx';
import {CopyPlayerId} from './CopyPlayerId.jsx';
import { useEffect, useRef } from 'react';
import { C, ALLIANCE_RANKS, TROOP_POWER_EVENTS } from '../../utils/constants.js';
import { roleColor } from '../../utils/roles.js';
import { fmtDateShort } from '../../utils/dates.js';
import { calcMetrics } from '../../data/metrics.js';
import { PlayerAvatar } from './PlayerAvatar.jsx';
import { ProfileSection, ProfileDetails, profileButton } from './ProfileParts.jsx';
import { ProfileTroops } from './ProfileTroops.jsx';
import { ProfileIdentity } from './ProfileIdentity.jsx';
import { ProfileRoles, ProfileNotes } from './ProfilePlanning.jsx';
import { ProfileJoiners } from './ProfileJoiners.jsx';
import { PlayerEquipmentSection } from './PlayerEquipmentSection.jsx';
import { ProviderStatsSection } from './ProviderStatsSection.jsx';
import { PlayerRankingsSection } from './PlayerRankingsSection.jsx';
import { PlayerHistorySection } from './PlayerHistorySection.jsx';
import { TroopPowerChart } from './TroopPowerChart.jsx';
export function ProfileView({player,roles=[],open,onClose,events=[],onOpenLeaderProfile,onSave,players=[],teamworkPreferences={},onSaveTeamworkPreferences}) {
  const panel=useRef(null);
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
    <section ref={panel} role="dialog" aria-modal="true" aria-label={`Player profile: ${name}`} onClick={e=>e.stopPropagation()} style={{background:C.card,borderRadius:'20px 20px 0 0',width:'100%',maxWidth:480,maxHeight:'94dvh',overflowY:'auto',boxSizing:'border-box',padding:'0 16px 24px',overscrollBehavior:'contain'}}>
      <header style={{position:'sticky',top:0,zIndex:1,background:C.card,padding:'16px 0 12px',display:'flex',gap:12,alignItems:'center',borderBottom:`1px solid ${C.border}`,marginBottom:16}}>
        <PlayerAvatar player={player} size={48} color={roleColor(player.roles?.[0],roles)} bordered/>
        <div style={{flex:1,minWidth:0}}><h2 style={{fontSize:20,color:C.white,margin:0,overflowWrap:'anywhere'}}>{name}</h2>{player.alias&&player.username&&<div style={{fontSize:14,color:C.icy,marginTop:3}}>{player.alias}</div>}<div style={{fontSize:14,color:C.icy,marginTop:4}}>{[player.allianceTag?`[${player.allianceTag}]`:null,player.furnaceLevel].filter(Boolean).join(' · ')}</div><CopyPlayerId fid={player.fid}/></div>
        <button style={profileButton} aria-label="Close profile" onClick={onClose}>✕</button>
      </header>
      {player.blacklisted&&<p style={{fontSize:14,color:C.red}}>Excluded from battle plans{player.blacklistReason?`: ${player.blacklistReason}`:''}</p>}
      <ProfileSection title="Alliance rank"><p style={{fontSize:14,color:C.icy,margin:'0 0 12px'}}>Tap a rank to set it. Tap again to clear.</p><div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{ALLIANCE_RANKS.map(rank=><button key={rank} style={{...profileButton,color:player.allianceRank===rank?C.gold:C.icy,borderColor:player.allianceRank===rank?C.gold:C.border}} aria-pressed={player.allianceRank===rank} onClick={()=>setAllianceRank(rank)}>{rank}</button>)}</div></ProfileSection>
      <ProfileTroops key={`troops:${player.id}`} player={player} onSave={onSave}/>
      <ProfileTalCapacity key={`tal-capacity:${player.id}`} player={player} onSave={onSave}/>
      <ProfileTeamwork key={`tal-teamwork:${player.id}`} player={player} players={players} preferences={teamworkPreferences} onSavePreferences={onSaveTeamworkPreferences} onSavePlayer={onSave}/>
      <ProfileJoiners key={`heroes:${player.id}`} player={player} onSave={onSave}/>
      <ProfileRoles key={`roles:${player.id}`} player={player} roles={roles} onSave={onSave}/>
        {(player.leaderProfile?.teams || []).length > 0 && (
          <ProfileSection title="Rally setup">
            {player.leaderProfile.marchTime != null && (
              <div style={{ fontSize:13, color:C.gold, fontWeight:700, marginBottom:10 }}>
                🏃 March time: {Math.floor(player.leaderProfile.marchTime / 60)}:{String(player.leaderProfile.marchTime % 60).padStart(2,'0')}
              </div>
            )}
            {player.leaderProfile.teams.map(team => {
              const heroes = (team.leadHeroes || []).filter(Boolean);
              if (!heroes.length) return null;
              return (
                <div key={team.id} style={{ marginBottom:10 }}>
                  <div style={{ fontSize:13, color:C.icy, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>{team.type === 'offense' ? '⚔️ Offense' : '🛡️ Defense'}{team.ratio ? ` · ${team.ratio}` : ''}</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                    {heroes.map(h => {
                      const skill = team.heroSkillLevels?.[h];
                      const widgets = team.widgets?.[h];
                      return (
                        <span key={h} style={{ padding:'6px 12px', borderRadius:16, background:C.gold+'18', border:`1px solid ${C.gold}44`, color:C.gold, fontWeight:600, fontSize:13 }}>
                          {h}{skill != null ? ` · Skill ${skill}` : ''}{widgets != null ? ` · Widget ${widgets}` : ''}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </ProfileSection>
        )}


      <button onClick={onOpenLeaderProfile} style={{...profileButton,width:'100%',color:C.gold,marginBottom:12}}>Edit rally setup</button>
      <ProfileIdentity key={`identity:${player.id}`} player={player} onSave={onSave}/><ProfileSheetImport player={player}/>
      <ProfileNotes key={`notes:${player.id}`} player={player} onSave={onSave}/>
      <ProfileDetails title="Game stats"><ProviderStatsSection player={player}/></ProfileDetails>
      <ProfileDetails title="Heroes & equipment"><PlayerEquipmentSection player={player} onSave={onSave}/></ProfileDetails>
      <ProfileDetails title="Rankings"><PlayerRankingsSection player={player}/></ProfileDetails>
      <ProfileDetails title="History & attendance"><PlayerHistorySection player={player}/>
        {metrics&&(
          <ProfileSection title="Event attendance">
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:12 }}>
              {[['Attendance',`${metrics.attendancePct}%`,metrics.attendancePct>=70?C.green:C.gold],['Discord',`${metrics.voicePct}%`,C.icy],['Reliability score',`${metrics.reliabilityScore}/100`,metrics.reliabilityScore>=70?C.green:C.gold]].map(([l,v,c])=>(
                <div key={l} style={{ background:C.card, borderRadius:10, padding:10, textAlign:'center' }}>
                  <div style={{ fontSize:18, fontWeight:700, color:c }}>{v}</div>
                  <div style={{ fontSize:13, color:C.icy, marginTop:2 }}>{l}</div>
                </div>
              ))}
            </div>
            {snaps.slice(0,4).map(s=>(
              <div key={s.snapshotId} style={{ padding:'8px 0', borderBottom:`1px solid ${C.border}22`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:C.white }}>{s.eventName}</div>
                  <div style={{ fontSize:13, color:C.icy }}>{fmtDateShort(s.eventDate)}</div>
                </div>
                <div style={{ display:'flex', gap:4 }}>
                  {s.attendance?.attended===true&&<span style={{ fontSize:11, padding:'2px 6px', borderRadius:8, background:C.green+'18', color:C.green }}>✓</span>}
                  {s.attendance?.noShow&&<span style={{ fontSize:11, padding:'2px 6px', borderRadius:8, background:C.red+'18', color:C.red }}>✗</span>}
                  {s.voice?.joined===true&&<span style={{ fontSize:11, padding:'2px 6px', borderRadius:8, background:C.icy+'18', color:C.icy }}>🎙️</span>}
                </div>
              </div>
            ))}
          </ProfileSection>
        )}


        {troopPowerHistory.length>0&&<ProfileSection title="Event troop power"><TroopPowerChart points={troopPowerHistory}/><p style={{fontSize:13,color:C.icy}}>Recorded in Foundry and Canyon Clash.</p></ProfileSection>}
      </ProfileDetails>
      <button onClick={onClose} style={{...profileButton,width:'100%',marginBottom:'env(safe-area-inset-bottom)'}}>Done</button>
    </section>
  </div>;
}
