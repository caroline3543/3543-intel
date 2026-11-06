import {C} from '../../../src/utils/constants.js';
export {C};
export const button={minHeight:44,minWidth:44,padding:'10px 12px',fontSize:14,fontWeight:600,borderRadius:10,border:`1px solid ${C.border}`,background:C.card,color:C.icy,cursor:'pointer'};
export const field={...button,width:'100%',fontSize:16,fontWeight:400,background:C.bg,color:C.white,boxSizing:'border-box'};
export function Card({title,children}){return <section style={{background:C.section,borderRadius:14,padding:16,marginBottom:12}}>{title&&<h3 style={{fontSize:17,margin:'0 0 12px'}}>{title}</h3>}{children}</section>;}
export function Hint({children}){return <p style={{fontSize:14,color:C.icy,lineHeight:1.5,margin:'8px 0 12px'}}>{children}</p>;}
export function TimeButtons({times,selected,onToggle,disabled,max}){return <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>{times.map(time=><button key={time} disabled={disabled||(!selected.includes(time)&&max&&selected.length>=max)} aria-pressed={selected.includes(time)} onClick={()=>onToggle(time)} style={{...button,color:selected.includes(time)?C.gold:C.icy,borderColor:selected.includes(time)?C.gold:C.border}}>{time}</button>)}</div>;}
