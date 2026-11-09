import {useState} from 'react';
import {C,LANGUAGES} from '../../utils/constants.js';
import {ProfileSection,profileButton} from './ProfileParts.jsx';
import {normaliseRallyPreferences} from '../../services/talTeamPreferences.js';

const traits=[['priority','Priority joiner'],['reliable','Reliable'],['strategy','Understands strategy'],['voice','Voice chat'],['punctual','On time']];
const pairKey=(a,b)=>[String(a),String(b)].sort().join(':');
export function ProfileTeamwork({player,players=[],preferences={},onSavePreferences,onSavePlayer}){
 const [partner,setPartner]=useState('');
 const values=preferences.players?.[String(player.id)]||{};
 const pairs=(preferences.pairs||[]).filter(([a,b])=>String(a)===String(player.id)||String(b)===String(player.id));
 const options=players.filter(p=>p.id!==player.id).sort((a,b)=>(a.username||a.alias||'').localeCompare(b.username||b.alias||''));
 const name=id=>players.find(p=>String(p.id)===String(id))?.username||String(id);
 function save(next){onSavePreferences?.(normaliseRallyPreferences(next));}
 function trait(key,checked){save({...preferences,players:{...preferences.players,[String(player.id)]:{...values,[key]:checked}}});}
 function addPair(){if(!partner||String(partner)===String(player.id))return;
   const a=String(player.id),b=String(partner);
   if(!(preferences.pairs||[]).some(([x,y])=>pairKey(x,y)===pairKey(a,b)))save({...preferences,pairs:[...(preferences.pairs||[]),[a,b]]});
   setPartner('');
 }
 function removePair(a,b){save({...preferences,pairs:(preferences.pairs||[]).filter(([x,y])=>pairKey(x,y)!==pairKey(a,b))});}
 return <ProfileSection title="TAL teamwork">
   <p style={{fontSize:13,color:C.icy,lineHeight:1.5}}>Officer-recorded preferences, shared across TAL battles. Not an automatic assessment of the player.</p>
   <label style={{fontSize:13,color:C.icy,display:'block',margin:'10px 0 14px'}}>Voice communication language
     <select aria-label="Preferred voice communication language" value={player.communicationLanguage||''}
       onChange={e=>onSavePlayer?.({...player,communicationLanguage:e.target.value,profileLastUpdated:new Date().toISOString()})}
       style={{...profileButton,width:'100%',marginTop:6}}>
       <option value="">Not specified (use spreadsheet or game language)</option>
       {LANGUAGES.map(lang=><option key={lang} value={lang}>{lang}</option>)}
     </select>
     <span style={{display:'block',fontSize:12,marginTop:5}}>Spreadsheet language: {player.sheetLanguage||'Not recorded'} · Game UI language: {player.gameLanguage||'Not recorded'}. Neither confirms spoken fluency.</span>
   </label>
   {traits.map(([key,title])=><label key={key} style={{display:'flex',gap:10,alignItems:'center',minHeight:44,fontSize:14,color:C.white}}>
     <input type="checkbox" checked={values[key]===true} onChange={e=>trait(key,e.target.checked)}/>{title}
   </label>)}
   <p style={{fontSize:13,color:C.icy,margin:'12px 0 6px'}}>Works well with</p>
   {pairs.map(([a,b])=><div key={pairKey(a,b)} style={{display:'flex',gap:8,justifyContent:'space-between',alignItems:'center',minHeight:40}}>
     <span style={{fontSize:13,color:C.white}}>{name(String(a)===String(player.id)?b:a)}</span>
     <button type="button" style={profileButton} onClick={()=>removePair(a,b)}>Remove</button>
   </div>)}
   <div style={{display:'grid',gridTemplateColumns:'1fr auto',gap:8}}>
     <select aria-label="Add a player who works well with this player" style={{...profileButton,width:'100%',minWidth:0}} value={partner} onChange={e=>setPartner(e.target.value)}>
       <option value="">Choose player</option>{options.map(p=><option key={p.id} value={String(p.id)}>{p.username||p.alias||p.fid||p.id}</option>)}
     </select>
     <button type="button" style={profileButton} disabled={!partner} onClick={addPair}>Add</button>
   </div>
 </ProfileSection>;
}
