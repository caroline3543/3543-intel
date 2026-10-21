import {useState} from 'react';
import {C} from '../../../utils/constants.js';
import {ARENA_SLOTS,activeArenaHeroes} from '../../../services/arenaComparisonService.js';
import {interpretedStars} from '../../../services/equipmentCatalogService.js';
import {arenaCard,arenaInput} from './arenaStyles.js';
export function ArenaGearComparison({yours,theirs}){
 const [position,setPosition]=useState(0),a=activeArenaHeroes(yours)[position],b=activeArenaHeroes(theirs)[position];
 const format=v=>v==null || v===''?'Unknown':String(v);
 const gear=(h,slot)=>{const g=h?.gear.find(g=>g.name===slot);return g?`${g.quality || 'Quality ?'} · +${g.enhancement ?? '?'} · mastery ${g.mastery ?? '?'}`:'Not reported'};
 const skills=h=>Array.isArray(h?.skill_levels)?h.skill_levels.filter(s=>s && typeof s==='object').map(s=>`${s.name || s.label || `ID ${s.id ?? '?'}`}: ${s.level ?? s.lv ?? '?'}`).join('; '):null;
 const rows=[['Hero',a?.name,b?.name],['Class',a?.troop,b?.troop],['Hero power',a?.power?.toLocaleString('en-US'),b?.power?.toLocaleString('en-US')],['Level',a?.level,b?.level],['Stars',a?interpretedStars(a):null,b?interpretedStars(b):null],['Widget level',a?.widgetLevel,b?.widgetLevel],['Reported skills',skills(a),skills(b)],...['Goggles','Gloves','Belt','Boots'].map(s=>[s,gear(a,s),gear(b,s)])];
 return <section style={arenaCard}><h3 style={{fontSize:16,marginTop:0}}>Hero & gear comparison</h3><label style={{fontSize:12}}>Compare position<select aria-label="Compare Arena position" value={position} onChange={e=>setPosition(Number(e.target.value))} style={arenaInput}>{ARENA_SLOTS.map((s,i)=><option key={s} value={i}>{s}</option>)}</select></label><p style={{fontSize:11,color:C.muted}}>These are matching formation positions, not a prediction of targeting. Different hero classes and equipment tiers are not interchangeable.</p><table style={{width:'100%',borderCollapse:'collapse',tableLayout:'fixed',fontSize:12}}><thead><tr>{['Detail','Your team','Opponent'].map(h=><th key={h} scope="col" style={{textAlign:'left',padding:'8px 4px',color:C.gold}}>{h}</th>)}</tr></thead><tbody>{rows.map(([label,left,right])=><tr key={label}><th scope="row" style={{textAlign:'left',fontWeight:400,padding:'8px 4px',borderTop:`1px solid ${C.border}`,color:C.muted}}>{label}</th>{[left,right].map((v,i)=><td key={i} style={{padding:'8px 4px',borderTop:`1px solid ${C.border}`,verticalAlign:'top',overflowWrap:'anywhere'}}>{format(v)}</td>)}</tr>)}</tbody></table></section>;
}
