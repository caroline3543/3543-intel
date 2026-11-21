import {accessContext,respond} from '../server/access.js';
import {WORKSPACE_ID} from '../shared/workspace.js';

// Read-only leader endpoint. No service-role or provider credential reaches the browser.
export default async function handler(req,res){
 if(req.method!=='GET')return respond(res,405,{error:'Method not allowed'});
 const access=accessContext(req);
 if(!access)return respond(res,401,{error:'Sign in to view transfers.'});
 if(access.role!=='leader'||access.workspaceId!==WORKSPACE_ID)return respond(res,403,{error:'Leader access required.'});
 const beforeId=req.query?.before??null;
 if(beforeId!==null&&(typeof beforeId!=='string'||!/^[1-9]\d{0,18}$/.test(beforeId)))return respond(res,400,{error:'Invalid transfer cursor.'});
 const base=process.env.GAME_API_URL,key=process.env.GAME_API_PUBLIC_KEY,token=process.env.GAME_SITE_TOKEN;
 if(!base||!key||!token)return respond(res,503,{error:'Transfer history is not configured.'});
 try{
  const response=await fetch(`${base.replace(/\/$/,'')}/functions/v1/caroline3573-workspace`,{
   method:'POST',
   headers:{'Content-Type':'application/json',apikey:key,Authorization:`Bearer ${key}`,'x-caroline-site-key':token},
   body:JSON.stringify({action:'transfers',workspaceId:WORKSPACE_ID,actor:access.actor,role:access.role,beforeId}),
   signal:AbortSignal.timeout(15000)
  });
  if(!response.ok)return respond(res,502,{error:'Transfer history is temporarily unavailable.'});
  const data=await response.json();
  if(!Array.isArray(data?.events))return respond(res,502,{error:'Invalid transfer history response.'});
  return respond(res,200,{events:data.events,nextCursor:data.nextCursor??null});
 }catch{return respond(res,502,{error:'Transfer history is temporarily unavailable.'});}
}
