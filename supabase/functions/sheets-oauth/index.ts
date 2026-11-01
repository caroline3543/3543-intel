// Supabase Edge Function: authenticated Google OAuth start and callback.
// Required secrets: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI,
// GOOGLE_TOKEN_ENCRYPTION_KEY (base64 32-byte AES-GCM key), SUPABASE_URL, SUPABASE_ANON_KEY,
// SUPABASE_SERVICE_ROLE_KEY. Requires the DRAFT OAuth tables to be migrated first.
// Intentionally unavailable until configured; no credentials are exposed to the browser.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const scope = 'https://www.googleapis.com/auth/spreadsheets';
const ALLOWED_ORIGINS=['https://3543-intel.vercel.app'];
const json = (data: unknown, status = 200, origin = '') => new Response(JSON.stringify(data), {status, headers:{'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin', ...(ALLOWED_ORIGINS.includes(origin)?{'Access-Control-Allow-Origin':origin}:{}),'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, GET, OPTIONS'}});
const required=(k:string)=>{const v=Deno.env.get(k);if(!v)throw new Error('Missing server configuration: '+k);return v};
function b64(bytes:Uint8Array){return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
async function hash(v:string){const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v));return Array.from(new Uint8Array(d)).map(x=>x.toString(16).padStart(2,'0')).join('')}
async function encrypt(text:string){
 const raw=Uint8Array.from(atob(required('GOOGLE_TOKEN_ENCRYPTION_KEY')), c=>c.charCodeAt(0));
 if(raw.length!==32)throw new Error('Encryption key must be 32 bytes');
 const key=await crypto.subtle.importKey('raw',raw,'AES-GCM',false,['encrypt']);
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(text));
 return JSON.stringify({v:1,iv:b64(iv),ciphertext:b64(new Uint8Array(encrypted))});
}
Deno.serve(async req=>{
 try{
  const origin=req.headers.get('origin')||'';
  if(origin&&!ALLOWED_ORIGINS.includes(origin))return json({error:'Origin not allowed'},403,origin);
  if(req.method==='OPTIONS')return json({},200,origin);
  const url=new URL(req.url);
  const base=new URL(required('GOOGLE_REDIRECT_URI'));
  if(base.protocol!=='https:'||base.search||base.hash) return json({error:'Invalid redirect configuration'},503);
  const service=createClient(required('SUPABASE_URL'),required('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false}});
  if(req.method==='POST' && url.pathname.endsWith('/start')){
    const jwt=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
    if(!jwt)return json({error:'Authentication required'},401);
    const auth=createClient(required('SUPABASE_URL'),required('SUPABASE_ANON_KEY'),{auth:{persistSession:false}});
    const {data:{user},error}=await auth.auth.getUser(jwt);
    if(error||!user)return json({error:'Authentication required'},401);
    const state=b64(crypto.getRandomValues(new Uint8Array(32)));
    const stateHash=await hash(state);
    const {error:dbError}=await service.from('spreadsheet_oauth_states').insert({
      state_hash:stateHash,user_id:user.id,expires_at:new Date(Date.now()+10*60_000).toISOString()
    });
    if(dbError)return json({error:'OAuth state storage unavailable'},503);
    const google=new URL('https://accounts.google.com/o/oauth2/v2/auth');
    for(const [k,v] of Object.entries({client_id:required('GOOGLE_CLIENT_ID'),redirect_uri:base.toString(),response_type:'code',scope,access_type:'offline',prompt:'consent',state}))google.searchParams.set(k,v);
    return json({authorization_url:google.toString()},200,origin);
  }
  if(req.method==='GET' && url.pathname.endsWith('/callback')){
    const state=url.searchParams.get('state')||'',code=url.searchParams.get('code')||'';
    if(!/^[a-zA-Z0-9_-]{32,256}$/.test(state))return json({error:'Invalid OAuth state'},400);
    const stateHash=await hash(state);
    // Atomic consumption prevents replay: DELETE returns the removed row only once.
    const {data:rows,error:consumeError}=await service.from('spreadsheet_oauth_states').delete().eq('state_hash',stateHash).gt('expires_at',new Date().toISOString()).select('user_id');
    if(consumeError||!rows||rows.length!==1)return json({error:'Expired or reused OAuth state'},400);
    if(!code)return json({error:'Google authorization was declined or incomplete'},400);
    const tokenResponse=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code,client_id:required('GOOGLE_CLIENT_ID'),client_secret:required('GOOGLE_CLIENT_SECRET'),redirect_uri:base.toString(),grant_type:'authorization_code'})});
    if(!tokenResponse.ok)return json({error:'Google token exchange failed'},502);
    const tokens=await tokenResponse.json();
    if(!tokens.refresh_token)return json({error:'Google did not provide offline access; reconnect account'},409);
    const encrypted=await encrypt(tokens.refresh_token);
    const {error:saveError}=await service.from('spreadsheet_google_credentials').upsert({user_id:rows[0].user_id,refresh_token_encrypted:encrypted,updated_at:new Date().toISOString()},{onConflict:'user_id'});
    if(saveError)return json({error:'Credential storage unavailable'},503);
    return new Response(null,{status:303,headers:{Location:'https://3543-intel.vercel.app/?sheets_connected=1','Cache-Control':'no-store'}});
  }
  return json({error:'Not found'},404);
 }catch(e){console.error('Sheets OAuth configuration/processing error',e instanceof Error?e.name:'unknown');return json({error:'OAuth flow unavailable'},503)}
});
