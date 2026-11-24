import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
const OWNER='f560b117-a3db-4692-b0bf-fd372044130c';
const ORIGINS=['https://3543-intel.vercel.app','https://3543-intel-git-feat-spreadsheet-s-8ea8a3-sunfire-castle-planner.vercel.app'];
function reply(req:Request,data:unknown,status=200){const origin=req.headers.get('origin')||'';return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin',...(ORIGINS.includes(origin)?{'Access-Control-Allow-Origin':origin}:{}),'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'GET, POST, OPTIONS'}})}
Deno.serve(async req=>{
 const origin=req.headers.get('origin')||'';
 if(origin&&!ORIGINS.includes(origin))return reply(req,{error:'Origin not permitted'},403);
 if(req.method==='OPTIONS')return reply(req,{},200);
 if(!['GET','POST'].includes(req.method))return reply(req,{error:'Method not allowed'},405);
 try{
  const jwt=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
  if(!jwt)return reply(req,{error:'Sign in required'},401);
  const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const auth=createClient(url,anon,{auth:{persistSession:false}});
  const {data:{user},error}=await auth.auth.getUser(jwt);
  if(error||user?.id!==OWNER)return reply(req,{error:'Not authorised'},403);
  const db=createClient(url,service,{auth:{persistSession:false}});
  if(req.method==='GET'){
   const {data,error:e}=await db.from('spreadsheet_connections').select('state_id,spreadsheet_id,title').eq('owner_user_id',user.id).eq('status','default').order('created_at',{ascending:false});
   if(e)return reply(req,{error:'Could not read state spreadsheets'},503);
   const defaults:Record<string,string>={};
   for(const item of data||[])if(!defaults[item.state_id])defaults[item.state_id]=item.spreadsheet_id;
   return reply(req,{defaults,readOnly:true});
  }
  const x=await req.json().catch(()=>null),state=String(x?.stateId||''),id=x?.spreadsheetId;
  if(!/^[1-9]\d{0,4}$/.test(state)||!(id===null||(typeof id==='string'&&/^[A-Za-z0-9_-]{15,200}$/.test(id))))return reply(req,{error:'Invalid state or spreadsheet ID'},400);
  const {data:existing,error:loadError}=await db.from('spreadsheet_connections').select('id').eq('owner_user_id',user.id).eq('state_id',state).eq('status','default');
  if(loadError)return reply(req,{error:'Could not load state connection'},503);
  if(id===null){
   const {error:e}=await db.from('spreadsheet_connections').delete().eq('owner_user_id',user.id).eq('state_id',state).eq('status','default');
   return e?reply(req,{error:'Could not clear default'},503):reply(req,{ok:true,stateId:state,spreadsheetId:null});
  }
  if(existing?.length){
   const {error:e}=await db.from('spreadsheet_connections').update({spreadsheet_id:id,title:'Default state spreadsheet'}).eq('owner_user_id',user.id).eq('state_id',state).eq('status','default');
   if(e)return reply(req,{error:'Could not save default spreadsheet'},503);
  }else{
   const {error:e}=await db.from('spreadsheet_connections').insert({owner_user_id:user.id,state_id:state,spreadsheet_id:id,title:'Default state spreadsheet',status:'default'});
   if(e)return reply(req,{error:'Could not save default spreadsheet'},503);
  }
  return reply(req,{ok:true,stateId:state,spreadsheetId:id});
 }catch{return reply(req,{error:'State spreadsheet connection unavailable'},503)}
});