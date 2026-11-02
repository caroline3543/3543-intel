// Authenticated, read-only worksheet values. No rows are imported or written.
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
const ORIGINS=['https://3543-intel.vercel.app','https://3543-intel-git-feat-spreadsheet-s-8ea8a3-sunfire-castle-planner.vercel.app'];
const secret=(k:string)=>{const v=Deno.env.get(k);if(!v)throw Error('Missing '+k);return v};
const bytes=(s:string)=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(s.length/4)*4,'=')),c=>c.charCodeAt(0));
function reply(req:Request,data:unknown,status=200){const origin=req.headers.get('origin')||'';return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin',...(ORIGINS.includes(origin)?{'Access-Control-Allow-Origin':origin}:{}),'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'}})}
Deno.serve(async req=>{
 const origin=req.headers.get('origin')||'';
 if(origin&&!ORIGINS.includes(origin))return reply(req,{error:'Origin not permitted'},403);
 if(req.method==='OPTIONS')return reply(req,{},200);
 if(req.method!=='POST')return reply(req,{error:'Method not permitted'},405);
 try{
  const jwt=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
  if(!jwt)return reply(req,{error:'Sign in required'},401);
  const auth=createClient(secret('SUPABASE_URL'),secret('SUPABASE_ANON_KEY'),{auth:{persistSession:false}});
  const {data:{user},error}=await auth.auth.getUser(jwt);
  if(error||!user)return reply(req,{error:'Sign in required'},401);
  const input=await req.json().catch(()=>null);
  const id=input?.spreadsheetId, worksheetTitle=input?.worksheetTitle;
  if(typeof id!=='string'||!/^[A-Za-z0-9_-]{15,200}$/.test(id))return reply(req,{error:'Invalid spreadsheet ID'},400);
  if(typeof worksheetTitle!=='string'||!worksheetTitle||worksheetTitle.length>100||/[\x00-\x1f]/.test(worksheetTitle))return reply(req,{error:'Invalid worksheet title'},400);
  const admin=createClient(secret('SUPABASE_URL'),secret('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false}});
  const {data:credential,error:dbError}=await admin.from('spreadsheet_google_credentials').select('refresh_token_encrypted').eq('user_id',user.id).maybeSingle();
  if(dbError||!credential)return reply(req,{error:'Google account not connected'},409);
  const tokenData=JSON.parse(credential.refresh_token_encrypted);
  if(tokenData.v!==1)throw Error('Unsupported encrypted token');
  const key=await crypto.subtle.importKey('raw',bytes(secret('GOOGLE_TOKEN_ENCRYPTION_KEY')),'AES-GCM',false,['decrypt']);
  const plaintext=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(tokenData.iv)},key,bytes(tokenData.ciphertext));
  const refresh=new TextDecoder().decode(plaintext);
  const tokenResponse=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:secret('GOOGLE_CLIENT_ID'),client_secret:secret('GOOGLE_CLIENT_SECRET'),refresh_token:refresh,grant_type:'refresh_token'})});
  if(!tokenResponse.ok)return reply(req,{error:'Google account must be reconnected'},401);
  const access=await tokenResponse.json();
  if(!access.access_token)return reply(req,{error:'Google token refresh unavailable'},502);
  const range="'"+worksheetTitle.replace(/'/g,"''")+"'!A1:T101";
  const g=await fetch('https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(id)+'/values/'+encodeURIComponent(range)+'?valueRenderOption=UNFORMATTED_VALUE',{headers:{Authorization:'Bearer '+access.access_token}});
  if(!g.ok)return reply(req,{error:'Worksheet could not be read',providerStatus:g.status},g.status===404?404:502);
  const data=await g.json();
  return reply(req,{range:data.range,rows:(data.values||[]).slice(0,101),truncated:(data.values||[]).length>101,rowLimit:101,columnLimit:20,readOnly:true});
 }catch(e){console.error('Sheets preview error',e instanceof Error?e.name:'unknown');return reply(req,{error:'Worksheet preview unavailable'},503)}
});
