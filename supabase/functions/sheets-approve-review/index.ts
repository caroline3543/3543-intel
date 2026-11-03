// Explicit audit-only approval. This endpoint has no Google write method.
// An approval expires after 10 minutes and must never be treated as a write grant.
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
const OWNER='f560b117-a3db-4692-b0bf-fd372044130c';
const ORIGINS=['https://3543-intel.vercel.app','https://3543-intel-git-feat-spreadsheet-s-8ea8a3-sunfire-castle-planner.vercel.app'];
const env=(k:string)=>{const v=Deno.env.get(k);if(!v)throw Error('Missing '+k);return v};
const value=(x:unknown)=>String(x??'').trim();
function reply(req:Request,data:unknown,status=200){const origin=req.headers.get('origin')||'';return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin',...(ORIGINS.includes(origin)?{'Access-Control-Allow-Origin':origin}:{}),'Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'}})}
Deno.serve(async req=>{
 const origin=req.headers.get('origin')||'';
 if(origin&&!ORIGINS.includes(origin))return reply(req,{error:'Origin not permitted'},403);
 if(req.method==='OPTIONS')return reply(req,{},200);
 if(req.method!=='POST')return reply(req,{error:'Method not permitted'},405);
 try{
  const jwt=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
  if(!jwt)return reply(req,{error:'Sign in required'},401);
  const auth=createClient(env('SUPABASE_URL'),env('SUPABASE_ANON_KEY'),{auth:{persistSession:false}});
  const {data:{user},error:authError}=await auth.auth.getUser(jwt);
  if(authError||user?.id!==OWNER)return reply(req,{error:'Not authorised'},403);
  const input=await req.json().catch(()=>null);
  if(!input||typeof input.reviewId!=='string'||!/^[0-9a-f-]{36}$/i.test(input.reviewId)||input.confirmation!=='APPROVE READ-ONLY REVIEW'||!Array.isArray(input.proposals))return reply(req,{error:'Explicit confirmation and review ID required'},400);
  const db=createClient(env('SUPABASE_URL'),env('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false}});
  const {data:review,error:reviewError}=await db.from('spreadsheet_export_reviews').select('id,owner_user_id,state_id,spreadsheet_id,worksheet_title,review_hash,payload,created_at,status').eq('id',input.reviewId).eq('owner_user_id',user.id).maybeSingle();
  if(reviewError||!review||review.status!=='reviewed_read_only')return reply(req,{error:'Review not found'},404);
  if(Date.now()-new Date(review.created_at).getTime()>10*60*1000||Date.now()<new Date(review.created_at).getTime())return reply(req,{error:'Review expired. Check Google again and save a new review.'},409);
  const changes=review.payload?.review?.changes;
  if(!Array.isArray(changes)||changes.length<1||changes.length>20||input.proposals.length!==changes.length)return reply(req,{error:'Invalid saved review'},409);
  const ids=new Set<string>();
  for(let i=0;i<changes.length;i++){
   const c=changes[i],p=input.proposals[i];
   if(!c||!p||!Number.isSafeInteger(c.row)||c.row<2||c.row>101||c.row!==p.row||c.column!==p.column||c.fid!==p.fid||c.expected!==p.expected||c.value!==p.value||!value(p.alliance)||!['Availability','Joiner Heroes','Infantry Troop Level','Lancer Troop Level','Marksman Troop Level'].includes(c.column))return reply(req,{error:'Proposal does not match the recorded review'},409);
   const cell=c.row+':'+c.column;if(ids.has(cell))return reply(req,{error:'Duplicate cell'},409);ids.add(cell);
  }
  const preflight=await fetch(env('SUPABASE_URL')+'/functions/v1/sheets-write-preflight',{method:'POST',headers:{Authorization:'Bearer '+jwt,apikey:env('SUPABASE_ANON_KEY'),'Content-Type':'application/json'},body:JSON.stringify({stateId:review.state_id,spreadsheetId:review.spreadsheet_id,worksheetTitle:review.worksheet_title,proposals:input.proposals})});
  const p=await preflight.json().catch(()=>({}));
  if(!preflight.ok||p.writeEnabled!==false||p.readOnly!==true||!p.allMatched||!Array.isArray(p.checked)||p.checked.length!==changes.length||p.checked.some((x:{row:number,column:string,match:boolean},i:number)=>!x.match||x.row!==changes[i].row||x.column!==changes[i].column))return reply(req,{error:'Google data changed or verification failed. Review again.'},409);
  const {data:approval,error:insertError}=await db.from('spreadsheet_export_approvals').insert({review_id:review.id,owner_user_id:user.id,state_id:review.state_id,review_hash:review.review_hash,status:'approved_not_executed'}).select('id,approved_at,expires_at,status').single();
  if(insertError){
   if(insertError.code==='23505')return reply(req,{error:'This review has already been approved. Start a fresh review to approve again.'},409);
   return reply(req,{error:'Could not record approval'},503);
  }
  return reply(req,{approval,writeEnabled:false,googleModified:false});
 }catch{return reply(req,{error:'Approval could not be recorded'},503)}
});
