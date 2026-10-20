import {C} from '../../utils/constants.js';
import {activeStateId} from '../../services/stateWorkspaceService.js';
import {usePlayerDetails} from '../../hooks/usePlayerDetails.js';
import {HeroEquipmentCard} from './HeroEquipmentCard.jsx';
import {ChiefEquipmentSection} from './ChiefEquipmentSection.jsx';
import {equipmentDate} from './EquipmentParts.jsx';
import {ProviderDataValue} from './ProviderStatsSection.jsx';
export function PlayerEquipmentSection({player,onSave}){
  const stateId=activeStateId(),{busy,message,error,refresh}=usePlayerDetails(player,onSave,stateId);
  const details=player.providerDetails && String(player.providerDetails.stateId)===stateId?player.providerDetails:null;
  const heroes=details?.heroes?.items || [];
  const validFid=/^[1-9]\d{3,14}$/.test(String(player.fid || '').trim());
  return <section style={{background:C.section,padding:16,borderRadius:12,marginBottom:12}}>
    <h3 style={{fontSize:14,color:C.icy,margin:'0 0 10px'}}>Heroes & equipment</h3>
    <button onClick={refresh} disabled={busy || !validFid || typeof onSave!=='function'} style={{minHeight:48,width:'100%',padding:12,border:0,borderRadius:10,background:busy || !validFid?C.card:C.gold,color:busy || !validFid?C.muted:C.bg,fontWeight:700,fontSize:14,cursor:'pointer'}}>{busy?'Fetching heroes & gear…':'Refresh heroes & gear'}</button>
    {!validFid && <p style={{fontSize:12,color:C.muted}}>Add this player’s chief ID to fetch their details.</p>}
    <p style={{fontSize:11,color:C.muted,lineHeight:1.5}}>Officer sign-in required. Uses one profile request; data may be cached for up to an hour. Available profile stats and rankings update too.</p>
    {error && <p role="alert" style={{fontSize:12,color:C.red}}>{error}</p>}{message && <p role="status" style={{fontSize:12,color:C.green}}>{message}</p>}
    <h4 style={{fontSize:14,color:C.icy,margin:'16px 0 6px'}}>Arena defence heroes</h4><p style={{fontSize:12,color:C.muted,lineHeight:1.5}}>This is the reported Arena defence team. Rally and joiner setups are managed separately.</p>
    {details?.heroes?<><p style={{fontSize:11,color:C.muted}}>Pulled {equipmentDate(details.heroes.retrievedAt)}</p>{heroes.length?heroes.map((hero,i)=><HeroEquipmentCard key={`${hero.id ?? i}:${i}`} hero={hero} index={i}/>):<p style={{fontSize:12,color:C.muted}}>No Arena defence heroes returned by the provider.</p>}</>:<p style={{fontSize:12,color:C.muted}}>Heroes have not been fetched yet.</p>}
    <ChiefEquipmentSection gear={details?.chiefGear}/>
    {details?.raw && <details style={{marginTop:12}}><summary style={{minHeight:44,paddingTop:12,color:C.gold,fontSize:12,cursor:'pointer'}}>All fetched profile details</summary><p style={{fontSize:11,color:C.muted}}>Online and last-login values are stale provider fields.</p><div style={{fontSize:12,color:C.icy}}><ProviderDataValue value={details.raw}/></div></details>}
  </section>;
}
