import { useState } from 'react';
import { C } from '../../utils/constants.js';
import { matchPollEntries, pollSuggestions, addPollPlayers, removePollPlayer } from '../../services/talPoll.js';
const button={minHeight:44,padding:'8px 12px',borderRadius:10,border:`1px solid ${C.border}`,background:C.card,color:C.icy,fontSize:16,cursor:'pointer'};
export function TalPollList({pollKey,config,players,onSave}) {
  const [text,setText]=useState('');
  const [unresolved,setUnresolved]=useState([]);
  const [message,setMessage]=useState('');
  const interested=pollKey==='interested';
  const title=interested?'Interested':`${pollKey} UTC`;
  const ids=interested?(config.interestedIds||[]).filter(id=>!(config.availability[id]||[]).length):Object.keys(config.availability).filter(id=>(config.availability[id]||[]).includes(pollKey));
  const members=players.filter(p=>ids.includes(p.id));
  const pool=players.filter(p=>!ids.includes(p.id)&&(!interested||!(config.availability[p.id]||[]).length));
  const single=!/[\n\r,;\t]/.test(text.trim());
  const suggestions=single?pollSuggestions(pool,text):[];
  const name=p=>p.username||p.alias||p.fid||p.id;
  const subtitle=p=>`[${p.allianceTag||'No alliance'}] · ID ${p.fid||p.id}`;
  function add(idsToAdd){if(config.locked)return;onSave(addPollPlayers(config,pollKey,idsToAdd));}
  function submit(){
    if(config.locked)return;
    const rows=matchPollEntries(players,text);
    const valid=rows.filter(r=>r.player);
    const blocked=valid.filter(r=>interested&&(config.availability[r.player.id]||[]).length);
    const idsToAdd=valid.filter(r=>!blocked.includes(r)).map(r=>r.player.id);
    add(idsToAdd);
    setUnresolved(previous=>[...previous,...rows.filter(r=>!r.player)]);setText('');
    const fresh=new Set(idsToAdd.filter(id=>!ids.includes(id))).size;
    setMessage(`${fresh} added.${blocked.length?` ${blocked.length} already have availability.`:''}${rows.some(r=>!r.player)?' Review unmatched names below.':''}`);
  }
  return <section style={{border:`1px solid ${C.border}`,borderRadius:14,padding:16,marginTop:16,background:C.bg}}>
    <h3 style={{color:C.white,fontSize:20,margin:'0 0 6px'}}>{title} <span style={{color:C.icy,fontSize:16}}>· {members.length}</span></h3>
    {interested&&<p style={{color:C.icy,fontSize:14,margin:'0 0 12px'}}>Wants to play; availability not yet provided. Moves off this list when a time is added.</p>}
    <label style={{color:C.icy,fontSize:14}} htmlFor={`tal-poll-${pollKey}`}>Add names or player IDs</label>
    <textarea id={`tal-poll-${pollKey}`} disabled={config.locked} value={text} onChange={e=>{setText(e.target.value);setMessage('');}} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&single&&text.trim()){e.preventDefault();submit();}}} placeholder="Type a name or ID, or paste a list" style={{width:'100%',minHeight:88,boxSizing:'border-box',padding:12,borderRadius:10,border:`1px solid ${C.border}`,background:C.section,color:C.white,fontSize:16,fontFamily:'inherit',resize:'vertical'}} />
    <p style={{color:C.icy,fontSize:13,margin:'6px 0'}}>One per line, or separate with commas. Press Enter to add one name.</p>
    {suggestions.length>0&&<div aria-label={`Suggestions for ${title}`}>{suggestions.map(p=><button key={p.id} disabled={config.locked} style={{...button,width:'100%',textAlign:'left',marginBottom:6}} onClick={()=>{add([p.id]);setText('');setMessage(`${name(p)} added.`);}}>{name(p)}<span style={{display:'block',fontSize:13,color:C.icy}}>{subtitle(p)}</span></button>)}</div>}
    <button disabled={config.locked||!text.trim()} style={{...button,color:C.gold}} onClick={submit}>Add to {interested?'Interested':pollKey+' UTC'}</button>
    {unresolved.map((row,i)=><div key={`${row.entry}-${i}`} style={{marginTop:12,borderTop:`1px solid ${C.border}`,paddingTop:10}}>
      <p style={{color:C.gold,margin:'0 0 8px'}}>{row.entry} · {row.ambiguous?'More than one match. Choose a player.':'No exact match. Choose a suggestion or check the spelling.'}</p>
      {row.suggestions.filter(p=>!interested||!(config.availability[p.id]||[]).length).map(p=><button disabled={config.locked} key={p.id} style={{...button,width:'100%',textAlign:'left',marginBottom:6}} onClick={()=>{add([p.id]);setUnresolved(rows=>rows.filter((_,index)=>index!==i));setMessage(`${name(p)} added.`);}}>{name(p)}<span style={{display:'block',fontSize:13}}>{subtitle(p)}</span></button>)}
      <button style={button} onClick={()=>{setText(row.entry);setUnresolved(rows=>rows.filter((_,index)=>index!==i));}}>Edit entry</button>
      <button style={button} onClick={()=>setUnresolved(rows=>rows.filter((_,index)=>index!==i))}>Skip entry</button>
    </div>)}
    {message&&<p role="status" style={{color:C.gold}}>{message}</p>}
    {members.length>0&&<details style={{color:C.icy,marginTop:12}}><summary style={{minHeight:44,cursor:'pointer'}}>View players · {members.length}</summary>{members.map(p=><div key={p.id} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 0',borderTop:`1px solid ${C.border}`}}><div style={{flex:1,minWidth:0,overflowWrap:'anywhere'}}>{name(p)}<div style={{fontSize:13}}>{subtitle(p)}</div></div><button disabled={config.locked} aria-label={`Remove ${name(p)} from ${title}`} style={button} onClick={()=>onSave(removePollPlayer(config,pollKey,p.id))}>Remove</button></div>)}</details>}
  </section>;
}
