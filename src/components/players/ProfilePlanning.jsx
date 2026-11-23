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
export function ProfileNotes({player,onSave,onGuardedSaveNotes}) {
  const [draft,setDraft]=useState(null);
  const [saving,setSaving]=useState(false);
  const [saveError,setSaveError]=useState('');
  const [originalNotes,setOriginalNotes]=useState(null);
  async function saveNotes(event){
    event.preventDefault();if(saving)return;
    setSaving(true);setSaveError('');
    try{
      const result=onGuardedSaveNotes
        ? await onGuardedSaveNotes(player,draft,originalNotes)
        : await onSave({...player,notes:draft,profileLastUpdated:new Date().toISOString()});
      if(!result?.persisted){setSaveError(result?.reason||'Cloud persistence was not confirmed. The change may exist on this device only.');return;}
      setDraft(null);setOriginalNotes(null);
    }catch(error){setSaveError(error?.message||'Unable to confirm cloud save');}
    finally{setSaving(false);}
  }
  return <ProfileSection title="Officer notes" action={draft===null?<button style={profileButton} onClick={()=>{setOriginalNotes(player.notes??null);setDraft(player.notes||'');}}>Edit</button>:null}>
    {draft===null?<p style={{fontSize:14,color:C.icy,lineHeight:1.6,whiteSpace:'pre-wrap',margin:0}}>{player.notes||'No notes yet.'}</p>:<form onSubmit={saveNotes}>
      <textarea autoFocus aria-label="Officer notes" value={draft} onChange={event=>setDraft(event.target.value)} style={{...profileButton,width:'100%',minHeight:100,boxSizing:'border-box',fontSize:16,fontFamily:'inherit',resize:'vertical',color:C.white,cursor:'text'}}/>
      {saveError&&<p role="alert" style={{fontSize:13,color:C.red}}>{saveError}</p>}
      <div style={{display:'flex',gap:8,marginTop:10}}><button type="button" style={{...profileButton,flex:1}} disabled={saving} onClick={()=>{setDraft(null);setOriginalNotes(null);}}>Cancel</button><button style={{...profileButton,flex:1,background:C.gold,color:C.bg}} type="submit" disabled={saving}>{saving?'Saving…':'Save notes'}</button></div>
    </form>}
  </ProfileSection>;
}
