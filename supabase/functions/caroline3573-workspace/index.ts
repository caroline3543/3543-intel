import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
import {validateWorkspace} from './workspace.js';
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
Deno.serve(async req=>{
 if(req.method!=='POST')return reply({error:'Method not allowed'},405);
 const token=req.headers.get('x-caroline-site-key')||'';
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
 const hash=Array.from(new Uint8Array(digest)).map(v=>v.toString(16).padStart(2,'0')).join('');
 const expectedHash=Deno.env.get('CAROLINE3573_SITE_KEY_HASH')||'6a1e9094f4daa0772a0651b0ae239fa1db314a3c9b631c498c10394f63712ade';
 if(token.length<32||hash!==expectedHash)return reply({error:'Site access required'},401);
 try{
  const input=await req.json();
  if(input.workspaceId!=='3573-leaders'||input.role!=='leader')return reply({error:'Leader workspace access required'},403);
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  if(input.action==='membership-refresh'){
   if(typeof input.start!=='boolean')return reply({error:'Invalid refresh request'},400);
   if(input.start&&Deno.env.get('MEMBERSHIP_3573_ENABLED')!=='true')return reply({error:'Membership refresh is disabled'},503);
   const {data,error}=await db.rpc('caroline_3573_manual_refresh',{p_start:input.start});
   if(error)throw error;
   return reply({refresh:data});
  }
  if(input.action==='priority-roster-refresh'){
   if(!Number.isSafeInteger(input.revision)||input.revision<0||
      !Array.isArray(input.missing)||input.missing.some((fid:unknown)=>typeof fid!=='string'||!/^[1-9]\d{3,14}$/.test(fid))){
    return reply({error:'Invalid priority refresh request'},400);
   }
   const missing=Deno.env.get('MEMBERSHIP_3573_ENABLED')==='true'?input.missing:[];
   const {data,error}=await db.rpc('caroline_3573_commit_priority_refresh',{
    p_revision:input.revision,p_workspace:validateWorkspace(input.data),p_missing:missing,
    p_actor:typeof input.actor==='string'?input.actor:'priority-roster-refresh'
   });
   if(error)throw error;
   return reply(data,data.conflict?409:200);
  }
  if(input.action==='transfers'){
   // Read-only, service-role RPC. The site server authenticates the leader session.
   const beforeId=input.beforeId??null;
   if(beforeId!==null&&!/^[1-9]\d{0,18}$/.test(String(beforeId)))return reply({error:'Invalid transfer cursor'},400);
   const {data,error}=await db.rpc('caroline_3573_transfer_feed',{p_limit:500,p_before_id:beforeId});
   if(error)throw error;
   const events=data||[];
   return reply({events,nextCursor:events.length===500?String(events.at(-1).id):null});
  }
  if(input.action==='read'){
   const {data,error}=await db.from('caroline_workspaces').select('data,revision,updated_at').eq('id','3573-leaders').single();
   if(error)throw error;if(input.since===data.revision&&data.data!=null)return reply({unchanged:true,revision:data.revision,updatedAt:data.updated_at});return reply({data:data.data,revision:data.revision,updatedAt:data.updated_at,role:'leader'});
  }
  if(input.action!=='commit'||!Number.isSafeInteger(input.revision)||input.revision<0)return reply({error:'Invalid save request'},400);
  validateWorkspace(input.data);
  const {data,error}=await db.rpc('caroline_workspace_commit',{expected_revision:input.revision,new_data:input.data,writer:typeof input.actor==='string'?input.actor:'leader'});
  if(error)throw error;return reply(data,data.conflict?409:200);
 }catch{return reply({error:'Unable to read or save shared data. Check the workspace and retry.'},400);}
});
