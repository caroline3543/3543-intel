import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const allowed=['https://3543-intel.vercel.app','https://3543-intel-git-feat-spreadsheet-s-8ea8a3-sunfire-castle-planner.vercel.app'];
function reply(req:Request,data:unknown,status=200) {
 const origin=req.headers.get('origin')||'';
 return new Response(JSON.stringify(data),{status,headers:{
  'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin',
  ...(allowed.includes(origin)?{'Access-Control-Allow-Origin':origin}:{}),
  'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods':'GET,OPTIONS',
 }});
}
Deno.serve(async(req)=>{
 const origin=req.headers.get('origin')||'';
 if(origin&&!allowed.includes(origin))return reply(req,{error:'Origin not allowed'},403);
 if(req.method==='OPTIONS')return reply(req,{},200);
 if(req.method!=='GET')return reply(req,{error:'Method not allowed'},405);
 const token=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
 if(!token)return reply(req,{error:'Sign in required'},401);
 try {
  const url=Deno.env.get('SUPABASE_URL'),anon=Deno.env.get('SUPABASE_ANON_KEY'),serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!url||!anon||!serviceKey)return reply(req,{error:'Unavailable'},503);
  const userClient=createClient(url,anon,{auth:{persistSession:false}});
  const {data:{user},error}=await userClient.auth.getUser(token);
  if(error||!user)return reply(req,{error:'Sign in required'},401);
  const service=createClient(url,serviceKey,{auth:{persistSession:false}});
  const {data,error:queryError}=await service.from('spreadsheet_google_credentials').select('updated_at').eq('user_id',user.id).maybeSingle();
  if(queryError)return reply(req,{error:'Connection status unavailable'},503);
  return reply(req,{connected:!!data,connectedAt:data?.updated_at??null,writeEnabled:false});
 }catch{return reply(req,{error:'Connection status unavailable'},503)}
});
