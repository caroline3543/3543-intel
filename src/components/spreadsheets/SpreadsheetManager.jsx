import { useState } from 'react';
import { supabase } from '../../services/supabaseClient.js';

/** Feature-gated setup screen. No Sheets writes and no browser OAuth secrets. */
export function SpreadsheetManager({ onClose }) {
  const [status,setStatus] = useState('idle');
  const [message,setMessage] = useState('');
  const enabled = import.meta.env.VITE_ENABLE_GOOGLE_SHEETS === 'true';
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
  const button={background:'#F5A623',color:'#0A1628',border:'none',padding:'12px 16px',minHeight:48,borderRadius:12,fontSize:16,fontWeight:700,width:'100%',cursor:'pointer'};
  return <div style={{padding:20,minHeight:'60vh',color:'#fff'}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
      <h2 style={{fontSize:22,margin:0}}>📋 Spreadsheet Manager</h2>
      <button aria-label="Close spreadsheet manager" onClick={onClose} style={{border:0,background:'transparent',color:'#A8C4D8',fontSize:25,minWidth:44,minHeight:44}}>×</button>
    </div>
    <section style={{background:'#152236',padding:18,borderRadius:16,marginBottom:14}}>
      <h3 style={{margin:'0 0 8px'}}>Connect Google Sheets</h3>
      <p style={{fontSize:14,color:'#A8C4D8',lineHeight:1.6,margin:'0 0 16px'}}>Connect a Google account, then select a spreadsheet and preview its player records before importing. Existing roster data will remain unchanged until an import is explicitly approved.</p>
      {enabled ? <button disabled={status==='connecting'||!supabase} style={{...button,opacity:status==='connecting'?0.6:1}} onClick={connect}>{status==='connecting'?'Opening Google…':'Connect Google account'}</button>
      : <div role="status" style={{padding:12,border:'1px solid #5A7A94',borderRadius:10,color:'#A8C4D8',fontSize:14}}>Connection is not enabled in this build. Secure OAuth configuration and database migration must be completed first.</div>}
      {message&&<p role="alert" style={{fontSize:14,color:'#FFC5A8'}}>{message}</p>}
    </section>
    <section style={{background:'#152236',padding:18,borderRadius:16}}>
      <h3 style={{margin:'0 0 8px'}}>Sync status</h3>
      <p style={{margin:0,fontSize:14,color:'#A8C4D8'}}>No Google spreadsheet synchronisation is active. Changes made here are not sent to Google Sheets.</p>
    </section>
  </div>;
}
