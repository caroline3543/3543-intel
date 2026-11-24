import {pastPlayerNames} from '../../services/playerNames.js';
import {CopyPlayerId} from './CopyPlayerId.jsx';
import { useState } from 'react';
import { C, LANGUAGES } from '../../utils/constants.js';
import { gameLanguageName, providerField } from '../../services/gameLanguageService.js';
import { PencilIcon, ProfileSection, ProfileRow, profileButton, profileCard } from './ProfileParts.jsx';
export function ProfileIdentity({player,onSave,softDark=false}) {
  const [draft,setDraft]=useState(null);
  const [message,setMessage]=useState('');
  const [languageSearch,setLanguageSearch]=useState('');
  const gameLanguage=gameLanguageName(providerField(player,'language')||player.gameLanguage);
  function start(){setMessage('');setDraft({username:player.username||'',alias:player.alias||'',country:player.country||'',languages:[...(player.languages||[])]});}
  function save(event){
    event.preventDefault();
    const username=draft.username.trim();
    if(!username)return;
    const at=new Date().toISOString();
    const history=pastPlayerNames({...player,username,pastUsernames:[...pastPlayerNames(player),player.username]});
    onSave({...player,username,alias:draft.alias.trim(),country:draft.country.trim(),languages:[...new Set(draft.languages.map(v=>v.trim()).filter(Boolean))],pastUsernames:history,profileLastUpdated:at});
    setDraft(null);setMessage('Identity saved');
  }
  if(softDark&&!draft)return <ProfileSection title="Identity" action={onSave&&<button type="button" className="soft-profile-edit" aria-label="Edit identity" onClick={start}>Edit</button>}>
    <ProfileRow label="Username" value={player.username||'Not recorded'}/>
    <ProfileRow label="Nickname" value={player.alias}/>
    <ProfileRow label="Past names" value={pastPlayerNames(player).join(', ')}/>
    <ProfileRow label="Country" value={player.country||'Not recorded'}/>
    <ProfileRow label="Game language" value={gameLanguage||'Not recorded'}/>
    <ProfileRow label="Languages" value={player.languages?.join(', ')||'Not recorded'}/>
    {message&&<p role="status" className="soft-profile-muted">{message}</p>}
  </ProfileSection>;
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
    <div style={{position:'sticky',top:0,zIndex:4,background:C.card,padding:'8px 0 12px',display:'flex',gap:8,borderBottom:`1px solid ${C.border}`,marginBottom:12}}><button type="button" style={{...profileButton,flex:1}} onClick={()=>setDraft(null)}>Cancel</button><button type="submit" disabled={!draft.username.trim()} style={{...profileButton,flex:1,background:C.gold,color:C.bg}}>Save</button></div>
    {[['username','Username'],['alias','Nickname'],['country','Country']].map(([key,label])=><label key={key} style={{display:'grid',gap:6,marginBottom:14,color:C.icy,fontSize:14}}>{label}<input autoFocus={key==='username'} required={key==='username'} value={draft[key]} onChange={event=>setDraft({...draft,[key]:event.target.value})} style={{...profileButton,width:'100%',fontSize:16,fontWeight:400,boxSizing:'border-box',color:C.white,cursor:'text'}}/></label>)}
    <div style={{marginBottom:16}}><div style={{fontSize:14,color:C.icy,marginBottom:8}}>Languages spoken · {draft.languages.length} selected</div><div style={{display:'flex',flexWrap:'wrap',gap:7,marginBottom:10}}>{draft.languages.map(lang=><button type="button" key={lang} aria-label={'Remove '+lang} onClick={()=>setDraft({...draft,languages:draft.languages.filter(v=>v!==lang)})} style={{...profileButton,minHeight:35,background:'#244535',color:'#B5F0C8'}}>{lang} ×</button>)}</div><input aria-label="Search languages" placeholder="Search or add a language" value={languageSearch} onChange={e=>setLanguageSearch(e.target.value)} style={{...profileButton,width:'100%',boxSizing:'border-box',fontSize:16,marginBottom:8}}/><div style={{display:'grid',gap:5,maxHeight:200,overflowY:'auto'}}>{[...new Set([...LANGUAGES,...draft.languages,...(languageSearch.trim()&&!LANGUAGES.some(l=>l.toLowerCase()===languageSearch.trim().toLowerCase())?[languageSearch.trim()]:[])])].filter(l=>l.toLowerCase().includes(languageSearch.toLowerCase())).slice(0,languageSearch?12:8).map(lang=><button type="button" key={lang} aria-pressed={draft.languages.includes(lang)} onClick={()=>setDraft({...draft,languages:draft.languages.includes(lang)?draft.languages.filter(v=>v!==lang):[...draft.languages,lang]})} style={{...profileButton,textAlign:'left',display:'flex',justifyContent:'space-between',background:draft.languages.includes(lang)?'#244535':C.section,borderColor:draft.languages.includes(lang)?'#6DD29B':C.border}}><span>{lang}</span><span aria-hidden="true" style={{color:draft.languages.includes(lang)?'#6DD29B':C.icy}}>{draft.languages.includes(lang)?'✓':'○'}</span></button>)}</div></div>
    {!softDark&&<ProfileRow label="Player ID" value={player.fid||'Unknown'}/>}<ProfileRow label="Game language" value={gameLanguage||'Unknown'}/>
    <p style={{color:C.icy,fontSize:13,lineHeight:1.5}}>Player ID and game language come from game data. Refreshes may update the username.</p>

  </form></ProfileSection>;
}
