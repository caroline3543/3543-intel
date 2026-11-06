import { useEffect, useRef } from 'react';
import { C } from '../../utils/constants.js';
import { gameLanguageName } from '../../services/gameLanguageService.js';
import { EMPTY_FILTERS, TIER_FILTERS } from '../../services/rosterViewService.js';
const control={minHeight:44,width:'100%',boxSizing:'border-box',borderRadius:10,padding:10,fontSize:16,background:C.section,color:C.white,border:`1px solid ${C.border}`};
export function RosterFilters({players,roles,filters,onChange,onClose,count}) {
  const dialog=useRef(null);
  useEffect(()=>{
    const previous=document.activeElement;
    dialog.current?.querySelector('button')?.focus();
    function keydown(event){
      if(event.key==='Escape'){event.preventDefault();onClose();}
      if(event.key==='Tab'){
        const controls=[...dialog.current.querySelectorAll('button,select,input')].filter(el=>!el.disabled);
        const first=controls[0],last=controls.at(-1);
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
      }
    }
    const section=dialog.current;
    section.addEventListener('keydown',keydown);
    const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
    return ()=>{section.removeEventListener('keydown',keydown);document.body.style.overflow=overflow;previous?.focus();};
  },[]);
  const unique=values=>[...new Set(values.filter(Boolean))].sort();
  const select=(key,label,options)=><label style={{display:'grid',gap:6,color:C.icy,fontSize:14}}>{label}<select style={control} value={filters[key]} onChange={e=>onChange({...filters,[key]:e.target.value,...(key==='hero'?{verified:false}:{})})}><option value="">Any</option>{options.map(([value,text])=><option key={value} value={value}>{text}</option>)}</select></label>;
  return <div style={{position:'fixed',inset:0,background:C.bg+'dd',zIndex:300,display:'flex',alignItems:'flex-end'}} onClick={onClose}>
    <section ref={dialog} role="dialog" aria-modal="true" aria-label="Roster filters" onClick={e=>e.stopPropagation()} style={{background:C.card,width:'100%',maxWidth:480,margin:'0 auto',borderRadius:'20px 20px 0 0',padding:20,boxSizing:'border-box',maxHeight:'90dvh',overflowY:'auto'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><h2 style={{fontSize:20}}>Filters</h2><button style={{...control,width:44}} onClick={onClose} aria-label="Close filters">✕</button></div>
      <div style={{display:'grid',gap:14}}>
        {select('alliance','Alliance',unique(players.map(p=>p.allianceTag)).map(v=>[v,v]))}
        {select('role','Role',[['joiner','Joiners'],...roles.map(r=>[r.name,r.name==='Rally Lead'?'Rally leaders':r.name])])}
        {select('tier','Troop strength',TIER_FILTERS)}
        {select('hero','Joiner hero · Skill 5',unique(players.flatMap(p=>(p.joinerHeroes||[]).filter(h=>h.skillLevel>=5).map(h=>h.hero))).map(v=>[v,v]))}
        {filters.hero && <label style={{minHeight:44,display:'flex',gap:10,alignItems:'center',color:C.icy}}><input type="checkbox" checked={filters.verified} onChange={e=>onChange({...filters,verified:e.target.checked})}/>Verified heroes only</label>}
        {select('language','Game language',unique(players.map(p=>gameLanguageName(p.gameLanguage))).map(v=>[v,v]))}
        <label style={{minHeight:44,display:'flex',gap:10,alignItems:'center',color:C.icy}}><input type="checkbox" checked={filters.review} onChange={e=>onChange({...filters,review:e.target.checked})}/>Missing troop tiers, alliance or player ID</label>
      </div>
      <p style={{fontSize:14,color:C.icy}} role="status">{count} players match all selected filters.</p>
      <div style={{display:'flex',gap:10,paddingBottom:'env(safe-area-inset-bottom)'}}><button style={control} onClick={()=>onChange({...EMPTY_FILTERS})}>Clear filters</button><button style={{...control,background:C.gold,color:C.bg,fontWeight:700}} onClick={onClose}>Show {count} players</button></div>
    </section>
  </div>;
}
