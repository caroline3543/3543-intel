import { useState } from 'react';
import { C } from '../../utils/constants.js';
import { ProfileSection } from './ProfileParts.jsx';

const types=[['infantry','Infantry'],['lancer','Lancer'],['marksman','Marksman']];
const tiers=['t11','t10'];
const inputStyle={width:'100%',minWidth:0,boxSizing:'border-box',border:`1px solid ${C.border}`,background:C.section,borderRadius:9,padding:'9px 8px',minHeight:42,color:C.white,fontSize:15};
const asText=v=>v==null?'':String(v);
function validInteger(value) {if(value==='')return null;const n=Number(value);return Number.isSafeInteger(n)&&n>=0?n:undefined;}
export function ProfileTalCapacity({player,onSave}) {
  const [editing,setEditing]=useState(false);
  const [march,setMarch]=useState(asText(player.marchCapacity));
  const [rally,setRally]=useState(asText(player.leaderProfile?.rallyCapacity));
  const [inventory,setInventory]=useState(()=>{
    const inv=player.talTroopInventory||{};
    return Object.fromEntries(types.map(([t])=>[t,Object.fromEntries(tiers.map(tier=>[tier,asText(inv[t]?.[tier])]))]));
  });
  const [message,setMessage]=useState('');
  function save() {
    const marchNumber=validInteger(march),rallyNumber=validInteger(rally);
    const values=Object.fromEntries(types.map(([t])=>[t,Object.fromEntries(tiers.map(tier=>[tier,validInteger(inventory[t][tier])]))]));
    if(marchNumber===undefined||rallyNumber===undefined||types.some(([t])=>tiers.some(k=>values[t][k]===undefined))) {setMessage('Enter non-negative whole numbers, or leave unknown values blank.');return;}
    const stamp=new Date().toISOString();
    onSave({...player,marchCapacity:marchNumber,leaderProfile:{...player.leaderProfile,rallyCapacity:rallyNumber},talTroopInventory:values,talTroopInventoryRecordedAt:stamp,profileLastUpdated:stamp});
    setMessage('Capacity and inventory saved.');
    setEditing(false);
  }
  return <ProfileSection title="TAL rally capacity & inventory">
    <p style={{color:C.icy,fontSize:13,margin:'0 0 10px'}}>Reusable across TAL matches. Blank means unknown, not zero.</p>
    {player.talTroopInventoryRecordedAt&&<p style={{color:C.muted,fontSize:12}}>Last recorded: {new Date(player.talTroopInventoryRecordedAt).toLocaleString()}</p>}
    {!editing?<div>
      <p style={{color:C.icy,fontSize:13}}>March: {player.marchCapacity==null?'Unknown':Number(player.marchCapacity).toLocaleString()} · Rally: {player.leaderProfile?.rallyCapacity==null?'Unknown':Number(player.leaderProfile.rallyCapacity).toLocaleString()}</p>
      <button type="button" onClick={()=>setEditing(true)} style={{...inputStyle,background:C.card,color:C.gold,cursor:'pointer'}}>Edit troop inventory</button>
    </div>:<>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
        <label style={{color:C.icy,fontSize:12}}>March capacity<input type="number" min="0" style={inputStyle} value={march} onChange={e=>setMarch(e.target.value)}/></label>
        <label style={{color:C.icy,fontSize:12}}>Rally capacity<input type="number" min="0" style={inputStyle} value={rally} onChange={e=>setRally(e.target.value)}/></label>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6,marginBottom:7,color:C.icy,fontSize:12}}><span>Type</span><span>T11 Helios</span><span>T10 fallback</span></div>
      {types.map(([type,title])=><div key={type} style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6,alignItems:'center',marginBottom:8}}>
        <span style={{color:C.white,fontSize:12}}>{title}</span>
        {tiers.map(tier=><input key={tier} type="number" min="0" aria-label={`${title} ${tier.toUpperCase()} count`} style={inputStyle} value={inventory[type][tier]} onChange={e=>setInventory(prev=>({...prev,[type]:{...prev[type],[tier]:e.target.value}}))}/>)}
      </div>)}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
        <button type="button" style={{...inputStyle,cursor:'pointer'}} onClick={()=>setEditing(false)}>Cancel</button>
        <button type="button" style={{...inputStyle,background:C.gold,color:C.bg,fontWeight:700,cursor:'pointer'}} onClick={save}>Save capacity</button>
      </div>
    </>}
    {message&&<p role="status" style={{color:C.gold,fontSize:12}}>{message}</p>}
  </ProfileSection>;
}
