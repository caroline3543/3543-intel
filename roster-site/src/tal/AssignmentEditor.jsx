import {useEffect,useRef,useState} from 'react';
import {Card,Hint,button,field,C} from './ui.jsx';
import {assignedTeam,eligible,placePlayer,playerLabel,unassign} from './planner.js';
export function AssignmentEditor({plan,players,player,onChange,onClose,onMessage,initialTargetId=''}){
 const source=assignedTeam(plan,player.id),member=source?.members.find(m=>m.id===player.id);
 const [target,setTarget]=useState(initialTargetId||source?.id||plan.teams[0]?.id||''),[swap,setSwap]=useState('');
 const panel=useRef(null),[error,setError]=useState('');
 useEffect(()=>{const previous=document.activeElement;panel.current?.scrollIntoView?.({block:'start'});panel.current?.querySelector('select')?.focus();return()=>{if(previous?.isConnected)previous.focus();};},[]);
 const [allowConflict,setAllowConflict]=useState(false);
 const destination=plan.teams.find(t=>t.id===target);
 const role=destination?.members.filter(m=>m.id!==player.id&&m.role==='combatant').length<30?'combatant':'substitute';
 return <div ref={panel}><Card title={playerLabel(player)}><Hint>Home alliance stays unchanged. This only changes your TAL plan.</Hint><label>Destination legion<select style={{...field,margin:'6px 0 12px'}} value={target} onChange={e=>{setTarget(e.target.value);setSwap('');}}>{plan.teams.map(t=><option key={t.id} value={t.id}>[{t.host}] Legion {t.number}{eligible(plan,player,t)?'':' · availability conflict'}</option>)}</select></label><Hint>Roles are automatic: top 30 combatants, then substitutes. Missing troop powers use Labyrinth rank.</Hint>
 {source&&target!==source.id&&<label>Swap with · optional<select style={{...field,margin:'6px 0 12px'}} value={swap} onChange={e=>setSwap(e.target.value)}><option value="">Move without swapping</option>{destination?.members.map(m=><option key={m.id} value={m.id}>{playerLabel(players.find(p=>p.id===m.id))} · {m.role}</option>)}</select></label>}
 {!eligible(plan,player,destination||{slots:[]})&&<label style={{display:'flex',alignItems:'center',gap:10,minHeight:48,fontSize:14,color:C.icy}}><input type="checkbox" disabled={plan.locked} checked={allowConflict} onChange={e=>setAllowConflict(e.target.checked)}/>Save with unconfirmed times</label>}
 {error&&<p role="alert" style={{fontSize:14,color:C.red,lineHeight:1.5}}>{error}</p>}
 <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button style={button} onClick={onClose}>Cancel</button>{source&&<button style={button} disabled={plan.locked} onClick={()=>{onChange(unassign(plan,player.id));onClose();}}>Unassign</button>}<button style={{...button,color:C.gold}} disabled={plan.locked||!target||!role} onClick={()=>{try{onChange(placePlayer(plan,players,player.id,target,role,swap,{allowAvailabilityConflict:allowConflict}));onClose();onMessage(swap?'Players swapped. Check the captain assignments.':'Assignment saved.');}catch(e){setError(e.message);}}}>{swap?'Swap players':'Save assignment'}</button></div>
 </Card></div>;
}
