import {C} from '../../../utils/constants.js';
const btn={minHeight:44,padding:'8px 12px',borderRadius:10,border:`1px solid ${C.border}`,background:C.section,color:C.icy,fontSize:14};
export function AllocationPreview({proposal,stale,onApply,onCancel}) {
 if(!proposal)return null;
 return <div style={{background:C.section,padding:16,borderRadius:14,marginBottom:16,border:`1px solid ${C.gold}`}}><b style={{color:C.white,fontSize:15}}>Review allocation</b>{stale&&<div role="alert" style={{color:C.red,fontSize:14,marginTop:8}}>Pool or plan changed. Generate a fresh preview.</div>}
 {proposal.changes.map((text,i)=><div key={i} style={{color:C.icy,fontSize:14,marginTop:8}}>{text}</div>)}{proposal.warnings.map((text,i)=><div key={i} style={{color:C.gold,fontSize:14,marginTop:8}}>{text}</div>)}
 <div style={{display:'flex',gap:8,marginTop:14}}><button disabled={stale} style={{...btn,background:stale?C.border:C.gold,color:C.bg}} onClick={onApply}>Apply allocation</button><button style={btn} onClick={onCancel}>Cancel</button></div></div>;
}
