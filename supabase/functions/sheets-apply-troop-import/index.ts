import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
const OWNER='f560b117-a3db-4692-b0bf-fd372044130c';
const ORIGINS=['https://3543-intel-git-feat-spreadsheet-s-8ea8a3-sunfire-castle-planner.vercel.app'];
function response(req:Request,data:unknown,status=200){
 const origin=req.headers.get('origin')||'';
 return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin',...(ORIGINS.includes(origin)?{'Access-Control-Allow-Origin':origin}:{}),'Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'}});
}
Deno.serve(async req=>{
 const origin=req.headers.get('origin')||'';
 if(origin&&!ORIGINS.includes(origin))return response(req,{error:'Origin not allowed'},403);
 if(req.method==='OPTIONS')return response(req,{},200);
 if(req.method!=='POST')return response(req,{error:'Method not allowed'},405);
 try{
  const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const jwt=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
  if(!jwt)return response(req,{error:'Sign in required'},401);
  const auth=createClient(url,anon,{auth:{persistSession:false}});
  const {data:{user},error}=await auth.auth.getUser(jwt);
  if(error||user?.id!==OWNER)return response(req,{error:'Not authorised'},403);
  const x=await req.json();
  const state=String(x.stateId||''),fid=String(x.fid||'');
  if(!/^[1-9]\d{0,4}$/.test(state)||!/^\d{4,15}$/.test(fid)||typeof x.alliance!=='string'||!x.alliance.trim())return response(req,{error:'Invalid state, ID or alliance'},400);
  const mode=x.mode==='create'?'create':x.mode==='heroes'?'heroes':'update';
  const tiers=x.troops;
  const extras=x.extraFields||{};
  if(typeof extras!=='object'||Array.isArray(extras)||Object.keys(extras).some(k=>!['foundryTroopPower','canyonTroopPower','gameLanguage'].includes(k)))return response(req,{error:'Unexpected manual field'},400);
  if(Object.entries(extras).some(([k,v])=>k==='gameLanguage'?(typeof v!=='string'||v.length>80):(typeof v!=='number'||!Number.isSafeInteger(v)||v<0||v>999999999999)))return response(req,{error:'Invalid manually entered value'},400);
  if(!tiers||Array.isArray(tiers)||typeof tiers!=='object'||(mode==='update'&&!Object.keys(tiers).length&&!Object.keys(extras).length)||Object.keys(tiers).some(k=>!['infantry','lancer','marksman'].includes(k)||typeof tiers[k]!=='string'||!/^(T\d{1,2}|FC\d{1,2})$/.test(tiers[k])))return response(req,{error:'Invalid troop-level data'},400);
  if(mode==='heroes'&&(!Array.isArray(x.joinerHeroes)||!x.joinerHeroes.length||x.joinerHeroes.length>30||x.joinerHeroes.some((h:any)=>!h||typeof h.hero!=='string'||h.hero.trim().length<2||h.hero.length>60||!Number.isInteger(h.skillLevel)||h.skillLevel!==5)))return response(req,{error:'Invalid hero or expedition skill level'},400);
  const admin=createClient(url,key,{auth:{persistSession:false}});
  if(mode==='create'){
   const username=String(x.username||'').trim();
   if(!username||username.length>80)return response(req,{error:'Username is required for new players'},400);
   const {data:newId,error:createError}=await admin.rpc('create_sheet_roster_player',{p_state:state,p_fid:fid,p_alliance:x.alliance.trim().toUpperCase(),p_username:username,p_troops:tiers});
   if(createError)return response(req,{error:'Cannot create player: duplicate ID or invalid roster data'},409);
   return response(req,{ok:true,created:true,playerId:newId,stateId:state,fid});
  }
  const {data:records,error:fetchError}=await admin.from('players').select('id,state_id,alliance_tag,data,updated_at').eq('state_id',state).limit(10000);
  if(fetchError)return response(req,{error:'Roster read failed'},503);
  const matches=(records||[]).filter(p=>String(p.data?.fid||'')===fid);
  if(matches.length!==1)return response(req,{error:'Player missing or duplicate; no changes made'},409);
  const player=matches[0];
  if(String(player.alliance_tag||'').toUpperCase()!==x.alliance.trim().toUpperCase())return response(req,{error:'Alliance no longer matches; reload preview'},409);
  if(mode==='heroes'){
   const incoming=x.joinerHeroes;
   const current=player.data?.joinerHeroes||[];
   const compare=(arr:any[])=>JSON.stringify(arr.map(h=>[String(h.hero).toLowerCase(),Number(h.skillLevel)]).sort());
   if(compare(current)!==compare(x.expectedHeroes||[]))return response(req,{error:'Joiner heroes changed since review; reload'},409);
   const {data:ok,error:heroError}=await admin.rpc('apply_sheet_joiner_heroes',{p_state:state,p_record_id:player.id,p_expected_updated_at:player.updated_at,p_heroes:incoming.map((h:any)=>({hero:h.hero.trim(),skillLevel:h.skillLevel,verified:false,updatedAt:new Date().toISOString()}))});
   if(heroError)return response(req,{error:'Could not save joiner heroes'},503);
   if(!ok)return response(req,{error:'Player changed during review; reload'},409);
   return response(req,{ok:true,stateId:state,fid,updatedFields:['joinerHeroes']});
  }
  const expected=x.expected||{};
  if(Object.keys(extras).some(k=>String(player.data?.[k]??'')!==String((x.expectedExtras||{})[k]??'')))return response(req,{error:'Manual fields changed since preview; reload'},409);
  if(!Object.keys(tiers).length&&Object.keys(extras).length){
   const {data:updated,error:applyError}=await admin.rpc('apply_sheet_manual_fields',{p_state:state,p_record_id:player.id,p_expected_updated_at:player.updated_at,p_fields:extras});
   if(applyError)return response(req,{error:'Manual fields could not be saved'},503);
   if(!updated)return response(req,{error:'Player changed during review; reload'},409);
   return response(req,{ok:true,stateId:state,fid,updatedFields:Object.keys(extras)});
  }
  if(Object.keys(tiers).some(k=>String(player.data?.troops?.[k]??'')!==String(expected[k]??'')))return response(req,{error:'Player troop levels changed since preview; reload'},409);
  if(Object.keys(extras).length)return response(req,{error:'Review troop levels and other changes separately for safe updates'},409);
  const {data:success,error:writeError}=await admin.rpc('apply_sheet_troop_levels',{p_state:state,p_record_id:player.id,p_expected_updated_at:player.updated_at,p_troops:tiers});
  if(writeError)return response(req,{error:'Could not apply troop update'},503);
  if(!success)return response(req,{error:'Roster changed during review; reload'},409);
  return response(req,{ok:true,stateId:state,fid,updatedFields:Object.keys(tiers)});
 }catch{return response(req,{error:'Import failed; no success confirmed'},503)}
});
