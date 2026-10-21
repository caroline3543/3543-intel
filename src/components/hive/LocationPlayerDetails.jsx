import {C} from '../../utils/constants.js';
import {usePlayerDetails} from '../../hooks/usePlayerDetails.js';
export function LocationPlayerDetails({player,reported,stateId,onSave,onViewPlayer}){
 const {busy,message,error,refresh}=usePlayerDetails(player,onSave,stateId);
 const loc=reported?.location;
 return <div style={{padding:14,borderRadius:10,background:C.section,marginTop:10}}><strong>{player.username}</strong><p style={{fontSize:13,color:C.icy}}>{loc?`X${loc.x} · Y${loc.y}`:'Location not recorded'}{loc?.retrievedAt && <><br/>{new Date(loc.retrievedAt).toISOString().slice(0,16).replace('T',' ')} UTC · retrieved</>}</p><div style={{display:'flex',gap:8}}><button onClick={refresh} disabled={busy} style={{minHeight:44,padding:'8px 12px',background:C.gold,color:C.bg,border:0,borderRadius:8,fontWeight:700}}>{busy?'Fetching…':'Refresh player'}</button><button onClick={()=>onViewPlayer(player.id)} style={{minHeight:44,padding:'8px 12px',background:C.card,color:C.icy,border:`1px solid ${C.border}`,borderRadius:8}}>Open profile</button></div><p style={{fontSize:11,color:C.muted}}>Officer sign-in required to refresh. Fetches the profile and available heroes, gear and rankings too.</p>{error && <p role="alert" style={{color:C.red,fontSize:12}}>{error}</p>}{message && <p role="status" style={{color:C.green,fontSize:12}}>{message}</p>}</div>;
}
