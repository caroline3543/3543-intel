import {useEffect,useRef,useState} from 'react';
import {ARENA_SLOTS,placeArenaHero,activeArenaHeroes} from '../services/arenaComparisonService.js';
export function useArenaPortraitDrag(team,onChange){
 const board=useRef(null),session=useRef(null),suppressClick=useRef(false),latest=useRef({team,onChange});latest.current={team,onChange};
 const [drag,setDrag]=useState(null),[selected,setSelected]=useState(null),[announcement,setAnnouncement]=useState(''),[undo,setUndo]=useState(null);
 const editable=typeof onChange==='function';
 useEffect(()=>{session.current=null;setDrag(null);setSelected(null)},[team,editable]);
 useEffect(()=>{setUndo(null);setAnnouncement('')},[team.fid,team.sourceAt,team.heroes]);
 function targetAt(x,y){const el=document.elementsFromPoint(x,y).map(el=>el.closest?.('[data-arena-slot]')).find(el=>el && board.current?.contains(el));return el?Number(el.dataset.arenaSlot):null}
 function move(source,target){
  const current=latest.current.team,key=current.slots[source];if(typeof latest.current.onChange!=='function' || !key || source===target || target==null)return;
  const next=placeArenaHero(current,target,key),hero=activeArenaHeroes(current)[source];
  setUndo({before:[...current.slots],after:[...next.slots]});latest.current.onChange(next);setSelected(null);
  setAnnouncement(`${hero?.name || 'Hero'} moved to ${ARENA_SLOTS[target].toLowerCase()}. Positions need confirmation.`);
 }
 function pointerDown(event,source){
  if(!editable || !event.isPrimary || event.button!==0 || !team.slots[source])return;
  session.current={source,pointerId:event.pointerId,x:event.clientX,y:event.clientY,team:latest.current.team,active:false};suppressClick.current=false;
  try{event.currentTarget.setPointerCapture(event.pointerId)}catch{ /* Tap-to-swap remains available. */ }
 }
 function pointerMove(event){
  const s=session.current;if(!s || s.pointerId!==event.pointerId)return;
  if(Math.hypot(event.clientX-s.x,event.clientY-s.y)<7 && !s.active)return;
  s.active=true;setSelected(null);setDrag({source:s.source,target:targetAt(event.clientX,event.clientY),x:event.clientX,y:event.clientY});
 }
 function pointerUp(event){
  const s=session.current;if(!s || s.pointerId!==event.pointerId)return;
  session.current=null;setDrag(null);suppressClick.current=s.active;
  if(s.active && s.team===latest.current.team){const target=targetAt(event.clientX,event.clientY);if(target!=null)move(s.source,target);else setAnnouncement('Move cancelled. Drop onto a position in your attack team.')}
 }
 function cancel(){suppressClick.current=!!session.current?.active;session.current=null;setDrag(null);setSelected(null);setAnnouncement('Move cancelled.')}
 function lostCapture(){if(session.current)cancel()}
 function tap(slot,event){
  if(!editable)return;
  if(suppressClick.current && event?.detail!==0){suppressClick.current=false;return}
  suppressClick.current=false;
  if(selected===slot){setSelected(null);return}
  if(selected!=null){move(selected,slot);return}
  if(team.slots[slot]){setSelected(slot);setAnnouncement(`Selected ${activeArenaHeroes(team)[slot]?.name || 'hero'}. Tap a destination to swap.`)}
 }
 const canUndo=!!undo && JSON.stringify(team.slots)===JSON.stringify(undo.after);
 function undoMove(){if(!canUndo)return;latest.current.onChange({...team,slots:[...undo.before],confirmed:false});setUndo(null);setSelected(null);setAnnouncement('Last portrait move undone. Positions need confirmation.')}
 return {board,drag,selected,announcement,editable,canUndo,undoMove,pointerDown,pointerMove,pointerUp,cancel,lostCapture,tap};
}
