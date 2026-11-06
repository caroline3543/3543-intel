import {useRef,useState} from 'react';
import {C} from '../../../src/utils/constants.js';
import {fetchMightpulseAlliance} from '../../../src/services/mightpulseService.js';
import {allianceRows} from '../../../src/services/allianceImportService.js';
export const DEFAULT_ALLIANCES=['ARC','RKG','LUN'];
const button={minHeight:44,minWidth:76,padding:'10px 14px',fontSize:14,fontWeight:600,borderRadius:10,border:`1px solid ${C.border}`,background:C.card,color:C.icy,cursor:'pointer'};
export function AllianceSetup({players,onLoad}){
  const [status,setStatus]=useState({}),[busy,setBusy]=useState(false);
  const [expanded,setExpanded]=useState(()=>!DEFAULT_ALLIANCES.every(tag=>players.some(p=>p.allianceTag===tag)));
  const running=useRef(false);
  async function load(tags){
    if(running.current)return;
    running.current=true;setBusy(true);
    try{
      for(const tag of tags){
        setStatus(prev=>({...prev,[tag]:{state:'loading'}}));
        try{
          const response=await fetchMightpulseAlliance(3573,tag);
          const rows=allianceRows(response,'3573',tag);
          if(!rows.length)throw new Error('No players found. Check the alliance tag.');
          await onLoad(rows);
          setStatus(prev=>({...prev,[tag]:{state:'done',count:rows.length}}));
        }catch(error){
          setStatus(prev=>({...prev,[tag]:{state:'error',message:error.message||'Couldn’t load this alliance. Try again.'}}));
          if([401,403,429].includes(error.status)||[401,403,429].includes(error.providerStatus))break;
        }
      }
    }finally{running.current=false;setBusy(false);}
  }
  const hasDefaults=DEFAULT_ALLIANCES.every(tag=>players.some(p=>p.allianceTag===tag));
  return <section aria-label="Your alliances" style={{margin:'16px 20px 4px',padding:16,borderRadius:14,background:C.section}}>
<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}><h2 style={{fontSize:18,margin:0}}>Your alliances</h2><button style={button} aria-expanded={expanded} disabled={busy} onClick={()=>setExpanded(!expanded)}>{expanded?"Hide":"Manage"}</button></div>
    {!expanded&&<p style={{fontSize:14,color:C.icy,marginBottom:0}}>ARC · RKG · LUN</p>}
    {expanded&&<>
    <p style={{fontSize:14,color:C.icy,lineHeight:1.5,margin:'0 0 14px'}}>Load ARC, RKG and LUN from State 3573.</p>
    <button style={{...button,width:'100%',background:C.gold,color:C.bg,marginBottom:10}} disabled={busy} onClick={()=>load(DEFAULT_ALLIANCES)}>{busy?'Loading…':hasDefaults?'Refresh all three':'Load all three'}</button>
    {DEFAULT_ALLIANCES.map(tag=>{
      const count=players.filter(p=>p.allianceTag===tag).length;
      const item=status[tag];
      return <div key={tag} style={{padding:'10px 0',borderTop:`1px solid ${C.border}`}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12}}><div><strong style={{fontSize:16}}>{tag}</strong><div style={{fontSize:13,color:C.icy,marginTop:4}}>{item?.state==='loading'?'Loading…':count?`${count} players`:'Not loaded'}</div></div><button aria-label={`${count?'Refresh':'Load'} ${tag}`} style={button} disabled={busy} onClick={()=>load([tag])}>{item?.state==='error'?'Retry':count?'Refresh':'Load'}</button></div>
        {item?.state==='error'&&<p role="alert" style={{fontSize:14,color:C.red,lineHeight:1.5,marginBottom:0}}>{item.message}</p>}
        {item?.state==='done'&&<span role="status" style={{fontSize:13,color:C.green}}>Saved · {item.count} players</span>}
      </div>;
    })}
    <p style={{fontSize:13,color:C.icy,lineHeight:1.5,margin:'8px 0 0'}}>Refresh keeps your notes and troop tiers.</p>
    </>}
  </section>;
}
