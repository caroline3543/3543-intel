import {playerSearchFields} from '../../../src/services/playerNames.js';
import {useState} from 'react';
import {matchPollEntries} from '../../../src/services/talPoll.js';
import {Card,Hint,TimeButtons,button,field,C} from './ui.jsx';
import {record,toggleTime,setRecord,assignedTeam,playerLabel} from './planner.js';
export function Availability({plan,players,onChange,onMessage,onCopy}){
 const [query,setQuery]=useState(''),[tag,setTag]=useState(''),[filter,setFilter]=useState('all'),[expanded,setExpanded]=useState(''),[limit,setLimit]=useState(20);
 const [paste,setPaste]=useState(''),[pasteTime,setPasteTime]=useState(plan.times[0]),[preview,setPreview]=useState(null);
 const counts={pending:players.filter(p=>record(plan,p).status==='pending').length,one:players.filter(p=>record(plan,p).status==='available'&&record(plan,p).times.length===1).length,available:players.filter(p=>record(plan,p).status==='available').length};
 const tags=[...new Set(players.map(p=>p.allianceTag).filter(Boolean))].sort();
 const shown=players.filter(p=>{
  const r=record(plan,p),q=query.trim().toLowerCase();
  return (!q||playerSearchFields(p).some(v=>String(v||'').toLowerCase().includes(q)))&&(!tag||p.allianceTag===tag)&&(filter==='all'||filter==='pending'&&r.status==='pending'||filter==='one'&&r.status==='available'&&r.times.length===1||filter==='available'&&r.status==='available'||filter==='unassigned'&&r.status==='available'&&!assignedTeam(plan,p.id));
 });
 return <>
  <Card title="Collect availability"><Hint>Record every time each player can attend across the season. Blank means no reply; it does not mean unavailable.</Hint><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button style={button} onClick={()=>onCopy('Tundra Arms league — pick all the time slots you’re available')}>Copy poll message</button></div><Hint>{counts.available} taking part · {counts.pending} no reply · {counts.one} with one time</Hint></Card>
  <details style={{marginBottom:16}}><summary style={{minHeight:44,padding:12,color:C.gold,cursor:'pointer'}}>Paste replies for one time</summary><Card><label>Available at · UTC<select disabled={plan.locked} style={{...field,margin:'6px 0 12px'}} value={pasteTime} onChange={e=>{setPasteTime(e.target.value);setPreview(null);}}>{plan.times.map(t=><option key={t}>{t}</option>)}</select></label><label>One username or player ID per line<textarea disabled={plan.locked} style={{...field,minHeight:100,margin:'6px 0 8px'}} value={paste} onChange={e=>{setPaste(e.target.value);setPreview(null);}} placeholder={'681766601\nCaroline'}/></label><button disabled={plan.locked||!paste.trim()} style={button} onClick={()=>setPreview(matchPollEntries(players,paste))}>Check names</button>{preview&&<><Hint>{new Set(preview.filter(r=>r.player).map(r=>r.player.id)).size} matched · {preview.filter(r=>!r.player).length} need checking</Hint>{preview.filter(r=>!r.player).map((r,i)=><p key={i} style={{fontSize:14,color:C.gold}}>{r.entry}: {r.ambiguous?'More than one match. Use a player ID.':'No exact match. Check the name or use a player ID.'}</p>)}<button style={button} disabled={plan.locked||!preview.some(r=>r.player)} onClick={()=>{let next=plan;for(const id of new Set(preview.filter(r=>r.player).map(r=>r.player.id))){const p=players.find(p=>p.id===id),r=record(next,p);next=setRecord(next,p,{status:'available',times:[...new Set([...r.times,pasteTime])]});}onChange(next);onMessage('Matched players added. Unmatched names were left unchanged.');setPreview(null);setPaste('');}}>Add matched players</button></>}</Card></details>
  <input aria-label="Search TAL players" style={{...field,marginBottom:10}} value={query} onChange={e=>{setQuery(e.target.value);setLimit(20);}} placeholder="Search username, nickname or ID"/>
  <div style={{display:'flex',gap:6,overflowX:'auto',marginBottom:10}}>{['',...tags].map(t=><button key={t||'all'} style={{...button,flexShrink:0,color:t===tag?C.gold:C.icy}} aria-pressed={t===tag} onClick={()=>{setTag(t);setLimit(20);}}>{t||'All alliances'}</button>)}</div>
  <select aria-label="Filter availability" style={{...field,marginBottom:12}} value={filter} onChange={e=>{setFilter(e.target.value);setLimit(20);}}><option value="all">All players</option><option value="pending">No reply</option><option value="one">Only one time</option><option value="available">Taking part</option><option value="unassigned">Taking part · unassigned</option></select>
  <Hint>{shown.length} players shown · All times UTC</Hint>
  {!shown.length&&<Hint>No players match these filters.</Hint>}
  {shown.slice(0,limit).map(p=>{
   const r=record(plan,p),open=expanded===p.id,color=r.status==='pending'?C.gold:r.status==='declined'?C.icy:r.times.length===1?C.gold:r.times.length>=3?C.green:C.icy;
   return <Card key={p.id}><button style={{...button,width:'100%',border:0,background:'none',padding:0,textAlign:'left',color:C.white}} aria-expanded={open} onClick={()=>setExpanded(open?'':p.id)}><strong style={{fontSize:16}}>{playerLabel(p)}</strong><span style={{display:'block',fontSize:13,color:C.icy,marginTop:5}}>[{r.homeAlliance||p.allianceTag||'?'}] · {p.fid||'ID unknown'}</span><span style={{display:'block',fontSize:14,color,marginTop:6}}>{r.status==='pending'?'No reply':r.status==='declined'?'Not participating':r.times.length?r.times.join(' · ')+' UTC':'Taking part · times needed'}</span></button>{open&&<div style={{marginTop:14}}>
    <label>Participation<select style={{...field,margin:'6px 0 12px'}} disabled={plan.locked} value={r.status} onChange={e=>onChange(setRecord(plan,p,{status:e.target.value}))}><option value="pending">No reply</option><option value="available">Taking part</option><option value="declined">Not participating</option></select></label>
    <TimeButtons times={plan.times} selected={r.status==='available'?r.times:[]} disabled={plan.locked} onToggle={time=>onChange(toggleTime(plan,p,time))}/>
    <Hint>{r.times.length<plan.minOverlap?'Add more times before assigning this player.':'Legion suggestions use these confirmed times.'}</Hint>
    <label>Availability note<input style={{...field,margin:'6px 0 12px'}} disabled={plan.locked} value={r.note} placeholder="For example: unavailable on Fridays" onChange={e=>onChange(setRecord(plan,p,{note:e.target.value}))}/></label>
    <details><summary style={{minHeight:44,paddingTop:12,color:C.icy,cursor:'pointer'}}>TAL troop power · optional</summary><input aria-label={`Troop power for ${playerLabel(p)}`} type="number" min="0" style={field} disabled={plan.locked} value={r.troopPower} onChange={e=>onChange(setRecord(plan,p,{troopPower:e.target.value===''?'':Math.max(0,Number(e.target.value))}))}/><Hint>Use the value shown in TAL registration, in leaderboard units. City power is different.</Hint></details>
   </div>}</Card>;
  })}
  {shown.length>limit&&<button style={{...button,width:'100%'}} onClick={()=>setLimit(limit+20)}>Show 20 more</button>}
 </>;
}
