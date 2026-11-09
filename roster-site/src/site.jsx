import {withAutomaticRoles} from './tal/autoRoles.js';
import {fetchMightpulseAlliance} from '../../src/services/mightpulseService.js';
import {allianceRows} from '../../src/services/allianceImportService.js';
import {WorkspaceOptions,WorkspaceAttention} from './components/WorkspaceOptions.jsx';
import {plannedMemberIds} from '../../src/services/talRosterService.js';
import {useSharedWorkspace} from './useSharedWorkspace.js';
import {normalizeRankings,rankingProfileUpdates} from '../../src/services/stateRankingsService.js';
import {BottomNav} from './components/BottomNav.jsx';
import {NameChanges} from './components/NameChanges.jsx';
import {mightpulseRequest} from '../../src/services/mightpulseService.js';
import {applyPlayerDetails} from '../../src/services/playerDetailsService.js';
import {useEffect,useRef,useState} from 'react';
import {TalTab} from './tal/TalTab.jsx';
import {newPlan} from './tal/planner.js';
import {AllianceSetup,DEFAULT_ALLIANCES} from './components/AllianceSetup.jsx';
import {QuickTour} from './components/QuickTour.jsx';
import {readPreferences,savePreferences,tapFeedback} from './preferences.js';
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
  const [preferences,setPreferences]=useState(()=>readPreferences());
  function updatePreferences(patch){setPreferences(savePreferences(patch));}
  useEffect(()=>{
    const feedback=event=>{const target=event.target.closest?.('button');if(target&&!target.disabled&&target.getAttribute('aria-disabled')!=='true')tapFeedback(preferences.haptics);};
    document.addEventListener('click',feedback,true);
    return()=>document.removeEventListener('click',feedback,true);
  },[preferences.haptics]);
  const [access,setAccess]=useState('checking'),[password,setPassword]=useState(''),[remember,setRemember]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=>{fetch('/api/session',{credentials:'same-origin'}).then(r=>r.json()).then(data=>{setAccess(data.authenticated?'open':'locked');if(data.error)setError(data.error);}).catch(()=>{setAccess('locked');setError('Unable to check access. Try again.');});const lock=()=>setAccess('locked');window.addEventListener('roster:locked',lock);return()=>window.removeEventListener('roster:locked',lock);},[]);
  async function login(event){event.preventDefault();setBusy(true);setError('');try{const response=await fetch('/api/session',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({password,remember})});const data=await response.json();if(!response.ok)throw new Error(data.error||'Unable to sign in.');setPassword('');setAccess('open');}catch(e){setError(e.message);}finally{setBusy(false);}}
  async function logout(){try{const r=await fetch('/api/session',{method:'DELETE',credentials:'same-origin',headers:{'Content-Type':'application/json'}});if(!r.ok)throw new Error();setAccess('locked');}catch{setError('Unable to sign out. Try again.');}}
  if(access==='checking')return <p style={{padding:24,color:C.icy}}>Checking access…</p>;
  if(access==='open')return <Members onLogout={logout} error={error} preferences={preferences} onPreferencesChange={updatePreferences}/>;
  return <main style={{maxWidth:420,margin:'12vh auto 0',padding:24}}><div style={{color:C.gold,fontSize:14,fontWeight:700}}>STATE 3573</div><h1 style={{fontSize:30,margin:'10px 0'}}>Caroline’s roster</h1><p style={{fontSize:16,color:C.icy,lineHeight:1.6}}>Enter the leader password to open the shared roster.</p><form onSubmit={login}><label htmlFor="password" style={{fontSize:14,color:C.icy}}>Site password</label><input id="password" type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} style={{...button,width:'100%',margin:'8px 0 12px',fontSize:16,color:C.white}}/><label style={{display:'flex',alignItems:'center',gap:10,margin:'4px 0 14px',fontSize:14,color:C.icy,minHeight:44,cursor:'pointer'}}><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)} style={{width:20,height:20,accentColor:C.gold,flexShrink:0}}/><span>Remember me for 30 days</span></label>{error&&<p role="alert" style={{color:C.red}}>{error}</p>}<button disabled={busy} style={{...button,width:'100%',background:C.gold,color:C.bg}}>{busy?'Opening…':'Open roster'}</button></form><p style={{fontSize:13,color:C.icy,lineHeight:1.5,marginTop:20}}>Game lookups use Caroline’s API allowance. Your browser can save your password for autofill. Remember me keeps this device signed in using a secure session. Anyone with the leader password can edit the shared roster.</p></main>;
}
function Members({onLogout,error,preferences,onPreferencesChange}){
  const [tab,setTab]=useState('members');
  const [workspaceOpen,setWorkspaceOpen]=useState(false);
  const [dataActionsOpen,setDataActionsOpen]=useState(false);
  const lastAttention=useRef(null);
  const [initialPlayerId,setInitialPlayerId]=useState(null);
  const [legionRefresh,setLegionRefresh]=useState(null);
  const [refreshingLab,setRefreshingLab]=useState(false);
  const labBusy=useRef(false);
  const refreshing=useRef(false),stopRefresh=useRef(false);
  function navigate(id){setTab(id);window.scrollTo?.({top:0,behavior:'instant'});}
  useEffect(()=>()=>{stopRefresh.current=true;},[]);
  const [tourOpen,setTourOpen]=useState(!preferences.tutorialSeen);
  const [exporting,setExporting]=useState(false);
  const localInitial=useRef(null);if(!localInitial.current)localInitial.current=loadFromStorage(empty);
  const {data,setData:setSharedData,sync,publish,join,retry,resolve}=useSharedWorkspace(localInitial.current);
  function setData(value){setSharedData(prev=>{const next=withAutomaticRoles(typeof value==='function'?value(prev):value);latest.current=next;return next;});}
  useEffect(()=>{if(sync.ready&&sync.joined&&!sync.conflicts?.length){const normalized=withAutomaticRoles(data);if(normalized!==data)setSharedData(normalized);}},[data,sync.ready,sync.joined,sync.conflicts?.length]);
  const [apiProgress,setApiProgress]=useState('');
  const [importing,setImporting]=useState(false),[deleting,setDeleting]=useState(null),[message,setMessage]=useState('');
  const latest=useRef(data);latest.current=data;
  const requiredAction=sync.conflicts?.length?'conflict':['join','unpublished'].includes(sync.mode)?sync.mode:null;
  useEffect(()=>{if(requiredAction&&requiredAction!==lastAttention.current)setWorkspaceOpen(true);else if(!requiredAction&&lastAttention.current)setWorkspaceOpen(false);lastAttention.current=requiredAction;},[requiredAction]);
  const players=data.players||[];
  useEffect(()=>{saveToStorage(data);},[data]);
  useEffect(()=>{const fail=()=>setMessage('Unable to save. Export a backup before closing this page.');window.addEventListener('app:storage-full',fail);return()=>window.removeEventListener('app:storage-full',fail);},[]);
  function save(player){const next=withGameLanguage({...player,profileLastUpdated:new Date().toISOString()});setData(prev=>({...prev,players:prev.players.map(p=>p.id===next.id?next:p)}));setMessage('Player updated');}
  function update(updated){const byId=new Map(updated.map(p=>[p.id,p]));setData(prev=>({...prev,players:prev.players.map(p=>byId.get(p.id)||p)}));}
  function importRoster(rows){
    const result=mergeAllianceProfiles(latest.current.players||[],rows,'3573');
    setData(prev=>({...prev,players:mergeAllianceProfiles(prev.players,rows,'3573').players,settings:{...prev.settings,lastApiRefresh:{at:new Date().toISOString(),scope:'Alliance roster',count:rows.length}}}));return {updated:result.updated.length,added:result.added.length};
  }
  async function syncNow(){setMessage('Syncing shared workspace…');const result=await retry();setMessage(result?.issue?result.issue:result?.conflicts?.length?'Edits need review.':result?.dirty||result?.syncing?'Changes are still syncing.':'Synced. All shared changes are up to date.');}
  async function refreshAll(){
    if(refreshing.current)return;refreshing.current=true;stopRefresh.current=false;let done=0,failed=0,updated=0;
    try{for(const tag of DEFAULT_ALLIANCES){if(stopRefresh.current)break;setApiProgress(`Refreshing [${tag}] · ${done+1}/${DEFAULT_ALLIANCES.length}`);try{const rows=allianceRows(await fetchMightpulseAlliance(3573,tag),'3573',tag);if(!rows.length)throw Error('No roster returned');importRoster(rows);updated+=rows.length;}catch(e){failed++;setMessage(`[${tag}]: ${e.message}`);if([401,403,429].includes(e.status)||[401,403,429].includes(e.providerStatus))break;}done++;}
      setData(prev=>({...prev,settings:{...prev.settings,lastApiRefresh:{at:new Date().toISOString(),scope:'HOT, ARC, RKG, LUN',count:updated,failed,partial:failed>0||done<4}}}));
      setMessage(`API refresh: ${updated} profiles updated${failed?` · ${failed} failed`:''}. Sharing with leaders…`);await retry();
    }finally{refreshing.current=false;setApiProgress('');}
  }
  async function refreshLab(){
    if(labBusy.current)return;labBusy.current=true;setRefreshingLab(true);
    try{
      const response=await mightpulseRequest('rankings',{state:3573,board:'labyrinth',limit:100});
      const result=normalizeRankings(response,'3573','labyrinth');
      const updates=rankingProfileUpdates(latest.current.players,result,'3573');
      setData(prev=>{const byId=new Map(rankingProfileUpdates(prev.players,result,'3573').map(p=>[p.id,p]));return {...prev,players:prev.players.map(p=>byId.get(p.id)||p),settings:{...prev.settings,lastApiRefresh:{at:new Date().toISOString(),scope:'Labyrinth',count:updates.length}}};});
      setMessage(`Labyrinth updated for ${updates.length} players. Only returned leaderboard entries were updated; other saved ranks were kept.`);
      return latest.current.players;
    }catch(e){setMessage(e.message||'Unable to refresh Labyrinth. Try again.');return null;}
    finally{labBusy.current=false;setRefreshingLab(false);}
  }
  async function refreshLegion(team){
    if(refreshing.current)return;
    const ids=[...plannedMemberIds(team)];
    const members=ids.map(id=>latest.current.players.find(p=>p.id===id)).filter(Boolean);
    refreshing.current=true;stopRefresh.current=false;
    let done=0,failed=0,skipped=0,reason='';
    setLegionRefresh({done:0,total:members.length});
    try{
      for(const member of members){
        if(stopRefresh.current)break;
        if(!/^[1-9]\d{3,14}$/.test(String(member.fid||''))){skipped++;done++;setLegionRefresh({done,total:members.length});continue;}
        try{
          const response=await mightpulseRequest('player_details',{state:3573,fid:String(member.fid)});
          const current=latest.current.players.find(p=>p.id===member.id);
          if(current){
            setData(prev=>({...prev,players:prev.players.map(p=>p.id===member.id?applyPlayerDetails(p,response,'3573'):p),settings:{...prev.settings,lastApiRefresh:{at:new Date().toISOString(),scope:`${team.host} Legion ${team.number}`,count:done+1}}}));
          }
        }catch(error){failed++;if([401,403,429].includes(error.status)||[401,403,429].includes(error.providerStatus)){done++;setLegionRefresh({done,total:members.length});reason=error.status===429||error.providerStatus===429?'API limit reached. Try again later.':error.message;break;}}
        done++;setLegionRefresh({done,total:members.length});
      }
      setMessage(`${done-failed-skipped} refreshed${failed?` · ${failed} failed`:''}${skipped?` · ${skipped} need a valid player ID`:''}${stopRefresh.current?' · Stopped':''}. ${reason||'Names and alliance checks updated.'}`);
    }finally{refreshing.current=false;setLegionRefresh(null);}
  }
  async function backup(){
    if(exporting)return;
    setExporting(true);
    try{
      if(tab==='tal'){const {exportTalWorkbook}=await import('./tal/export.js');exportTalWorkbook({...newPlan(),...data.talPlan},players);}
      else{const {exportWorkbook}=await import('../../src/services/exportXlsx.js');exportWorkbook(data,{includeEvents:false,includePlans:false});}
      setMessage('Excel file ready. Check your downloads.');
    }catch{setMessage('Couldn’t download the roster. Try again.');}
    finally{setExporting(false);}
  }
  if(!sync.ready)return <p role="status" style={{padding:24,color:C.icy}}>Opening shared workspace…</p>;
  return <main style={{maxWidth:480,margin:'0 auto',paddingBottom:'calc(140px + env(safe-area-inset-bottom, 0px))'}}>
    <div data-workspace-content="" inert={workspaceOpen?'':undefined} aria-hidden={workspaceOpen?'true':undefined}>
    <header style={{padding:'14px 20px',borderBottom:`1px solid ${C.border}`}}><div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10}}><div><h1 style={{fontSize:22,margin:0}}>3573 · Caroline</h1><p style={{fontSize:14,color:C.icy,margin:'5px 0 0'}}>{tab==='tal'?'TAL planner':tab==='changes'?'Name changes':`Members · ${players.length} players`}</p></div><button style={{...button,minWidth:44,padding:10}} aria-label="Workspace options" title="Workspace" onClick={()=>setWorkspaceOpen(true)}><svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg></button></div><div style={{display:'flex',alignItems:'center',gap:8,marginTop:10,flexWrap:'wrap'}}><button style={{...button,minHeight:40,flex:1,padding:'8px 10px',color:C.gold}} onClick={refreshAll} aria-busy={!!apiProgress||!!legionRefresh} disabled={!!apiProgress||!!legionRefresh||sync.mode==='join'||!!sync.conflicts?.length}>{apiProgress?'Refreshing API…':'↻ Refresh roster'}</button><button style={{...button,minHeight:40,padding:'8px 10px',fontSize:13}} aria-expanded={dataActionsOpen} onClick={()=>setDataActionsOpen(v=>!v)}>Data actions {dataActionsOpen?'▴':'▾'}</button></div><div role="status" style={{fontSize:12,color:sync.issue?C.gold:C.icy,marginTop:7,lineHeight:1.4}}>{sync.syncing?'Syncing shared changes…':sync.issue?'Sync needs attention':sync.dirty?'Changes waiting to sync':sync.checkedAt?`Synced ${new Date(sync.checkedAt).toISOString().slice(11,16)} UTC`:'Shared workspace'}</div>{dataActionsOpen&&<div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center',marginTop:10}}><button style={{...button,minHeight:40,padding:'8px 10px',fontSize:13}} disabled={sync.syncing||sync.mode==='join'||!!sync.conflicts?.length} aria-busy={!!sync.syncing} onClick={syncNow}>{sync.syncing?'Syncing…':sync.issue?'Retry sync':sync.dirty?'Sync changes':'Sync now'}</button><button style={{...button,minHeight:40,padding:'8px 10px',fontSize:13}} onClick={backup} disabled={exporting}>{exporting?'Exporting…':tab==='tal'?'Export TAL Excel':'Export roster Excel'}</button>{data.settings?.lastApiRefresh&&<span style={{fontSize:12,color:C.icy}}>API updated {new Date(data.settings.lastApiRefresh.at).toISOString().slice(0,16).replace('T',' ')} UTC{data.settings.lastApiRefresh.partial?' · Partial':''}</span>}</div>}{error&&<p role="alert" style={{color:C.red}}>{error}</p>}</header>
    <WorkspaceAttention sync={sync} onReview={()=>setWorkspaceOpen(true)}/>
    {message&&<div role="status" style={{margin:'12px 20px 0',padding:10,color:C.icy,background:C.section,borderRadius:10,display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>{message}<button style={button} onClick={()=>setMessage('')} aria-label="Dismiss message">✕</button></div>}
    <BottomNav tab={tab} onChange={navigate}/>
    {apiProgress&&<div role="status" style={{padding:'12px 20px',fontSize:14,color:C.icy}}>{apiProgress}<button style={button} onClick={()=>{stopRefresh.current=true;}}>Stop after this alliance</button></div>}
    {legionRefresh&&<div role="status" style={{padding:'12px 20px',color:C.icy}}>Refreshing players: {legionRefresh.done} of {legionRefresh.total}<button style={{...button,marginLeft:8}} onClick={()=>{stopRefresh.current=true;}}>Stop after this player</button></div>}
    {sync.mode!=='join'&&!sync.conflicts?.length&&<div>
    {tab==='members'&&!DEFAULT_ALLIANCES.every(tag=>players.some(p=>p.allianceTag===tag))&&<AllianceSetup players={players} onLoad={importRoster}/>}
    {tab==='members'&&players.length>0&&<RosterTab initialPlayerId={initialPlayerId} onInitialPlayerOpened={()=>setInitialPlayerId(null)} players={players} events={data.events||[]} roles={withBuiltinRole(data.customRoles||[])} onSaveCustomRoles={customRoles=>setData(prev=>({...prev,customRoles}))} onSavePlayer={save} onUpdatePlayers={update} onDeletePlayer={setDeleting} onLoadAlliance={()=>setImporting(true)} showToast={setMessage}/>}
    {tab==='changes'&&<NameChanges players={players} plan={data.talPlan||newPlan()} onOpen={id=>{setInitialPlayerId(id);navigate('members');}}/>}
    {tab==='tal'&&<TalTab value={data.talPlan} players={players} onRefreshLegion={refreshLegion} legionRefresh={legionRefresh} onMessage={setMessage}/>}
    </div>}
    </div>
    {workspaceOpen&&<WorkspaceOptions sync={sync} data={data} onPublish={publish} onJoin={join} onRetry={syncNow} onResolve={resolve} onClose={()=>setWorkspaceOpen(false)} onLogout={onLogout} onAlliance={()=>{setWorkspaceOpen(false);setImporting(true);}} onHelp={()=>{setWorkspaceOpen(false);setTourOpen(true);}}/>}
    {tourOpen&&!workspaceOpen&&<QuickTour haptics={preferences.haptics} onHapticsChange={haptics=>onPreferencesChange({haptics})} onClose={()=>{onPreferencesChange({tutorialSeen:true});setTourOpen(false);}}/>}
    {importing&&<AllianceImportPanel stateId="3573" players={players} onImport={importRoster} onClose={()=>setImporting(false)}/>}
    {deleting&&<DeleteConfirmModal message="Remove this player from the roster? Their game account is unaffected." onCancel={()=>setDeleting(null)} onConfirm={()=>{setData(prev=>({...prev,players:prev.players.filter(p=>p.id!==deleting)}));setDeleting(null);}}/>}
  </main>;
}
