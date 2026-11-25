import {useMembershipRefresh} from './useMembershipRefresh.js';
import {MembershipRefreshStatus} from './components/MembershipRefreshStatus.jsx';
import {MEMBERSHIP_STALE_AFTER_MS,verifiedMembershipTime} from '../../src/services/rosterViewService.js';
import {applyTalBulk} from './tal/bulkActions.js';
import {applyTalSheetSnapshot} from './tal/sheetSync.js';
import {BattlePlanner} from './battle/BattlePlanner.jsx';
import {EventPlanner} from './foundry/EventPlanner.jsx';
import {EVENT_NAMES,updateEventPlanner} from '../../src/services/eventPlanner.js';
import {SvsComparison} from './svs/SvsComparison.jsx';
import {applyBattleAction} from './battle/model.js';
import {withAutomaticRoles} from './tal/autoRoles.js';
import {fetchMightpulsePlayer} from '../../src/services/mightpulseService.js';
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
import {mergeAllianceProfiles,reconcileAllianceMembership} from '../../src/services/allianceImportService.js';
import {withBuiltinRole} from '../../src/utils/roles.js';
import {withGameLanguage} from '../../src/services/gameLanguageService.js';
const button={minHeight:44,padding:'10px 14px',fontSize:14,fontWeight:600,borderRadius:10,border:`1px solid ${C.border}`,background:C.section,color:C.icy,cursor:'pointer'};
const empty={players:[],events:[],customRoles:[],settings:{stateId:'3573'}};
export function relativeRefreshAge(timestamp,now=Date.now()){
  const ms=Date.parse(timestamp||'');
  if(!Number.isFinite(ms)||ms>now+60000)return 'Never refreshed';
  const elapsed=Math.max(0,now-ms);
  if(elapsed<60000)return 'Just now';
  const minutes=Math.floor(elapsed/60000);
  if(minutes<60)return minutes+' min ago';
  const hours=Math.floor(minutes/60);
  if(hours<24)return hours+' hr'+(hours===1?'':'s')+' ago';
  const days=Math.floor(hours/24);
  return days+' day'+(days===1?'':'s')+' ago';
}

export function SiteApp(){
  const [preferences,setPreferences]=useState(()=>readPreferences());
  function updatePreferences(patch){setPreferences(savePreferences(patch));}
  useEffect(()=>{
    const feedback=event=>{const target=event.target.closest?.('button,[role="button"],input[type="checkbox"],input[type="radio"]');if(target&&!target.disabled&&target.getAttribute('aria-disabled')!=='true')tapFeedback(preferences.haptics);};
    document.addEventListener('click',feedback,true);
    return()=>document.removeEventListener('click',feedback,true);
  },[preferences.haptics]);
  const interactionStyles=<style>{`
    @media (prefers-reduced-motion: no-preference) {
      button, [role="button"], input[type="checkbox"], input[type="radio"] { transition: background-color 140ms ease, border-color 140ms ease, color 140ms ease, transform 110ms ease, opacity 140ms ease; }
      button:not(:disabled):active, [role="button"]:not([aria-disabled="true"]):active { transform: scale(.975); }
      [draggable="true"]:active { opacity:.86; }
    }
    button:focus-visible, [role="button"]:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid #E6BF7B; outline-offset: 2px; }
    @media (prefers-reduced-motion: reduce) { *, *::before, *::after { scroll-behavior:auto !important; animation-duration:.01ms !important; transition-duration:.01ms !important; } }
  `}</style>;
  const [access,setAccess]=useState('checking'),[password,setPassword]=useState(''),[remember,setRemember]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=>{fetch('/api/session',{credentials:'same-origin'}).then(r=>r.json()).then(data=>{setAccess(data.authenticated?'open':'locked');if(data.error)setError(data.error);}).catch(()=>{setAccess('locked');setError('Unable to check access. Try again.');});const lock=()=>setAccess('locked');window.addEventListener('roster:locked',lock);return()=>window.removeEventListener('roster:locked',lock);},[]);
  async function login(event){event.preventDefault();setBusy(true);setError('');try{const response=await fetch('/api/session',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({password,remember})});const data=await response.json();if(!response.ok)throw new Error(data.error||'Unable to sign in.');setPassword('');setAccess('open');}catch(e){setError(e.message);}finally{setBusy(false);}}
  async function logout(){try{const r=await fetch('/api/session',{method:'DELETE',credentials:'same-origin',headers:{'Content-Type':'application/json'}});if(!r.ok)throw new Error();setAccess('locked');}catch{setError('Unable to sign out. Try again.');}}
  if(access==='checking')return <>{interactionStyles}<p style={{padding:24,color:C.icy}}>Checking access…</p></>;
  if(access==='open')return <>{interactionStyles}<Members onLogout={logout} error={error} preferences={preferences} onPreferencesChange={updatePreferences}/></>;
  return <>{interactionStyles}<main style={{maxWidth:420,margin:'12vh auto 0',padding:24}}><div style={{color:C.gold,fontSize:14,fontWeight:700}}>STATE 3573</div><h1 style={{fontSize:30,margin:'10px 0'}}>Caroline’s roster</h1><p style={{fontSize:16,color:C.icy,lineHeight:1.6}}>Enter the leader password to open the shared roster.</p><form onSubmit={login}><label htmlFor="password" style={{fontSize:14,color:C.icy}}>Site password</label><input id="password" type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} style={{...button,width:'100%',margin:'8px 0 12px',fontSize:16,color:C.white}}/><label style={{display:'flex',alignItems:'center',gap:10,margin:'4px 0 14px',fontSize:14,color:C.icy,minHeight:44,cursor:'pointer'}}><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)} style={{width:20,height:20,accentColor:C.gold,flexShrink:0}}/><span>Remember me for 30 days</span></label>{error&&<p role="alert" style={{color:C.red}}>{error}</p>}<button disabled={busy} style={{...button,width:'100%',background:C.gold,color:C.bg}}>{busy?'Opening…':'Open roster'}</button></form><p style={{fontSize:13,color:C.icy,lineHeight:1.5,marginTop:20}}>Game lookups use Caroline’s API allowance. Your browser can save your password for autofill. Remember me keeps this device signed in using a secure session. Anyone with the leader password can edit the shared roster.</p></main></>;
}
function Members({onLogout,error,preferences,onPreferencesChange}){
  const [tab,setTab]=useState('members');
  const [transferEvents,setTransferEvents]=useState([]);
  useEffect(()=>{
    let active=true;
    let refreshing=false;
    async function refreshTransfers(){
      if(refreshing)return;
      refreshing=true;
      try{
        const events=[];
        let cursor=null;
        do {
          const path=cursor===null?'/api/transfers':'/api/transfers?before='+encodeURIComponent(cursor);
          const response=await fetch(path,{credentials:'same-origin',cache:'no-store'});
          if(!response.ok||!active)return;
          const result=await response.json();
          const next=result.nextCursor??null;
          if(!Array.isArray(result.events)||(next!==null&&
            (typeof next!=='string'||!/^[1-9]\d{0,18}$/.test(next)||(cursor!==null&&BigInt(next)>=BigInt(cursor)))))return;
          events.push(...result.events);
          cursor=next;
        } while(cursor!==null);
        if(active)setTransferEvents(events);
      }catch{/* Preserve last successful transfer feed when offline. */}
      finally{refreshing=false;}
    }
    refreshTransfers();
    const timer=setInterval(()=>{if(document.visibilityState!=='hidden')refreshTransfers();},60_000);
    return ()=>{active=false;clearInterval(timer);};
  },[]);

  const [workspaceOpen,setWorkspaceOpen]=useState(false);
  const lastAttention=useRef(null);
  const [initialPlayerId,setInitialPlayerId]=useState(null);
  const [returnToPlanner,setReturnToPlanner]=useState(null);
  const foundryScroll=useRef(0);
  const [legionRefresh,setLegionRefresh]=useState(null);
  const [refreshingLab,setRefreshingLab]=useState(false);
  const labBusy=useRef(false);
  const refreshing=useRef(false),stopRefresh=useRef(false);
  function navigate(id){setReturnToPlanner(null);setTab(id==='teams'?'tal':id);window.scrollTo?.({top:0,behavior:'instant'});}
  function openPlannerProfile(kind,id){foundryScroll.current=window.scrollY||0;setReturnToPlanner(kind);setInitialPlayerId(id);setTab('members');window.scrollTo?.({top:0,behavior:'instant'});}
  function backToPlanner(){setTab(returnToPlanner);setReturnToPlanner(null);requestAnimationFrame(()=>window.scrollTo?.({top:foundryScroll.current,behavior:'instant'}));}
  useEffect(()=>()=>{stopRefresh.current=true;},[]);
  const [tourOpen,setTourOpen]=useState(!preferences.tutorialSeen);
  const [exporting,setExporting]=useState(false);
  const localInitial=useRef(null);if(!localInitial.current)localInitial.current=loadFromStorage(empty);
  const {data,setData:setSharedData,sync,publish,join,retry,resolve}=useSharedWorkspace(localInitial.current);
  function setData(value){setSharedData(prev=>{const next=withAutomaticRoles(typeof value==='function'?value(prev):value);latest.current=next;return next;});}
  useEffect(()=>{if(sync.ready&&sync.joined&&!sync.conflicts?.length){const normalized=withAutomaticRoles(data);if(normalized!==data)setSharedData(normalized);}},[data,sync.ready,sync.joined,sync.conflicts?.length]);
  const membership=useMembershipRefresh(sync.ready&&sync.joined);
  const [nameRefresh,setNameRefresh]=useState({status:'idle',done:0,total:0,changes:[],failed:0,error:''});
  const nameRefreshStop=useRef(false);
  async function refreshUsernames(){
    if(refreshing.current){setMessage('Another API refresh is already running.');return;}
    refreshing.current=true;nameRefreshStop.current=false;
    const unique=new Map();
    for(const p of latest.current.players||[]){
      const fid=String(p.fid||'').trim();
      if(/^[1-9]\\d{3,14}$/.test(fid)&&!unique.has(fid))unique.set(fid,p);
    }
    const targets=[...unique.values()];
    const changes=[];let failed=0,done=0,firstError='';
    setNameRefresh({status:'running',done:0,total:targets.length,changes:[],failed:0,error:''});
    try{
      for(const p of targets){
        if(nameRefreshStop.current)break;
        try{
          const response=await mightpulseRequest('player',{fid:String(p.fid)});
          const base=response?.data?.player||response?.data;
          const id=String(base?.chief_id??base?.fid??response?.data?.chief_id??'');
          const username=String(base?.nick_name??base?.nickname??base?.name??'').trim();
          if(id!==String(p.fid)||!username)throw Error('Invalid player response');
          if(username!==p.username)changes.push({id:p.id,fid:String(p.fid),before:p.username||'',after:username});
        }catch(e){
          failed++;if(!firstError)firstError=e.message||'Player lookup failed';
          if([401,403,429].includes(e.status)||[401,403,429].includes(e.providerStatus)){
            setMessage(e.status===429||e.providerStatus===429?'API rate limit reached. Review the partial results.':'Username refresh stopped: '+e.message);
            done++;break;
          }
        }
        done++;
        setNameRefresh({status:'running',done,total:targets.length,changes:[...changes],failed,error:firstError});
      }
      setNameRefresh({status:'review',done,total:targets.length,changes,failed,error:firstError});
      if(failed)setMessage(`${failed} username lookup(s) failed. ${firstError}`);
      else if(!targets.length)setMessage('No valid player IDs found to check.');
    }catch(e){setNameRefresh(v=>({...v,status:'review',error:e.message||'Unexpected refresh error'}));setMessage(e.message||'Username refresh failed');}
    finally{refreshing.current=false;}
  }
  function applyUsernameChanges(){
    const changes=nameRefresh.changes||[];
    if(!changes.length)return;
    const byId=new Map(changes.map(c=>[c.id,c]));
    setData(prev=>({...prev,players:prev.players.map(p=>{
      const c=byId.get(p.id);
      if(!c||p.username!==c.before)return p;
      return {...p,username:c.after,pastUsernames:[...new Set([...(p.pastUsernames||[]),p.username].filter(Boolean))],profileLastUpdated:new Date().toISOString()};
    })}));
    setNameRefresh(v=>({...v,status:'applied'}));
    setMessage('Username changes saved to the shared roster. Check sync status.');
  }

  const [syncTick,setSyncTick]=useState(0);
  const syncPendingSince=useRef(null);
  useEffect(()=>{if(sync.dirty){if(syncPendingSince.current===null)syncPendingSince.current=Date.now();}else syncPendingSince.current=null;},[sync.dirty]);
  useEffect(()=>{const timer=setInterval(()=>setSyncTick(n=>n+1),1000);return()=>clearInterval(timer)},[]);
  const syncLate=Boolean(sync.dirty&&syncPendingSince.current!==null&&Date.now()-syncPendingSince.current>=30000);
  const syncProblem=Boolean(sync.issue||sync.conflicts?.length||syncLate);
  const syncLabel=syncProblem?'Sync not working':sync.dirty||sync.syncing?'Syncing':'Synced';
  const syncColor=syncProblem?'#F07575':sync.dirty||sync.syncing?'#E6BF7B':'#72CBA9';
  const membershipAge=relativeRefreshAge(membership.refresh?.completedAt);
  const membershipLabel=membership.running?'Verifying moves':membership.refresh?.completedAt?'Moves checked '+membershipAge.toLowerCase():'Alliance refresh';
  const [importing,setImporting]=useState(false),[deleting,setDeleting]=useState(null),[message,setMessage]=useState('');
  const [rosterRefreshing,setRosterRefreshing]=useState(false);
  const rosterRefreshLock=useRef(false);
  async function refreshPriorityRosters(){
    if(rosterRefreshLock.current)return;
    rosterRefreshLock.current=true;
    setRosterRefreshing(true);
    setMessage('');
    try{
      const response=await fetch('/api/priority-roster-refresh',{method:'POST',credentials:'same-origin',signal:AbortSignal.timeout(125000)});
      const result=await response.json();
      if(!response.ok)throw Error(result.error||'Could not refresh the alliance lists.');
      const verification=result.missing===0?'No missing players to verify.':
        result.queued===result.missing?`${result.queued} queued for verification.`:
        `${result.missing} missing · ${result.queued} newly queued for verification.`;
      setMessage(`${result.succeeded.length} of 5 alliance lists refreshed · ${result.found} players found. ${verification}`+
        (result.unavailable.length?` Still using saved rosters for ${result.unavailable.join(', ')}.`:''));
      await retry();
    }catch(error){setMessage(error.name==='TimeoutError'?'Alliance refresh timed out. Check sync before trying again.':error.message||'Could not refresh the alliance lists.');}
    finally{rosterRefreshLock.current=false;setRosterRefreshing(false);}
  }
  const refreshAction=<button style={button} onClick={refreshPriorityRosters} disabled={rosterRefreshing||!!legionRefresh||nameRefresh.status==='running'||!sync.joined||sync.dirty||sync.mode==='join'||!!sync.conflicts?.length}>{rosterRefreshing?'Loading alliance lists…':'Refresh priority alliances'}</button>;
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
   const recordedAt = new Date().toISOString();
   pendingTalSync.current={active:true,sawDirty:false};
   setData(prev=>{
    const previous=new Map((prev.talPlan?.teams||[]).flatMap(t=>(t.members||[]).map(m=>[t.id+':'+String(m.id),m])));
    const teams=(talPlan.teams||[]).map(t=>({...t,members:(t.members||[]).map(m=>{
     const old=previous.get(t.id+':'+String(m.id));if(!old)return m;
     return {...m,
      ...(old.registrationLocked&&m.registrationLocked!==false?{registered:old.registered}:{}),
      ...(old.roleLocked&&m.roleLocked!==false?{role:old.role}:{})
     };
    })}));
    const records = Object.fromEntries(Object.entries(talPlan.records || {}).map(([id,record]) => {
      const old = prev.talPlan?.records?.[id];
      const power = record.troopPower;
      if (power === '' || power == null) {
        if (!record.troopPowerRecordedAt) return [id, record];
        const cleared = {...record};
        delete cleared.troopPowerRecordedAt;
        return [id, cleared];
      }
      if (String(power) === String(old?.troopPower)) return [id, record];
      return [id, {...record,troopPowerRecordedAt:recordedAt}];
    }));
    return {...prev,talPlan:{...talPlan,records,teams,autoRoles:false}};
   });
   setMessage('TAL changes saved on this device · syncing to the shared workspace…');
  }
  function resetTalLegion(teamId,kinds){
    const choices=Array.isArray(kinds)?kinds:[kinds];
    if(!teamId||!choices.some(k=>['teams','roles','registration'].includes(k)))return;
    pendingTalSync.current={active:true,sawDirty:false};
    setData(prev=>{
      const plan=prev.talPlan;
      if(!plan?.teams?.some(t=>t.id===teamId))return prev;
      const nextTeams=plan.teams.map(t=>t.id!==teamId?t:{...t,members:(t.members||[]).map(m=>({
        ...m,
        ...(choices.includes('roles')&&!m.roleLocked?{role:'pending'}:{}),
        ...(choices.includes('registration')&&!m.registrationLocked?{registered:false}:{})
      }))});
      const existing=prev.talTeamPreferences||{};
      const drafts={...(existing.drafts||{})};
      if(choices.includes('teams'))for(const key of Object.keys(drafts)){
        if(!key.startsWith(String(teamId)+':'))continue;
        const draft=drafts[key]||{};
        drafts[key]={...draft,groups:[],assignment:{},confirmed:false,absentIds:[],copyDraft:'',copySource:'',updatedAt:new Date().toISOString()};
      }
      return {...prev,talPlan:{...plan,teams:nextTeams,autoRoles:false},talTeamPreferences:{...existing,drafts}};
    });
    setMessage('Selected allocations cleared on this device · syncing…');
  }
  const requiredAction=sync.conflicts?.length?'conflict':['join','unpublished'].includes(sync.mode)?sync.mode:null;
  useEffect(()=>{if(requiredAction&&requiredAction!==lastAttention.current)setWorkspaceOpen(true);else if(!requiredAction&&lastAttention.current)setWorkspaceOpen(false);lastAttention.current=requiredAction;},[requiredAction]);
  const players=data.players||[];
  const activePlayers=players.filter(p=>p.membershipStatus!=='transferred_out');
  const staleMemberships=activePlayers.filter(player=>!(Date.parse(verifiedMembershipTime(player))>=Date.now()-MEMBERSHIP_STALE_AFTER_MS)).length;
  useEffect(()=>{saveToStorage(data);},[data]);
  useEffect(()=>{const fail=()=>setMessage('Unable to save. Export a backup before closing this page.');window.addEventListener('app:storage-full',fail);return()=>window.removeEventListener('app:storage-full',fail);},[]);
  function save(player){const next=withGameLanguage({...player,profileLastUpdated:new Date().toISOString()});setData(prev=>({...prev,players:prev.players.map(p=>p.id===next.id?next:p)}));setMessage('Player updated');}
  function update(updated){const byId=new Map(updated.map(p=>[p.id,p]));setData(prev=>({...prev,players:prev.players.map(p=>byId.get(p.id)||p)}));}
  function importRoster(rows,{reconcileTag=null,assessment=null}={}){
    const result=mergeAllianceProfiles(latest.current.players||[],rows,'3573');
    setData(prev=>({...prev,players:reconcileTag?reconcileAllianceMembership(mergeAllianceProfiles(prev.players,rows,'3573').players,rows,reconcileTag,new Date().toISOString(),assessment):mergeAllianceProfiles(prev.players,rows,'3573').players,settings:{...prev.settings,lastApiRefresh:{at:new Date().toISOString(),scope:'Alliance roster',count:rows.length}}}));return {updated:result.updated.length,added:result.added.length};
  }
  async function syncNow(){setMessage('Syncing shared workspace…');const result=await retry();setMessage(result?.issue?result.issue:result?.conflicts?.length?'Edits need review.':result?.dirty||result?.syncing?'Changes are still syncing.':'Synced. All shared changes are up to date.');}
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
        <div style={{minWidth:0}}><h1 style={{margin:0,fontSize:19,letterSpacing:'-.025em',fontWeight:750}}>3573 · Caroline</h1><p style={{margin:'3px 0 0',fontSize:12,color:C.icy}}>{activePlayers.length} active players</p></div>
        <div style={{display:'flex',alignItems:'center',gap:7}}>
          <button aria-label="Workspace sync status and details" title="Workspace sync details" onClick={()=>setWorkspaceOpen(true)} style={{background:'transparent',border:0,color:syncProblem?'#F07575':C.icy,minHeight:44,padding:'5px 2px',fontSize:12,display:'flex',alignItems:'center',gap:5}}>
            <span aria-hidden="true" style={{display:'inline-block',width:7,height:7,borderRadius:'50%',background:syncColor}}/>
            <span style={{display:'grid',textAlign:'left',gap:2}}><span>{syncLabel}</span><span style={{fontSize:10,color:C.icy,whiteSpace:'nowrap'}}>{membershipLabel}</span></span>
          </button>
          <details style={{position:'relative'}}><summary aria-label="More workspace actions" style={{listStyle:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',minHeight:44,minWidth:44,borderRadius:10,background:C.section,color:C.icy,fontSize:22}}>⋯</summary>
            <div style={{position:'absolute',right:0,top:48,zIndex:85,width:235,display:'grid',gap:7,padding:12,background:'#14263A',border:'1px solid '+C.border,borderRadius:13,boxShadow:'0 12px 32px #0009'}}>
              <strong style={{fontSize:13,marginBottom:2}}>Workspace actions</strong>
              {refreshAction}
              <button style={button} onClick={refreshUsernames} disabled={membership.running||!!legionRefresh||nameRefresh.status==='running'||sync.mode==='join'||!!sync.conflicts?.length}>{nameRefresh.status==='running'?'Checking usernames…':'Refresh usernames'}</button>
              {nameRefresh.status!=='idle'&&<div role="status" style={{padding:10,borderRadius:10,background:C.section,fontSize:12,lineHeight:1.6}}>
                <strong>{nameRefresh.status==='running'?'Checking usernames':nameRefresh.status==='applied'?'Names saved':'Username review'}</strong>
                <div>{nameRefresh.done} of {nameRefresh.total} checked · {nameRefresh.changes.length} differences · {nameRefresh.failed} failed</div>{nameRefresh.error&&<div role="alert" style={{color:'#F0B25C'}}>{nameRefresh.error}</div>}
                {nameRefresh.status==='running'&&<button style={button} onClick={()=>{nameRefreshStop.current=true;}}>Stop</button>}
                {nameRefresh.status==='review'&&<div style={{maxHeight:220,overflowY:'auto',marginTop:6}}>
                  {nameRefresh.changes.length===0?<div>No username differences found in successful lookups.</div>:nameRefresh.changes.map(c=><div key={c.id} style={{padding:'6px 0',borderBottom:'1px solid '+C.border,overflowWrap:'anywhere'}}>{c.before||'Unknown'} → <strong>{c.after}</strong> · {c.fid}</div>)}
                  {nameRefresh.changes.length>0&&<button style={{...button,marginTop:8,width:'100%'}} onClick={applyUsernameChanges}>Apply {nameRefresh.changes.length} username changes</button>}
                  <p style={{margin:'6px 0 0'}}>API names may be outdated. Review before applying. Other profile fields remain unchanged.</p>
                </div>}
              </div>}
              <button style={button} disabled={exporting} onClick={backup}>{exporting?'Exporting…':'Export roster as Excel'}</button>
              <button style={button} disabled={sync.syncing||sync.mode==='join'||!!sync.conflicts?.length} onClick={syncNow}>{sync.syncing?'Syncing…':sync.issue?'Retry sync':sync.dirty?'Sync changes':'Check sync'}</button>
              <button style={button} onClick={()=>setWorkspaceOpen(true)}>Workspace settings</button>
              <MembershipRefreshStatus refresh={membership.refresh} error={membership.error} revision={sync.revision} stale={staleMemberships}/>
            </div>
          </details>
        </div>
      </div>
      {error&&<p role="alert" style={{fontSize:12,color:C.red,margin:'8px 0 0'}}>{error}</p>}
    </header>:<header style={{padding:'13px 16px 8px'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10}}>
        <div style={{minWidth:0}}><h1 style={{margin:0,fontSize:19,letterSpacing:'-.025em',fontWeight:750}}>3573 · Caroline</h1><p style={{margin:'3px 0 0',fontSize:12,color:C.icy}}>{tab==='tal'?'TAL':tab==='teams'?'Teams':tab==='changes'?'Name Changes':tab==='battle'?'Battle planner':tab==='canyon'?'Canyon Clash':tab==='castle'?'Castle Battle':tab==='events'?'Events':tab==='members'?'Members':'SvS comparison'}</p></div>
        <div style={{display:'flex',alignItems:'center',gap:7}}>
          <button aria-label="Workspace sync status and details" title="Workspace sync details" onClick={()=>setWorkspaceOpen(true)} style={{background:'transparent',border:0,color:syncProblem?'#F07575':C.icy,minHeight:44,padding:'5px 2px',fontSize:12,display:'flex',alignItems:'center',gap:5}}>
            <span aria-hidden="true" style={{display:'inline-block',width:7,height:7,borderRadius:'50%',background:syncColor}}/>
            <span style={{display:'grid',textAlign:'left',gap:2}}><span>{syncLabel}</span><span style={{fontSize:10,color:C.icy,whiteSpace:'nowrap'}}>{membershipLabel}</span></span>
          </button>
          <details style={{position:'relative'}}><summary aria-label="More workspace actions" style={{listStyle:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',minHeight:44,minWidth:44,borderRadius:10,background:C.section,color:C.icy,fontSize:22}}>⋯</summary>
            <div style={{position:'absolute',right:0,top:48,zIndex:85,width:235,display:'grid',gap:7,padding:12,background:'#14263A',border:'1px solid '+C.border,borderRadius:13,boxShadow:'0 12px 32px #0009'}}>
              <strong style={{fontSize:13,marginBottom:2}}>Workspace actions</strong>
              {refreshAction}
              <MembershipRefreshStatus refresh={membership.refresh} error={membership.error} revision={sync.revision} stale={staleMemberships}/>
              <button style={button} onClick={refreshUsernames} disabled={membership.running||!!legionRefresh||nameRefresh.status==='running'||sync.mode==='join'||!!sync.conflicts?.length}>{nameRefresh.status==='running'?'Checking usernames…':'Refresh usernames'}</button>
              {nameRefresh.status!=='idle'&&<div role="status" style={{padding:10,borderRadius:10,background:C.section,fontSize:12,lineHeight:1.6}}>
                <strong>{nameRefresh.status==='running'?'Checking usernames':nameRefresh.status==='applied'?'Names saved':'Username review'}</strong>
                <div>{nameRefresh.done} of {nameRefresh.total} checked · {nameRefresh.changes.length} differences · {nameRefresh.failed} failed</div>
                {nameRefresh.status==='running'&&<button style={button} onClick={()=>{nameRefreshStop.current=true;}}>Stop</button>}
                {nameRefresh.status==='review'&&<div style={{maxHeight:220,overflowY:'auto',marginTop:6}}>
                  {nameRefresh.changes.length===0?<div>No username differences found in successful lookups.</div>:nameRefresh.changes.map(c=><div key={c.id} style={{padding:'6px 0',borderBottom:'1px solid '+C.border,overflowWrap:'anywhere'}}>{c.before||'Unknown'} → <strong>{c.after}</strong> · {c.fid}</div>)}
                  {nameRefresh.changes.length>0&&<button style={{...button,marginTop:8,width:'100%'}} onClick={applyUsernameChanges}>Apply {nameRefresh.changes.length} username changes</button>}
                  <p style={{margin:'6px 0 0'}}>API names may be outdated. Review before applying. Other profile fields remain unchanged.</p>
                </div>}
              </div>}
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
    {legionRefresh&&<div role="status" style={{padding:'12px 20px',color:C.icy}}>Refreshing players: {legionRefresh.done} of {legionRefresh.total}<button style={{...button,marginLeft:8}} onClick={()=>{stopRefresh.current=true;}}>Stop after this player</button></div>}
    {sync.mode!=='join'&&!sync.conflicts?.length&&<div>
    {tab==='members'&&!DEFAULT_ALLIANCES.every(tag=>players.some(p=>p.allianceTag===tag))&&<AllianceSetup players={players} onLoad={importRoster}/>}
    {returnToPlanner&&tab==='members'&&<div style={{position:'sticky',top:0,zIndex:10,padding:'10px 16px',background:'#142438',borderBottom:'1px solid #40546a'}}><button type="button" style={button} onClick={backToPlanner}>← Back to {EVENT_NAMES[returnToPlanner]}</button></div>}
    {tab==='members'&&players.length>0&&<RosterTab enable3573Tracking transferEvents={transferEvents} teamworkPreferences={data.talTeamPreferences||{players:{},pairs:[]}} onSaveTeamworkPreferences={prefs=>{setData(prev=>({...prev,talTeamPreferences:prefs}));setMessage('TAL teamwork preferences saved.');}} initialPlayerId={initialPlayerId} onInitialPlayerOpened={()=>setInitialPlayerId(null)} legionPlan={data.talPlan||newPlan()} onRefreshLegion={refreshLegion} legionRefresh={legionRefresh} players={players} events={data.events||[]} roles={withBuiltinRole(data.customRoles||[])} onSaveCustomRoles={customRoles=>setData(prev=>({...prev,customRoles}))} onSavePlayer={save} onUpdatePlayers={update} onDeletePlayer={setDeleting} onLoadAlliance={()=>setImporting(true)} showToast={setMessage}/>}
    {tab==='events'&&<section aria-label="Events" style={{padding:'12px 16px',display:'grid',gap:8}}>{[['foundry','Foundry','Team planning and assignments',true],['tal','Tundra Arms League','Under development',true],['castle','Castle Battle','Coming soon',false],['canyon','Canyon Clash','Team planning and attendance',true]].map(([id,label,description,available])=><button key={id} type="button" disabled={!available} aria-disabled={!available} onClick={()=>available&&navigate(id)} style={{...button,textAlign:'left',padding:'13px 14px',minHeight:64,display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,opacity:available?1:.56,cursor:available?'pointer':'not-allowed',background:available?'#203449':'#172739',borderColor:available?'#40546a':'#293b4d'}}><span style={{display:'grid',gap:3}}><strong style={{fontSize:15,fontWeight:700}}>{label}</strong><span style={{fontSize:12,color:C.icy}}>{description}</span></span><span aria-hidden="true" style={{fontSize:available?20:14,color:C.icy}}>{available?'›':'Locked'}</span></button>)}</section>}
    {['foundry','castle','canyon','tal'].includes(tab)&&<button type="button" onClick={()=>navigate('events')} style={{...button,margin:'12px 16px'}}>‹ Back to Events</button>}
    {tab==='svs'&&<SvsComparison players={players} lastLabSummary={data.settings?.compareLabTop100||null} onLabSummary={summary=>setData(prev=>({...prev,settings:{...prev.settings,compareLabTop100:summary}}))}/>}
    {tab==='castle'&&<section aria-label="Castle Battle coming soon" style={{minHeight:'60vh',display:'flex',alignItems:'center',justifyContent:'center',padding:'32px 20px',textAlign:'center'}}><div style={{maxWidth:320}}><div style={{width:64,height:64,display:'grid',placeItems:'center',borderRadius:20,background:'#203449',margin:'0 auto 18px',color:C.icy}}><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg></div><h2 style={{fontSize:22,margin:'0 0 8px'}}>Castle Battle</h2><p style={{color:C.icy,fontSize:14,margin:'0 0 8px'}}>Coming soon</p><p style={{color:'#B8C8D5',fontSize:14,lineHeight:1.5,margin:0}}>Castle Battle team planning will be available in a future update.</p></div></section>}
    {['foundry','canyon'].filter(kind=>tab===kind||returnToPlanner===kind).map(kind=><div key={kind} style={{display:tab===kind?'block':'none'}}>
      <EventPlanner kind={kind} players={activePlayers} attendancePlayers={players} storage={data.foundry}
        onUpdate={action=>setData(prev=>updateEventPlanner(prev,action))} teamworkPreferences={data.talTeamPreferences||{}}
        onSaveTeamworkPreferences={prefs=>setData(prev=>({...prev,talTeamPreferences:prefs}))}
        onUpdatePlayerLanguage={(ids,language)=>{const selected=new Set(ids.map(String));setData(prev=>({...prev,players:prev.players.map(p=>selected.has(String(p.id??p.fid))?withGameLanguage({...p,gameLanguage:language,gameLanguageSource:'manual',language,profileLastUpdated:new Date().toISOString()}):p)}))}}
        onOpenPlayerProfile={id=>openPlannerProfile(kind,id)}/>
    </div>)}
    {tab==='battle'&&<BattlePlanner onOpenMemberProfile={id=>{setInitialPlayerId(id);navigate('members');}} events={data.events||[]} players={activePlayers} plan={data.talPlan||newPlan()} sharedTeamPreferences={data.talTeamPreferences||{players:{},pairs:[]}} onSaveTeamPreferences={prefs=>{setData(prev=>({...prev,talTeamPreferences:prefs}));setMessage('Reusable TAL teamwork preferences saved.');}} onMessage={setMessage} onUpdate={action=>{try{setData(prev=>({...prev,events:applyBattleAction(prev.events||[],action)}));return {ok:true};}catch(e){setMessage(e.message);return {ok:false,error:e.message};}}}/>}
    {tab==='changes'&&<NameChanges players={players} plan={data.talPlan||newPlan()} onOpen={id=>{setInitialPlayerId(id);navigate('members');}}/>}
    {tab==='tal'&&<section aria-label="Tundra Arms League under development" style={{minHeight:'60vh',display:'flex',alignItems:'center',justifyContent:'center',padding:'32px 20px',textAlign:'center'}}><div style={{maxWidth:320}}><div style={{width:64,height:64,display:'grid',placeItems:'center',borderRadius:20,background:'#203449',margin:'0 auto 18px',color:C.icy}}><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg></div><h2 style={{fontSize:22,margin:'0 0 8px'}}>Tundra Arms League</h2><p style={{color:C.icy,fontSize:14,margin:'0 0 8px'}}>Under development</p><p style={{color:'#B8C8D5',fontSize:14,lineHeight:1.5,margin:0}}>TAL planning is temporarily unavailable while improvements are being made.</p></div></section>}
    </div>}
    </div>
    {workspaceOpen&&<WorkspaceOptions sync={sync} data={data} onPublish={publish} onJoin={join} onRetry={syncNow} onResolve={resolve} onClose={()=>setWorkspaceOpen(false)} onLogout={onLogout} onAlliance={()=>{setWorkspaceOpen(false);setImporting(true);}} onHelp={()=>{setWorkspaceOpen(false);setTourOpen(true);}}/>}
    {tourOpen&&!workspaceOpen&&<QuickTour haptics={preferences.haptics} onHapticsChange={haptics=>onPreferencesChange({haptics})} onClose={()=>{onPreferencesChange({tutorialSeen:true});setTourOpen(false);}}/>}
    {importing&&<AllianceImportPanel stateId="3573" players={players} onImport={(rows,assessment)=>importRoster(rows,{reconcileTag:assessment?.authoritative?rows[0]?.allianceTag:null,assessment})} onClose={()=>setImporting(false)}/>}
    {deleting&&<DeleteConfirmModal message="Remove this player from the roster? Their game account is unaffected." onCancel={()=>setDeleting(null)} onConfirm={()=>{setData(prev=>({...prev,players:prev.players.filter(p=>p.id!==deleting)}));setDeleting(null);}}/>}
  </main>;
}
