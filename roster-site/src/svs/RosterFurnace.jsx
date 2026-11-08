import {useState} from 'react';
import {C} from '../../../src/utils/constants.js';
import {providerFurnaceLevel} from '../../../src/services/providerProfileService.js';

const tierNames=['FC10','FC9','FC8','FC7','FC6','FC5','FC4','FC3','FC2','FC1','Pre-FC','Unknown'];
export function normalizeRosterResponse(response,expectedState,tag){
 const data=response?.data;
 if(!Array.isArray(data?.members))throw new Error('Alliance roster missing');
 if(data.alliance?.kid!=null&&Number(data.alliance.kid)!==Number(expectedState))throw new Error('Alliance belongs to a different state');
 const seen=new Set();
 return data.members.flatMap(m=>{
  if(m.kid!=null&&Number(m.kid)!==Number(expectedState))return [];
  const id=String(m.chief_id??m.fid??'');
  if(!/^[1-9]\d+$/.test(id)||seen.has(id))return [];
  seen.add(id);
  const raw=m.furnace_level_label??m.furnace_level??m.stove_lv??m.town_center_level;
  const level=providerFurnaceLevel(raw);
  const tier=level?.startsWith('FC')?level:level?.startsWith('F')?'Pre-FC':'Unknown';
  return [{fid:id,name:m.nick_name||'Unknown player',tag:tag,level:level||'Unknown',tier:tierNames.includes(tier)?tier:'Unknown',power:Number(m.power)||null}];
 });
}
export function aggregateRoster(rosters){
 const map=new Map();
 for(const roster of rosters||[])for(const player of roster.players||[])map.set(player.fid,player);
 return [...map.values()];
}
export function RosterFurnace({ours,theirs,ourLabel,theirLabel}){
 const [selected,setSelected]=useState(null);
 const columns=[{name:ourLabel,players:ours,color:C.gold},{name:theirLabel,players:theirs,color:C.blue}];
 const counts=columns.map(side=>Object.fromEntries(tierNames.map(tier=>[tier,side.players.filter(p=>p.tier===tier).length])));
 const max=Math.max(1,...counts.flatMap(c=>tierNames.map(t=>c[t])));
 const high=c=>['FC10','FC9','FC8','FC7'].reduce((n,t)=>n+c[t],0);
 return <section style={{background:C.card,borderRadius:16,padding:16,marginTop:16}}>
  <h3 style={{fontSize:18,margin:'0 0 5px'}}>Furnace distribution</h3>
  <p style={{color:C.icy,fontSize:13,lineHeight:1.5,margin:'0 0 14px'}}>Count players across the loaded alliance rosters. Tap a tier to see who is included.</p>
  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
   {columns.map((side,i)=><div key={i} style={{background:C.section,padding:12,borderRadius:12,minWidth:0}}>
    <div style={{fontSize:12,fontWeight:700,color:side.color,overflowWrap:'anywhere'}}>{side.name}</div>
    <div style={{fontWeight:800,fontSize:29,marginTop:6}}>{side.players.length}</div><div style={{fontSize:12,color:C.icy}}>Players tracked</div>
    <div style={{borderTop:'1px solid '+C.border,marginTop:10,paddingTop:10,fontSize:13}}><strong>{high(counts[i])}</strong> <span style={{color:C.icy}}>FC7+</span></div>
   </div>)}
  </div>
  <div style={{display:'grid',gridTemplateColumns:'76px 1fr 1fr',gap:8,alignItems:'center',marginBottom:6}}><span style={{color:C.muted,fontSize:12}}>Tier</span>{columns.map((side,i)=><span key={i} style={{color:side.color,textAlign:'center',fontSize:12,fontWeight:700,overflowWrap:'anywhere'}}>{side.name}</span>)}</div>
  {tierNames.map(tier=><button type="button" key={tier} onClick={()=>setSelected(selected===tier?null:tier)} aria-expanded={selected===tier} style={{display:'grid',gridTemplateColumns:'76px 1fr 1fr',gap:8,width:'100%',alignItems:'center',border:0,borderTop:'1px solid '+C.border,padding:'10px 0',background:selected===tier?C.section:'transparent',color:C.white,textAlign:'left',cursor:'pointer',borderRadius:4}}>
   <strong style={{fontSize:13}}>{tier}</strong>
   {counts.map((count,i)=><div key={i} style={{textAlign:'center'}}><strong style={{fontSize:16}}>{count[tier]}</strong><div style={{height:6,background:C.bg,borderRadius:4,overflow:'hidden',marginTop:6}}><div style={{height:'100%',background:columns[i].color,width:count[tier]/max*100+'%',borderRadius:4}}/></div></div>)}
  </button>)}
  {selected&&<div style={{background:C.section,borderRadius:12,padding:12,marginTop:10}}>
   <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><strong style={{fontSize:14}}>{selected} players</strong><button type="button" onClick={()=>setSelected(null)} style={{background:'none',border:0,color:C.icy,minHeight:36}}>Close</button></div>
   <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
    {columns.map((side,i)=><div key={i}><strong style={{fontSize:12,color:side.color}}>{side.name}</strong>{side.players.filter(p=>p.tier===selected).length?side.players.filter(p=>p.tier===selected).map(p=><div key={p.fid} style={{padding:'8px 0',borderBottom:'1px solid '+C.border,fontSize:12,overflowWrap:'anywhere'}}>{p.name}<div style={{color:C.muted}}>[{p.tag}] · {p.level}</div></div>):<p style={{fontSize:12,color:C.muted}}>No players tracked</p>}</div>)}
   </div>
  </div>}
  <p style={{fontSize:12,color:C.muted,lineHeight:1.55,margin:'14px 0 0'}}>Coverage includes only successfully loaded alliances. Unallied players and other alliances are excluded. Each player is counted once by game ID.</p>
 </section>;
}
