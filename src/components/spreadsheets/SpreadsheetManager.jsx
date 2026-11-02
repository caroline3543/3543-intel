import { useEffect, useState } from 'react';
import { supabase } from '../../services/supabaseClient.js';
import { IMPORT_FIELDS, detectMapping, assessMapping } from '../../services/worksheetMappingPreview.js';
import { planStateRosterImport } from '../../services/stateRosterImportPreview.js';

/** Feature-gated setup screen. No Sheets writes and no browser OAuth secrets. */
export function SpreadsheetManager({ onClose, players = [], stateId }) {
  const [status,setStatus] = useState('idle');
  const [message,setMessage] = useState('');
  const [spreadsheetId,setSpreadsheetId]=useState('');
  const [sheetInfo,setSheetInfo]=useState(null);
  const [email,setEmail]=useState('');
  const [otp,setOtp]=useState('');
  const [otpSent,setOtpSent]=useState(false);
  const [connection,setConnection]=useState(null);
  const [previewRows,setPreviewRows]=useState(null);
  const [columnMapping,setColumnMapping]=useState({});
  const [previewAlliance,setPreviewAlliance]=useState('');
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
    if(!supabase||!enabled)return;
    try {
      const {data:{session}}=await supabase.auth.getSession();
      if(!session?.access_token){setConnection(null);return;}
      const response=await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sheets-status`,{headers:{
        Authorization:`Bearer ${session.access_token}`,apikey:import.meta.env.VITE_SUPABASE_ANON_KEY,
      }});
      if(response.ok)setConnection(await response.json());
    }catch {setConnection(null);}
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
      setPreviewRows({title,rows:data.rows});setColumnMapping(detectMapping(data.rows?.[0]||[]));setStatus('ready');
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
    }catch(error){setMessage(error.message||'Spreadsheet creation failed.');}
    finally{setCreatingWorkbook(false);}
  }
  const button={background:'#F5A623',color:'#0A1628',border:'none',padding:'12px 16px',minHeight:48,borderRadius:12,fontSize:16,fontWeight:700,width:'100%',cursor:'pointer'};
  return <div style={{padding:20,minHeight:'60vh',color:'#fff'}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
      <h2 style={{fontSize:22,margin:0}}>📋 Spreadsheet Manager</h2>
      <button aria-label="Close spreadsheet manager" onClick={onClose} style={{border:0,background:'transparent',color:'#A8C4D8',fontSize:25,minWidth:44,minHeight:44}}>×</button>
    </div>
    <section style={{background:'#152236',padding:18,borderRadius:16,marginBottom:14}}>
      <h3 style={{margin:'0 0 8px'}}>Connect Google Sheets</h3>
      <p style={{fontSize:14,color:'#A8C4D8',lineHeight:1.6,margin:'0 0 16px'}}>Connect a Google account, then select a spreadsheet and preview its player records before importing. Existing roster data will remain unchanged until an import is explicitly approved.</p>
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
      <h3 style={{margin:'0 0 8px'}}>Create a state spreadsheet</h3>
      <p style={{color:'#A8C4D8',fontSize:14,lineHeight:1.5}}>
        One new Google workbook per state, with one tab per alliance. The app fills player IDs, usernames, alliance, furnace and available player statistics from the selected state's roster. Unverified fields stay empty.
      </p>
      <label htmlFor="create-workbook-state" style={{display:'block',color:'#A8C4D8',fontSize:14,marginBottom:6}}>State number</label>
      <input id="create-workbook-state" inputMode="numeric" value={createState} onChange={e=>setCreateState(e.target.value)}
        placeholder="e.g. 3573" style={{background:'#0A1628',border:'1px solid #5A7A94',borderRadius:10,padding:12,color:'white',width:'100%',fontSize:16,minHeight:48,marginBottom:10}}/>
      <button type="button" style={button} disabled={!enabled||!signedInEmail||creatingWorkbook||!createState.trim()} onClick={createStateWorkbook}>
        {creatingWorkbook?'Creating spreadsheet…':'Create spreadsheet'}
      </button>
      <p style={{color:'#A8C4D8',fontSize:12,margin:'10px 0 0'}}>Exports the currently saved Supabase roster for one state into a new Google file. Members, Events and Hive use the app roster; editing this Google file does NOT yet update that roster. State-scoped, reviewed import and conflict handling are required before two-way syncing can be enabled. Owner-only.</p>
      {createdWorkbook?.spreadsheetUrl&&<p style={{fontSize:14,marginTop:12}}><a href={createdWorkbook.spreadsheetUrl} target="_blank" rel="noopener noreferrer" style={{color:'#F5A623'}}>Open created spreadsheet</a>{createdWorkbook.players!=null?` · ${createdWorkbook.players} players in ${createdWorkbook.alliances} alliance tabs`:''}</p>}
    </section>
    <section style={{background:'#152236',padding:18,borderRadius:16,marginBottom:14}}>
      <h3 style={{margin:'0 0 8px'}}>Find a spreadsheet</h3>
      <label htmlFor="spreadsheet-id" style={{display:'block',fontSize:14,color:'#A8C4D8',marginBottom:8}}>Google spreadsheet ID or URL</label>
      <input id="spreadsheet-id" type="text" value={spreadsheetId} onChange={e=>{
        const value=e.target.value;const found=value.match(new RegExp('spreadsheets/d/([A-Za-z0-9_-]+)'));
        setSpreadsheetId(found?found[1]:value);
      }} placeholder="Paste a Google Sheets URL" style={{background:'#0A1628',border:'1px solid #5A7A94',borderRadius:10,padding:12,color:'white',width:'100%',fontSize:16,minHeight:48,marginBottom:12}}/>
      <button style={{...button,opacity:!enabled||status==='loading'?0.5:1}} disabled={!enabled||status==='loading'||!spreadsheetId.trim()} onClick={previewMetadata}>
        {status==='loading'?'Reading worksheets…':'Preview worksheets'}
      </button>
      {sheetInfo&&<div aria-live="polite" style={{marginTop:14,color:'#A8C4D8'}}>
        <strong style={{color:'white'}}>{sheetInfo.title}</strong>
        <p style={{fontSize:13,margin:'8px 0'}}>Worksheets (read-only)</p>
        {(sheetInfo.worksheets||[]).map(w=><div key={w.id} style={{padding:'10px 0',borderTop:'1px solid #2A4A64',fontSize:14}}>{w.title} · up to {w.rows} rows <button type="button" onClick={()=>previewRowsForWorksheet(w.title)} style={{border:0,borderRadius:8,padding:'8px 12px',marginLeft:8,background:'#1E3A52',color:'white'}}>Preview</button></div>)}
      </div>}
      {previewRows&&previewRows.rows.length>0&&<div style={{marginTop:18,padding:14,background:'#0A1628',borderRadius:12}}>
        <h4 style={{margin:'0 0 8px',fontSize:18}}>Map columns (read-only)</h4>
        <p style={{fontSize:13,color:'#A8C4D8',margin:'0 0 12px'}}>Check how the worksheet headings correspond to app fields. API-controlled fields are displayed for reference and cannot be overwritten by this preview.</p>
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
            {plan.candidates.filter(x=>x.changed).length>0&&<div style={{maxHeight:200,overflowY:'auto',marginBottom:12}}>{plan.candidates.filter(x=>x.changed).slice(0,25).map(x=><p key={x.fid} style={{fontSize:12,margin:'4px 0',color:'#A8C4D8'}}>Player {x.fid}: {Object.entries(x.manualFields).map(([type,tier])=>type+' '+tier).join(' · ')}</p>)}</div>}
            <p style={{marginBottom:0}}>Review only. Changes are not yet applied; the shared roster, other app sections and Google Sheet remain unchanged.</p>
          </div>;}catch(e){return <p style={{color:'#FFC5A8'}}>{e.message}</p>}})()}

        </div>})()}
      </div>}
      {previewRows&&<div style={{marginTop:14}}><strong>Read-only preview: {previewRows.title}</strong><p style={{fontSize:12,color:'#A8C4D8'}}>First 101 rows maximum. No changes have been saved.</p><div style={{overflowX:'auto',maxHeight:340,overflowY:'auto',fontSize:12}}><table style={{borderCollapse:'collapse'}}><tbody>{previewRows.rows.map((row,i)=><tr key={i}>{row.slice(0,20).map((v,j)=><td key={j} style={{border:'1px solid #36536B',padding:6,whiteSpace:'nowrap'}}>{String(v??'')}</td>)}</tr>)}</tbody></table></div></div>}
    </section>
    <section style={{background:'#152236',padding:18,borderRadius:16}}>
      <h3 style={{margin:'0 0 8px'}}>Sync status</h3>
      {connection&&<p style={{color:'#A8C4D8',fontSize:14}}>Google account: {connection.connected?'Connected':'Not connected'}</p>}
      <button type="button" onClick={refreshConnection} style={{background:'#1E3A52',color:'white',border:0,borderRadius:10,padding:12,minHeight:44,marginBottom:12}}>Refresh connection status</button>
      <p style={{margin:0,fontSize:14,color:'#A8C4D8'}}>No Google spreadsheet synchronisation is active. Changes made here are not sent to Google Sheets.</p>
    </section>
  </div>;
}
