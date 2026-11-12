import {applyTalBulk} from './tal/bulkActions.js';
import {applyTalSheetSnapshot} from './tal/sheetSync.js';
import {BattlePlanner} from './battle/BattlePlanner.jsx';
import {SvsComparison} from './svs/SvsComparison.jsx';
import {applyBattleAction} from './battle/model.js';
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
  const pendingTalSync=useRef({active:false,sawDirty:false});
  useEffect(()=>{
   const p=pendingTalSync.current;
   if(!p.active)return;
   if(sync.dirty)p.sawDirty=true;
   if(sync.issue||sync.conflicts?.length){
    setMessage('TAL changes saved on this device. Sync needs attention; use Review to resolve it.');
   }else if(p.sawDirty&&!sync.dirty&&!sync.syncing&&sync.joined&&sync.mode==='active'){
    p.active=false;
    setMessage('TAL changes synced to the shared workspace.');
   }
  },[sync.dirty,sync.syncing,sync.issue,sync.conflicts?.length,sync.joined,sync.mode]);
  function saveTalPlan(talPlan){
   pendingTalSync.current={active:true,sawDirty:false};
   setData(prev=>({...prev,talPlan:{...talPlan,autoRoles:false}}));
   setMessage('TAL changes saved on this device · syncing to the shared workspace…');
  }
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
    {tab==='members'?<header style={{padding:'13px 16px 8px'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10}}>
        <div style={{minWidth:0}}><h1 style={{margin:0,fontSize:19,letterSpacing:'-.025em',fontWeight:750}}>3573 · Caroline</h1><p style={{margin:'3px 0 0',fontSize:12,color:C.icy}}>{players.length} players</p></div>
        <div style={{display:'flex',alignItems:'center',gap:7}}>
          <button aria-label="Workspace sync status and details" title="Workspace sync details" onClick={()=>setWorkspaceOpen(true)} style={{background:'transparent',border:0,color:sync.issue?C.gold:C.icy,minHeight:44,padding:'5px 2px',fontSize:12,display:'flex',alignItems:'center',gap:5}}>
            <span aria-hidden="true" style={{display:'inline-block',width:7,height:7,borderRadius:'50%',background:sync.issue?C.gold:sync.syncing?'#E6BF7B':sync.dirty?'#E6BF7B':'#72CBA9'}}/>
            {sync.issue?'Sync issue':sync.syncing?'Syncing':sync.dirty?'Unsynced':'Shared'}
          </button>
          <details style={{position:'relative'}}><summary aria-label="More workspace actions" style={{listStyle:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',minHeight:44,minWidth:44,borderRadius:10,background:C.section,color:C.icy,fontSize:22}}>⋯</summary>
            <div style={{position:'absolute',right:0,top:48,zIndex:85,width:235,display:'grid',gap:7,padding:12,background:'#14263A',border:'1px solid '+C.border,borderRadius:13,boxShadow:'0 12px 32px #0009'}}>
              <strong style={{fontSize:13,marginBottom:2}}>Workspace actions</strong>
              <button style={button} onClick={refreshAll} disabled={!!apiProgress||!!legionRefresh||sync.mode==='join'||!!sync.conflicts?.length}>{apiProgress?'Refreshing API…':'Refresh API'}</button>
              <button style={button} disabled={exporting} onClick={backup}>{exporting?'Exporting…':'Export roster as Excel'}</button>
              <button style={button} disabled={sync.syncing||sync.mode==='join'||!!sync.conflicts?.length} onClick={syncNow}>{sync.syncing?'Syncing…':sync.issue?'Retry sync':sync.dirty?'Sync changes':'Check sync'}</button>
              <button style={button} onClick={()=>setWorkspaceOpen(true)}>Workspace settings</button>
              {data.settings?.lastApiRefresh&&<span style={{fontSize:11,color:C.icy,lineHeight:1.4}}>API updated {new Date(data.settings.lastApiRefresh.at).toISOString().slice(0,16).replace('T',' ')} UTC</span>}
            </div>
          </details>
        </div>
      </div>
      {error&&<p role="alert" style={{fontSize:12,color:C.red,margin:'8px 0 0'}}>{error}</p>}
    </header>:<header style={{padding:'13px 16px 8px'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10}}>
        <div style={{minWidth:0}}><h1 style={{margin:0,fontSize:19,letterSpacing:'-.025em',fontWeight:750}}>3573 · Caroline</h1><p style={{margin:'3px 0 0',fontSize:12,color:C.icy}}>{tab==='tal'?'TAL Planner':tab==='teams'?'Teams':tab==='changes'?'Name Changes':tab==='battle'?'Battle planner':'SvS comparison'}</p></div>
        <div style={{display:'flex',alignItems:'center',gap:7}}>
          <button aria-label="Workspace sync status and details" title="Workspace sync details" onClick={()=>setWorkspaceOpen(true)} style={{background:'transparent',border:0,color:sync.issue?C.gold:C.icy,minHeight:44,padding:'5px 2px',fontSize:12,display:'flex',alignItems:'center',gap:5}}>
            <span aria-hidden="true" style={{display:'inline-block',width:7,height:7,borderRadius:'50%',background:sync.issue?C.gold:sync.syncing?'#E6BF7B':sync.dirty?'#E6BF7B':'#72CBA9'}}/>
            {sync.issue?'Sync issue':sync.syncing?'Syncing':sync.dirty?'Unsynced':'Shared'}
          </button>
          <details style={{position:'relative'}}><summary aria-label="More workspace actions" style={{listStyle:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',minHeight:44,minWidth:44,borderRadius:10,background:C.section,color:C.icy,fontSize:22}}>⋯</summary>
            <div style={{position:'absolute',right:0,top:48,zIndex:85,width:235,display:'grid',gap:7,padding:12,background:'#14263A',border:'1px solid '+C.border,borderRadius:13,boxShadow:'0 12px 32px #0009'}}>
              <strong style={{fontSize:13,marginBottom:2}}>Workspace actions</strong>
              <button style={button} onClick={refreshAll} disabled={!!apiProgress||!!legionRefresh||sync.mode==='join'||!!sync.conflicts?.length}>{apiProgress?'Refreshing API…':'Refresh API'}</button>
              <button style={button} disabled={exporting} onClick={backup}>{exporting?'Exporting…':'Export roster as Excel'}</button>
              <button style={button} disabled={sync.syncing||sync.mode==='join'||!!sync.conflicts?.length} onClick={syncNow}>{sync.syncing?'Syncing…':sync.issue?'Retry sync':sync.dirty?'Sync changes':'Check sync'}</button>
              <button style={button} onClick={()=>setWorkspaceOpen(true)}>Workspace settings</button>
            </div>
          </details>
        </div>
      </div>
      {error&&<p role="alert" style={{fontSize:12,color:C.red,margin:'8px 0 0'}}>{error}</p>}
    </header>}
    <WorkspaceAttention sync={sync} onReview={()=>setWorkspaceOpen(true)}/>
    {message&&<div role="status" style={{margin:'12px 20px 0',padding:10,color:C.icy,background:C.section,borderRadius:10,display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>{message}<button style={button} onClick={()=>setMessage('')} aria-label="Dismiss message">✕</button></div>}
    <BottomNav tab={tab} onChange={navigate}/>
    {apiProgress&&<div role="status" style={{padding:'12px 20px',fontSize:14,color:C.icy}}>{apiProgress}<button style={button} onClick={()=>{stopRefresh.current=true;}}>Stop after this alliance</button></div>}
    {legionRefresh&&<div role="status" style={{padding:'12px 20px',color:C.icy}}>Refreshing players: {legionRefresh.done} of {legionRefresh.total}<button style={{...button,marginLeft:8}} onClick={()=>{stopRefresh.current=true;}}>Stop after this player</button></div>}
    {sync.mode!=='join'&&!sync.conflicts?.length&&<div>
    {tab==='members'&&!DEFAULT_ALLIANCES.every(tag=>players.some(p=>p.allianceTag===tag))&&<AllianceSetup players={players} onLoad={importRoster}/>}
    {tab==='members'&&players.length>0&&<RosterTab teamworkPreferences={data.talTeamPreferences||{players:{},pairs:[]}} onSaveTeamworkPreferences={prefs=>{setData(prev=>({...prev,talTeamPreferences:prefs}));setMessage('TAL teamwork preferences saved.');}} initialPlayerId={initialPlayerId} onInitialPlayerOpened={()=>setInitialPlayerId(null)} legionPlan={data.talPlan||newPlan()} onRefreshLegion={refreshLegion} legionRefresh={legionRefresh} players={players} events={data.events||[]} roles={withBuiltinRole(data.customRoles||[])} onSaveCustomRoles={customRoles=>setData(prev=>({...prev,customRoles}))} onSavePlayer={save} onUpdatePlayers={update} onDeletePlayer={setDeleting} onLoadAlliance={()=>setImporting(true)} showToast={setMessage}/>}
    {tab==='svs'&&<SvsComparison players={players}/>}
    {tab==='battle'&&<BattlePlanner onOpenMemberProfile={id=>{setInitialPlayerId(id);navigate('members');}} events={data.events||[]} players={players} plan={data.talPlan||newPlan()} sharedTeamPreferences={data.talTeamPreferences||{players:{},pairs:[]}} onSaveTeamPreferences={prefs=>{setData(prev=>({...prev,talTeamPreferences:prefs}));setMessage('Reusable TAL teamwork preferences saved.');}} onMessage={setMessage} onUpdate={action=>{try{setData(prev=>({...prev,events:applyBattleAction(prev.events||[],action)}));return {ok:true};}catch(e){setMessage(e.message);return {ok:false,error:e.message};}}}/>}
    {tab==='changes'&&<NameChanges players={players} plan={data.talPlan||newPlan()} onOpen={id=>{setInitialPlayerId(id);navigate('members');}}/>}
    {tab==='tal'&&<TalTab workspace={data} value={data.talPlan} players={players} onChange={saveTalPlan} onOpenPlayer={id=>{setInitialPlayerId(id);navigate('members');}} onRefreshLegion={refreshLegion} legionRefresh={legionRefresh} onMessage={setMessage} sync={sync} onCheckSync={retry} onBulkApply={(ids,action)=>{const result=applyTalBulk(latest.current,ids,action);pendingTalSync.current={active:true,sawDirty:false};setData({...result.data,talPlan:{...result.data.talPlan,autoRoles:false}});setMessage('Bulk changes saved on this device · syncing…');}}/>}
    {tab==='teams'&&<section aria-label="Teams" style={{minHeight:'65vh',display:'flex',alignItems:'center',justifyContent:'center',padding:'40px 20px'}}><div style={{textAlign:'center',maxWidth:300}}><svg width="54" height="54" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="Locked"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg><h2 style={{color:C.white,fontSize:22,margin:'18px 0 8px'}}>Coming soon</h2><p style={{color:C.icy,fontSize:14,lineHeight:1.6}}>Teams will be available in a future update.</p></div></section>}
    </div>}
    </div>
    {workspaceOpen&&<WorkspaceOptions sync={sync} data={data} onPublish={publish} onJoin={join} onRetry={syncNow} onResolve={resolve} onClose={()=>setWorkspaceOpen(false)} onLogout={onLogout} onAlliance={()=>{setWorkspaceOpen(false);setImporting(true);}} onHelp={()=>{setWorkspaceOpen(false);setTourOpen(true);}}/>}
    {tourOpen&&!workspaceOpen&&<QuickTour haptics={preferences.haptics} onHapticsChange={haptics=>onPreferencesChange({haptics})} onClose={()=>{onPreferencesChange({tutorialSeen:true});setTourOpen(false);}}/>}
    {importing&&<AllianceImportPanel stateId="3573" players={players} onImport={importRoster} onClose={()=>setImporting(false)}/>}
    {deleting&&<DeleteConfirmModal message="Remove this player from the roster? Their game account is unaffected." onCancel={()=>setDeleting(null)} onConfirm={()=>{setData(prev=>({...prev,players:prev.players.filter(p=>p.id!==deleting)}));setDeleting(null);}}/>}
  </main>;
}
