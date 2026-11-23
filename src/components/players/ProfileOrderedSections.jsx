import {useState} from 'react';
import {C} from '../../utils/constants.js';
import {PROFILE_SECTION_IDS,normalizeProfileSectionOrder,moveProfileSection} from '../../services/profileSectionOrder.js';
import {ProfileStrengthSummary} from './ProfileStrengthSummary.jsx';
import {ProfileMovementSummary} from './ProfileMovementSummary.jsx';
import {ProfileJoiners} from './ProfileJoiners.jsx';
import {ProfileTeamwork} from './ProfileTeamwork.jsx';
import {ProfileNotes} from './ProfilePlanning.jsx';
import {ProfileDetails,ProfileSection,profileButton} from './ProfileParts.jsx';
import {PlayerHistorySection} from './PlayerHistorySection.jsx';
import {PlayerRankingsSection} from './PlayerRankingsSection.jsx';
import {PlayerEquipmentSection} from './PlayerEquipmentSection.jsx';
import {TroopPowerChart} from './TroopPowerChart.jsx';

const labels={
 'event-power':'Event power','troop-tiers':'Troop tiers','quick-statistics':'Quick statistics',
 'previous-usernames':'Previous usernames','alliance-movements':'Alliance movements',
 'hero-pet-expert-power':'Hero, pet & expert power','joiner-heroes':'Joiner heroes',
 teamwork:'Teamwork','officer-notes':'Officer notes',
 'last-known-location':'Last known location',more:'More'
};
const display = value => value==null||value===''||!Number.isFinite(Number(value))?'Not recorded':new Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:1}).format(Number(value));

/** Session-only ordering until authenticated per-organiser preferences are available.
 * Do not persist this to shared browser storage: multiple organisers may use one device.
 */
export function ProfileOrderedSections({player,onSave,players,preferences,onSavePreferences,events,history}) {
 const [order,setOrder]=useState(()=>normalizeProfileSectionOrder());
 const [arranging,setArranging]=useState(false);
 const [expandedMore,setExpandedMore]=useState(false);
 const names=[...new Set((player.pastUsernames||[]).filter(Boolean))].slice(-3).reverse();
 function render(id){
  switch(id){
   case 'event-power': case 'troop-tiers': case 'quick-statistics':
    return <ProfileStrengthSummary player={player} onSave={onSave} section={id}/>;
   case 'previous-usernames':
    return <ProfileSection title="Previous usernames">{names.length?<div style={{display:'flex',gap:6,flexWrap:'wrap'}}>{names.map(name=><span key={name} style={{border:`1px solid ${C.border}`,padding:8,borderRadius:8,overflowWrap:'anywhere'}}>{name}</span>)}</div>:<p>None recorded</p>}</ProfileSection>;
   case 'alliance-movements':return <ProfileMovementSummary player={player}/>;
   case 'hero-pet-expert-power':
    return <ProfileSection title="Hero, pet & expert power"><div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:12}}>{[
     ['Strongest hero',player.strongestHeroPower],['Total heroes',player.totalHeroPower??player.heroesTotalPower],
     ['Pets',player.totalPetPower],['Experts',player.totalExpertPower]
    ].map(([name,value])=><div key={name} style={{minWidth:0}}><div style={{fontSize:12,color:C.icy}}>{name}</div><strong style={{fontSize:18,overflowWrap:'anywhere'}}>{display(value)}</strong></div>)}</div></ProfileSection>;
   case 'joiner-heroes':return <ProfileJoiners player={player} onSave={onSave}/>;
   case 'teamwork':return <ProfileTeamwork player={player} players={players} preferences={preferences} onSavePreferences={onSavePreferences} onSavePlayer={onSave}/>;
   case 'officer-notes':return <ProfileNotes player={player} onSave={onSave}/>;
   case 'last-known-location':
    return <ProfileSection title="Last known location"><p style={{fontSize:14,color:C.icy}}>{player.lastKnownLocation?.state&&player.lastKnownLocation?.x!=null&&player.lastKnownLocation?.y!=null?`State ${player.lastKnownLocation.state} · X:${player.lastKnownLocation.x} Y:${player.lastKnownLocation.y}`:'Location not recorded'}</p></ProfileSection>;
   case 'more':return <ProfileDetails title="More"><ProfileDetails title="History and attendance"><PlayerHistorySection player={player}/>{history}</ProfileDetails><ProfileDetails title="Heroes and equipment"><PlayerEquipmentSection player={player} onSave={onSave}/></ProfileDetails><ProfileDetails title="Other rankings"><PlayerRankingsSection player={player}/></ProfileDetails></ProfileDetails>;
   default:return null;
  }
 }
 return <div>
  <button type="button" onClick={()=>setArranging(x=>!x)} aria-expanded={arranging} style={{...profileButton,width:'100%',marginBottom:12}}>{arranging?'Done arranging':'Arrange profile sections'}</button>
  {arranging&&<div aria-label="Profile section order" style={{marginBottom:16}}>
   <p style={{fontSize:12,color:C.icy}}>Order changes apply to this open profile only. Account sync is not yet enabled.</p>
   <button type="button" style={profileButton} onClick={()=>setOrder(normalizeProfileSectionOrder())}>Reset order</button>
   {order.map((id,index)=><div key={id} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 0',borderBottom:`1px solid ${C.border}`}}>
    <span style={{flex:1,minWidth:0,fontSize:14}}>{labels[id]}</span>
    <button type="button" aria-label={`Move ${labels[id]} up`} disabled={index===0} style={profileButton} onClick={()=>setOrder(prev=>moveProfileSection(prev,id,-1))}>↑</button>
    <button type="button" aria-label={`Move ${labels[id]} down`} disabled={index===order.length-1} style={profileButton} onClick={()=>setOrder(prev=>moveProfileSection(prev,id,1))}>↓</button>
   </div>)}
  </div>}
  {order.map(id=><div key={id} data-profile-section={id}>{render(id)}</div>)}
 </div>;
}
