import {useState} from 'react';
import {C} from '../../../src/utils/constants.js';
import {providerFurnaceLevel} from '../../../src/services/providerProfileService.js';

const tierNames=['FC10','FC9','FC8','FC7','FC6','FC5','FC4','FC3','FC2','FC1','Pre-FC','Unknown'];
export function normalizeRosterResponse(response,expectedState,tag){
 const data=response?.data;
 if(!Array.isArray(data?.members))throw new Error('Alliance roster missing');
 if(data.alliance?.kid!=null&&Number(data.alliance.kid)!==Number(expectedState))throw new Error('Alliance belongs to a different state');
 const returnedTag=data.alliance?.tag??data.alliance?.alliance_tag??data.alliance?.abbr;
 if(returnedTag!=null&&String(returnedTag)!==String(tag))throw new Error('Alliance tag does not match exactly (capitalisation matters)');
 const seen=new Set();
 return data.members.flatMap(m=>{
  if(m.kid!=null&&Number(m.kid)!==Number(expectedState))return [];
  const id=String(m.chief_id??m.fid??'');
  if(!/^[1-9]\d+$/.test(id)||seen.has(id))return [];
  seen.add(id);
  const raw=m.furnace_level_label??m.furnace_level??m.stove_lv??m.town_center_level;
  const level=providerFurnaceLevel(raw);
  const tier=level?.startsWith('FC')?level:level?.startsWith('F')?'Pre-FC':'Unknown';
  return [{fid:id,name:m.nick_name||'Unknown player',tag:tag,level:level||'Unknown',tier:tierNames.includes(tier)?tier:'Unknown',power:Number(m.power)||null,labScore:(()=>{const raw=m.labyrinth_score??m.lab_score??m.labyrinth?.score;return raw==null||raw===''||!Number.isFinite(Number(raw))?null:Number(raw)})()}];
 });
}
export function aggregateRoster(rosters){
 const map=new Map();
 for(const roster of rosters||[])for(const player of roster.players||[])map.set(player.fid,player);
 return [...map.values()];
}
export function RosterFurnace({ours,theirs,ourLabel,theirLabel}){
 const [selected,setSelected]=useState(null);
 const [threshold,setThreshold]=useState(7);
 const [metric,setMetric]=useState('count');
 const columns=[{name:ourLabel,players:ours,color:'#89C4FF'},{name:theirLabel,players:theirs,color:'#EBC18A'}];
 const counts=columns.map(side=>Object.fromEntries(tierNames.map(tier=>[tier,side.players.filter(p=>p.tier===tier).length])));
 const known=columns.map(side=>side.players.filter(p=>p.tier!=='Unknown').length);
 const qualified=columns.map((side,i)=>tierNames.filter(t=>/^FC\d+$/.test(t)&&Number(t.slice(2))>=threshold).reduce((n,t)=>n+counts[i][t],0));
 const shares=qualified.map((n,i)=>known[i]?n/known[i]*100:0);
 const values=metric==='count'?qualified:shares;
 const leader=values[0]===values[1]?-1:values[0]>values[1]?0:1;
 const delta=Math.abs(values[0]-values[1]);
 const coverage=columns.map((side,i)=>({known:known[i],total:side.players.length}));
 const median=side=>{
  const sorted=side.players.map(p=>p.tier).filter(t=>/^FC\d+$/.test(t)).map(t=>Number(t.slice(2))).sort((a,b)=>a-b);
  if(!sorted.length)return '—';
  const lo=sorted[Math.floor((sorted.length-1)/2)],hi=sorted[Math.floor(sorted.length/2)];
  return lo===hi?'FC'+lo:'FC'+lo+'–FC'+hi;
 };
  return <section style={{background:C.card,borderRadius:16,padding:14,marginTop:16}}>
  <div style={{fontSize:11,fontWeight:750,color:C.icy,letterSpacing:'.07em'}}>FURNACE STRENGTH PROFILE</div>
  <h3 style={{fontSize:19,margin:'5px 0 4px'}}>Summary of advantages</h3>
  <p style={{color:C.icy,fontSize:12,margin:'0 0 12px'}}>Development comparison · recorded alliance members</p>
  <div style={{background:C.section,borderRadius:12,padding:13,marginBottom:15}}>
   <div style={{fontSize:22,fontWeight:800,fontVariantNumeric:'tabular-nums'}}>{leader<0?'Even at FC'+threshold+'+':columns[leader].name+' leads'}</div>
   <div style={{fontSize:13,color:C.icy,marginTop:5}}>{leader<0?'Both sides are equal at this threshold':(metric==='count'?delta+' more players':delta.toFixed(1)+' percentage points')+' at FC'+threshold+'+'}</div>
   <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:9,marginTop:12}}>
    {columns.map((side,i)=><div key={i} style={{borderTop:'1px solid '+C.border,paddingTop:9}}><div style={{color:side.color,fontSize:12,fontWeight:700}}>{side.name}</div><div style={{fontSize:18,fontWeight:750}}>{median(side)}</div><div style={{fontSize:11,color:C.icy}}>Median furnace</div></div>)}
   </div>
  </div>
  <h4 style={{fontSize:16,margin:'0 0 9px'}}>Furnace strength</h4>
  <div role="group" aria-label="Furnace threshold" style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:5,marginBottom:10}}>
   {[7,8,9,10].map(n=><button key={n} type="button" aria-pressed={threshold===n} onClick={()=>setThreshold(n)} style={{border:'1px solid '+(threshold===n?'#89C4FF':C.border),borderRadius:9,minHeight:42,color:threshold===n?'#F2F7FD':C.icy,background:threshold===n?'#31516D':C.section,fontWeight:700}}>FC{n}{n===10?'':'+'}</button>)}
  </div>
  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:9,marginBottom:17}}>
   {columns.map((side,i)=><div key={i} style={{background:C.section,borderRadius:12,padding:12,minWidth:0}}>
    <div style={{fontSize:12,color:side.color,fontWeight:750,overflowWrap:'anywhere'}}>{side.name}</div>
    <div style={{fontSize:27,fontWeight:800,fontVariantNumeric:'tabular-nums',marginTop:4}}>{metric==='count'?qualified[i]:shares[i].toFixed(1)+'%'}</div>
    <div style={{fontSize:11,color:C.icy}}>{qualified[i]} of {known[i]} players with known furnace levels</div>
   </div>)}
  </div>
  <div style={{display:'flex',justifyContent:'space-between',gap:8,alignItems:'center',flexWrap:'wrap',marginBottom:10}}>
   <div><h4 style={{fontSize:16,margin:0}}>Furnace distribution</h4><div style={{fontSize:12,color:C.icy,marginTop:3}}>Recorded players by level</div></div>
   <div role="group" aria-label="Distribution metric" style={{display:'flex',gap:4,background:C.section,borderRadius:9,padding:3}}>
    {[['count','Players'],['percent','Roster %']].map(([id,label])=><button type="button" key={id} aria-pressed={metric===id} onClick={()=>setMetric(id)} style={{border:0,borderRadius:7,minHeight:37,padding:'6px 9px',fontSize:12,fontWeight:650,background:metric===id?'#365675':'transparent',color:C.white}}>{label}</button>)}
   </div>
  </div>
  <div style={{display:'flex',gap:13,marginBottom:10}}>{columns.map((side,i)=><span key={i} style={{fontSize:12,color:side.color}}>● {side.name}</span>)}</div>

  <div style={{fontSize:11,color:C.icy,marginBottom:10}}>Tap a furnace level to see its players. Bars share the same scale.</div>
  {tierNames.map(tier=>{
   const series=counts.map((c,i)=>metric==='count'?c[tier]:known[i]?c[tier]/known[i]*100:0);
   const scale=Math.max(1,...tierNames.flatMap(t=>counts.map((c,i)=>metric==='count'?c[t]:known[i]?c[t]/known[i]*100:0)));
   return <div key={tier} style={{borderBottom:'1px solid '+C.border,padding:'8px 0'}}>
    <button type="button" aria-expanded={selected===tier} onClick={()=>setSelected(selected===tier?null:tier)} style={{width:'100%',border:0,background:selected===tier?C.section:'transparent',borderRadius:8,color:C.white,padding:'7px 3px',cursor:'pointer'}}>
     <div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) 52px minmax(0,1fr)',alignItems:'center',gap:5}}>
      <div style={{display:'flex',alignItems:'center',gap:5,justifyContent:'flex-end'}}>
       <span style={{fontSize:11,fontVariantNumeric:'tabular-nums'}}>{metric==='count'?series[0]:series[0].toFixed(1)+'%'}</span>
       <div style={{height:17,width:(series[0]/scale*75)+'%',minWidth:series[0]>0?2:0,background:columns[0].color,borderRadius:'3px 0 0 3px'}}/>
      </div>
      <strong style={{fontSize:12,textAlign:'center'}}>{tier}</strong>
      <div style={{display:'flex',alignItems:'center',gap:5}}>
       <div style={{height:17,width:(series[1]/scale*75)+'%',minWidth:series[1]>0?2:0,background:columns[1].color,borderRadius:'0 3px 3px 0'}}/>
       <span style={{fontSize:11,fontVariantNumeric:'tabular-nums'}}>{metric==='count'?series[1]:series[1].toFixed(1)+'%'}</span>
      </div>
     </div>
    </button>
    {selected===tier&&<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:9,background:C.section,borderRadius:9,padding:9,marginTop:8}}>
     {columns.map((side,i)=><div key={i} style={{minWidth:0}}><strong style={{fontSize:12,color:side.color}}>{side.name}</strong>{side.players.filter(p=>p.tier===tier).map(p=><div key={p.fid} style={{fontSize:12,padding:'5px 0',overflowWrap:'anywhere'}}>{p.name}</div>)}{!counts[i][tier]&&<p style={{fontSize:12,color:C.icy}}>No players</p>}</div>)}
    </div>}
   </div>;
  })}
  <p style={{fontSize:12,color:C.icy,lineHeight:1.5,margin:'13px 0 0'}}>Known furnace levels: {coverage.map(c=>c.known+' of '+c.total).join(' vs ')}. Recorded players: {columns.map(s=>s.players.length).join(' vs ')}. Unknown furnace levels are excluded from percentages. Counts reflect returned alliance rosters, not total state populations. Furnace progression does not directly measure combat power.</p>
 </section>;
}
