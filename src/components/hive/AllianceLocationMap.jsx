import {useState} from 'react';
import {C} from '../../utils/constants.js';
import {locationBounds} from '../../services/hiveIntegrationService.js';
import {LocationPlayerDetails} from './LocationPlayerDetails.jsx';
export function AllianceLocationMap({roster,players,onViewPlayer}){
 const [selected,setSelected]=useState(null),[zoom,setZoom]=useState(1);
 const located=roster.players.filter(p=>p.location),bounds=locationBounds(roster.players),width=420,height=Math.max(300,Math.min(600,width*bounds.h/bounds.w));
 const chosen=roster.players.find(p=>p.id===selected),player=players.find(p=>p.id===selected);
 const toX=x=>(x-bounds.x)/bounds.w*width,toY=y=>height-(y-bounds.y)/bounds.h*height;
 return <div><p style={{fontSize:13,color:C.icy,lineHeight:1.5}}>{located.length} of {roster.players.length} players have recorded coordinates. Shows saved locations, including completed fetches. Planned city placements stay unchanged.</p>
  <div style={{display:'flex',gap:8,marginBottom:8}}>{[['−',()=>setZoom(z=>Math.max(1,z-0.5))],['+',()=>setZoom(z=>Math.min(6,z+0.5))],['Fit',()=>{setZoom(1);setSelected(null)}]].map(([label,action])=><button key={label} onClick={action} aria-label={label==='+'?'Zoom in':label==='−'?'Zoom out':'Fit locations'} style={{minWidth:44,minHeight:44,border:`1px solid ${C.border}`,borderRadius:8,background:C.section,color:C.white}}>{label}</button>)}</div>
  <div style={{overflow:'auto',height:440,border:`1px solid ${C.border}`,borderRadius:12,background:C.bg}}>{located.length?<svg aria-label={`Reported ${roster.alliance} city locations`} role="img" viewBox={`0 0 ${width} ${height}`} style={{display:'block',width:`${zoom*100}%`,minWidth:420*zoom,height:height*zoom}}>
   {located.map(p=>{const x=toX(p.location.x),y=toY(p.location.y),w=Math.max(3,2/bounds.w*width),h=Math.max(3,2/bounds.h*height);return <g key={p.id}><rect x={x} y={y-h} width={w} height={h} rx={1} fill={selected===p.id?C.gold:C.icy}/><rect x={x-12} y={y-24} width={Math.max(44,w+24)} height={Math.max(44,h+24)} fill="transparent" tabIndex={0} role="button" aria-label={`${p.name}, X${p.location.x} Y${p.location.y}`} onClick={()=>setSelected(p.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected(p.id)}}}/>{(bounds.w<150 || selected===p.id) && <text x={x+w/2} y={y+12} textAnchor="middle" fontSize={selected===p.id?11:9} fill={selected===p.id?C.gold:C.white} pointerEvents="none">{p.name}</text>}</g>})}
  </svg>:<p style={{padding:20,color:C.muted,fontSize:13}}>No saved coordinates for this alliance. Use Fetch all locations to request them.</p>}</div>
  {roster.players.some(p=>!p.location) && <details style={{fontSize:12,color:C.muted,marginTop:8}}><summary style={{minHeight:44,cursor:'pointer'}}>Missing coordinates ({roster.players.length-located.length})</summary><ul>{roster.players.filter(p=>!p.location).map(p=><li key={p.id}>{p.name}</li>)}</ul></details>}
  <label style={{display:'block',fontSize:12,color:C.icy,marginTop:12}}>Find a player<select aria-label="Find a player" value={selected || ''} onChange={e=>setSelected(e.target.value || null)} style={{display:'block',width:'100%',minHeight:44,marginTop:6,border:`1px solid ${C.border}`,borderRadius:8,background:C.section,color:C.white,padding:8,fontSize:16}}><option value="">Choose a player</option>{roster.players.map(p=><option key={p.id} value={p.id}>{p.name}{p.location?'':' · location missing'}</option>)}</select></label>
  {player && chosen && <LocationPlayerDetails key={player.id} player={player} reported={chosen} onViewPlayer={onViewPlayer}/>}
 </div>;
}
