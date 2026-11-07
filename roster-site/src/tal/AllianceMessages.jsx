import {useState} from 'react';
import {Card,Hint,button,C} from './ui.jsx';
import {moveMessageGroups,discordBlocks} from './moveMessages.js';
export function AllianceMessages({plan,players,onCopy}){
 const [open,setOpen]=useState(false),groups=moveMessageGroups(plan,players);
 return <Card title="Alliance moves & stay lists"><Hint>Grouped by home alliance and TAL legion. Names are A–Z. Staying players are included. Refresh Members to check current alliances.</Hint><button style={button} aria-expanded={open} onClick={()=>setOpen(!open)}>{open?'Hide Discord lists':'Show Discord lists'}</button>{open&&<>
  {!groups.length&&<Hint>Assign players to legions to create these lists.</Hint>}
  {groups.map(group=><section key={group.id} style={{marginTop:16}}><h4 style={{fontSize:15,lineHeight:1.5,margin:'0 0 8px'}}>{group.title} · {group.players.length}</h4>{discordBlocks(group).map((text,i,blocks)=><div key={i} style={{marginBottom:12}}>{blocks.length>1&&<Hint>Message {i+1} of {blocks.length}</Hint>}<pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',fontSize:14,lineHeight:1.6,background:C.bg,padding:12,borderRadius:10,maxHeight:260,overflowY:'auto',userSelect:'text'}}>{text}</pre><button style={{...button,width:'100%',color:C.gold}} onClick={()=>onCopy(text)} aria-label={`Copy ${group.title}${blocks.length>1?` message ${i+1}`:''}`}>Copy for Discord{blocks.length>1?` · ${i+1}/${blocks.length}`:''}</button></div>)}</section>)}
  {groups.length>0&&<Hint>Paste each block as a separate Discord message. If copying is unavailable, select the block to copy it.</Hint>}
 </>}</Card>;
}
