import { useState } from 'react';
import { C, TIER_OPTIONS } from '../../utils/constants.js';
import { ProfileSection, profileButton } from './ProfileParts.jsx';
const types=[['infantry','Infantry',C.inf],['lancer','Lancer',C.lan],['marksman','Marksman',C.mar]];
export function ProfileTroops({player,onSave}) {
  const [editing,setEditing]=useState(null);
  const [message,setMessage]=useState('');
  const current=types.find(([key])=>key===editing);
  function choose(value){
    const at=new Date().toISOString();
    onSave({...player,troops:{...player.troops,[editing]:value},tiersUpdatedAt:at,profileLastUpdated:at});
    setMessage(`${current[1]} saved: ${value||'Unknown'}`);setEditing(null);
  }
  return <ProfileSection title="Troop tiers">
    <p style={{fontSize:14,color:C.icy,margin:'0 0 12px'}}>Tap a troop type to change its tier.</p>
    <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:8}}>{types.map(([key,label,color])=><button key={key} style={{...profileButton,padding:'12px 4px',borderColor:editing===key?color:C.border}} aria-label={`Edit ${label.toLowerCase()} tier: ${player.troops?.[key]||'Unknown'}`} aria-expanded={editing===key} onClick={()=>{setEditing(editing===key?null:key);setMessage('');}}><span style={{display:'block',fontSize:13,color:C.icy,marginBottom:8}}>{label}</span><span style={{display:'block',fontSize:16,fontWeight:700,color,overflowWrap:'anywhere'}}>{player.troops?.[key]||'Unknown'}</span></button>)}</div>
    {current && <div style={{marginTop:14,paddingTop:14,borderTop:`1px solid ${C.border}`}} role="group" aria-label={`${current[1]} tier`}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}><strong style={{fontSize:14}}>Choose {current[1].toLowerCase()} tier</strong><button style={profileButton} onClick={()=>setEditing(null)}>Cancel</button></div>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{[...new Set([player.troops?.[editing],...TIER_OPTIONS].filter(Boolean)),null].map(tier=><button key={tier||'unknown'} aria-pressed={(player.troops?.[editing]||null)===tier} onClick={()=>choose(tier)} style={{...profileButton,color:player.troops?.[editing]===tier?C.gold:C.icy,borderColor:player.troops?.[editing]===tier?C.gold:C.border}}>{tier||'Unknown'}</button>)}</div>
    </div>}
    {message && <p role="status" style={{fontSize:14,color:C.green,marginBottom:0}}>{message}</p>}
  </ProfileSection>;
}
