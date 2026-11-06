import {useEffect,useState} from 'react';
import {C} from '../../src/utils/constants.js';
import {RosterTab} from '../../src/components/players/RosterTab.jsx';
import {AllianceImportPanel} from '../../src/components/workspaces/AllianceImportPanel.jsx';
import {DeleteConfirmModal} from '../../src/components/common/DeleteConfirmModal.jsx';
import {loadFromStorage,saveToStorage} from '../../src/services/exportImportService.js';
import {mergeAllianceProfiles} from '../../src/services/allianceImportService.js';
import {withBuiltinRole} from '../../src/utils/roles.js';
import {withGameLanguage} from '../../src/services/gameLanguageService.js';
const button={minHeight:44,padding:'10px 14px',fontSize:14,fontWeight:600,borderRadius:10,border:`1px solid ${C.border}`,background:C.section,color:C.icy,cursor:'pointer'};
const empty={players:[],events:[],customRoles:[],settings:{stateId:'3573'}};
export function SiteApp(){
  const [access,setAccess]=useState('checking'),[password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=>{fetch('/api/session',{credentials:'same-origin'}).then(r=>r.json()).then(data=>{setAccess(data.authenticated?'open':'locked');if(data.error)setError(data.error);}).catch(()=>{setAccess('locked');setError('Unable to check access. Try again.');});const lock=()=>setAccess('locked');window.addEventListener('roster:locked',lock);return()=>window.removeEventListener('roster:locked',lock);},[]);
  async function login(event){event.preventDefault();setBusy(true);setError('');try{const response=await fetch('/api/session',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});const data=await response.json();if(!response.ok)throw new Error(data.error||'Unable to sign in.');setPassword('');setAccess('open');}catch(e){setError(e.message);}finally{setBusy(false);}}
  async function logout(){try{const r=await fetch('/api/session',{method:'DELETE',credentials:'same-origin',headers:{'Content-Type':'application/json'}});if(!r.ok)throw new Error();setAccess('locked');}catch{setError('Unable to sign out. Try again.');}}
  if(access==='checking')return <p style={{padding:24,color:C.icy}}>Checking access…</p>;
  if(access==='open')return <Members onLogout={logout} error={error}/>;
  return <main style={{maxWidth:420,margin:'12vh auto 0',padding:24}}><div style={{color:C.gold,fontSize:14,fontWeight:700}}>STATE 3573</div><h1 style={{fontSize:30,margin:'10px 0'}}>Caroline’s roster</h1><p style={{fontSize:16,color:C.icy,lineHeight:1.6}}>Enter the shared password to manage members and refresh game data.</p><form onSubmit={login}><label htmlFor="password" style={{fontSize:14,color:C.icy}}>Site password</label><input id="password" type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} style={{...button,width:'100%',margin:'8px 0 12px',fontSize:16,color:C.white}}/>{error&&<p role="alert" style={{color:C.red}}>{error}</p>}<button disabled={busy} style={{...button,width:'100%',background:C.gold,color:C.bg}}>{busy?'Opening…':'Open roster'}</button></form><p style={{fontSize:13,color:C.icy,lineHeight:1.5,marginTop:20}}>No officer account is needed. Game lookups use Caroline’s API allowance.</p></main>;
}
function Members({onLogout,error}){
  const [data,setData]=useState(()=>loadFromStorage(empty)),[importing,setImporting]=useState(false),[deleting,setDeleting]=useState(null),[message,setMessage]=useState('');
  const players=data.players||[];
  useEffect(()=>{saveToStorage(data);},[data]);
  useEffect(()=>{const fail=()=>setMessage('Unable to save. Export a backup before closing this page.');window.addEventListener('app:storage-full',fail);return()=>window.removeEventListener('app:storage-full',fail);},[]);
  function save(player){const next=withGameLanguage({...player,profileLastUpdated:new Date().toISOString()});setData(prev=>({...prev,players:prev.players.map(p=>p.id===next.id?next:p)}));setMessage('Player saved');}
  function update(updated){const byId=new Map(updated.map(p=>[p.id,p]));setData(prev=>({...prev,players:prev.players.map(p=>byId.get(p.id)||p)}));}
  function importRoster(rows){const result=mergeAllianceProfiles(players,rows,'3573');setData(prev=>({...prev,players:result.players}));return {updated:result.updated.length,added:result.added.length};}
  function backup(){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='3573-caroline-roster.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  return <main style={{maxWidth:480,margin:'0 auto',paddingBottom:24}}>
    <header style={{padding:20,borderBottom:`1px solid ${C.border}`}}><div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10}}><div><h1 style={{fontSize:22,margin:0}}>3573 · Caroline</h1><p style={{fontSize:14,color:C.icy,margin:'5px 0 0'}}>Members · {players.length} players</p></div><button style={button} onClick={onLogout}>Sign out</button></div><div style={{display:'flex',gap:8,marginTop:14}}><button style={{...button,flex:1,color:C.gold}} onClick={()=>setImporting(true)}>{players.length?'Load or refresh alliance':'Load alliance'}</button><button style={button} onClick={backup}>Backup</button></div><p style={{fontSize:13,color:C.icy,marginBottom:0}}>Roster edits are saved on this device.</p>{error&&<p role="alert" style={{color:C.red}}>{error}</p>}</header>
    {message&&<div role="status" style={{margin:'12px 20px 0',padding:10,color:C.icy,background:C.section,borderRadius:10,display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>{message}<button style={button} onClick={()=>setMessage('')} aria-label="Dismiss message">✕</button></div>}
    <RosterTab players={players} events={data.events||[]} roles={withBuiltinRole(data.customRoles||[])} onSaveCustomRoles={customRoles=>setData(prev=>({...prev,customRoles}))} onSavePlayer={save} onUpdatePlayers={update} onDeletePlayer={setDeleting} onLoadAlliance={()=>setImporting(true)} showToast={setMessage}/>
    {importing&&<AllianceImportPanel stateId="3573" players={players} onImport={importRoster} onClose={()=>setImporting(false)}/>}
    {deleting&&<DeleteConfirmModal message="Remove this player from this device’s roster? Their game account is unaffected." onCancel={()=>setDeleting(null)} onConfirm={()=>{setData(prev=>({...prev,players:prev.players.filter(p=>p.id!==deleting)}));setDeleting(null);}}/>}
  </main>;
}
