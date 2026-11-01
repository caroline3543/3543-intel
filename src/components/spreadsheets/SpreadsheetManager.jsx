import { useState } from 'react';
import { supabase } from '../../services/supabaseClient.js';

/** Feature-gated setup screen. No Sheets writes and no browser OAuth secrets. */
export function SpreadsheetManager({ onClose }) {
  const [status,setStatus] = useState('idle');
  const [message,setMessage] = useState('');
  const [spreadsheetId,setSpreadsheetId]=useState('');
  const [sheetInfo,setSheetInfo]=useState(null);
  const [email,setEmail]=useState('');
  const [otp,setOtp]=useState('');
  const [otpSent,setOtpSent]=useState(false);
  const enabled = import.meta.env.VITE_ENABLE_GOOGLE_SHEETS === 'true';
  async function sendLoginCode() {
    if(!supabase)return;
    setStatus('signing-in');setMessage('');
    const {error}=await supabase.auth.signInWithOtp({email:email.trim(),options:{shouldCreateUser:false}});
    if(error){setMessage('Could not send a sign-in code. Verify the email is registered.');setStatus('error');return;}
    setOtpSent(true);setStatus('idle');
    setMessage('Check your email for the sign-in code.');
  }
  async function verifyLoginCode() {
    if(!supabase)return;
    setStatus('signing-in');setMessage('');
    const {error}=await supabase.auth.verifyOtp({email:email.trim(),token:otp.trim(),type:'email'});
    if(error){setMessage('The code could not be verified.');setStatus('error');return;}
    setStatus('idle');setMessage('Signed in. You can now connect Google Sheets.');
  }
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
  const button={background:'#F5A623',color:'#0A1628',border:'none',padding:'12px 16px',minHeight:48,borderRadius:12,fontSize:16,fontWeight:700,width:'100%',cursor:'pointer'};
  return <div style={{padding:20,minHeight:'60vh',color:'#fff'}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
      <h2 style={{fontSize:22,margin:0}}>📋 Spreadsheet Manager</h2>
      <button aria-label="Close spreadsheet manager" onClick={onClose} style={{border:0,background:'transparent',color:'#A8C4D8',fontSize:25,minWidth:44,minHeight:44}}>×</button>
    </div>
    <section style={{background:'#152236',padding:18,borderRadius:16,marginBottom:14}}>
      <h3 style={{margin:'0 0 8px'}}>Connect Google Sheets</h3>
      <p style={{fontSize:14,color:'#A8C4D8',lineHeight:1.6,margin:'0 0 16px'}}>Connect a Google account, then select a spreadsheet and preview its player records before importing. Existing roster data will remain unchanged until an import is explicitly approved.</p>
      {enabled && supabase && <div style={{marginBottom:14}}>
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
      {enabled ? <button disabled={status==='connecting'||!supabase} style={{...button,opacity:status==='connecting'?0.6:1}} onClick={connect}>{status==='connecting'?'Opening Google…':'Connect Google account'}</button>
      : <div role="status" style={{padding:12,border:'1px solid #5A7A94',borderRadius:10,color:'#A8C4D8',fontSize:14}}>Connection is not enabled in this build. Secure OAuth configuration and database migration must be completed first.</div>}
      {message&&<p role="alert" style={{fontSize:14,color:'#FFC5A8'}}>{message}</p>}
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
        {(sheetInfo.worksheets||[]).map(w=><div key={w.id} style={{padding:'10px 0',borderTop:'1px solid #2A4A64',fontSize:14}}>{w.title} · up to {w.rows} rows</div>)}
      </div>}
    </section>
    <section style={{background:'#152236',padding:18,borderRadius:16}}>
      <h3 style={{margin:'0 0 8px'}}>Sync status</h3>
      <p style={{margin:0,fontSize:14,color:'#A8C4D8'}}>No Google spreadsheet synchronisation is active. Changes made here are not sent to Google Sheets.</p>
    </section>
  </div>;
}
