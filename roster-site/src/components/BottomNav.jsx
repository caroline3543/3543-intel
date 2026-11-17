import {C} from '../../../src/utils/constants.js';
const tabs=[
 ['members','Members','M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87'],
 ['tal','TAL','M8 21h8 M12 17v4 M7 4h10v6a5 5 0 0 1-10 0V4Z M7 6H4v3a4 4 0 0 0 4 4 M17 6h3v3a4 4 0 0 1-4 4'],
 ['events','Events','M3 21V9l6 3V9l6 3V4h6v17H3Z M7 17h2 M12 17h2 M17 17h2'],
 ['svs','Compare','M3 3v18h18 M7 16l4-5 4 3 5-7'],
 ['changes','Changes','M3 12a9 9 0 1 0 3-6.7M3 3v6h6M12 7v5l3 2']
];
export function BottomNav({tab,onChange}){
 return <nav aria-label="Main navigation" style={{position:'fixed',bottom:0,left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:480,zIndex:90,display:'flex',overflowX:'hidden',background:'#0C1929',borderTop:'1px solid #2D4054',padding:'5px 8px calc(5px + env(safe-area-inset-bottom,0px))'}}>
  {tabs.map(([id,label,path])=>{
   const current=tab===id||(id==='events'&&['foundry','castle','canyon'].includes(tab));
   return <button key={id} type="button" aria-current={current?'page':undefined} aria-label={id==='tal'?'TAL':id==='teams'?'Teams':id==='changes'?'Changes':label} onClick={()=>onChange(id)} style={{minHeight:52,minWidth:0,flex:'1 1 0',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:4,padding:'5px 2px',border:0,borderRadius:8,background:'transparent',color:current?C.gold:'#B8C8D5',fontSize:10,fontWeight:current?700:500,cursor:'pointer'}}>
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={current?'2.2':'1.85'} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path}/>{id==='members'&&<circle cx="9" cy="7" r="4"/>}</svg>
    <span style={{textAlign:'center',lineHeight:1.1}}>{label}</span>
   </button>;
  })}
 </nav>;
}