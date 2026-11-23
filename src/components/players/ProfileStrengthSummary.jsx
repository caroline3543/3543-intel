import { useState } from 'react';
import { C } from '../../utils/constants.js';
import { ProfileTroops } from './ProfileTroops.jsx';
import { dataFreshness } from '../../services/profileFreshness.js';

const number = value => value == null || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);
const compact = value => value == null ? 'Unavailable' : new Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:1}).format(value);
const age = raw => {const time=Date.parse(raw||'');if(!Number.isFinite(time))return 'Date unknown';const days=Math.max(0,Math.floor((Date.now()-time)/86400000));return days===0?'Recorded today':days===1?'Recorded yesterday':`Recorded ${days}d ago`;};
function Stat({label,value}){return <div style={{flex:1,minWidth:0}}><div style={{fontSize:12,color:C.icy}}>{label}</div><div style={{fontSize:21,fontWeight:650,color:C.white,fontVariantNumeric:'tabular-nums',marginTop:4}}>{value}</div></div>;}
export function ProfileStrengthSummary({player,onSave}){
 const [showEvents,setShowEvents]=useState(false);
 const foundry=number(player.lastFoundryTroopPower);
 const foundryFreshness=dataFreshness(foundry,player.lastFoundryTroopPowerAt);
 const tal=number(player.lastTalTroopPower ?? player.lastTALTroopPower);
 const canyon=number(player.lastCanyonTroopPower ?? player.lastCanyonClashTroopPower);
 const stats=player.providerStats||{};
 const labRank=number(stats.labRank ?? player.labRank);
 const labScore=number(stats.labScore ?? player.labScore);
 const city=number(player.power ?? player.cityPower);
 return <div aria-label="Player strength" style={{padding:'8px 0 18px',borderBottom:`1px solid ${C.border}`}}>
  <div style={{fontSize:13,color:C.icy,marginBottom:5}}>Foundry troop power</div>
  <div style={{fontSize:34,lineHeight:1.12,fontWeight:750,letterSpacing:'-0.025em',color:C.white,fontVariantNumeric:'tabular-nums'}}>{compact(foundry)}</div>
  <div style={{fontSize:12,color:foundryFreshness.status==='stale'?C.gold:C.icy,marginTop:6}}>{foundryFreshness.label}</div>
  <button type="button" aria-expanded={showEvents} onClick={()=>setShowEvents(x=>!x)} style={{display:'flex',alignItems:'center',justifyContent:'space-between',width:'100%',minHeight:44,padding:'10px 0',background:'transparent',border:0,color:C.icy,fontSize:14,textAlign:'left',cursor:'pointer'}}>Other event power <span aria-hidden="true">{showEvents?'⌃':'⌄'}</span></button>
  {showEvents&&<div style={{display:'grid',gap:10,padding:'2px 0 14px'}}>
   {[[ 'TAL',tal,player.lastTalTroopPowerAt ?? player.lastTALTroopPowerAt],['Canyon Clash',canyon,player.lastCanyonTroopPowerAt ?? player.lastCanyonClashTroopPowerAt]].map(([label,value,date])=><div key={label} style={{display:'flex',justifyContent:'space-between',gap:12,fontSize:13,color:C.icy}}><span>{label}<small style={{display:'block',marginTop:3}}>{dataFreshness(value,date).label}</small></span><strong style={{color:C.white,fontSize:15}}>{compact(value)}</strong></div>)}
  </div>}
  <div style={{marginTop:8}}><ProfileTroops player={player} onSave={onSave}/></div>
  <div style={{marginTop:18}}><div style={{fontSize:13,color:C.icy,marginBottom:10}}>Labyrinth</div><div style={{display:'flex',gap:20}}><Stat label="Rank" value={labRank==null?'—':`#${labRank.toLocaleString()}`}/><Stat label="Score" value={labScore==null?'—':labScore.toLocaleString()}/></div></div>
  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,marginTop:20,fontSize:14}}><span style={{color:C.icy}}>City power</span><strong style={{color:C.white,fontVariantNumeric:'tabular-nums'}}>{compact(city)}</strong></div>
 </div>;
}
