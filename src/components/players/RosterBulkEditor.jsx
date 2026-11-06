import { useState } from 'react';
import { C } from '../../utils/constants.js';
import { FIELD_DEFS, getFieldValues, assignFieldValue } from '../../services/fieldRegistryService.js';
const button={minHeight:44,padding:10,borderRadius:10,background:C.section,color:C.white,border:`1px solid ${C.border}`,fontSize:14};
export function RosterBulkEditor({players,selected,onApply,onOpenFields}) {
  const [staged,setStaged]=useState({});
  return <section aria-label="Update selected players" style={{padding:14,background:C.card,borderRadius:12,marginBottom:12}}>
    <h3 style={{fontSize:16,margin:'0 0 8px'}}>Update {selected.size} selected players</h3>
    <p style={{fontSize:14,color:C.icy}}>Choose changes, then apply them together. Existing values in these fields may be replaced.</p>
    <div style={{display:'grid',gap:10}}>{FIELD_DEFS.filter(f=>!/furnace/i.test(`${f.id} ${f.label}`)).map(field=><label key={field.id} style={{color:C.icy,fontSize:14,display:'grid',gap:4}}>{field.label}<select style={{...button,width:'100%',fontSize:16}} value={staged[field.id]??''} onChange={e=>setStaged(prev=>{const next={...prev};if(e.target.value)next[field.id]=e.target.value;else delete next[field.id];return next;})}><option value="">Keep current</option>{getFieldValues(players,field).map(value=><option key={value} value={value}>{value}</option>)}</select></label>)}</div>
    <button style={{...button,width:'100%',marginTop:12}} onClick={onOpenFields}>Manage available values</button>
    <button disabled={!Object.keys(staged).length} style={{...button,width:'100%',marginTop:10,background:Object.keys(staged).length?C.gold:C.section,color:Object.keys(staged).length?C.bg:C.icy}} onClick={()=>{
      const updated=players.filter(p=>selected.has(p.id)).map(player=>Object.entries(staged).reduce((result,[key,value])=>assignFieldValue(result,FIELD_DEFS.find(f=>f.id===key),value),player));
      onApply(updated);
    }}>Apply changes to {selected.size} players</button>
  </section>;
}
