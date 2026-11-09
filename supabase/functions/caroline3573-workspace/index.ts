import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
import {validateWorkspace} from './workspace.js';
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
Deno.serve(async req=>{
 if(req.method!=='POST')return reply({error:'Method not allowed'},405);
 const token=req.headers.get('x-caroline-site-key')||'';
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
 const hash=Array.from(new Uint8Array(digest)).map(v=>v.toString(16).padStart(2,'0')).join('');
 if(token.length<32||hash!=='6a1e9094f4daa0772a0651b0ae239fa1db314a3c9b631c498c10394f63712ade')return reply({error:'Site access required'},401);
 try{
  const input=await req.json();
  if(input.workspaceId!=='3573-leaders'||input.role!=='leader')return reply({error:'Leader workspace access required'},403);
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
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
