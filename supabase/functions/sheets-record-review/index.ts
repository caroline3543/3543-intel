// Record a read-only Google Sheets review after a fresh live preflight.
// An audit entry is evidence of a check, not consent or authority to write.
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
const OWNER='f560b117-a3db-4692-b0bf-fd372044130c';
const ORIGINS=['https://3543-intel.vercel.app','https://3543-intel-git-feat-spreadsheet-s-8ea8a3-sunfire-castle-planner.vercel.app'];
const ALLOWED=new Set(['Availability','Joiner Heroes','Infantry Troop Level','Lancer Troop Level','Marksman Troop Level']);
const env=(k:string)=>{const v=Deno.env.get(k);if(!v)throw Error('Missing '+k);return v};
function reply(req:Request,data:unknown,status=200){const origin=req.headers.get('origin')||'';return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin',...(ORIGINS.includes(origin)?{'Access-Control-Allow-Origin':origin}:{}),'Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'}})}
const str=(x:unknown)=>String(x??'').trim();
Deno.serve(async req=>{
 const origin=req.headers.get('origin')||'';
 if(origin&&!ORIGINS.includes(origin))return reply(req,{error:'Origin not allowed'},403);
 if(req.method==='OPTIONS')return reply(req,{},200);
 if(req.method!=='POST')return reply(req,{error:'Method not allowed'},405);
 try{
  const jwt=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
  if(!jwt)return reply(req,{error:'Sign in required'},401);
  const auth=createClient(env('SUPABASE_URL'),env('SUPABASE_ANON_KEY'),{auth:{persistSession:false}});
  const {data:{user},error:authError}=await auth.auth.getUser(jwt);
  if(authError||user?.id!==OWNER)return reply(req,{error:'Not authorised'},403);
  const body=await req.json().catch(()=>null);
  const review=body?.review,proposals=body?.proposals;
  const stateId=review?.stateId,spreadsheetId=review?.spreadsheetId,worksheetTitle=review?.worksheetTitle;
  if(typeof stateId!=='string'||!/^\d{1,5}$/.test(stateId)||Number(stateId)<1||typeof spreadsheetId!=='string'||!/^[A-Za-z0-9_-]{15,200}$/.test(spreadsheetId)||typeof worksheetTitle!=='string'||!worksheetTitle||worksheetTitle.length>100||/[\x00-\x1f]/.test(worksheetTitle))return reply(req,{error:'Invalid review identity'},400);
  const changes=review.changes;
  if(!Array.isArray(changes)||!changes.length||changes.length>20||!Array.isArray(proposals)||proposals.length!==changes.length)return reply(req,{error:'Review must contain 1–20 matching changes'},400);
  const seen=new Set<string>();
  for(let i=0;i<changes.length;i++){
   const c=changes[i],p=proposals[i];
   if(!c||!p||!Number.isSafeInteger(c.row)||c.row<2||c.row>101||!ALLOWED.has(c.column)||!/^[0-9]{4,15}$/.test(str(c.fid))||typeof c.expected!=='string'||typeof c.value!=='string'||c.value.length>500||c.expected.length>500)return reply(req,{error:'Invalid proposed cell'},400);
   if(c.row!==p.row||c.column!==p.column||c.fid!==p.fid||c.expected!==p.expected||c.value!==p.value||!str(p.alliance))return reply(req,{error:'Proposals do not match review'},400);
   const identity=c.row+':'+c.column;if(seen.has(identity))return reply(req,{error:'Duplicate proposed cell'},400);seen.add(identity);
  }
  const preflight=await fetch(env('SUPABASE_URL')+'/functions/v1/sheets-write-preflight',{method:'POST',headers:{Authorization:'Bearer '+jwt,apikey:env('SUPABASE_ANON_KEY'),'Content-Type':'application/json'},body:JSON.stringify({stateId,spreadsheetId,worksheetTitle,proposals})});
  const result=await preflight.json().catch(()=>({}));
  if(!preflight.ok)return reply(req,{error:result.error||'Live Google verification unavailable',preflightStatus:preflight.status},preflight.status===409?409:502);
  if(!result.readOnly||result.writeEnabled!==false||!result.allMatched||!Array.isArray(result.checked)||result.checked.length!==changes.length||result.checked.some((x:{match:boolean,row:number,column:string},i:number)=>!x.match||x.row!==changes[i].row||x.column!==changes[i].column))return reply(req,{error:'Google changed. Refresh and review the worksheet again.'},409);
  const canonical=JSON.stringify({stateId,spreadsheetId,worksheetTitle,changes});
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical));
  const hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
  const db=createClient(env('SUPABASE_URL'),env('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false}});
  const entry={owner_user_id:user.id,state_id:stateId,spreadsheet_id:spreadsheetId,worksheet_title:worksheetTitle,review_hash:hash,payload:{review:{stateId,spreadsheetId,worksheetTitle,changes},cellCount:changes.length,verification:'live_read_only'},status:'reviewed_read_only'};
  const {data,error}=await db.from('spreadsheet_export_reviews').insert(entry).select('id,created_at').single();
  if(error){
   if(error.code==='23505'){
    const {data:old,error:readError}=await db.from('spreadsheet_export_reviews').select('id,created_at').eq('owner_user_id',user.id).eq('review_hash',hash).single();
    if(readError||!old)return reply(req,{error:'Review record unavailable'},503);
    return reply(req,{recorded:true,existing:true,id:old.id,createdAt:old.created_at,hash,writeEnabled:false});
   }
   return reply(req,{error:'Unable to record review'},503);
  }
  return reply(req,{recorded:true,existing:false,id:data.id,createdAt:data.created_at,hash,writeEnabled:false});
 }catch{return reply(req,{error:'Unable to validate or record this review'},503)}
});
