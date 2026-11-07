import {useEffect,useRef} from 'react';
import {C} from '../../../src/utils/constants.js';
import {WorkspaceSync} from './WorkspaceSync.jsx';
import {SheetImportSummary} from './SheetImportSummary.jsx';
const button={minHeight:44,minWidth:44,padding:'10px 12px',fontSize:14,fontWeight:600,borderRadius:10,border:`1px solid ${C.border}`,background:C.section,color:C.icy,cursor:'pointer'};
export function WorkspaceAttention({sync,onReview}){
 const text=sync.conflicts?.length?'Edits need review':sync.mode==='join'?'Open the shared roster':sync.mode==='unpublished'?'Start sharing your roster':sync.issue?'Sync needs attention':null;
 if(!text)return null;
 return <div role="status" aria-label="Workspace needs attention" style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,padding:'6px 20px',borderBottom:`1px solid ${C.border}`,fontSize:14,color:C.gold}}><span>{text}</span><button style={button} onClick={onReview}>Review</button></div>;
}
export function WorkspaceOptions({sync,data,onPublish,onJoin,onRetry,onResolve,onClose,onLogout,onHelp,onAlliance}){
 const panel=useRef(null),close=useRef(onClose);close.current=onClose;
 useEffect(()=>{
  const previous=document.activeElement===document.body?document.querySelector('[aria-label="Workspace options"]'):document.activeElement,section=panel.current,overflow=document.body.style.overflow;
  document.body.style.overflow='hidden';section.querySelector('button')?.focus();
  function key(event){
   if(event.key==='Escape'){event.preventDefault();close.current();}
   if(event.key==='Tab'){
    const controls=[...section.querySelectorAll('button,a[href],input,select,textarea,summary,[tabindex="0"]')].filter(el=>!el.disabled&&el.getClientRects().length);
    const first=controls[0],last=controls.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
   }
  }
  section.addEventListener('keydown',key);return()=>{document.body.style.overflow=overflow;section.removeEventListener('keydown',key);if(previous?.isConnected)previous.focus();};
 },[]);
 return <div onClick={onClose} style={{position:'fixed',inset:0,zIndex:650,background:C.bg+'ee',display:'flex',justifyContent:'center'}}><section ref={panel} role="dialog" aria-modal="true" aria-labelledby="workspace-title" onClick={e=>e.stopPropagation()} style={{width:'100%',maxWidth:480,height:'100dvh',overflowY:'auto',overscrollBehavior:'contain',background:C.bg,paddingBottom:'calc(24px + env(safe-area-inset-bottom, 0px))'}}>
  <header style={{position:'sticky',top:0,zIndex:1,padding:'calc(12px + env(safe-area-inset-top, 0px)) 20px 12px',background:C.bg,borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}><h2 id="workspace-title" style={{fontSize:22,margin:0}}>Workspace</h2><button style={button} onClick={onClose}>Close</button></header>
  <WorkspaceSync sync={sync} data={data} onPublish={onPublish} onJoin={onJoin} onRetry={onRetry} onResolve={onResolve}/>
  <SheetImportSummary data={data}/>
  <div style={{display:'grid',gap:10,margin:'16px 20px'}}><button style={button} onClick={onAlliance}>Add or refresh an alliance</button><button style={button} onClick={onHelp}>Help</button><button style={button} onClick={onLogout}>Sign out</button></div>
 </section></div>;
}
