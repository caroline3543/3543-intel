import { useState } from 'react';
import { C } from '../../utils/constants.js';
import { ProfileSection, profileButton } from './ProfileParts.jsx';
export function ProfileRoles({player,roles,onSave}) {
  const [editing,setEditing]=useState(false);
  const values=player.roles||[];
  const options=[...new Set(['Rally Lead',...roles.map(role=>role.name),...values])];
  const label=role=>role==='Rally Lead'?'Rally leader':role;
  function toggle(role){onSave({...player,roles:values.includes(role)?values.filter(value=>value!==role):[...values,role],profileLastUpdated:new Date().toISOString()});}
  return <ProfileSection title="Battle roles" action={<button style={profileButton} aria-expanded={editing} onClick={()=>setEditing(!editing)}>{editing?'Done':'Edit'}</button>}>
    {editing?<div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{options.map(role=><button key={role} aria-pressed={values.includes(role)} style={{...profileButton,color:values.includes(role)?C.gold:C.icy,borderColor:values.includes(role)?C.gold:C.border}} onClick={()=>toggle(role)}>{label(role)}</button>)}</div>:<div style={{fontSize:14,color:C.icy,lineHeight:1.5}}>{values.length?values.map(label).join(' · '):'Joiner'}</div>}
    {editing&&<p style={{fontSize:13,color:C.icy,marginBottom:0}}>Changes save as you tap. Players without a rally leader role can join rallies.</p>}
  </ProfileSection>;
}
export function ProfileNotes({player,onSave}) {
  const [draft,setDraft]=useState(null);
  return <ProfileSection title="Officer notes" action={draft===null?<button style={profileButton} onClick={()=>setDraft(player.notes||'')}>Edit</button>:null}>
    {draft===null?<p style={{fontSize:14,color:C.icy,lineHeight:1.6,whiteSpace:'pre-wrap',margin:0}}>{player.notes||'No notes yet.'}</p>:<form onSubmit={event=>{event.preventDefault();onSave({...player,notes:draft,profileLastUpdated:new Date().toISOString()});setDraft(null);}}>
      <textarea autoFocus aria-label="Officer notes" value={draft} onChange={event=>setDraft(event.target.value)} style={{...profileButton,width:'100%',minHeight:100,boxSizing:'border-box',fontSize:16,fontFamily:'inherit',resize:'vertical',color:C.white,cursor:'text'}}/>
      <div style={{display:'flex',gap:8,marginTop:10}}><button type="button" style={{...profileButton,flex:1}} onClick={()=>setDraft(null)}>Cancel</button><button style={{...profileButton,flex:1,background:C.gold,color:C.bg}} type="submit">Save notes</button></div>
    </form>}
  </ProfileSection>;
}
