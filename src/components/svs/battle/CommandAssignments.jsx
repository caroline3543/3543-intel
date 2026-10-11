import {C} from '../../../utils/constants.js';
export function CommandAssignments({plan,players,onUpdate}) {
 const roles=[['commanderId','Commander'],['deputyId','Deputy'],['garrisonId','Main garrison'],['backupId','Backup garrison'],['reinforcementId','Reinforcement leader']];
 const value=plan.commandAssignments||{};
 return <details style={{background:C.card,borderRadius:14,padding:16,marginBottom:16}}><summary style={{color:C.white,fontSize:14,fontWeight:700,minHeight:44}}>Command & garrison assignments</summary><div style={{color:C.icy,fontSize:14,marginBottom:12}}>Reuse members from your roster. Availability follows the linked event.</div>
 {roles.map(([key,label])=><label key={key} style={{display:'block',color:C.icy,fontSize:14,marginBottom:12}}>{label}<select value={value[key]||''} onChange={e=>onUpdate({...plan,commandAssignments:{...value,[key]:e.target.value}})} style={{width:'100%',minHeight:44,marginTop:6,background:C.section,border:`1px solid ${C.border}`,borderRadius:10,padding:10,color:C.white,fontSize:16}}><option value="">Unassigned</option>{players.filter(p=>!p.blacklisted).map(p=><option key={p.id} value={p.id}>{p.username||p.alias}</option>)}</select></label>)}
 {value.garrisonId&&value.garrisonId===value.backupId&&<div style={{color:C.gold,fontSize:14}}>Main and backup garrison use the same player. Review assignments.</div>}
 </details>;
}
