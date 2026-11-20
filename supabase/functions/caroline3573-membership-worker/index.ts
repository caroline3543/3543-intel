// STAGED ONLY. Private scheduled worker; no public or browser access.
// Requires DATABASE_URL, WHITEOUTSTATS_API_KEY, MEMBERSHIP_3573_CRON_SECRET
// and explicit MEMBERSHIP_3573_ENABLED=true after production approval.
import postgres from "npm:postgres@3.4.7";
import {createMembershipWorker} from "../../../src/services/automaticMembershipWorker.js";
import {createMembershipQueueAdapter} from "../../../src/services/automaticMembershipQueueAdapter.js";
import {verifiedPlayerLocation} from "../../../src/services/verifiedPlayerLocation.js";

const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{
 status,headers:{"content-type":"application/json","cache-control":"no-store"}
});
async function authenticated(req:Request){
 const secret=Deno.env.get("MEMBERSHIP_3573_CRON_SECRET")||"";
 const received=(req.headers.get("authorization")||"").replace(/^Bearer /,"");
 if(secret.length<32||received.length!==secret.length)return false;
 const digest=async(s:string)=>new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s)));
 const [a,b]=await Promise.all([digest(secret),digest(received)]);
 let mismatch=0;for(let i=0;i<a.length;i++)mismatch|=a[i]^b[i];
 return mismatch===0;
}
function validUsage(payload:any){
 const body=payload?.data??payload;
 // Provider response format must be verified before the worker is enabled.
 const used=body?.used,minuteUsed=body?.minute_used;
 if(!Number.isSafeInteger(used)||used<0||!Number.isSafeInteger(minuteUsed)||minuteUsed<0||minuteUsed>60)
  throw Error("Unverified provider usage response");
 return {used,minuteUsed};
}
Deno.serve(async(req)=>{
 if(req.method!=="POST")return json({error:"Method not allowed"},405);
 if(!await authenticated(req))return json({error:"Unauthorized"},401);
 // Authenticated read-only provider diagnostics, usable before enabling writes.
 // Returns only response-shape evidence, never player data or API credentials.
 let input:any={};
 try{input=await req.json();}catch{return json({error:"Invalid JSON"},400);}
 if(input?.mode==="probe"){
  const apiKey=Deno.env.get("WHITEOUTSTATS_API_KEY")||"";
  if(!/^wos_[\\x21-\\x7e]+$/.test(apiKey))return json({error:"Provider key unavailable"},503);
  const fid=String(input.fid||"");
  if(!/^[1-9]\\d{3,14}$/.test(fid))return json({error:"A valid test FID is required"},400);
  try{
   const headers={Authorization:"Bearer "+apiKey,Accept:"application/json"};
   const [usageRes,playerRes]=await Promise.all([
    fetch("https://api.whiteoutstats.com/v1/usage",{headers,signal:AbortSignal.timeout(15000)}),
    fetch("https://api.whiteoutstats.com/v1/players/"+fid+"?include=base",{headers,signal:AbortSignal.timeout(15000)})
   ]);
   const [usage,player]=await Promise.all([usageRes.json(),playerRes.json()]);
   const body=player?.data??player;
   const base=body?.player;
   const at=base?.cached_at??body?.cached_at??body?.meta?.cached_at??null;
   const evidence={
    providerUsageHttp:usageRes.status,providerPlayerHttp:playerRes.status,
    usageKeys:Object.keys(usage?.data??usage??{}).slice(0,20),
    playerKeys:Object.keys(body??{}).slice(0,20),
    hasFreshBoolean:typeof body?.fresh==="boolean",fresh:body?.fresh===true,
    hasCachedAt:at!==null,cacheAgeMinutes:at?Math.round((Date.now()-Date.parse(at))/60000):null,
    hasExplicitAlliance:base!=null&&Object.hasOwn(base,"alliance"),
    hasState:base?.kid!=null,hasPlayerId:base?.chief_id!=null||base?.fid!=null
   };
   return json({status:"diagnostic",evidence});
  }catch{return json({error:"Provider diagnostic unavailable"},502);}
 }
 if(Deno.env.get("MEMBERSHIP_3573_ENABLED")!=="true")return json({status:"disabled"});
 const connection=Deno.env.get("DATABASE_URL")||"";
 const apiKey=Deno.env.get("WHITEOUTSTATS_API_KEY")||"";
 if(!connection||!/^wos_[\x21-\x7e]+$/.test(apiKey))
  return json({error:"Worker database or provider configuration unavailable"},503);
 const sql=postgres(connection,{max:2,prepare:false,connect_timeout:10,idle_timeout:5});
 const query=async(statement:string,params:any[]=[])=>Array.from(await sql.unsafe(statement,params));
 const store=createMembershipQueueAdapter({
  query,enabled:async()=>Deno.env.get("MEMBERSHIP_3573_ENABLED")==="true"
 });
 const upstream=async(path:string)=>{
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),20000);
  try{
   const response=await fetch("https://api.whiteoutstats.com/v1"+path,{
    headers:{Authorization:"Bearer "+apiKey,Accept:"application/json"},
    signal:controller.signal
   });
   if(!response.ok)throw Error("Provider HTTP "+response.status);
   return await response.json();
  }finally{clearTimeout(timer);}
 };
 const api={
  usage:async()=>validUsage(await upstream("/usage")),
  verifyPlayer:async(fid:string)=>{
   if(!/^[1-9]\d{3,14}$/.test(fid))throw Error("Invalid FID");
   const response=await upstream("/players/"+fid+"?include=base");
   return verifiedPlayerLocation(response,fid);
  },
  roster:async(state:string,tag:string)=>{
   if(state!=="3573"||!/^[A-Za-z0-9_]{1,16}$/.test(tag))throw Error("Invalid roster request");
   const response=await upstream("/alliances/3573/"+encodeURIComponent(tag)+"?include=info,roster");
   const data=response?.data??response;
   // Never infer completeness or freshness from a successful HTTP status.
   if(data?.fresh!==true||data?.complete!==true||!Array.isArray(data?.members)||
      !data?.cached_at)throw Error("Provider roster freshness or completeness unverified");
   return {complete:true,fresh:true,observedAt:data.cached_at,members:data.members};
  }
 };
 try{
  const workspace=await query("select data from public.caroline_workspaces where id=$1",["3573-leaders"]);
  if(!workspace[0]||!Array.isArray(workspace[0].data?.players))
   return json({error:"Workspace player data unavailable"},503);
  const worker=createMembershipWorker({store,api});
  const seeded=await worker.seed(workspace[0].data.players);
  const result=await worker.tick();
  return json({seeded,status:result.status,jobKind:result.jobKind||null});
 }catch(error){
  console.error(JSON.stringify({event:"membership_worker_error",type:error instanceof Error?error.name:"unknown"}));
  return json({error:"Membership worker unavailable; no unverified changes applied"},503);
 }finally{await sql.end({timeout:5});}
});
