import {C} from '../../utils/constants.js';
export function LocationPlayerDetails({player,reported,onViewPlayer}){
 const loc=reported?.location,at=Date.parse(loc?.retrievedAt);
 return <div style={{padding:14,borderRadius:10,background:C.section,marginTop:10}}><strong>{player.username}</strong><p style={{fontSize:13,color:C.icy}}>{loc?`X${loc.x} · Y${loc.y}`:'Location not recorded'}{Number.isFinite(at) && <><br/>{new Date(at).toISOString().slice(0,16).replace('T',' ')} UTC · recorded</>}</p><button onClick={()=>onViewPlayer(player.id)} style={{minHeight:44,padding:'8px 12px',background:C.card,color:C.icy,border:`1px solid ${C.border}`,borderRadius:8}}>Open profile</button><p style={{fontSize:11,color:C.muted}}>Saved location. Fetch all locations can request an updated observation.</p></div>;
}
