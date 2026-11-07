import { C } from '../../utils/constants.js';
export const profileButton={minHeight:44,minWidth:44,padding:'10px 12px',fontSize:14,fontWeight:600,borderRadius:10,border:`1px solid ${C.border}`,background:C.card,color:C.icy,cursor:'pointer'};
export const profileCard={background:C.section,borderRadius:14,padding:16,marginBottom:12};
export function ProfileSection({title,children,action}) {
  return <section style={profileCard}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,marginBottom:12}}><h3 style={{fontSize:16,fontWeight:700,color:C.white,margin:0}}>{title}</h3>{action}</div>{children}</section>;
}
export function ProfileRow({label,value}) {
  if(value==null||value==='')return null;
  return <span style={{display:'flex',justifyContent:'space-between',gap:16,padding:'7px 0',fontSize:14}}><span style={{color:C.icy}}>{label}</span><span style={{color:C.white,fontWeight:500,textAlign:'right',overflowWrap:'anywhere',minWidth:0}}>{value}</span></span>;
}
export function PencilIcon(){return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m16 3 5 5-12 12-6 1 1-6Z"/><path d="m14 5 5 5"/></svg>;}
export function ProfileDetails({title,children}) {
  return <details style={{...profileCard,padding:0}}><summary style={{minHeight:48,boxSizing:'border-box',padding:'14px 16px',fontSize:16,fontWeight:600,color:C.icy,cursor:'pointer'}}>{title}</summary><div style={{padding:'0 10px 4px'}}>{children}</div></details>;
}
