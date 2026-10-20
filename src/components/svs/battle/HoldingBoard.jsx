import {useState,memo} from 'react';
import {C} from '../../../utils/constants.js';
import {nameOf} from '../../../services/battlePoolService.js';
const input={minHeight:44,width:'100%',boxSizing:'border-box',background:C.section,color:C.white,border:`1px solid ${C.border}`,padding:10,borderRadius:10,fontSize:16};
export const HoldingBoard=memo(function HoldingBoard({controller,players,assignments={}}) {
 const [editing,setEditing]=useState('castle');if(!controller)return null;
 const ids=['castle','north','east','south','west'];const s=controller.pool.structures?.[editing]||{};
 const patch=p=>controller.setStructure(editing,p);
 return <details style={{background:C.card,borderRadius:14,padding:16,marginBottom:16}}><summary style={{minHeight:44,color:C.white,fontSize:15,fontWeight:700}}>Castle & turret holding</summary>
 <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:12}}>{ids.map(id=><button key={id} style={{minHeight:44,padding:'8px 12px',borderRadius:10,background:C.section,border:`1px solid ${editing===id?C.gold:C.border}`,color:editing===id?C.gold:C.icy,fontSize:14}} onClick={()=>setEditing(id)}>{id} · {controller.pool.structures?.[id]?.owner||'Unknown'}</button>)}</div>
 <label style={{display:'block',fontSize:14,color:C.icy,marginBottom:12}}>Reported owner<select value={s.owner||'Unknown'} onChange={e=>patch({owner:e.target.value})} style={input}>{['Unknown','Our alliance','Friendly state','Enemy','Empty'].map(v=><option key={v}>{v}</option>)}</select></label>
 {['leaderId','backupId'].map(k=><label key={k} style={{display:'block',fontSize:14,color:C.icy,marginBottom:12}}>{k==='leaderId'?'Holding leader':'Backup leader'}<select value={s[k]||(editing==='castle'?assignments[k==='leaderId'?'garrisonId':'backupId']:'')||''} onChange={e=>patch({[k]:e.target.value})} style={input}><option value="">Unassigned</option>{players.map(p=><option key={p.id} value={p.id}>{nameOf(p)}</option>)}</select></label>)}
 <label style={{display:'block',fontSize:14,color:C.icy}}>Infantry replenishment / commander note<input style={input} value={s.note||''} onChange={e=>patch({note:e.target.value})}/></label>
 <details><summary style={{minHeight:44,color:C.icy,fontSize:14}}>Confirmed supporting skill providers</summary>{players.filter(p=>p.joinerHeroes?.some(h=>h.skillLevel>=5)).map(p=><label key={p.id} style={{display:'flex',alignItems:'center',minHeight:44,color:C.icy,fontSize:14}}><input type="checkbox" checked={s.skillProviders?.includes(p.id)||false} onChange={e=>patch({skillProviders:e.target.checked?[...(s.skillProviders||[]),p.id]:(s.skillProviders||[]).filter(id=>id!==p.id)})}/>{nameOf(p)}</label>)}</details>
 {s.skillProviders?.length>0&&<div style={{color:C.gold,fontSize:14,marginTop:8}}>Rotation warning: confirm replacement skills before removing these providers.</div>}
 <div style={{fontSize:14,color:C.icy,marginTop:12}}>Reports are manual. Friendly-state ownership does not assume domestic friendly-fire rules.</div>{s.confirmedAt&&<div style={{fontSize:14,color:C.icy}}>Reported {s.confirmedAt.slice(11,19)} UTC</div>}
 </details>;
});
