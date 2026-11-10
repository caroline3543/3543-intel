import {gzipSync} from 'node:zlib';
import {accessContext,respond} from '../server/access.js';
import {WORKSPACE_ID} from '../shared/workspace.js';
function compressed(res,status,data){res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');res.setHeader('Content-Encoding','gzip');return res.status(status).send(gzipSync(Buffer.from(JSON.stringify(data))));}
export default async function handler(req,res){
 const access=accessContext(req);
 if(!access)return respond(res,401,{error:'Sign in again. Your pending edits stay on this device.'});
 if(access.role!=='leader'||access.workspaceId!==WORKSPACE_ID)return respond(res,403,{error:'Leader access is required.'});
 if(req.method!=='GET')return respond(res,405,{error:'Caroline 3739 is a local-only testing copy. Shared roster writes are disabled.'});
 // Read-only clone: never commit to the original workspace.
 const body={action:'read',workspaceId:WORKSPACE_ID,actor:access.actor,role:access.role};
 if(req.method==='GET'&&/^\d+$/.test(String(req.query?.revision||'')))body.since=Number(req.query.revision);
 const base=process.env.GAME_API_URL,key=process.env.GAME_API_PUBLIC_KEY,token=process.env.GAME_SITE_TOKEN;
 if(!base||!key||!token)return respond(res,503,{error:'Shared storage is not configured.'});
 try{
  const response=await fetch(`${base.replace(/\/$/,'')}/functions/v1/caroline3739-seed`,{method:'POST',headers:{'Content-Type':'application/json',apikey:key,Authorization:`Bearer ${key}`,'x-caroline-site-key':token},body:JSON.stringify(body),signal:AbortSignal.timeout(25000)});
  const result=await response.json();return compressed(res,response.status,result);
 }catch{return respond(res,502,{error:'Shared storage is unavailable. Edits are saved on this device.'});}
}
