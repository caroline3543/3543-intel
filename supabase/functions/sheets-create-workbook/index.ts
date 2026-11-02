// Owner-only Google workbook creation. Creates a new workbook; never mutates existing spreadsheets.
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
const OWNER_ID='f560b117-a3db-4692-b0bf-fd372044130c'; // existing owner only; replace with admin allowlist before multi-user rollout
const ORIGINS=['https://3543-intel-git-feat-spreadsheet-s-8ea8a3-sunfire-castle-planner.vercel.app'];
const HEADERS=['Player ID','Username','State','Alliance','Furnace Level','Total Power','Kills','Game Language','Infantry Troop Level','Lancer Troop Level','Marksman Troop Level','Foundry Troop Power','Canyon Clash Troop Power','Joiner Heroes','Availability','Last Verified'];
const COMBAT_HEADERS=['Player ID','Username','State','Alliance','Troop Type','Attack %','Defence %','Health %','Lethality %','Battle Role','Battle Type','Rally Capacity','March Capacity','Battle Report Date','Evidence URL','Last Verified'];
const EVENT_HEADERS=['Event ID','Event Type','Event Date UTC','Player ID','Username','State','Alliance','Registered','Attendance Status','Assigned Team','Assigned Role','Assigned Building','Event Troop Power','Contribution','Assignment Confirmed','Last Updated'];
const env=(k:string)=>{const v=Deno.env.get(k);if(!v)throw Error('Missing configuration '+k);return v};
const decode=(v:string)=>Uint8Array.from(atob(v.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(v.length/4)*4,'=')),c=>c.charCodeAt(0));
function respond(req:Request,data:unknown,status=200){const origin=req.headers.get('origin')||'';return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin',...(ORIGINS.includes(origin)?{'Access-Control-Allow-Origin':origin}:{}),'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'}})}
Deno.serve(async req=>{
 const origin=req.headers.get('origin')||'';
 if(origin&&!ORIGINS.includes(origin))return respond(req,{error:'Origin not allowed'},403);
 if(req.method==='OPTIONS')return respond(req,{},200);
 if(req.method!=='POST')return respond(req,{error:'Method not allowed'},405);
 try {
  const jwt=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
  if(!jwt)return respond(req,{error:'Sign in required'},401);
  const auth=createClient(env('SUPABASE_URL'),env('SUPABASE_ANON_KEY'),{auth:{persistSession:false}});
  const {data:{user},error}=await auth.auth.getUser(jwt);
  if(error||!user)return respond(req,{error:'Sign in required'},401);
  if(user.id!==OWNER_ID)return respond(req,{error:'Only the app owner can create roster exports'},403);
  const input=await req.json().catch(()=>null);
  const state=String(input?.stateId??'').trim();
  if(!/^\d{1,5}$/.test(state)||Number(state)===0)return respond(req,{error:'Select a valid state'},400);
  const stateId=String(Number(state));
  const admin=createClient(env('SUPABASE_URL'),env('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false}});
  const rows:any[]=[];
  // Query is strictly scoped by state; do not fetch other states and filter afterward.
  for(let offset=0;offset<10000;offset+=500){
   const {data,error:dbError}=await admin.from('players').select('id,state_id,alliance_tag,data,updated_at').eq('state_id',stateId).range(offset,offset+499);
   if(dbError)return respond(req,{error:'Unable to load state roster'},503);
   rows.push(...(data||[]));
   if(!data||data.length<500)break;
  }
  if(!rows.length)return respond(req,{error:'No players recorded for that state'},404);
  if(rows.length>=10000)return respond(req,{error:'State roster exceeds the export limit'},413);
  const groups=new Map<string,any[]>();
  const combatRows:any[][]=[];
  const eventRows:any[][]=[];
  for(const p of rows){
   if(p.state_id!==stateId)throw Error('State isolation invariant violated');
   const raw=String(p.alliance_tag??'').trim().toUpperCase();
   const alliance=/^[A-Z0-9_-]{2,10}$/.test(raw)?raw:'UNALLIED';
   if(!groups.has(alliance))groups.set(alliance,[]);
   const d=p.data||{};
   const fid=String(d.fid??p.id??'');
   const username=String(d.username??'');
   for(const troopType of ['Infantry','Lancer','Marksman'])combatRows.push([fid,username,stateId,alliance,troopType,'','','','', '', '', '',d.marchCapacity??'', '', '',p.updated_at??'']);
   // Blank event-specific columns prevent invented attendance or assignments.
   eventRows.push(['','','',fid,username,stateId,alliance,'','','','','','','','',p.updated_at??'']);
   const verifiedJoiners=Array.isArray(d.joinerHeroes)?d.joinerHeroes.filter((h:any)=>Number(h?.skillLevel)===5&&typeof h?.hero==='string'&&h.hero.trim()).map((h:any)=>h.hero.trim()).join('; '):'';
   const troopTier=(type:string)=>{const value=String(d.troops?.[type]??'').trim();return /^(T[0-9]{1,2}|FC[0-9]{1,2})$/.test(value)?value:'';};
   groups.get(alliance)!.push([String(d.fid??p.id??''),String(d.username??''),stateId,alliance,d.furnaceLevel??'',d.power??'',d.kills??'',d.gameLanguage??'',
    troopTier('infantry'),troopTier('lancer'),troopTier('marksman'),d.foundryTroopPower??'',d.canyonTroopPower??'',verifiedJoiners,'',p.updated_at??'']);
  }
  const tags=[...groups.keys()].sort();
  if(tags.length>90)return respond(req,{error:'State has too many alliance groups'},422);
  if(tags.some(tag=>['COMBAT','EVENTS'].includes(tag)))return respond(req,{error:'An alliance tag conflicts with a reserved worksheet name'},422);
  const {data:credential,error:credsError}=await admin.from('spreadsheet_google_credentials').select('refresh_token_encrypted').eq('user_id',user.id).maybeSingle();
  if(credsError||!credential)return respond(req,{error:'Connect your Google account first'},409);
  const encrypted=JSON.parse(credential.refresh_token_encrypted);
  if(encrypted?.v!==1)return respond(req,{error:'Unsupported credential version'},503);
  const key=await crypto.subtle.importKey('raw',decode(env('GOOGLE_TOKEN_ENCRYPTION_KEY')),'AES-GCM',false,['decrypt']);
  const decrypted=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(encrypted.iv)},key,decode(encrypted.ciphertext));
  const refreshToken=new TextDecoder().decode(decrypted);
  const tokenResult=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env('GOOGLE_CLIENT_ID'),client_secret:env('GOOGLE_CLIENT_SECRET'),refresh_token:refreshToken,grant_type:'refresh_token'})});
  if(!tokenResult.ok)return respond(req,{error:'Reconnect Google before creating a workbook'},401);
  const {access_token}=await tokenResult.json();
  if(!access_token)return respond(req,{error:'Google token unavailable'},502);
  const headers={Authorization:'Bearer '+access_token,'Content-Type':'application/json'};
  const title='3543 Intel | State '+stateId+' | '+new Date().toISOString().slice(0,10);
  const created=await fetch('https://sheets.googleapis.com/v4/spreadsheets',{method:'POST',headers,body:JSON.stringify({properties:{title},sheets:[...tags.map(tag=>({properties:{title:tag,gridProperties:{frozenRowCount:1,rowCount:Math.max(1000,(groups.get(tag)?.length||0)+1)}}})),...['Combat','Events'].map(title=>({properties:{title,gridProperties:{frozenRowCount:1,rowCount:Math.max(1000,title==='Combat'?combatRows.length+1:eventRows.length+1)}}}))]})});
  if(!created.ok)return respond(req,{error:'Google could not create the spreadsheet',googleStatus:created.status},502);
  const workbook=await created.json();
  const spreadsheetId=workbook.spreadsheetId;
  if(!spreadsheetId)return respond(req,{error:'Google did not return a spreadsheet ID'},502);
  const data=[...tags.map(tag=>({range:"'"+tag.replace(/'/g,"''")+"'!A1:P"+(groups.get(tag)!.length+1),values:[HEADERS,...groups.get(tag)!.sort((a,b)=>String(a[0]).localeCompare(String(b[0])))]})),{range:"'Combat'!A1:P"+(combatRows.length+1),values:[COMBAT_HEADERS,...combatRows]},{range:"'Events'!A1:P"+(eventRows.length+1),values:[EVENT_HEADERS,...eventRows]}];
  const written=await fetch('https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(spreadsheetId)+'/values:batchUpdate',{method:'POST',headers,body:JSON.stringify({valueInputOption:'RAW',data})});
  if(!written.ok)return respond(req,{error:'Workbook was created but filling rows failed. Do not retry until checking the created workbook.',spreadsheetUrl:'https://docs.google.com/spreadsheets/d/'+spreadsheetId+'/edit'},502);
  return respond(req,{spreadsheetId,spreadsheetUrl:'https://docs.google.com/spreadsheets/d/'+spreadsheetId+'/edit',stateId,alliances:tags.length,players:rows.length,writeMode:'new_workbook_only'});
 }catch(e){console.error('Workbook creation failed',e instanceof Error?e.name:'unknown');return respond(req,{error:'Unable to create spreadsheet'},503)}
});
