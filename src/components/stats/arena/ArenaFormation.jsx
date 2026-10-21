import {useId,useState,useEffect} from 'react';
import {C} from '../../../utils/constants.js';
import {EquipmentIcon} from '../../players/EquipmentParts.jsx';
import {ARENA_SLOTS,activeArenaHeroes} from '../../../services/arenaComparisonService.js';
import {useArenaPortraitDrag} from '../../../hooks/useArenaPortraitDrag.js';
import {arenaButton} from './arenaStyles.js';
export function ArenaFormation({team,label,onChange,locked=false}){
 const [unlocked,setUnlocked]=useState(false);
 useEffect(()=>setUnlocked(false),[team.fid,team.sourceAt,team.heroes]);
 const heroes=activeArenaHeroes(team),interaction=useArenaPortraitDrag(team,locked&&!unlocked?undefined:onChange),hintId=useId();
 const {board,drag,selected,announcement,editable}=interaction;
 const content=h=>h?<><EquipmentIcon url={h.icon} name={h.name} size={32}/><span style={{fontSize:11,overflowWrap:'anywhere',marginTop:4}}>{h.name}</span><small style={{fontSize:10,color:C.muted}}>{h.level!=null?`Lv ${h.level}`:'Lv ?'}</small></>:<span style={{fontSize:11,color:C.muted}}>Empty</span>;
 return <div ref={board} role="group" aria-label={`${label} formation`} style={{minWidth:0}} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();interaction.cancel()}}}><strong style={{display:'block',fontSize:13,lineHeight:'18px',minHeight:36,overflowWrap:'anywhere',marginBottom:8}}>{label}</strong>{[[0,1],[2,3,4]].map((row,i)=><div key={i}><div style={{fontSize:10,color:C.muted,margin:'6px 0'}}>{i?'Back row':'Front row'}</div><div style={{display:'grid',gridTemplateColumns:`repeat(${row.length},minmax(0,1fr))`,gap:4}}>{row.map(slot=>{
  const h=heroes[slot],active=selected===slot || drag?.source===slot,target=drag?.target===slot;
  const style={background:target?C.card:C.bg,border:`2px solid ${target || active?C.gold:C.border}`,borderRadius:8,padding:'4px 3px',minWidth:44,minHeight:80,boxSizing:'border-box',display:'flex',flexDirection:'column',alignItems:'center',textAlign:'center',color:C.white,fontFamily:'inherit',opacity:drag?.source===slot?0.45:1};
  const title=`${label} ${ARENA_SLOTS[slot]}: ${h?.name || 'Empty'}`;
  return editable?<button key={slot} type="button" data-arena-slot={slot} aria-label={title} aria-describedby={hintId} aria-pressed={selected===slot} onPointerDown={e=>interaction.pointerDown(e,slot)} onPointerMove={interaction.pointerMove} onPointerUp={interaction.pointerUp} onPointerCancel={interaction.cancel} onLostPointerCapture={interaction.lostCapture} onDragStart={e=>e.preventDefault()} onClick={e=>interaction.tap(slot,e)} style={{...style,touchAction:'none',userSelect:'none',WebkitUserSelect:'none',WebkitTouchCallout:'none',cursor:drag?'grabbing':'grab'}}>{content(h)}</button>:<div key={slot} aria-label={title} style={style}>{content(h)}</div>;
 })}</div></div>)}
 <p id={hintId} style={{fontSize:11,color:editable?C.icy:C.muted,margin:'8px 0'}}>{editable?locked?'Drag only to match the recorded defence in game.':'Drag a portrait to swap, or tap a hero then its new position.':'Recorded defence · positions protected.'}</p>
 {locked && <button aria-pressed={unlocked} onClick={()=>setUnlocked(!unlocked)} style={{...arenaButton,width:'100%',fontSize:12,padding:'6px 4px',marginBottom:6}}>{unlocked?'Lock defence positions':'Adjust defence positions'}</button>}
 {editable && <button disabled={!interaction.canUndo} onClick={interaction.undoMove} style={{...arenaButton,width:'100%',fontSize:12,padding:'6px 4px'}}>Undo portrait move</button>}
 <p style={{fontSize:11,color:team.confirmed?C.green:C.gold}}>{team.confirmed?'Positions confirmed':'Check positions below'}</p><span role="status" aria-live="polite" style={{display:'block',fontSize:11,color:C.icy}}>{announcement}</span>
 {drag && heroes[drag.source] && <div aria-hidden="true" style={{position:'fixed',left:drag.x,top:drag.y,transform:'translate(-50%,-65%)',pointerEvents:'none',zIndex:1000,background:C.card,border:`2px solid ${C.gold}`,borderRadius:10,padding:8,opacity:0.95}}><EquipmentIcon url={heroes[drag.source].icon} name={heroes[drag.source].name} size={44}/></div>}
 </div>;
}
