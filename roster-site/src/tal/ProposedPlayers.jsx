import {useState} from 'react';
import {Hint,button,C} from './ui.jsx';
import {playerLabel,record} from './planner.js';
export function ProposedPlayers({plan,team,players,onReview}){
 const [open,setOpen]=useState(false),candidates=team.candidates||[];
 if(!candidates.length)return null;
 return <section style={{padding:12,margin:'12px 0',background:C.bg,borderRadius:12}}><button style={{...button,width:'100%',textAlign:'left'}} aria-expanded={open} onClick={()=>setOpen(!open)}>Proposed players · {candidates.length} {open?'▴':'▾'}</button><Hint>Spreadsheet proposals are kept separate from selected players. Review each player before adding a role. Withdrawn entries stay saved.</Hint>{open&&candidates.map((candidate,index)=>{const p=players.find(p=>p.id===candidate.id);return <div key={candidate.id} style={{padding:'10px 0',borderTop:`1px solid ${C.border}`}}><strong style={{fontSize:14,overflowWrap:'anywhere'}}>{index+1}. {playerLabel(p)}</strong><div style={{fontSize:13,color:C.gold,margin:'6px 0'}}>{candidate.status||'Needs review'} · {p?.fid||'Player ID missing'}</div>{p&&record(plan,p).note&&<Hint>{record(plan,p).note}</Hint>}<button style={button} disabled={plan.locked} onClick={()=>onReview(candidate.id,team.id)}>Review assignment</button></div>;})}</section>;
}
