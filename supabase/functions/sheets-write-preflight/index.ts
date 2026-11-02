// Owner-authenticated, read-only preflight for a future Google Sheets write.
// Never sends a Google write request. Every proposed cell is re-read live.
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
const OWNER='f560b117-a3db-4692-b0bf-fd372044130c';
const ORIGINS=['https://3543-intel.vercel.app','https://3543-intel-git-feat-spreadsheet-s-8ea8a3-sunfire-castle-planner.vercel.app'];
const env=(k:string)=>{const v=Deno.env.get(k);if(!v)throw Error('Missing '+k);return v};
const bytes=(s:string)=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(s.length/4)*4,'=')),c=>c.charCodeAt(0));
function reply(req:Request,data:unknown,status=200){const origin=req.headers.get('origin')||'';return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin',...(ORIGINS.includes(origin)?{'Access-Control-Allow-Origin':origin}:{}),'Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'}})}
Deno.serve(async req=>{
 const origin=req.headers.get('origin')||'';
 if(origin&&!ORIGINS.includes(origin))return reply(req,{error:'Origin not allowed'},403);
 if(req.method==='OPTIONS')return reply(req,{},200);
 if(req.method!=='POST')return reply(req,{error:'Method not allowed'},405);
 try{
  const bearer=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
  if(!bearer)return reply(req,{error:'Sign in required'},401);
  const auth=createClient(env('SUPABASE_URL'),env('SUPABASE_ANON_KEY'),{auth:{persistSession:false}});
  const {data:{user},error}=await auth.auth.getUser(bearer);
  if(error||user?.id!==OWNER)return reply(req,{error:'Not authorised'},403);
  const payload=await req.json().catch(()=>null);
  const state=String(payload?.stateId??''),id=payload?.spreadsheetId,title=payload?.worksheetTitle;
  const proposals=payload?.proposals;
  if(!/^[1-9]\d{0,4}$/.test(state)||typeof id!=='string'||!/^[A-Za-z0-9_-]{15,200}$/.test(id)||typeof title!=='string'||!title||title.length>100||/[\x00-\x1f]/.test(title)||!Array.isArray(proposals)||proposals.length<1||proposals.length>20)return reply(req,{error:'Invalid preflight request'},400);
  const db=createClient(env('SUPABASE_URL'),env('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false}});
  const {data:linked,error:linkError}=await db.from('spreadsheet_connections').select('spreadsheet_id').eq('owner_user_id',user.id).eq('state_id',state).eq('status','default').maybeSingle();
  if(linkError)return reply(req,{error:'Connection lookup failed'},503);
  if(linked?.spreadsheet_id!==id)return reply(req,{error:'Spreadsheet is not the saved default for this state'},409);
  const {data:credential,error:credentialError}=await db.from('spreadsheet_google_credentials').select('refresh_token_encrypted').eq('user_id',user.id).maybeSingle();
  if(credentialError||!credential)return reply(req,{error:'Connect Google before checking updates'},409);
  const token=JSON.parse(credential.refresh_token_encrypted);
  if(token.v!==1)throw Error('Unsupported encrypted token');
  const key=await crypto.subtle.importKey('raw',bytes(env('GOOGLE_TOKEN_ENCRYPTION_KEY')),'AES-GCM',false,['decrypt']);
  const refresh=new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(token.iv)},key,bytes(token.ciphertext)));
  const t=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env('GOOGLE_CLIENT_ID'),client_secret:env('GOOGLE_CLIENT_SECRET'),refresh_token:refresh,grant_type:'refresh_token'})});
  if(!t.ok)return reply(req,{error:'Reconnect your Google account'},401);
  const access=(await t.json()).access_token;
  if(!access)return reply(req,{error:'Could not obtain Google access'},502);
  const checked=[],duplicates=new Set<string>();
  for(const proposal of proposals){
   const row=proposal?.row,column=proposal?.column,expected=proposal?.expected;
   const allowed=['Availability','Joiner Heroes','Infantry Troop Level','Lancer Troop Level','Marksman Troop Level'];
   if(!Number.isSafeInteger(row)||row<2||row>101||!allowed.includes(column)||typeof expected!=='string'||expected.length>500)return reply(req,{error:'Invalid proposal or unapproved field'},400);
   const key=String(row)+':'+column;
   if(duplicates.has(key))return reply(req,{error:'Duplicate proposed cell'},400);
   duplicates.add(key);
  }
  // Fetch the entire bounded worksheet for identity, heading and cell verification.
  const range="'"+title.replace(/'/g,"''")+"'!A1:T102";
  const g=await fetch('https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(id)+'/values/'+encodeURIComponent(range)+'?valueRenderOption=UNFORMATTED_VALUE',{headers:{Authorization:'Bearer '+access}});
  if(!g.ok)return reply(req,{error:'Google worksheet read failed',providerStatus:g.status},502);
  const all=(await g.json()).values||[];
  if(all.length>101)return reply(req,{error:'Worksheet exceeds safe review limit'},409);
  const headers=(all[0]||[]).map((x:unknown)=>String(x??'').trim());
  if(new Set(headers.filter(Boolean)).size!==headers.filter(Boolean).length)return reply(req,{error:'Duplicate headings'},409);
  for(const col of ['Player ID','State','Alliance'])if(!headers.includes(col))return reply(req,{error:'Missing identity heading'},409);
  for(const proposal of proposals){
   const row=all[proposal.row-1]||[];
   const field=headers.indexOf(proposal.column);
   if(field<0||field>=20)return reply(req,{error:'Requested column is unavailable'},409);
   const fid=String(row[headers.indexOf('Player ID')]??'').trim(),rowState=String(row[headers.indexOf('State')]??'').trim();
   const alliance=String(row[headers.indexOf('Alliance')]??'').trim().toUpperCase();
   const current=String(row[field]??'').trim();
   const valid= /^\d{4,15}$/.test(fid)&&fid===String(proposal.fid??'')&&rowState===state&&alliance===String(proposal.alliance??'').trim().toUpperCase();
   const unchanged=current===proposal.expected.trim();
   checked.push({row:proposal.row,column:proposal.column,match:valid&&unchanged,reason:!valid?'Player, state or alliance changed':!unchanged?'Google cell changed':null});
  }
  return reply(req,{readOnly:true,writeEnabled:false,allMatched:checked.every(c=>c.match),checked});
 }catch{return reply(req,{error:'Preflight unavailable'},503)}
});
