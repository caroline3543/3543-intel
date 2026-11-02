import {useState} from 'react';

/** Imported worksheet intelligence is reference-only; it never changes battle or event assignments. */
export function ImportedWorksheetIntel({players=[],kind}){
 const [open,setOpen]=useState(false);
 const key=kind==='Combat'?'sheetCombat':'sheetEvents';
 const entries=players.flatMap(p=>Object.entries(p[key]||{}).map(([id,fields])=>({player:p,id,fields})));
 if(!entries.length)return null;
 return <section style={{margin:'12px 0',padding:12,background:'#152236',border:'1px solid #36536B',borderRadius:12,color:'#A8C4D8'}}>
  <button type="button" onClick={()=>setOpen(x=>!x)} aria-expanded={open} style={{background:'transparent',border:0,color:'#fff',fontSize:15,fontWeight:650,minHeight:44,textAlign:'left',width:'100%'}}>
    {kind} spreadsheet intelligence · {entries.length} saved entries {open?'▴':'▾'}
  </button>
  {open&&<div style={{maxHeight:340,overflowY:'auto'}}>
    <p style={{fontSize:12}}>Reference only. Does not overwrite battle plans, event attendance or assignments.</p>
    {entries.slice(0,200).map(({player,id,fields},i)=><div key={player.id+':'+id+':'+i} style={{borderTop:'1px solid #36536B',padding:'9px 0',fontSize:13}}>
      <strong style={{color:'#fff'}}>{player.username||player.fid}</strong> · {id}
      <div>{Object.entries(fields||{}).map(([label,value])=>label+': '+String(value)).join(' · ')}</div>
    </div>)}
    {entries.length>200&&<p>Showing first 200 entries.</p>}
  </div>}
 </section>;
}
