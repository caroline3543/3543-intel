import {useState} from 'react';
import {Card,Hint,button,field,C} from './ui.jsx';
import {LANGUAGES} from '../../../src/utils/constants.js';
import {playerSearchFields} from '../../../src/services/playerNames.js';
import {previewTalBulk} from './bulkActions.js';
import {record} from './planner.js';

export function TalBulkEditor({data,onApply}){
 const players=data.players||[],plan=data.talPlan||{},locked=!!plan.locked;
 const [open,setOpen]=useState(false),[selected,setSelected]=useState([]);
 const [query,setQuery]=useState(''),[alliance,setAlliance]=useState(''),[status,setStatus]=useState('all');
 const [kind,setKind]=useState('language'),[language,setLanguage]=useState('English');
 const [availabilityMode,setAvailabilityMode]=useState('add'),[times,setTimes]=useState([]);
 const [registration,setRegistration]=useState('needs'),[teamworkMode,setTeamworkMode]=useState('pair');
 const [preview,setPreview]=useState(null),[error,setError]=useState('');
 const tags=[...new Set(players.map(p=>p.allianceTag).filter(Boolean))].sort();
 const filtered=players.filter(p=>{
  const q=query.trim().toLowerCase(),r=record(plan,p);
  return (!alliance||p.allianceTag===alliance)&&(!q||playerSearchFields(p).some(v=>String(v||'').toLowerCase().includes(q)))&&
   (status==='all'||(status==='available'&&r.status==='available')||(status==='pending'&&r.status==='pending')||
    (status==='verified'&&r.sheetRegistration==='Verified')||(status==='needs'&&r.sheetRegistration!=='Verified'));
 });
 const picked=new Set(selected),ids=selected.filter(id=>players.some(p=>String(p.id)===id));
 const action=kind==='language'?{type:'language',language}:
  kind==='availability'?{type:'availability',mode:availabilityMode,times}:
  kind==='registration'?{type:'registration',value:registration}:
  {type:'teamwork',mode:teamworkMode};
 function choose(id,checked){setSelected(old=>checked?[...new Set([...old,id])]:old.filter(x=>x!==id));setPreview(null);setError('');}
 function review(){
  try{setPreview(previewTalBulk(data,ids,action));setError('');}
  catch(e){setError(e.message);setPreview(null);}
 }
 function apply(){
  if(!preview)return;
  try{onApply(ids,action);setSelected([]);setPreview(null);setError('');setOpen(false);}
  catch(e){setError(e.message);}
 }
 return <Card title="Bulk edit players">
  <Hint>Update several players at once. Selection remains when switching filters. Changes are reviewed before saving to the shared leader workspace.</Hint>
  <button type="button" style={{...button,width:'100%',color:C.gold}} aria-expanded={open} onClick={()=>setOpen(!open)}>{open?'Close bulk selection':`Select players${selected.length?' · '+selected.length+' selected':''}`}</button>
  {open&&<>
   <div style={{display:'grid',gap:8,marginTop:12}}>
    <input style={field} value={query} placeholder="Search name or Player ID" aria-label="Search bulk TAL players" onChange={e=>{setQuery(e.target.value);setPreview(null);}}/>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
     <select style={field} aria-label="Filter by alliance" value={alliance} onChange={e=>setAlliance(e.target.value)}><option value="">All alliances</option>{tags.map(tag=><option key={tag}>{tag}</option>)}</select>
     <select style={field} aria-label="Filter bulk players by status" value={status} onChange={e=>setStatus(e.target.value)}>
      <option value="all">All statuses</option><option value="available">Taking part</option><option value="pending">No reply</option><option value="verified">Sheet verified</option><option value="needs">Needs verification</option>
     </select>
    </div>
    <div style={{display:'flex',gap:8,alignItems:'center',justifyContent:'space-between',flexWrap:'wrap'}}>
     <span role="status" style={{fontSize:13,color:C.icy}}>{ids.length} selected · {filtered.length} matching</span>
     <button type="button" style={button} onClick={()=>{setSelected(old=>[...new Set([...old,...filtered.map(p=>String(p.id))])]);setPreview(null);}}>Select all matching</button>
     <button type="button" style={button} onClick={()=>{setSelected([]);setPreview(null);}}>Clear</button>
    </div>
    <div style={{maxHeight:290,overflowY:'auto',border:`1px solid ${C.border}`,borderRadius:10}}>
     {filtered.map(p=><label key={p.id} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 10px',minHeight:46,borderBottom:`1px solid ${C.border}`}}>
      <input type="checkbox" checked={picked.has(String(p.id))} onChange={e=>choose(String(p.id),e.target.checked)}/>
      <span style={{fontSize:14,minWidth:0}}><strong>{p.username||p.alias||p.fid}</strong><span style={{display:'block',fontSize:12,color:C.icy}}>{p.allianceTag||'?'} · {p.fid||'No player ID'}</span></span>
     </label>)}
     {!filtered.length&&<Hint>No players match the current filters.</Hint>}
    </div>
    {!!ids.length&&<div style={{padding:12,background:C.section,borderRadius:12}}>
     <strong style={{fontSize:14}}>Update {ids.length} selected players</strong>
     <label style={{display:'block',fontSize:13,margin:'10px 0'}}>Action<select style={{...field,marginTop:5}} value={kind} onChange={e=>{setKind(e.target.value);setPreview(null);}}>
      <option value="language">Communication language</option><option value="teamwork">Works well together / preferred group</option><option value="availability">Availability</option><option value="registration">Registration</option>
     </select></label>
     {kind==='language'&&<label style={{fontSize:13}}>Preferred communication language<select style={{...field,marginTop:6}} value={language} onChange={e=>{setLanguage(e.target.value);setPreview(null);}}>{LANGUAGES.map(l=><option key={l}>{l}</option>)}</select><Hint>Does not overwrite recorded game UI language.</Hint></label>}
     {kind==='teamwork'&&<label style={{fontSize:13}}>Teamwork meaning<select style={{...field,marginTop:6}} value={teamworkMode} onChange={e=>{setTeamworkMode(e.target.value);setPreview(null);}}>
      <option value="pair">Works well together (create a link between every selected pair)</option>
     </select></label>}
     {kind==='availability'&&<><label style={{fontSize:13}}>Update mode<select style={{...field,marginTop:6}} value={availabilityMode} onChange={e=>{setAvailabilityMode(e.target.value);setPreview(null);}}>
      <option value="add">Add times</option><option value="remove">Remove times</option><option value="replace">Replace existing times</option>
     </select></label><p style={{fontSize:13,color:C.icy}}>UTC times</p><div style={{display:'flex',flexWrap:'wrap',gap:8}}>{(plan.times||[]).map(t=><label key={t} style={{fontSize:13,display:'flex',alignItems:'center',gap:5,minHeight:40}}><input type="checkbox" checked={times.includes(t)} onChange={e=>{setTimes(old=>e.target.checked?[...old,t]:old.filter(v=>v!==t));setPreview(null);}}/>{t}</label>)}</div>{availabilityMode==='replace'&&<p style={{fontSize:13,color:C.gold}}>Replace will remove any previously recorded times not selected here.</p>}</>}
     {kind==='registration'&&<label style={{fontSize:13}}>Registration status<select style={{...field,marginTop:6}} value={registration} onChange={e=>{setRegistration(e.target.value);setPreview(null);}}>
      <option value="needs">Needs registration (planning)</option><option value="pending">Pending verification (planning)</option><option value="verified">Verified on spreadsheet</option><option value="registered">Registered in game (assigned players only)</option><option value="unregistered">Not registered in game (assigned players only)</option>
     </select><Hint>Spreadsheet status and in-game registration are separate.</Hint></label>}
     {locked&&<p style={{fontSize:13,color:C.gold}}>Unlock the TAL plan to make changes.</p>}
     <button type="button" disabled={locked} style={{...button,width:'100%',marginTop:12,background:C.gold,color:C.bg}} onClick={review}>Review changes</button>
     {preview&&<div style={{marginTop:12}}><p style={{fontSize:13,color:C.white}}>{preview.summary}</p><Hint>{preview.players.slice(0,6).map(p=>p.name).join(', ')}{preview.players.length>6?' and '+(preview.players.length-6)+' more':''}</Hint>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}><button type="button" style={button} onClick={()=>setPreview(null)}>Cancel</button><button type="button" style={{...button,background:C.gold,color:C.bg}} onClick={apply}>Confirm {preview.ids.length}</button></div>
     </div>}
     {error&&<p role="alert" style={{fontSize:13,color:C.gold}}>{error}</p>}
    </div>}
   </div>
  </>}
 </Card>;
}
