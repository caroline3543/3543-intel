import {gzipSync,gunzipSync} from 'node:zlib';
import {accessContext,sameOrigin,respond} from '../server/access.js';
import {validateWorkspace,WORKSPACE_ID} from '../shared/workspace.js';
function compressed(res,status,data){res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');res.setHeader('Content-Encoding','gzip');return res.status(status).send(gzipSync(Buffer.from(JSON.stringify(data))));}
export default async function handler(req,res){
 const access=accessContext(req);
 if(!access)return respond(res,401,{error:'Sign in again. Your pending edits stay on this device.'});
 if(access.role!=='leader'||access.workspaceId!==WORKSPACE_ID)return respond(res,403,{error:'Leader access is required.'});
 if(!['GET','POST'].includes(req.method))return respond(res,405,{error:'Method not allowed'});
 if(req.method==='POST'&&!sameOrigin(req))return respond(res,403,{error:'Open this website directly to save.'});
 const body={action:'read',workspaceId:WORKSPACE_ID,actor:access.actor,role:access.role};
 if(req.method==='GET'&&/^\d+$/.test(String(req.query?.revision||'')))body.since=Number(req.query.revision);
 if(req.method==='POST'){
  try{
   const input=req.body;
   if(!input||Object.keys(input).some(k=>!['revision','encoded','data'].includes(k))||!Number.isSafeInteger(input.revision)||input.revision<0)throw Error('Invalid save request.');
   const data=input.encoded?JSON.parse(gunzipSync(Buffer.from(input.encoded,'base64'),{maxOutputLength:24*1024*1024}).toString('utf8')):input.data;
   if(JSON.stringify(data).length>24*1024*1024)throw Error('Workspace is too large. Export a backup.');
   body.action='commit';body.revision=input.revision;body.data=validateWorkspace(data);
  }catch(e){return respond(res,400,{error:e.message||'Invalid workspace data.'});}
 }
 const base=process.env.GAME_API_URL,key=process.env.GAME_API_PUBLIC_KEY,token=process.env.GAME_SITE_TOKEN;
 if(!base||!key||!token)return respond(res,503,{error:'Shared storage is not configured.'});
 try{
  const response=await fetch(`${base.replace(/\/$/,'')}/functions/v1/caroline3739-workspace`,{method:'POST',headers:{'Content-Type':'application/json',apikey:key,Authorization:`Bearer ${key}`,'x-caroline-site-key':token},body:JSON.stringify(body),signal:AbortSignal.timeout(25000)});
  const result=await response.json();return compressed(res,response.status,result);
 }catch{return respond(res,502,{error:'Shared storage is unavailable. Edits are saved on this device.'});}
}
