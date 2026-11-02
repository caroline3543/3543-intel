import { useEffect, useState } from 'react';
import { supabase } from '../../services/supabaseClient.js';
import { IMPORT_FIELDS, detectMapping, assessMapping } from '../../services/worksheetMappingPreview.js';
import { planStateRosterImport } from '../../services/stateRosterImportPreview.js';
import { previewSpecialWorksheet } from '../../services/specialWorksheetPreview.js';
import { readStateSheet, saveStateSheet, clearStateSheet } from '../../services/stateSpreadsheetDefaults.js';
import { getWorkspaces, normalizeStateId } from '../../services/stateWorkspaceService.js';

/** Feature-gated setup screen. No Sheets writes and no browser OAuth secrets. */
export function SpreadsheetManager({ onClose, players = [], stateId, onRosterUpdated, onPullApiData, onSelectSheetState }) {
  const [status,setStatus] = useState('idle');
  const [message,setMessage] = useState('');
  const [newSheetState,setNewSheetState]=useState('');
  const [addingSheetState,setAddingSheetState]=useState(false);
  const [spreadsheetId,setSpreadsheetId]=useState(()=>readStateSheet(stateId)||'');
  const [savedSpreadsheetId,setSavedSpreadsheetId]=useState(()=>readStateSheet(stateId)||'');
  const [cloudDefaultFeedback,setCloudDefaultFeedback]=useState('Stored on this device. Sign in to load cloud defaults.');
  const [refreshingSavedSheet,setRefreshingSavedSheet]=useState(false);
  const [sheetInfo,setSheetInfo]=useState(null);
  const [email,setEmail]=useState('');
  const [otp,setOtp]=useState('');
  const [otpSent,setOtpSent]=useState(false);
  const [connection,setConnection]=useState(null);
  const [connectionChecking,setConnectionChecking]=useState(false);
  const [connectionFeedback,setConnectionFeedback]=useState('');
  const [connectionCheckedAt,setConnectionCheckedAt]=useState(null);
  const [previewRows,setPreviewRows]=useState(null);
  const [columnMapping,setColumnMapping]=useState({});
  const [previewAlliance,setPreviewAlliance]=useState('');
  const [applyingFid,setApplyingFid]=useState(null);
  const [signedInEmail,setSignedInEmail]=useState(null);
  const [createState,setCreateState]=useState('');
  const [createdWorkbook,setCreatedWorkbook]=useState(null);
  const [creatingWorkbook,setCreatingWorkbook]=useState(false);
  const enabled = import.meta.env.VITE_ENABLE_GOOGLE_SHEETS === 'true';
  async function sendLoginCode() {
    if(!supabase)return;
    setStatus('signing-in');setMessage('');
    const {error}=await supabase.auth.signInWithOtp({email:email.trim(),options:{shouldCreateUser:false,emailRedirectTo:window.location.origin+'/?sheets_auth=1'}});
    if(error){const rateLimited=error.status===429||error.code==='over_email_send_rate_limit';setMessage(rateLimited?'Supabase email limit reached. Please try again after the limit resets, or configure custom SMTP.':'Email sign-in failed: '+(error.message||'Check your account and authentication settings.'));setStatus('error');return;}
    setOtpSent(true);setStatus('idle');
    setMessage('Check your email for the sign-in code.');
  }
  async function verifyLoginCode() {
    if(!supabase)return;
    setStatus('signing-in');setMessage('');
    const {error}=await supabase.auth.verifyOtp({email:email.trim(),token:otp.trim(),type:'email'});
    if(error){setMessage('The code could not be verified.');setStatus('error');return;}
    const {data:{user}}=await supabase.auth.getUser();
    setSignedInEmail(user?.email||email.trim());
    setOtpSent(false);setOtp('');
    setStatus('idle');setMessage('Signed in. You can now connect Google Sheets.');
  }
  async function refreshConnection() {
    if(!supabase||!enabled){setConnectionFeedback('Google Sheets integration is unavailable.');return;}
    setConnectionChecking(true);
    setConnectionFeedback('Checking saved Google connection…');
    try {
      const {data:{session},error:sessionError}=await supabase.auth.getSession();
      if(sessionError||!session?.access_token){
        setConnection(null);
        setConnectionFeedback('Sign in first to check your Google connection.');
        return;
      }
      const response=await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sheets-status`,{headers:{
        Authorization:`Bearer ${session.access_token}`,apikey:import.meta.env.VITE_SUPABASE_ANON_KEY,
      }});
      const result=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(result.error||'Could not check connection status.');
      setConnection(result);
      setConnectionCheckedAt(new Date());
      setConnectionFeedback(result.connected
        ? 'Saved Google connection confirmed. This does not test Google API access.'
        : 'No saved Google connection found. Connect your account to continue.');
    }catch(error){
      setConnection(null);
      setConnectionFeedback('Status check failed: '+(error?.message||'Network error')+'. Please retry.');
    }finally{setConnectionChecking(false);}
  }
  useEffect(()=>{
    if(!supabase)return;
    let mounted=true;
    supabase.auth.getUser().then(({data:{user}})=>{if(mounted)setSignedInEmail(user?.email||null);});
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{
      if(!mounted)return;
      setSignedInEmail(session?.user?.email||null);
    });
    refreshConnection();
    return ()=>{mounted=false;subscription.unsubscribe();};
  },[]);
  async function connect() {
    if (!enabled || !supabase) return;
    setStatus('connecting');setMessage('');
    try {
      const {data:{session},error:sessionError}=await supabase.auth.getSession();
      if (sessionError || !session?.access_token) throw new Error('Sign in to connect a spreadsheet.');
      const endpoint=`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sheets-oauth/start`;
      const response=await fetch(endpoint,{method:'POST',headers:{
        'Authorization':`Bearer ${session.access_token}`,
        'apikey':import.meta.env.VITE_SUPABASE_ANON_KEY,
        'Content-Type':'application/json',
      },body:'{}'});
      const result=await response.json();
      if(!response.ok || !result.authorization_url) throw new Error(result.error || 'Connection unavailable');
      const url=new URL(result.authorization_url);
      if(url.origin!=='https://accounts.google.com') throw new Error('Unexpected authorisation destination');
      window.location.assign(url.toString());
    }catch(error){
      setStatus('error');setMessage(error.message || 'Could not connect Google Sheets');
    }
  }
  async function stateDefaultRequest(method,payload){
    const {data:{session}}=await supabase.auth.getSession();
    if(!session?.access_token)throw Error('Sign in to sync saved spreadsheet links.');
    const res=await fetch(import.meta.env.VITE_SUPABASE_URL+'/functions/v1/sheets-state-default',{method,headers:{Authorization:'Bearer '+session.access_token,apikey:import.meta.env.VITE_SUPABASE_ANON_KEY,...(method==='POST'?{'Content-Type':'application/json'}:{})},...(method==='POST'?{body:JSON.stringify(payload)}:{})});
    const result=await res.json().catch(()=>({}));
    if(!res.ok)throw Error(result.error||'Could not sync spreadsheet default.');
    return result;
  }
  useEffect(()=>{
    if(!signedInEmail||!enabled||!supabase)return;
    let active=true;
    stateDefaultRequest('GET').then(result=>{
      if(!active)return;
      const remote=result.defaults?.[String(stateId)];
      if(remote){
        setSavedSpreadsheetId(remote);setSpreadsheetId(remote);
        saveStateSheet(stateId,remote);
        setSheetInfo(null);setPreviewRows(null);
        setCloudDefaultFeedback('Default loaded from Supabase. Available across signed-in devices.');
      }else if(readStateSheet(stateId)){
        setCloudDefaultFeedback('This device has a saved link. Select Save as state default to make it available across devices.');
      }else setCloudDefaultFeedback('No default saved in Supabase for this state.');
    }).catch(error=>{if(active)setCloudDefaultFeedback('Cloud lookup unavailable: '+error.message)});
    return ()=>{active=false};
  },[signedInEmail,stateId,enabled]);
  async function saveDefaultSpreadsheet(){
    try{
      const normalized=saveStateSheet(stateId,spreadsheetId);
      setSavedSpreadsheetId(normalized);
      setSpreadsheetId(normalized);
      setMessage('Saved locally. Saving to Supabase…');
      await stateDefaultRequest('POST',{stateId,spreadsheetId:normalized});
      setCloudDefaultFeedback('Saved in Supabase for State '+stateId+'.');
      setMessage('Default saved for State '+stateId+' on this device and in Supabase.');
    }catch(error){setMessage(error.message||'Could not save spreadsheet.');}
  }
  async function removeDefaultSpreadsheet(){
    try{await stateDefaultRequest('POST',{stateId,spreadsheetId:null});
      clearStateSheet(stateId);setSavedSpreadsheetId('');
      setCloudDefaultFeedback('No saved default for this state.');
      setMessage('Default cleared across devices. No Google file was deleted.');
    }catch(error){setMessage('Could not clear cloud default: '+error.message)}
  }
  async function refreshSavedSpreadsheet(){
    if(!savedSpreadsheetId||refreshingSavedSheet)return;
    setRefreshingSavedSheet(true);
    setSpreadsheetId(savedSpreadsheetId);
    setSheetInfo(null);setPreviewRows(null);
    setMessage('Refreshing worksheets from the saved Google spreadsheet…');
    try{
      const {data:{session}}=await supabase.auth.getSession();
      if(!session?.access_token)throw Error('Sign in before refreshing Google Sheets.');
      const response=await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sheets-metadata`,{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`,apikey:import.meta.env.VITE_SUPABASE_ANON_KEY,'Content-Type':'application/json'},body:JSON.stringify({spreadsheetId:savedSpreadsheetId})});
      const result=await response.json().catch(()=>({}));
      if(!response.ok)throw Error(result.error||'Could not refresh Google Sheets.');
      setSheetInfo(result);setStatus('ready');
      setMessage('Worksheet list refreshed from Google. Select a worksheet to preview its latest rows before approving changes.');
    }catch(error){setStatus('error');setMessage('Refresh failed: '+(error.message||'Unknown error'));}
    finally{setRefreshingSavedSheet(false);}
  }
  async function previewMetadata() {
    if(!enabled||!supabase)return;
    setStatus('loading');setMessage('');setSheetInfo(null);
    try {
      const {data:{session}}=await supabase.auth.getSession();
      if(!session?.access_token)throw new Error('Sign in first.');
      const endpoint=`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sheets-metadata`;
      const response=await fetch(endpoint,{method:'POST',headers:{
        Authorization:`Bearer ${session.access_token}`,
        apikey:import.meta.env.VITE_SUPABASE_ANON_KEY,
        'Content-Type':'application/json',
      },body:JSON.stringify({spreadsheetId:spreadsheetId.trim()})});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||'Could not read spreadsheet');
      setSheetInfo(result);setStatus('ready');
    }catch(error){setStatus('error');setMessage(error.message||'Preview failed');}
  }
  async function previewRowsForWorksheet(title) {
    setStatus('loading');setMessage('');setPreviewRows(null);setColumnMapping({});setPreviewAlliance('');
    try {
      const {data:{session}}=await supabase.auth.getSession();
      if(!session?.access_token)throw new Error('Sign in first.');
      const response=await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sheets-rows-preview`,{
        method:'POST',headers:{Authorization:`Bearer ${session.access_token}`,apikey:import.meta.env.VITE_SUPABASE_ANON_KEY,'Content-Type':'application/json'},
        body:JSON.stringify({spreadsheetId:spreadsheetId.trim(),worksheetTitle:title}),
      });
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||'Could not preview rows');
      setPreviewAlliance(title);
      setPreviewRows({title,spreadsheetId:spreadsheetId.trim(),rows:data.rows,truncated:!!data.truncated});setColumnMapping(detectMapping(data.rows?.[0]||[]));setStatus('ready');
    }catch(e){setStatus('error');setMessage(e.message||'Worksheet preview failed');}
  }
  async function createStateWorkbook() {
    if(!supabase||!enabled||creatingWorkbook)return;
    setCreatingWorkbook(true);setCreatedWorkbook(null);setMessage('');
    try{
      const stateId=createState.trim();
      if(!/^\d{1,5}$/.test(stateId)||Number(stateId)===0)throw new Error('Enter a valid state number.');
      const {data:{session}}=await supabase.auth.getSession();
      if(!session?.access_token)throw new Error('Sign in first.');
      const response=await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sheets-create-workbook`,{
        method:'POST',
        headers:{Authorization:`Bearer ${session.access_token}`,apikey:import.meta.env.VITE_SUPABASE_ANON_KEY,'Content-Type':'application/json'},
        body:JSON.stringify({stateId}),
      });
      const result=await response.json();
      if(!response.ok){
        if(result.spreadsheetUrl)setCreatedWorkbook(result);
        throw new Error(result.error||'Spreadsheet creation failed.');
      }
      setCreatedWorkbook(result);
      if(result.spreadsheetId){setSpreadsheetId(result.spreadsheetId);setSheetInfo(null);setPreviewRows(null);setMessage('Workbook created. Its ID is ready below; save it as this state’s default if you want to keep using it.');}
    }catch(error){setMessage(error.message||'Spreadsheet creation failed.');}
    finally{setCreatingWorkbook(false);}
  }
  async function createReviewedPlayer(candidate) {
    if(applyingFid||!stateId||candidate.kind!=='new'||!candidate.username||!previewAlliance)return;
    if(!window.confirm(`Create player ${candidate.username} (${candidate.fid}) in State ${stateId}, alliance ${previewAlliance}? This adds them to the shared roster.`))return;
    setApplyingFid(candidate.fid);setMessage('');
    try{
      const {data:{session}}=await supabase.auth.getSession();
      if(!session?.access_token)throw new Error('Sign in required.');
      const response=await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sheets-apply-troop-import`,{
        method:'POST',headers:{Authorization:`Bearer ${session.access_token}`,apikey:import.meta.env.VITE_SUPABASE_ANON_KEY,'Content-Type':'application/json'},
        body:JSON.stringify({mode:'create',stateId:String(stateId),fid:candidate.fid,username:candidate.username,alliance:previewAlliance,troops:candidate.manualFields}),
      });
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||'Player creation failed.');
      setPreviewRows(null);
      await onRosterUpdated?.();
      setMessage('Created player '+candidate.fid+'. Re-preview before further imports.');
    }catch(e){setMessage(e.message||'Player creation failed.');}
    finally{setApplyingFid(null);}
  }
  async function applySpecialRow(plan,row){
    if(applyingFid||plan.errors.length||!Object.keys(row.updates).length)return;
    if(!previewRows||previewRows.spreadsheetId!==spreadsheetId.trim())return setMessage('Spreadsheet changed. Preview the current file before approving an import.');
    const player=players.find(p=>p.id===row.playerId&&String(p.fid)===row.fid);
    if(!player)return setMessage('Player no longer in roster. Re-preview.');
    const entryKey=plan.type==='Combat'?row.troopType:row.eventId+'|'+String(row.updates['Event Date UTC']||'').slice(0,10);
    if(plan.type==='Events'&&(!row.eventId||!/^\d{4}-\d{2}-\d{2}$/.test(String(row.updates['Event Date UTC']||'').slice(0,10))))return setMessage('Event ID and UTC date are required.');
    if(!window.confirm('Import '+plan.type+' row '+row.row+' for player '+row.fid+' in state '+plan.stateId+'?'))return;
    setApplyingFid(row.fid);setMessage('');
    try{
      const {data:{session}}=await supabase.auth.getSession();if(!session?.access_token)throw Error('Sign in required');
      const latestResponse=await fetch(import.meta.env.VITE_SUPABASE_URL+'/functions/v1/sheets-rows-preview',{method:'POST',headers:{Authorization:'Bearer '+session.access_token,apikey:import.meta.env.VITE_SUPABASE_ANON_KEY,'Content-Type':'application/json'},body:JSON.stringify({spreadsheetId:previewRows.spreadsheetId,worksheetTitle:plan.type})});
      if(!latestResponse.ok)throw Error('Could not recheck the spreadsheet. Preview again.');
      const latest=await latestResponse.json();
      if(latest.truncated||JSON.stringify(latest.rows?.[0])!==JSON.stringify(previewRows.rows?.[0])||JSON.stringify(latest.rows?.[row.row-1])!==JSON.stringify(previewRows.rows?.[row.row-1]))throw Error('The worksheet changed since preview. Review it again before importing.');
      const container=plan.type==='Combat'?'sheetCombat':'sheetEvents';
      const response=await fetch(import.meta.env.VITE_SUPABASE_URL+'/functions/v1/sheets-apply-troop-import',{method:'POST',headers:{Authorization:'Bearer '+session.access_token,apikey:import.meta.env.VITE_SUPABASE_ANON_KEY,'Content-Type':'application/json'},body:JSON.stringify({mode:'special',kind:plan.type,stateId:plan.stateId,fid:row.fid,alliance:player.allianceTag,entryKey,entry:row.updates,expectedEntry:player[container]?.[entryKey]??null})});
      const result=await response.json();if(!response.ok)throw Error(result.error||'Import failed');
      setPreviewRows(null);await onRosterUpdated?.();setMessage('Saved '+plan.type+' entry for '+row.fid+'. Re-preview to continue.');
    }catch(e){setMessage(e.message||'Import failed');}finally{setApplyingFid(null)}
  }
  async function applyJoinerHeroes(candidate) {
    if(applyingFid||!candidate.changedHeroes||!candidate.playerId||!candidate.joinerHeroes?.length)return;
    const existing=players.find(p=>p.id===candidate.playerId&&String(p.fid)===candidate.fid);
    if(!existing)return setMessage('Player no longer in roster. Re-preview.');
    if(!window.confirm(`Add/update ${candidate.joinerHeroes.length} joiner heroes for player ${candidate.fid}? Existing heroes not in this spreadsheet will be preserved.`))return;
    setApplyingFid(candidate.fid);setMessage('');
    try{
      const {data:{session}}=await supabase.auth.getSession();
      if(!session?.access_token)throw new Error('Sign in required.');
      const response=await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sheets-apply-troop-import`,{
        method:'POST',headers:{Authorization:`Bearer ${session.access_token}`,apikey:import.meta.env.VITE_SUPABASE_ANON_KEY,'Content-Type':'application/json'},
        body:JSON.stringify({mode:'heroes',stateId:String(stateId),fid:candidate.fid,alliance:previewAlliance,troops:{},joinerHeroes:candidate.joinerHeroes,expectedHeroes:existing.joinerHeroes||[]}),
      });
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||'Joiner hero import failed.');
      setPreviewRows(null);
      await onRosterUpdated?.();
      setMessage('Joiner heroes updated for '+candidate.fid+'. Re-preview to continue.');
    }catch(e){setMessage(e.message||'Joiner hero import failed.');}
    finally{setApplyingFid(null);}
  }
  async function applySingleTierChange(candidate, mode = 'tiers') {
    if(applyingFid||!stateId||!candidate.changed||candidate.kind!=='existing')return;
    const existing=players.find(p=>p.id===candidate.playerId&&String(p.fid)===candidate.fid);
    if(!existing)throw new Error('Player no longer in roster. Reload preview.');
    if(!window.confirm(`Apply verified troop-level changes for player ${candidate.fid} in State ${stateId}? This changes the app roster.`))return;
    setApplyingFid(candidate.fid);setMessage('');
    try{
      const {data:{session}}=await supabase.auth.getSession();
      if(!session?.access_token)throw new Error('Please sign in.');
      const changedTiers=Object.fromEntries(Object.entries(candidate.manualFields).filter(([k,v])=>String(existing.troops?.[k]??'')!==v));
      const changedExtras=Object.fromEntries(Object.entries(candidate.extraFields||{}).filter(([k,v])=>String(existing[k]??'')!==String(v)));
      const tiers=mode==='tiers'?changedTiers:{};
      const extraFields=mode==='extras'?changedExtras:{};
      if(!Object.keys(tiers).length&&!Object.keys(extraFields).length)throw new Error('No changes found for this category.');
      const expected=Object.fromEntries(Object.keys(tiers).map(k=>[k,existing.troops?.[k]??'']));
      const expectedExtras=Object.fromEntries(Object.keys(extraFields).map(k=>[k,existing[k]??'']));
      const response=await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sheets-apply-troop-import`,{
        method:'POST',headers:{Authorization:`Bearer ${session.access_token}`,apikey:import.meta.env.VITE_SUPABASE_ANON_KEY,'Content-Type':'application/json'},
        body:JSON.stringify({stateId:String(stateId),fid:candidate.fid,alliance:previewAlliance,troops:tiers,extraFields,expected,expectedExtras}),
      });
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||'Import failed.');
      setPreviewRows(null);
      await onRosterUpdated?.();
      setMessage('Applied troop-level changes for '+candidate.fid+'. Roster refreshed. Re-preview the worksheet before another import.');
    }catch(e){setMessage(e.message||'Import failed.');}
    finally{setApplyingFid(null);}
  }
  const button={background:'#F5A623',color:'#0A1628',border:'none',padding:'12px 16px',minHeight:48,borderRadius:12,fontSize:16,fontWeight:700,width:'100%',cursor:'pointer'};
  const secondaryButton={...button,background:'#1E3A52',color:'#FFFFFF',border:'1px solid #36536B'};
  return <div style={{padding:16,minHeight:'60vh',color:'#fff'}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
      <h2 style={{fontSize:22,margin:0}}>Google Sheets</h2>
      <button aria-label="Close spreadsheet manager" onClick={onClose} style={{border:0,background:'transparent',color:'#A8C4D8',fontSize:25,minWidth:44,minHeight:44}}>×</button>
    </div>
    <section style={{background:'#152236',padding:18,borderRadius:16,marginBottom:14}}>
      <h3 style={{margin:'0 0 8px'}}>Google account</h3>
      <p style={{fontSize:14,color:'#A8C4D8',lineHeight:1.6,margin:'0 0 16px'}}>Sign in to access saved spreadsheet links and preview Google data. Importing changes into the app always requires your approval.</p>
      <p role="status" style={{fontSize:14,color:signedInEmail?'#A7E7C0':'#FFC5A8'}}>{signedInEmail?`Signed in as ${signedInEmail}`:'Not signed in to the app'}</p>
      {enabled && supabase && !signedInEmail && <div style={{marginBottom:14}}>
        <label htmlFor="sheet-auth-email" style={{display:'block',fontSize:14,color:'#A8C4D8',marginBottom:6}}>App account email</label>
        <input id="sheet-auth-email" type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}
         placeholder="Your existing account email" style={{background:'#0A1628',border:'1px solid #5A7A94',borderRadius:10,padding:12,color:'white',width:'100%',fontSize:16,minHeight:48,marginBottom:8}}/>
        {otpSent && <input aria-label="Email verification code" value={otp} onChange={e=>setOtp(e.target.value)}
         inputMode="numeric" autoComplete="one-time-code" placeholder="Email verification code"
         style={{background:'#0A1628',border:'1px solid #5A7A94',borderRadius:10,padding:12,color:'white',width:'100%',fontSize:16,minHeight:48,marginBottom:8}}/>}
        <button type="button" onClick={otpSent?verifyLoginCode:sendLoginCode} disabled={status==='signing-in'||!email.trim()||(otpSent&&!otp.trim())}
         style={{...button,background:'#1E3A52',color:'white',marginBottom:8}}>
          {otpSent?'Verify sign-in code':'Email me a sign-in code'}
        </button>
      </div>}
      {enabled ? <button disabled={status==='connecting'||!supabase||!signedInEmail} style={{...button,opacity:status==='connecting'?0.6:1}} onClick={connect}>{status==='connecting'?'Opening Google…':'Connect Google account'}</button>
      : <div role="status" style={{padding:12,border:'1px solid #5A7A94',borderRadius:10,color:'#A8C4D8',fontSize:14}}>Connection is not enabled in this build. Secure OAuth configuration and database migration must be completed first.</div>}
      {otpSent&&!signedInEmail&&<p style={{fontSize:13,color:'#A8C4D8'}}>If the email link opens another browser or the production app, copy the numeric code from the email and enter it here in this preview. Signing in on another domain does not share this preview’s session.</p>}
      {message&&<p role="alert" style={{fontSize:14,color:'#FFC5A8'}}>{message}</p>}
    </section>
    <section style={{background:'#152236',padding:18,borderRadius:16,marginBottom:14}}>
      <h3 style={{margin:'0 0 8px'}}>Your state spreadsheet</h3>
      <div style={{border:'1px solid #36536B',borderRadius:12,padding:12,marginBottom:14}}>
        <label htmlFor="sheet-state-choice" style={{display:'block',color:'#A8C4D8',fontSize:14,marginBottom:8}}>Spreadsheet state</label>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <select id="sheet-state-choice" value={stateId} onChange={e=>onSelectSheetState?.(e.target.value)} style={{flex:1,minWidth:140,padding:12,fontSize:16,borderRadius:10,background:'#0A1628',color:'white',border:'1px solid #5A7A94'}}>
            {getWorkspaces().states.map(id=><option key={id} value={id}>State {id}</option>)}
          </select>
          <button type="button" style={secondaryButton} onClick={()=>setAddingSheetState(!addingSheetState)}>+ State</button>
        </div>
        {addingSheetState&&<form onSubmit={e=>{e.preventDefault();try{const id=normalizeStateId(newSheetState);setMessage('');onSelectSheetState?.(id)}catch(error){setMessage(error.message)}}} style={{display:'flex',gap:8,marginTop:10}}>
          <input aria-label="New state number" inputMode="numeric" value={newSheetState} onChange={e=>setNewSheetState(e.target.value)} placeholder="State number" style={{minWidth:0,flex:1,padding:12,fontSize:16,background:'#0A1628',color:'white',border:'1px solid #5A7A94',borderRadius:10}}/>
          <button type="submit" style={button} disabled={!newSheetState.trim()}>Add & select</button>
        </form>}
        <p style={{fontSize:12,color:'#A8C4D8',margin:'10px 0 0'}}>Each state keeps its own saved spreadsheet link. Switching states reloads that state's roster and saved link.</p>
      </div>
      <label htmlFor="spreadsheet-id" style={{display:'block',fontSize:14,color:'#A8C4D8',marginBottom:8}}>Spreadsheet link</label>
      <input id="spreadsheet-id" type="text" value={spreadsheetId} onChange={e=>{
        const value=e.target.value;const found=value.match(new RegExp('spreadsheets/d/([A-Za-z0-9_-]+)'));
        setSpreadsheetId(found?found[1]:value);
        setPreviewRows(null);setSheetInfo(null);setColumnMapping({});setMessage('Spreadsheet changed. Preview worksheets to review the new file.');
      }} placeholder="Paste the Google Sheets link for this state" style={{background:'#0A1628',border:'1px solid #5A7A94',borderRadius:10,padding:12,color:'white',width:'100%',fontSize:16,minHeight:48,marginBottom:12}}/>
      <button style={{...button,opacity:!enabled||status==='loading'?0.5:1}} disabled={!enabled||status==='loading'||!spreadsheetId.trim()} onClick={previewMetadata}>
        {status==='loading'?'Reading worksheets…':'Load worksheets'}
      </button>
      <div style={{border:'1px solid #36536B',borderRadius:12,padding:12,marginBottom:14}}>
        <strong style={{color:'white'}}>Saved spreadsheet · State {stateId}</strong>
        <p style={{color:'#A8C4D8',fontSize:13,overflowWrap:'anywhere',margin:'8px 0'}}>{savedSpreadsheetId?`Saved link: ${savedSpreadsheetId}`:'No spreadsheet saved for this state yet.'}</p>
        <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
          <button type="button" onClick={saveDefaultSpreadsheet} disabled={!spreadsheetId.trim()||!enabled} style={secondaryButton}>Save link for this state</button>
          <button type="button" onClick={refreshSavedSpreadsheet} disabled={!savedSpreadsheetId||refreshingSavedSheet||!signedInEmail} style={button}>{refreshingSavedSheet?'Refreshing…':'Refresh Google worksheets'}</button>
          {savedSpreadsheetId&&<button type="button" onClick={removeDefaultSpreadsheet} style={{...secondaryButton,color:'#A8C4D8'}}>Remove saved link</button>}
        </div>
        <p style={{fontSize:12,color:'#A8C4D8',margin:'10px 0 0'}}>{cloudDefaultFeedback} Refreshing reads the worksheet list. Importing data requires reviewing individual rows. App changes are not automatically sent to Google.</p>
      </div>
      <div style={{border:'1px solid #36536B',borderRadius:12,padding:12,marginBottom:14}}>
        <strong style={{color:'white'}}>Update player records</strong>
        <p style={{color:'#A8C4D8',fontSize:13,lineHeight:1.5,margin:'8px 0'}}>Retrieve current player profiles from the Mightpulse API. You'll review the changes before applying them to the app roster.</p>
        <button type="button" style={secondaryButton} onClick={onPullApiData} disabled={!onPullApiData}>Refresh player data from API</button>
        <p style={{color:'#A8C4D8',fontSize:12,margin:'8px 0 0'}}>Does not modify Google Sheets. Updates are applied to the app only after approval.</p>
      </div>
      {sheetInfo&&<div aria-live="polite" style={{marginTop:14,color:'#A8C4D8'}}>
        <strong style={{color:'white'}}>{sheetInfo.title}</strong>
        <p style={{fontSize:13,margin:'8px 0'}}>Choose a worksheet to inspect</p>
        {(sheetInfo.worksheets||[]).map(w=><div key={w.id} style={{padding:'10px 0',borderTop:'1px solid #2A4A64',fontSize:14}}>{w.title} · up to {w.rows} rows <button type="button" onClick={()=>previewRowsForWorksheet(w.title)} style={{border:0,borderRadius:8,padding:'8px 12px',marginLeft:8,background:'#1E3A52',color:'white'}}>Preview</button></div>)}
      </div>}
      {previewRows&&['Combat','Events'].includes(previewRows.title)&&<div style={{marginTop:18,padding:14,background:'#0A1628',borderRadius:12}}>
        <h4 style={{margin:'0 0 8px',fontSize:18}}>{previewRows.title} import preview</h4>
        {(()=>{try{const plan=previewSpecialWorksheet({type:previewRows.title,values:previewRows.rows,players,stateId});
          if(previewRows.truncated)plan.errors.push('Worksheet has additional rows beyond the 100-row review limit. Approval is blocked.');
          return <div style={{color:'#A8C4D8',fontSize:14}}>
            <p>{plan.matched} matching rows · {plan.errors.length} conflicts · State {plan.stateId}</p>
            {plan.errors.length>0&&<ul>{plan.errors.slice(0,20).map((e,i)=><li key={i}>{e}</li>)}</ul>}
            {plan.matches.slice(0,20).map((m,i)=><div key={i} style={{fontSize:12,margin:'7px 0'}}>{m.fid} · {m.username} {m.troopType||m.eventId} · {Object.keys(m.updates).length} filled values
            <button type="button" disabled={!!applyingFid||!!plan.errors.length||!onRosterUpdated||!Object.keys(m.updates).length||(plan.type==='Events'&&(!m.eventId||!String(m.updates['Event Date UTC']||'').trim()))} onClick={()=>applySpecialRow(plan,m)} style={{marginLeft:8,padding:'8px 12px',background:'#1E3A52',color:'white',borderRadius:8,border:'1px solid #5A7A94'}}>Approve row</button>
          </div>)}
            <p>Review each row before writing to the player's saved Combat or Events worksheet data. Blank values are ignored. Existing event planner assignments are not overwritten.</p>
          </div>;
        }catch(e){return <p style={{color:'#FFC5A8'}}>{e.message}</p>}})()}
      </div>}
      {previewRows&&previewRows.rows.length>0&&!['Combat','Events'].includes(previewRows.title)&&<div style={{marginTop:18,padding:14,background:'#0A1628',borderRadius:12}}>
        <h4 style={{margin:'0 0 8px',fontSize:18}}>Map columns (read-only)</h4>
        <p style={{fontSize:13,color:'#A8C4D8',margin:'0 0 12px'}}>Check how worksheet headings correspond to app fields. For Joiner Heroes, enter only confirmed skill-5 heroes by name, for example Jessie; Norah; Mia. The app automatically records skill level 5. API-controlled fields cannot be overwritten.</p>
        {IMPORT_FIELDS.map(field=><label key={field.key} style={{display:'block',marginBottom:10,fontSize:14,color:'#A8C4D8'}}>
          {field.label} {field.authority==='api'?'· API-owned':field.authority==='manual'?'· Manual':'· Identity'}
          <select value={columnMapping[field.key]??''} onChange={e=>setColumnMapping(prev=>({...prev,[field.key]:e.target.value}))} style={{display:'block',width:'100%',minHeight:44,marginTop:5,background:'#152236',color:'white',border:'1px solid #5A7A94',borderRadius:9,padding:9,fontSize:16}}>
            <option value="">Not mapped</option>
            {(previewRows.rows[0]||[]).map((h,i)=><option value={String(i)} key={i}>{String.fromCharCode(65+i)} · {String(h??'').trim()||'(empty header)'}</option>)}
          </select>
        </label>)}
        {(()=>{const report=assessMapping(previewRows.rows,columnMapping);return <div aria-live="polite" style={{fontSize:14,color:'#A8C4D8'}}>
          <strong style={{color:'white'}}>Import assessment: {report.totalRows} populated rows</strong>
          {report.errors.length>0?<ul style={{paddingLeft:20}}>{report.errors.map((error,i)=><li key={i} style={{color:'#FFC5A8'}}>{error}</li>)}</ul>:<p style={{color:'#A7E7C0'}}>No structural issues detected in the previewed rows.</p>}
          <p style={{marginBottom:0}}>Structural checks only. No records have been changed.</p>
          {stateId&&(()=>{try{const plan=planStateRosterImport({values:previewRows.rows,mapping:columnMapping,players,stateId,worksheetAlliance:previewAlliance});return <div style={{marginTop:12,borderTop:'1px solid #36536B',paddingTop:12}}>
            <strong style={{color:'white'}}>State {plan.stateId} roster comparison</strong>
            <p>{plan.matched} existing players · {plan.proposedChanges} proposed troop-level updates · {plan.newPlayers} unmatched player IDs · {plan.errors.length} conflicts</p>
            {plan.errors.length>0&&<ul style={{paddingLeft:20,color:'#FFC5A8'}}>{plan.errors.slice(0,10).map((error,i)=><li key={i}>{error}</li>)}</ul>}
            {plan.candidates.filter(x=>x.changed).length>0&&<div style={{maxHeight:200,overflowY:'auto',marginBottom:12}}>{plan.candidates.filter(x=>x.changed).slice(0,25).map(x=><div key={x.fid} style={{fontSize:12,margin:'6px 0',color:'#A8C4D8'}}>Player {x.fid}: {[...Object.entries(x.manualFields),...Object.entries(x.extraFields||{}),...(x.joinerHeroes?.length?[['joinerHeroes',x.joinerHeroes.map(h=>h.hero+':'+h.skillLevel).join('; ')]]:[])].map(([type,value])=>type+' '+value).join(' · ')}
              <button type="button" disabled={!!applyingFid||plan.errors.length>0||report.errors.length>0||!plan.worksheetAlliance||!onRosterUpdated} onClick={()=>applySingleTierChange(x)} style={{display:'block',padding:'8px 12px',minHeight:40,borderRadius:8,marginTop:4,background:'#1E3A52',color:'white',border:'1px solid #5A7A94'}}> {applyingFid===x.fid?'Applying…':'Apply troop levels'} </button>
              <button type="button" disabled={!!applyingFid||!x.changedExtras||plan.errors.length>0||report.errors.length>0||!plan.worksheetAlliance||!onRosterUpdated} onClick={()=>applySingleTierChange(x,'extras')} style={{display:'block',padding:'8px 12px',minHeight:40,borderRadius:8,marginTop:4,background:'#1E3A52',color:'white',border:'1px solid #5A7A94'}}>Apply event power / language</button>
              <button type="button" disabled={!!applyingFid||!x.changedHeroes||plan.errors.length>0||report.errors.length>0||!onRosterUpdated} onClick={()=>applyJoinerHeroes(x)} style={{display:'block',padding:'8px 12px',minHeight:40,borderRadius:8,marginTop:4,background:'#1E3A52',color:'white',border:'1px solid #5A7A94'}}>Apply joiner heroes</button></div>)}</div>}
            {plan.candidates.filter(x=>x.kind==='new').slice(0,30).map(x=><div key={'new-'+x.fid} style={{margin:'8px 0',fontSize:13,color:'#A8C4D8'}}>
              New: {x.username||'(missing username)'} · {x.fid}
              <button type="button" disabled={!!applyingFid||!x.username||plan.errors.length>0||report.errors.length>0||!onRosterUpdated||!/^[A-Za-z0-9_-]{2,10}$/.test(previewAlliance)}
                onClick={()=>createReviewedPlayer(x)} style={{display:'block',padding:'8px 12px',minHeight:40,marginTop:4,background:'#1E3A52',color:'white',border:'1px solid #5A7A94',borderRadius:8}}> {applyingFid===x.fid?'Creating…':'Review & add player'} </button>
            </div>)}
            <p style={{marginBottom:0}}>Each player requires separate approval. API-owned fields are not overwritten. Google Sheets is not modified.</p>
          </div>;}catch(e){return <p style={{color:'#FFC5A8'}}>{e.message}</p>}})()}

        </div>})()}
      </div>}
      {previewRows&&<div style={{marginTop:14}}><strong>Read-only preview: {previewRows.title}</strong><p style={{fontSize:12,color:'#A8C4D8'}}>First 101 rows maximum. No changes have been saved.</p><div style={{overflowX:'auto',maxHeight:340,overflowY:'auto',fontSize:12}}><table style={{borderCollapse:'collapse'}}><tbody>{previewRows.rows.map((row,i)=><tr key={i}>{row.slice(0,20).map((v,j)=><td key={j} style={{border:'1px solid #36536B',padding:6,whiteSpace:'nowrap'}}>{String(v??'')}</td>)}</tr>)}</tbody></table></div></div>}
    </section>
    <details style={{background:'#152236',padding:18,borderRadius:16,marginBottom:14}}>
      <summary style={{fontSize:17,fontWeight:700,cursor:'pointer',minHeight:44}}>Create a new Google spreadsheet</summary>
      <h3 style={{margin:'0 0 8px'}}>Create a new spreadsheet</h3>
      <p style={{color:'#A8C4D8',fontSize:14,lineHeight:1.5}}>
        Create a new Google file from the selected state's saved roster. Includes alliance tabs, Combat and Events. This does not replace your saved default unless you choose to save it.
      </p>
      <label htmlFor="create-workbook-state" style={{display:'block',color:'#A8C4D8',fontSize:14,marginBottom:6}}>State number</label>
      <input id="create-workbook-state" inputMode="numeric" value={createState} onChange={e=>setCreateState(e.target.value)}
        placeholder="e.g. 3573" style={{background:'#0A1628',border:'1px solid #5A7A94',borderRadius:10,padding:12,color:'white',width:'100%',fontSize:16,minHeight:48,marginBottom:10}}/>
      <button type="button" style={button} disabled={!enabled||!signedInEmail||creatingWorkbook||!createState.trim()} onClick={createStateWorkbook}>
        {creatingWorkbook?'Creating spreadsheet…':'Create spreadsheet'}
      </button>
      <p style={{color:'#A8C4D8',fontSize:12,margin:'10px 0 0'}}>Creates a separate Google file. It will not overwrite any existing spreadsheet. Automatic two-way sync is not enabled.</p>
      {createdWorkbook?.spreadsheetUrl&&<p style={{fontSize:14,marginTop:12}}><a href={createdWorkbook.spreadsheetUrl} target="_blank" rel="noopener noreferrer" style={{color:'#F5A623'}}>Open created spreadsheet</a>{createdWorkbook.players!=null?` · ${createdWorkbook.players} players in ${createdWorkbook.alliances} alliance tabs`:''}</p>}
    </details>
    <section style={{background:'#152236',padding:18,borderRadius:16}}>
      <h3 style={{margin:'0 0 8px'}}>Sync status</h3>
      <p style={{color:'#A8C4D8',fontSize:14}}>Google account: {connectionChecking?'Checking…':connection?(connection.connected?'Saved connection found':'Not connected'):'Not checked'}</p>
      <button type="button" onClick={refreshConnection} disabled={connectionChecking||!enabled} aria-busy={connectionChecking} style={{background:'#1E3A52',color:'white',border:0,borderRadius:10,padding:12,minHeight:44,marginBottom:12,opacity:connectionChecking?0.65:1}}>{connectionChecking?'Checking connection…':'Refresh connection status'}</button>
      {connectionFeedback&&<p role="status" aria-live="polite" style={{fontSize:14,color:'#A8C4D8',margin:'0 0 8px'}}>{connectionFeedback}</p>}
      {connectionCheckedAt&&<p style={{fontSize:12,color:'#A8C4D8',margin:'0 0 8px'}}>Last checked: {connectionCheckedAt.toLocaleTimeString()}</p>}
      {connection?.connectedAt&&<p style={{fontSize:12,color:'#A8C4D8',margin:'0 0 8px'}}>Google credentials saved: {new Date(connection.connectedAt).toLocaleString()}</p>}
      <p style={{margin:0,fontSize:14,color:'#A8C4D8'}}>Saved links and manual previews are supported. Automatic app-to-Google updates are not enabled yet.</p>
    </section>
  </div>;
}
