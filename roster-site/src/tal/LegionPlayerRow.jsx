import {useRef,useState} from 'react';
import {PencilIcon} from '../../../src/components/players/ProfileParts.jsx';
import {playerLabel,record,overlap,assignedTeam} from './planner.js';
import {setLegionSelected,removeLegionEntry} from './selection.js';
import {cleanTalNote} from './notes.js';
import {TalNoteEditor} from './TalNoteEditor.jsx';
import {labyrinthLabel} from './labyrinth.js';
import {fmtPower,troopPower} from './power.js';
import {button,C} from './ui.jsx';
export function LegionPlayerRow({plan,team,player,member,candidate,index,sort,top20,onChange,onRole,onPower,onSelectionChange}){
 const [menu,setMenu]=useState(false),[notes,setNotes]=useState(false),[confirm,setConfirm]=useState(''),[error,setError]=useState('');
 const pencil=useRef(null),check=useRef(null),name=playerLabel(player),selected=!!member,r=record(plan,player),note=cleanTalNote(r.note),other=assignedTeam(plan,player.id);
 function select(){try{if(selected&&member.registered){setConfirm('deselect');return;}onChange(setLegionSelected(plan,planPlayers(),player.id,team.id,!selected));setError('');onSelectionChange?.();}catch(e){setError(e.message);}}
 // Selection only needs this profile; the plan itself supplies cross-legion membership.
 function planPlayers(){return [player];}
 function confirmAction(){try{onChange(confirm==='remove'?removeLegionEntry(plan,player.id,team.id):setLegionSelected(plan,planPlayers(),player.id,team.id,false,{confirmRegistered:true}));setConfirm('');setMenu(false);check.current?.focus();onSelectionChange?.();}catch(e){setError(e.message);}}
 const power=troopPower(plan,player),availability=r.status==='declined'?'Not participating':r.status==='pending'?'Times not confirmed':`${overlap(plan,player,team)}/${team.slots.length||3} times`;
 const blocked=!selected&&(player.blacklisted||r.status==='declined'||other&&other.id!==team.id);
 return <article aria-label={`Legion player ${name}`} style={{padding:'12px 0',borderTop:`1px solid ${C.border}`}}>
  <div style={{display:'flex',gap:8,alignItems:'flex-start'}}>
   <button ref={check} role="checkbox" aria-checked={selected} aria-label={`${selected?'Deselect':'Select'} ${name} for ${team.host} Legion ${team.number}`} title={blocked?'Update availability or move from the other legion first':selected?'Selected for this legion':'Select for this legion'} disabled={plan.locked||blocked} onClick={select} style={{...button,padding:0,border:0,width:44,height:44,flexShrink:0,background:'none',display:'grid',placeItems:'center'}}><span aria-hidden="true" style={{width:28,height:28,borderRadius:'50%',border:`2px solid ${selected?C.green:C.icy}`,background:selected?C.green:'none',color:C.bg,display:'grid',placeItems:'center',fontSize:19,fontWeight:700}}>{selected?'✓':''}</span></button>
   <div style={{flex:1,minWidth:0}}><strong style={{fontSize:16,overflowWrap:'anywhere'}}>{index+1}. {name}</strong><div style={{fontSize:13,color:selected?C.green:C.icy,marginTop:5}}>{selected?'Selected':'Not selected'}{selected&&overlap(plan,player,team)<plan.minOverlap?' · Check availability':''}{selected?` · ${member.role==='pending'?'Role not set':member.role}`:candidate?.status&&candidate.status!=='Not selected'?` · ${candidate.status}`:''}</div><div style={{fontSize:13,color:C.icy,lineHeight:1.5,marginTop:4}}>{r.homeAlliance?`[${r.homeAlliance}] · `:''}{availability}{top20?' · Top 20':''}</div><div style={{fontSize:13,color:C.icy,marginTop:4}}>{sort==='city'?`City ${fmtPower(player.power??player.providerStats?.power)}`:labyrinthLabel(player)}{power!=null?` · Troop power ${fmtPower(power)}`:''}</div>{other&&other.id!==team.id&&<div style={{fontSize:13,color:C.gold,marginTop:5}}>Selected in {other.host} Legion {other.number}</div>}</div>
   <button ref={pencil} style={{...button,padding:10,flexShrink:0}} aria-label={`${note?'Edit':'Add'} TAL note for ${name}`} disabled={plan.locked} onClick={()=>setNotes(!notes)}><PencilIcon/></button>
   <button style={{...button,padding:'10px 8px',flexShrink:0}} aria-label={`Options for ${name}`} aria-expanded={menu} onClick={()=>setMenu(!menu)}>•••</button>
  </div>
  {!notes&&note&&<p aria-label={`TAL note for ${name}`} style={{fontSize:14,color:C.icy,lineHeight:1.5,margin:'8px 0 0 52px',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden',overflowWrap:'anywhere'}}>{note}</p>}
  {notes&&<TalNoteEditor plan={plan} player={player} onChange={onChange} onClose={()=>{setNotes(false);pencil.current?.focus();}}/>}
  {menu&&<div role="group" aria-label={`Actions for ${name}`} style={{display:'grid',gap:8,padding:10,marginTop:10,background:C.bg,borderRadius:10}}><button style={button} disabled={plan.locked} onClick={()=>{setMenu(false);onRole(player.id,team.id);}}>Move or change role</button><button style={button} disabled={plan.locked} onClick={()=>{setMenu(false);onPower(team,player.id);}}>Edit troop power</button><details><summary style={{minHeight:44,paddingTop:12,color:C.icy,fontSize:14}}>Source details</summary><div style={{fontSize:13,color:C.icy,lineHeight:1.6}}>Player ID: {player.fid||'Missing'}<br/>City power: {fmtPower(player.power??player.providerStats?.power)}<br/>Troop power: {fmtPower(power)}{r.sheetSelection&&<><br/>Imported selection: {r.sheetSelection}</>}{r.sheetRegistration&&<><br/>Imported registration: {r.sheetRegistration}</>}</div></details><button style={{...button,color:C.red}} disabled={plan.locked} onClick={()=>setConfirm('remove')}>Remove from list…</button></div>}
  {confirm&&<div role="group" aria-label={`Confirm ${confirm==='remove'?'removal':'deselection'} of ${name}`} style={{marginTop:10,padding:12,background:C.bg,borderRadius:10}}><p style={{fontSize:14,color:C.icy,lineHeight:1.5,marginTop:0}}>{confirm==='remove'?`Remove ${name} from this list? Their profile and notes stay saved.`:`Deselect ${name}? Their role and notes stay saved.`}{member?.registered?' In-game registration stays unchanged. Reconfirm it here if you select them again.':''}</p><div style={{display:'flex',gap:8}}><button style={button} onClick={()=>setConfirm('')}>Cancel</button><button style={{...button,color:C.red}} disabled={plan.locked} onClick={confirmAction}>{confirm==='remove'?'Remove from list':'Deselect player'}</button></div></div>}
  {error&&<p role="alert" style={{fontSize:14,color:C.red,lineHeight:1.5}}>{error}</p>}
 </article>;
}
