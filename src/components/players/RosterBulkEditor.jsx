import { useState } from 'react';
import { C } from '../../utils/constants.js';
import { FIELD_DEFS, getFieldValues, assignFieldValue } from '../../services/fieldRegistryService.js';
const button={minHeight:44,padding:10,borderRadius:10,background:C.section,color:C.white,border:`1px solid ${C.border}`,fontSize:14};
export function RosterBulkEditor({players,selected,onApply,onOpenFields}) {
  const [staged,setStaged]=useState({});
  const [confirming,setConfirming]=useState(false);
  const changes=Object.entries(staged);
  const targets=players.filter(p=>selected.has(p.id));
  const preview=targets.map(player=>({before:player,after:changes.reduce((result,[key,value])=>assignFieldValue(result,FIELD_DEFS.find(f=>f.id===key),value),player)}));
  return <section aria-label="Update selected players" style={{padding:14,background:C.card,borderRadius:12,marginBottom:12}}>
    <h3 style={{fontSize:16,margin:'0 0 8px'}}>Update {selected.size} selected players</h3>
    <p style={{fontSize:14,color:C.icy}}>Choose changes, then apply them together. Existing values in these fields may be replaced.</p>
    <div style={{display:'grid',gap:10}}>{FIELD_DEFS.filter(f=>!/furnace/i.test(`${f.id} ${f.label}`)).map(field=><label key={field.id} style={{color:C.icy,fontSize:14,display:'grid',gap:4}}>{field.label}<select style={{...button,width:'100%',fontSize:16}} value={staged[field.id]??''} onChange={e=>{setConfirming(false);setStaged(prev=>{const next={...prev};if(e.target.value)next[field.id]=e.target.value;else delete next[field.id];return next;});}}><option value="">Keep current</option>{getFieldValues(players,field).map(value=><option key={value} value={value}>{value}</option>)}</select></label>)}</div>
    <button style={{...button,width:'100%',marginTop:12}} onClick={onOpenFields}>Manage available values</button>
    {changes.length>0&&<div role="status" style={{fontSize:13,color:C.icy,marginTop:12}}>
      <strong>{targets.length} selected players</strong> · {changes.map(([key,value])=>`${FIELD_DEFS.find(f=>f.id===key)?.label||key}: ${value}`).join(' · ')}
      <details style={{marginTop:8}}><summary style={{minHeight:44,cursor:'pointer'}}>Review affected players</summary>
        <ul style={{paddingLeft:20,maxHeight:220,overflowY:'auto'}}>{preview.map(({before})=><li key={before.id}>{before.username||before.alias||before.fid||before.id}</li>)}</ul>
      </details>
    </div>}
    {confirming&&<p role="alert" style={{fontSize:13,color:C.gold}}>Confirm replacement of the selected fields for {targets.length} players. Other fields will remain unchanged.</p>}
    <button disabled={!changes.length||!targets.length} style={{...button,width:'100%',marginTop:10,background:changes.length?C.gold:C.section,color:changes.length?C.bg:C.icy}} onClick={()=>{
      if(!confirming){setConfirming(true);return;}
      onApply(preview.map(item=>item.after));
      setConfirming(false);
      setStaged({});
    }}>{confirming?`Confirm updates for ${targets.length} players`:`Review changes for ${targets.length} players`}</button>
  </section>;
}
