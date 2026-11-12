import {C} from '../../../src/utils/constants.js';
const tabs=[
 ['members','Members','M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87'],
 ['tal','TAL Planner','M12 3 3 7v6c0 5 9 8 9 8s9-3 9-8V7Z M8 12l3 3 5-6'],
 ['changes','Name Changes','M3 12a9 9 0 1 0 3-6.7M3 3v6h6M12 7v5l3 2']
];
export function BottomNav({tab,onChange}){
 return <nav aria-label="Main navigation" style={{position:'fixed',bottom:0,left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:480,zIndex:90,display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',background:'#0C1929',borderTop:'1px solid #2D4054',padding:'5px 8px calc(5px + env(safe-area-inset-bottom,0px))'}}>
  {tabs.map(([id,label,path])=>{
   const current=tab===id;
   return <button key={id} type="button" aria-current={current?'page':undefined} aria-label={id==='tal'?'TAL Planner':id==='teams'?'Teams':id==='changes'?'Name changes':label} onClick={()=>onChange(id)} style={{minHeight:52,minWidth:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:4,padding:'5px 2px',border:0,borderRadius:8,background:'transparent',color:current?C.gold:'#B8C8D5',fontSize:11,fontWeight:current?700:500,cursor:'pointer'}}>
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={current?'2.2':'1.85'} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path}/>{id==='members'&&<circle cx="9" cy="7" r="4"/>}</svg>
    <span style={{textAlign:'center',lineHeight:1.1}}>{label}</span>
   </button>;
  })}
 </nav>;
}