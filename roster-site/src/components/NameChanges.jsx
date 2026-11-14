import {PlayerSearch} from '../../../src/components/players/PlayerSearch.jsx';
import {useEffect,useState} from 'react';
import {C} from '../../../src/utils/constants.js';
import {recentNameChanges,recentAllianceMoves,recentFurnaceChanges,legionForPlayer} from '../../../src/services/talRosterService.js';
import {playerSearchFields} from '../../../src/services/playerNames.js';

const control={minHeight:40,borderRadius:10,border:'none',cursor:'pointer'};
const green='#80D6AB';
function relativeTime(value,now){
 const time=Date.parse(value);
 if(!Number.isFinite(time))return 'Detection time unavailable';
 const elapsed=Math.max(0,Math.floor((now-time)/1000));
 if(elapsed<60)return 'Detected just now';
 if(elapsed<3600){const n=Math.floor(elapsed/60);return `Detected ${n} minute${n===1?'':'s'} ago`;}
 if(elapsed<86400){const n=Math.floor(elapsed/3600);return `Detected ${n} hour${n===1?'':'s'} ago`;}
 if(elapsed<604800){const n=Math.floor(elapsed/86400);return `Detected ${n} day${n===1?'':'s'} ago`;}
 return 'Detected '+new Date(time).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'});
}
function dayGroup(value,now){
 const date=new Date(value);
 if(!Number.isFinite(date.getTime()))return 'Earlier';
 const today=new Date(now),yesterday=new Date(now);
 today.setHours(0,0,0,0);yesterday.setHours(0,0,0,0);yesterday.setDate(yesterday.getDate()-1);
 return date>=today?'Today':date>=yesterday?'Yesterday':'Earlier';
}
export function NameChanges({players,plan,onOpen}){
 const [query,setQuery]=useState(''),[limit,setLimit]=useState(40),[assignedOnly,setAssignedOnly]=useState(false),[changeType,setChangeType]=useState('all'),[now,setNow]=useState(()=>Date.now()),[copied,setCopied]=useState('');
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),30000);return ()=>clearInterval(timer);},[]);
 const q=query.trim().toLocaleLowerCase();
 const playerById=new Map(players.map(p=>[p.id,p]));
 const rows=[...recentNameChanges(players).map(row=>({...row,type:'name'})),...recentAllianceMoves(players),...recentFurnaceChanges(players)]
  .sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)||a.id.localeCompare(b.id)).filter(row=>{
   const p=playerById.get(row.playerId);
   return p&&(changeType==='all'||row.type===changeType)&&(!assignedOnly||legionForPlayer(plan,p.id))&&(!q||[...playerSearchFields(p),row.before,row.after].some(v=>String(v||'').toLocaleLowerCase().includes(q)));
  });
 async function copyName(name,id){
  try{await navigator.clipboard.writeText(name);setCopied(id);}catch(e){
   const area=document.createElement('textarea');area.value=name;area.style.position='fixed';area.style.opacity='0';document.body.appendChild(area);area.select();const ok=document.execCommand('copy');area.remove();if(ok)setCopied(id);
  }
 }
 const shown=rows.slice(0,limit);
 return <section style={{padding:'18px 16px 28px'}}>
  <h2 style={{fontSize:24,margin:'0 0 14px'}}>Changes</h2>
  <div role="group" aria-label="Filter changes by type" style={{display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:5,marginBottom:12}}>
   {[['all','All'],['alliance','Alliance'],['name','Names'],['furnace','Furnace']].map(([id,label])=><button key={id} type="button" aria-pressed={changeType===id} onClick={()=>{setChangeType(id);setLimit(40);}} style={{...control,fontSize:12,fontWeight:600,padding:'8px 3px',background:changeType===id?C.gold:C.section,color:changeType===id?C.bg:C.white}}>{label}</button>)}
  </div>
  <PlayerSearch label="Search changes by player name or ID" players={players} value={query} onChange={value=>{setQuery(value);setLimit(40);}}/>
  <label style={{display:'flex',alignItems:'center',gap:9,minHeight:44,color:C.icy,fontSize:13}}><input type="checkbox" checked={assignedOnly} onChange={e=>{setAssignedOnly(e.target.checked);setLimit(40);}} style={{width:19,height:19}}/>TAL players only</label>
  <p role="status" style={{fontSize:12,color:C.icy,margin:'4px 0 14px'}}>{rows.length} {rows.length===1?'change':'changes'}</p>
  {['Today','Yesterday','Earlier'].map(group=>{
   const items=shown.filter(row=>dayGroup(row.at,now)===group);
   return items.length?<div key={group} style={{marginBottom:18}}>
    <h3 style={{fontSize:13,fontWeight:650,color:C.icy,margin:'0 0 9px'}}>{group}</h3>
    {items.map(row=>{
     const p=playerById.get(row.playerId);
     const name=p.username||p.alias||String(p.fid||'Unknown player');
     const label=row.type==='alliance'?'Alliance':row.type==='furnace'?'Furnace':'Name';
     return <article key={row.id} style={{background:C.card,borderRadius:14,padding:'13px 14px',marginBottom:9}}>
      <button type="button" aria-label={`Copy username ${name}`} onClick={()=>copyName(name,row.id)} style={{border:0,background:'transparent',padding:'3px 0',display:'inline-flex',alignItems:'center',gap:8,maxWidth:'100%',textAlign:'left',color:C.white,cursor:'pointer'}}>
       <span style={{fontSize:17,fontWeight:700,overflowWrap:'anywhere',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{name}</span>
       <span aria-hidden="true" style={{fontSize:14,color:copied===row.id?green:C.icy,flexShrink:0}}>{copied===row.id?'✓':'⧉'}</span>
      </button>
      <div style={{fontSize:12,color:C.muted,marginTop:2}}>ID {p.fid||p.id}</div>
      <button type="button" onClick={()=>onOpen(p.id)} aria-label={`View ${name} profile and ${label.toLowerCase()} change`} style={{display:'block',width:'100%',background:'transparent',border:0,color:C.white,textAlign:'left',padding:'9px 0 0',cursor:'pointer',minHeight:50}}>
       <div style={{display:'flex',alignItems:'baseline',gap:7,flexWrap:'wrap',fontSize:14}}>
        <span style={{fontSize:12,color:C.icy}}>{label}</span>
        <span style={{color:C.white}}>{row.before}</span>
        <span style={{color:C.icy}}>→</span>
        <strong style={{color:green,fontWeight:650}}>{row.after}</strong>
        <span style={{color:C.icy,marginLeft:'auto'}}>›</span>
       </div>
       <div title={new Date(row.at).toLocaleString()} style={{fontSize:11,color:C.muted,marginTop:8}}>{relativeTime(row.at,now)}</div>
      </button>
      {copied===row.id&&<div role="status" style={{fontSize:11,color:green,marginTop:5}}>✓ Username copied</div>}
     </article>;
    })}
   </div>:null;
  })}
  {!rows.length&&<div style={{padding:16,background:C.section,borderRadius:12}}><p style={{fontSize:15,fontWeight:600,marginTop:0}}>{changeType==='furnace'&&!query&&!assignedOnly?'No furnace upgrades detected':changeType==='name'&&!query&&!assignedOnly?'No name changes detected':changeType==='alliance'&&!query&&!assignedOnly?'No alliance moves detected':query||assignedOnly?'No matching changes':'No changes detected yet'}</p><p style={{fontSize:13,color:C.icy,lineHeight:1.5,marginBottom:0}}>Refresh the roster to check for new changes, or adjust your filters.</p></div>}
  {rows.length>limit&&<button style={{...control,width:'100%',background:C.section,color:C.white}} onClick={()=>setLimit(limit+40)}>Show more changes</button>}
 </section>;
}
