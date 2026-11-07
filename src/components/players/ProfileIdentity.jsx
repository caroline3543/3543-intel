import {pastPlayerNames} from '../../services/playerNames.js';
import {CopyPlayerId} from './CopyPlayerId.jsx';
import { useState } from 'react';
import { C } from '../../utils/constants.js';
import { gameLanguageName, providerField } from '../../services/gameLanguageService.js';
import { PencilIcon, ProfileSection, ProfileRow, profileButton, profileCard } from './ProfileParts.jsx';
export function ProfileIdentity({player,onSave}) {
  const [draft,setDraft]=useState(null);
  const [message,setMessage]=useState('');
  const gameLanguage=gameLanguageName(providerField(player,'language')||player.gameLanguage);
  function start(){setMessage('');setDraft({username:player.username||'',alias:player.alias||'',country:player.country||'',languages:(player.languages||[]).join(', ')});}
  function save(event){
    event.preventDefault();
    const username=draft.username.trim();
    if(!username)return;
    const at=new Date().toISOString();
    const history=pastPlayerNames({...player,username,pastUsernames:[...pastPlayerNames(player),player.username]});
    onSave({...player,username,alias:draft.alias.trim(),country:draft.country.trim(),languages:[...new Set(draft.languages.split(',').map(v=>v.trim()).filter(Boolean))],pastUsernames:history,profileLastUpdated:at});
    setDraft(null);setMessage('Identity saved');
  }
  if(!draft)return <section style={profileCard}>
    <button onClick={start} aria-label="Edit identity" style={{width:'100%',background:'none',border:0,padding:0,color:C.white,textAlign:'left',cursor:'pointer',fontFamily:'inherit'}}>
      <span style={{display:'flex',justifyContent:'space-between',alignItems:'center',minHeight:44,marginBottom:8}}><span style={{fontSize:16,fontWeight:700}}>Identity</span><span style={{...profileButton,display:'flex',alignItems:'center',justifyContent:'center',boxSizing:'border-box',color:C.icy}}><PencilIcon/></span></span>
      <ProfileRow label="Username" value={player.username||'Unknown'}/><ProfileRow label="Nickname" value={player.alias}/><ProfileRow label="Past names" value={pastPlayerNames(player).join(', ')}/><ProfileRow label="Country" value={player.country||'Not recorded'}/><ProfileRow label="Game language" value={gameLanguage||'Unknown'}/><ProfileRow label="Languages" value={player.languages?.join(', ')||'Not recorded'}/>
    </button>
    <CopyPlayerId fid={player.fid}/>
    {pastPlayerNames(player).length>0&&<p style={{fontSize:13,color:C.icy,marginBottom:0}}>You can search by past names.</p>}
    {message&&<p role="status" style={{fontSize:14,color:C.green,marginBottom:0}}>{message}</p>}
  </section>;
  return <ProfileSection title="Edit identity"><form onSubmit={save}>
    {[['username','Username'],['alias','Nickname'],['country','Country'],['languages','Languages']].map(([key,label])=><label key={key} style={{display:'grid',gap:6,marginBottom:14,color:C.icy,fontSize:14}}>{label}<input autoFocus={key==='username'} required={key==='username'} value={draft[key]} onChange={event=>setDraft({...draft,[key]:event.target.value})} style={{...profileButton,width:'100%',fontSize:16,fontWeight:400,boxSizing:'border-box',color:C.white,cursor:'text'}}/>{key==='languages'&&<span style={{fontSize:13}}>Separate languages with commas.</span>}</label>)}
    <ProfileRow label="Player ID" value={player.fid||'Unknown'}/><ProfileRow label="Game language" value={gameLanguage||'Unknown'}/>
    <p style={{color:C.icy,fontSize:13,lineHeight:1.5}}>Player ID and game language come from game data. Refreshes may update the username.</p>
    <div style={{display:'flex',gap:8}}><button type="button" style={{...profileButton,flex:1}} onClick={()=>setDraft(null)}>Cancel</button><button type="submit" disabled={!draft.username.trim()} style={{...profileButton,flex:1,background:C.gold,color:C.bg}}>Save</button></div>
  </form></ProfileSection>;
}
