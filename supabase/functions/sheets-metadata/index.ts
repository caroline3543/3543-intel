// Read-only Google Sheets metadata / worksheet preview.
// Deploy only after OAuth credentials, secure token tables and ownership rules are configured.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const ROOT='https://sheets.googleapis.com/v4/spreadsheets';
const ALLOWED_ORIGINS=['https://3543-intel.vercel.app','https://3543-intel-git-feat-spreadsheet-s-8ea8a3-sunfire-castle-planner.vercel.app'];
function respond(req:Request,data:unknown,status=200){
 const origin=req.headers.get('origin')||'';
 const headers:Record<string,string>={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
 if(ALLOWED_ORIGINS.includes(origin))headers['Access-Control-Allow-Origin']=origin;
 headers['Access-Control-Allow-Headers']='authorization, apikey, content-type, x-client-info';
 headers['Access-Control-Allow-Methods']='POST, OPTIONS';
 return new Response(JSON.stringify(data),{status,headers});
}
function base64ToBytes(s:string){
 const b=atob(s.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(s.length/4)*4,'='));
 return Uint8Array.from(b,c=>c.charCodeAt(0));
}
async function decrypt(value:string,key64:string){
 const v=JSON.parse(value);
 if(v?.v!==1)throw new Error('Unsupported credential version');
 const key=await crypto.subtle.importKey('raw',base64ToBytes(key64),'AES-GCM',false,['decrypt']);
 const bytes=await crypto.subtle.decrypt({name:'AES-GCM',iv:base64ToBytes(v.iv)},key,base64ToBytes(v.ciphertext));
 return new TextDecoder().decode(bytes);
}
const secret=(name:string)=>{const value=Deno.env.get(name);if(!value)throw new Error('Missing '+name);return value};
Deno.serve(async req=>{
 try{
  const origin=req.headers.get('origin')||'';
  if(origin&&!ALLOWED_ORIGINS.includes(origin))return respond(req,{error:'Origin not allowed'},403);
  if(req.method==='OPTIONS')return respond(req,{},200);
  if(req.method!=='POST')return respond(req,{error:'Method not allowed'},405);
  const token=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
  if(!token)return respond(req,{error:'Sign in required'},401);
  const url=secret('SUPABASE_URL');
  const auth=createClient(url,secret('SUPABASE_ANON_KEY'),{auth:{persistSession:false}});
  const {data:{user},error}=await auth.auth.getUser(token);
  if(error||!user)return respond(req,{error:'Sign in required'},401);
  const input=await req.json().catch(()=>null);
  const id=input?.spreadsheetId;
  if(typeof id!=='string'||! /^[A-Za-z0-9_-]{15,200}$/.test(id))return respond(req,{error:'Invalid spreadsheet ID'},400);
  const service=createClient(url,secret('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false}});
  const {data:credential,error:dbError}=await service.from('spreadsheet_google_credentials')
    .select('refresh_token_encrypted').eq('user_id',user.id).maybeSingle();
  if(dbError||!credential)return respond(req,{error:'Google account not connected'},409);
  const refreshToken=await decrypt(credential.refresh_token_encrypted,secret('GOOGLE_TOKEN_ENCRYPTION_KEY'));
  const tokenResponse=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({
   client_id:secret('GOOGLE_CLIENT_ID'),client_secret:secret('GOOGLE_CLIENT_SECRET'),refresh_token:refreshToken,grant_type:'refresh_token',
  })});
  if(!tokenResponse.ok)return respond(req,{error:'Google authorisation expired or unavailable'},502);
  const access=await tokenResponse.json();
  if(!access.access_token)return respond(req,{error:'No Google access token'},502);
  const query=new URLSearchParams({fields:'spreadsheetId,properties(title),sheets(properties(sheetId,title,gridProperties(rowCount,columnCount)))'});
  const metadata=await fetch(ROOT+'/'+encodeURIComponent(id)+'?'+query,{headers:{Authorization:'Bearer '+access.access_token}});
  if(!metadata.ok)return respond(req,{error:'Unable to read spreadsheet',provider_status:metadata.status},metadata.status===404?404:502);
  const info=await metadata.json();
  // This endpoint intentionally returns only metadata and makes no spreadsheet writes.
  return respond(req,{spreadsheetId:info.spreadsheetId,title:info.properties?.title??'',worksheets:(info.sheets||[]).map((s:any)=>({
    id:s.properties?.sheetId,title:s.properties?.title,rows:s.properties?.gridProperties?.rowCount??0,
  }))});
 }catch(error){
  console.error('Sheets metadata error',error instanceof Error?error.name:'unknown');
  return respond(req,{error:'Spreadsheet preview unavailable'},503);
 }
});
