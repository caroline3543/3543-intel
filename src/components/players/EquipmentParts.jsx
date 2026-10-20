import {useState} from 'react';
import {C} from '../../utils/constants.js';
import {normalizeAvatarUrl} from '../../services/playerAvatarService.js';
export const equipmentDate=value=>value && Number.isFinite(Date.parse(value))?new Date(value).toISOString().slice(0,16).replace('T',' ')+' UTC':'Not recorded';
export function EquipmentIcon({url,name,size=40}){
  const src=normalizeAvatarUrl(url),[failed,setFailed]=useState(null);
  return <div style={{width:size,height:size,flexShrink:0,borderRadius:8,overflow:'hidden',background:C.card,display:'flex',alignItems:'center',justifyContent:'center',color:C.gold}}>{src && failed!==src?<img src={src} width={size} height={size} alt={name || 'Equipment'} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={()=>setFailed(src)} style={{width:'100%',height:'100%',objectFit:'contain'}}/>:<span aria-hidden="true">✦</span>}</div>;
}
export function EquipmentFacts({entries}){
  return <div style={{display:'flex',flexWrap:'wrap',gap:'6px 12px',fontSize:12,color:C.icy,marginTop:6}}>{entries.filter(([,value])=>value!=null && value!=='' && ['string','number'].includes(typeof value)).map(([label,value])=><span key={label}>{label} <strong style={{color:C.white}}>{typeof value==='number'?value.toLocaleString('en-US'):value}</strong></span>)}</div>;
}
