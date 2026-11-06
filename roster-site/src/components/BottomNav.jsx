import {C} from '../../../src/utils/constants.js';
const tabs=[['members','Members','M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87'],['tal','TAL planner','M12 3 3 7v6c0 5 9 8 9 8s9-3 9-8V7Z M8 12l3 3 5-6'],['changes','Name changes','M3 12a9 9 0 1 0 3-6.7M3 3v6h6M12 7v5l3 2']];
export function BottomNav({tab,onChange}){
 return <nav aria-label="Main tabs" style={{position:'fixed',bottom:0,left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:480,zIndex:90,display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',background:C.bg,borderTop:`1px solid ${C.border}`,padding:'6px 8px calc(6px + env(safe-area-inset-bottom, 0px))'}}>
  {tabs.map(([id,label,path])=><button key={id} aria-current={tab===id?'page':undefined} onClick={()=>onChange(id)} style={{minHeight:62,minWidth:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:5,padding:'6px 2px',border:0,borderRadius:10,background:tab===id?C.section:'none',color:tab===id?C.gold:C.icy,fontSize:13,fontWeight:600,cursor:'pointer'}}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path}/>{id==='members'&&<circle cx="9" cy="7" r="4"/>}</svg><span style={{overflowWrap:'anywhere'}}>{label}</span></button>)}
 </nav>;
}
