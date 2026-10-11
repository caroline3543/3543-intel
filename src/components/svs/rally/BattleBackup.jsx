import {useState} from 'react';
import {C} from '../../../utils/constants.js';
export function BattleBackup({state,onRestore}) {
 const [error,setError]=useState(''),[pending,setPending]=useState(null);
 const style={minHeight:44,padding:'8px 12px',borderRadius:10,border:`1px solid ${C.border}`,background:C.section,color:C.icy,fontSize:14};
 function download(){const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='battle-live-room.json';a.click();URL.revokeObjectURL(url);}
 return <details style={{marginTop:16}}><summary style={{minHeight:44,color:C.icy,fontSize:14}}>Backup & restore Live Room</summary><button style={style} onClick={download}>Export backup</button><label style={{display:'block',color:C.icy,fontSize:14,marginTop:12}}>Choose backup<input aria-label="Restore Live Room backup" type="file" accept="application/json,.json" style={{...style,width:'100%',boxSizing:'border-box'}} onChange={async e=>{try{const file=e.target.files?.[0];if(file)setPending(JSON.parse(await file.text()));}catch{setError('Invalid backup file');}e.target.value='';}}/></label>
 {pending&&<div style={{color:C.gold,fontSize:14,marginTop:12}}>Replace this Live Room with the backup? Export current data first.<div style={{display:'flex',gap:8,marginTop:8}}><button style={style} onClick={()=>setPending(null)}>Cancel</button><button style={style} onClick={()=>{try{onRestore(pending);setPending(null);setError('Backup restored');}catch(e){setError(e.message);}}}>Restore backup</button></div></div>}{error&&<div role="status" style={{color:C.gold,fontSize:14,marginTop:10}}>{error}</div>}</details>;
}
