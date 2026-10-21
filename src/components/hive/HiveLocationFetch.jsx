import {C} from '../../utils/constants.js';
import {useHiveLocationFetch} from '../../hooks/useHiveLocationFetch.js';
export function HiveLocationFetch({roster,players,onSave,onLocate}){
 const {busy,stopping,progress,start,stop}=useHiveLocationFetch({roster,players,onSave});
 const button={minHeight:44,padding:'8px 12px',border:`1px solid ${C.border}`,borderRadius:8,background:C.section,color:C.icy};
 return <div style={{marginBottom:8}}><div style={{display:'flex',gap:8}}><button disabled={busy || !roster.players.length} onClick={()=>{onLocate();void start()}} style={{...button,flex:1,background:C.gold,color:C.bg,fontWeight:700}}>{busy?'Fetching locations…':'Fetch all locations'}</button>{busy && <button disabled={stopping} onClick={stop} style={button}>{stopping?'Stopping…':'Stop'}</button>}</div>
 <p style={{fontSize:11,color:C.muted,margin:'6px 0'}}>Officer sign-in required. Fetches each saved alliance member once. Provider locations may be cached.</p>
 {progress && <div role="status" style={{fontSize:12,color:C.icy}}>{progress.stopped?'Stopped':busy?'Fetching':'Finished'} · {progress.done}/{progress.total} checked · {progress.saved} saved · {progress.missing} missing or older · {progress.failed.length} failed</div>}
 {progress?.failed.length>0 && <details style={{fontSize:12,color:C.muted}}><summary style={{minHeight:44,cursor:'pointer'}}>Location errors ({progress.failed.length})</summary><ul style={{maxHeight:120,overflow:'auto'}}>{progress.failed.map(p=><li key={p.fid}>{p.name}: {p.message}</li>)}</ul></details>}
 </div>;
}
