import {useState} from 'react';
import {C} from '../../../utils/constants.js';
import {readCommandDraft} from './rallyRoomHelpers.js';
import {importCommandBattle} from '../../../services/battleOperationsService.js';
export function LegacyBattleImport({onAdd}) {
 const [source]=useState(readCommandDraft),[message,setMessage]=useState('');
 if(!source)return null;
 return <details style={{marginTop:16}}><summary style={{minHeight:44,color:C.icy,fontSize:14}}>Import standalone Castle Command draft</summary><div style={{color:C.icy,fontSize:14,marginBottom:10}}>Existing Live Room timers stay intact. Imported actions require review.</div><select aria-label="Import Castle Command battle" value="" onChange={e=>{try{const b=source.battles.find(b=>b.id===e.target.value);if(b){onAdd(importCommandBattle(b,source.players||[]));setMessage(`${b.name} imported. Review dates and capture dependencies.`);}}catch(err){setMessage(err.message);}}} style={{width:'100%',minHeight:44,background:C.section,border:`1px solid ${C.border}`,borderRadius:10,color:C.white,fontSize:16}}><option value="">Choose draft battle</option>{source.battles.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select>{message&&<div role="status" style={{color:C.gold,fontSize:14,marginTop:10}}>{message}</div>}</details>;
}
