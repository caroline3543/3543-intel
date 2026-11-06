import {useEffect,useRef,useState} from 'react';
import {C} from '../../../src/utils/constants.js';
const steps=[
  {title:'Load your alliances',body:'Tap Load all four to add HOT, ARC, RKG and LUN. Or load one alliance at a time.'},
  {title:'Find a player',body:'Tap an alliance chip or search a username, nickname or player ID. Use Filters to narrow the list.'},
  {title:'Make an update',body:'Open a player. Tap a troop tier or the Identity pencil to edit. Tap the download icon to save an Excel copy of your roster.'},
];
const button={minHeight:44,padding:'10px 14px',fontSize:14,fontWeight:600,borderRadius:10,border:`1px solid ${C.border}`,background:C.section,color:C.icy,cursor:'pointer'};
export function QuickTour({onClose,haptics,onHapticsChange}){
  const [step,setStep]=useState(0);
  const panel=useRef(null),close=useRef(onClose);close.current=onClose;
  useEffect(()=>{
    const previous=document.activeElement,element=panel.current;
    element.querySelector('button')?.focus();
    const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
    function key(event){
      if(event.key==='Escape'){event.preventDefault();close.current();}
      if(event.key==='Tab'){
        const controls=[...element.querySelectorAll('button')].filter(el=>!el.disabled);
        const first=controls[0],last=controls.at(-1);
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
      }
    }
    element.addEventListener('keydown',key);
    return()=>{element.removeEventListener('keydown',key);document.body.style.overflow=overflow;previous?.focus();};
  },[]);
  return <div style={{position:'fixed',inset:0,zIndex:700,background:C.bg+'dd',display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
    <section ref={panel} role="dialog" aria-modal="true" aria-labelledby="tour-title" style={{maxWidth:480,width:'100%',maxHeight:'90dvh',overflowY:'auto',background:C.card,borderRadius:'20px 20px 0 0',padding:24}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}><span style={{fontSize:14,color:C.icy}}>Quick tour · {step+1} of 3</span><button style={button} onClick={onClose}>Skip</button></div>
      <div aria-live="polite"><h2 id="tour-title" style={{fontSize:24,margin:'20px 0 12px'}}>{steps[step].title}</h2><p style={{fontSize:16,color:C.icy,lineHeight:1.6,margin:'0 0 24px'}}>{steps[step].body}</p></div>
      <div style={{display:'flex',gap:10}}>{step>0&&<button style={{...button,flex:1}} onClick={()=>setStep(step-1)}>Back</button>}<button style={{...button,flex:2,background:C.gold,color:C.bg}} onClick={()=>step===2?onClose():setStep(step+1)}>{step===2?'Get started':'Next'}</button></div>
      <div style={{marginTop:24,paddingTop:16,borderTop:`1px solid ${C.border}`,display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,paddingBottom:'env(safe-area-inset-bottom)'}}><div><div style={{fontSize:14}}>Touch feedback</div><div style={{fontSize:13,color:C.icy,marginTop:4}}>Vibration on supported devices.</div></div><button style={button} aria-label="Touch feedback" aria-pressed={haptics} onClick={()=>onHapticsChange(!haptics)}>{haptics?'On':'Off'}</button></div>
    </section>
  </div>;
}
