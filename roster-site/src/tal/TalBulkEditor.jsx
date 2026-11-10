import {useState} from 'react';
import {Card,Hint,button,field,C} from './ui.jsx';
import {LANGUAGES} from '../../../src/utils/constants.js';
import {playerSearchFields} from '../../../src/services/playerNames.js';
import {previewTalBulk} from './bulkActions.js';
import {record} from './planner.js';

const selectionStyle={...button,width:'100%',textAlign:'left',color:C.gold,background:C.card};
export function TalBulkEditor({data,onApply,scopedIds=[],scopeLabel='Current legion'}){
 const players=data.players||[],plan=data.talPlan||{},locked=!!plan.locked;
 const [open,setOpen]=useState(false),[selected,setSelected]=useState([]);
 const [query,setQuery]=useState(''),[alliance,setAlliance]=useState(''),[status,setStatus]=useState('all');
 const [scope,setScope]=useState('legion'),[showAll,setShowAll]=useState(false);
 const [kind,setKind]=useState('language'),[language,setLanguage]=useState('English');
 const [availabilityMode,setAvailabilityMode]=useState('add'),[times,setTimes]=useState([]);
 const [registration,setRegistration]=useState('needs');
 const [preview,setPreview]=useState(null),[error,setError]=useState('');
 const scoped=new Set(scopedIds.map(String));
 const available=scope==='legion'?players.filter(p=>scoped.has(String(p.id))):players;
 const tags=[...new Set(available.map(p=>p.allianceTag).filter(Boolean))].sort();
 const filtered=available.filter(p=>{
  const q=query.trim().toLowerCase(),r=record(plan,p);
  return (!alliance||p.allianceTag===alliance)&&(!q||playerSearchFields(p).some(v=>String(v||'').toLowerCase().includes(q)))&&
   (status==='all'||(status==='available'&&r.status==='available')||(status==='pending'&&r.status==='pending')||
    (status==='verified'&&r.sheetRegistration==='Verified')||(status==='needs'&&r.sheetRegistration!=='Verified'));
 });
 const selectedSet=new Set(selected),ids=selected.filter(id=>players.some(p=>String(p.id)===id));
 const visible=showAll?filtered:filtered.slice(0,8);
 const action=kind==='language'?{type:'language',language}:
  kind==='availability'?{type:'availability',mode:availabilityMode,times}:
  kind==='registration'?{type:'registration',value:registration}:
  {type:'teamwork',mode:'pair'};
 function invalidate(){setPreview(null);setError('');}
 function choose(id,checked){setSelected(old=>checked?[...new Set([...old,id])]:old.filter(x=>x!==id));invalidate();}
 function review(){
  try{setPreview(previewTalBulk(data,ids,action));setError('');}
  catch(e){setError(e.message);setPreview(null);}
 }
 function apply(){
  if(!preview)return;
  try{onApply(ids,action);setSelected([]);setPreview(null);setError('');setOpen(false);}
  catch(e){setError(e.message);}
 }
 return <Card>
   <button type="button" style={selectionStyle} aria-expanded={open} aria-controls="tal-bulk-editor" onClick={()=>setOpen(v=>!v)}>
     <span style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}>
      <span><strong>{open?'Editing multiple players':'Select multiple players'}</strong><span style={{display:'block',fontSize:12,fontWeight:400,color:C.icy,marginTop:4}}>{open?'Choose players and apply one change':ids.length?ids.length+' selected · tap to resume':'Update language, availability, registration or teamwork'}</span></span>
      <span aria-hidden="true">{open?'▴':'▾'}</span>
     </span>
   </button>
   {open&&<div id="tal-bulk-editor" style={{marginTop:14,display:'grid',gap:10}}>
     <strong style={{fontSize:14,color:C.white}}>1. Choose players</strong>
     <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
       <button type="button" aria-pressed={scope==='legion'} style={{...button,color:scope==='legion'?C.gold:C.icy,borderColor:scope==='legion'?C.gold:C.border,fontSize:12}} onClick={()=>{setScope('legion');setAlliance('');setShowAll(false);invalidate();}}>{scopeLabel}</button>
       <button type="button" aria-pressed={scope==='state'} style={{...button,color:scope==='state'?C.gold:C.icy,borderColor:scope==='state'?C.gold:C.border,fontSize:12}} onClick={()=>{setScope('state');setAlliance('');setShowAll(false);invalidate();}}>All state players</button>
     </div>
     <input style={field} value={query} placeholder="Search name or Player ID" aria-label="Find players to edit" onChange={e=>{setQuery(e.target.value);setShowAll(false);invalidate();}}/>
     <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
       <label style={{fontSize:12,color:C.icy}}>Alliance<select style={{...field,marginTop:5}} aria-label="Filter by alliance" value={alliance} onChange={e=>{setAlliance(e.target.value);setShowAll(false);invalidate();}}><option value="">All alliances</option>{tags.map(tag=><option key={tag} value={tag}>{tag}</option>)}</select></label>
       <label style={{fontSize:12,color:C.icy}}>Availability<select style={{...field,marginTop:5}} aria-label="Filter by participation" value={status} onChange={e=>{setStatus(e.target.value);setShowAll(false);invalidate();}}>
         <option value="all">Any status</option><option value="available">Taking part</option><option value="pending">No reply</option><option value="verified">Sheet verified</option><option value="needs">Not sheet verified</option>
       </select></label>
     </div>
     <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,flexWrap:'wrap'}}>
       <span role="status" style={{fontSize:13,fontWeight:600,color:C.white}}>{ids.length} selected <span style={{color:C.icy,fontWeight:400}}>· {filtered.length} matches</span></span>
       <button type="button" style={{...button,fontSize:12,color:C.gold}} disabled={!filtered.length} onClick={()=>{setSelected(old=>[...new Set([...old,...filtered.map(p=>String(p.id))])]);invalidate();}}>Select all {filtered.length} matches</button>
       {!!ids.length&&<button type="button" style={{...button,fontSize:12}} onClick={()=>{setSelected([]);invalidate();}}>Clear selection</button>}
     </div>
     <div style={{border:'1px solid '+C.border,borderRadius:10,overflow:'hidden'}}>
      {visible.map(p=><label key={p.id} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',minHeight:48,borderBottom:'1px solid '+C.border}}>
        <input type="checkbox" checked={selectedSet.has(String(p.id))} onChange={e=>choose(String(p.id),e.target.checked)} aria-label={'Select '+(p.username||p.alias||p.fid)}/>
        <span style={{fontSize:14,minWidth:0}}><strong>{p.username||p.alias||p.fid}</strong><span style={{display:'block',fontSize:12,color:C.icy}}>{p.allianceTag||'No alliance'} · {p.fid||'ID not recorded'}</span></span>
      </label>)}
      {!filtered.length&&<p style={{padding:12,fontSize:13,color:C.icy}}>No matches. Try another name or clear a filter.</p>}
      {filtered.length>8&&<button type="button" style={{...button,width:'100%',textAlign:'center',border:0,color:C.gold}} onClick={()=>setShowAll(v=>!v)}>{showAll?'Show fewer players':'Show all '+filtered.length+' matches'}</button>}
     </div>
     {!!ids.length&&<section style={{borderTop:'1px solid '+C.border,paddingTop:12,display:'grid',gap:10}}>
       <strong style={{fontSize:14,color:C.white}}>2. Choose what to change</strong>
       <label style={{fontSize:12,color:C.icy}}>Update<select style={{...field,marginTop:5}} value={kind} onChange={e=>{setKind(e.target.value);invalidate();}}>
         <option value="language">Communication language</option><option value="teamwork">Works well together</option><option value="availability">Available times</option><option value="registration">Registration status</option>
       </select></label>
       {kind==='language'&&<label style={{fontSize:12,color:C.icy}}>Preferred communication language<select style={{...field,marginTop:6}} value={language} onChange={e=>{setLanguage(e.target.value);invalidate();}}>{LANGUAGES.map(l=><option key={l} value={l}>{l}</option>)}</select><Hint>Game UI language is kept separately.</Hint></label>}
       {kind==='teamwork'&&<Hint>All selected players will be linked as working well with each other. Review the number of relationships before saving.</Hint>}
       {kind==='availability'&&<><label style={{fontSize:12,color:C.icy}}>Change<select style={{...field,marginTop:6}} value={availabilityMode} onChange={e=>{setAvailabilityMode(e.target.value);invalidate();}}>
         <option value="add">Add available times</option><option value="remove">Remove available times</option><option value="replace">Replace all available times</option>
       </select></label>
       <div role="group" aria-label="UTC availability times" style={{display:'flex',flexWrap:'wrap',gap:8}}>{(plan.times||[]).map(t=><label key={t} style={{fontSize:13,color:C.white,display:'flex',alignItems:'center',gap:5,minHeight:40}}><input type="checkbox" checked={times.includes(t)} onChange={e=>{setTimes(old=>e.target.checked?[...old,t]:old.filter(v=>v!==t));invalidate();}}/>{t} UTC</label>)}</div>
       {availabilityMode==='replace'&&<p style={{fontSize:13,color:C.gold}}>This replaces the players' existing available times. Other selected times will be removed.</p>}</>}
       {kind==='registration'&&<label style={{fontSize:12,color:C.icy}}>Mark as<select style={{...field,marginTop:6}} value={registration} onChange={e=>{setRegistration(e.target.value);invalidate();}}>
         <option value="needs">Needs registration</option><option value="pending">Awaiting verification</option><option value="verified">Verified in planning sheet</option><option value="registered">Registered in game (assigned players only)</option><option value="unregistered">Not registered in game (assigned players only)</option>
       </select><Hint>Planning-sheet verification is not the same as registration inside Whiteout Survival.</Hint></label>}
       {locked&&<p style={{fontSize:13,color:C.gold}}>The TAL plan is locked. Unlock it before changing player details.</p>}
       <button type="button" disabled={locked} style={{...button,width:'100%',background:C.gold,color:C.bg}} onClick={review}>Review changes for {ids.length} players</button>
       {preview&&<div role="region" aria-label="Confirm bulk updates" style={{background:C.card,borderRadius:10,padding:12}}>
         <strong style={{fontSize:14,color:C.white}}>3. Confirm changes</strong>
         <p style={{fontSize:13,color:C.white,lineHeight:1.6}}>{preview.summary}</p>
         <p style={{fontSize:12,color:C.icy}}>{preview.players.slice(0,6).map(p=>p.name).join(', ')}{preview.players.length>6?' and '+(preview.players.length-6)+' more':''}</p>
         <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:12}}><button type="button" style={button} onClick={()=>setPreview(null)}>Back</button><button type="button" style={{...button,background:C.gold,color:C.bg}} onClick={apply}>Save changes</button></div>
       </div>}
       {error&&<p role="alert" style={{fontSize:13,color:C.gold}}>{error}</p>}
     </section>}
   </div>}
 </Card>;
}
