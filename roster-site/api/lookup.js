import {authorized,sameOrigin,respond} from '../server/access.js';
const actions=new Set(['alliance','player_details','rankings']);
export default async function handler(req,res){
  if(req.method!=='POST')return respond(res,405,{error:'Method not allowed'});
  if(!authorized(req))return respond(res,401,{error:'Enter the site password to refresh game data.'});
  if(!sameOrigin(req))return respond(res,403,{error:'Open this website directly to refresh.'});
  const input=req.body;
  if(!input||!actions.has(input.action)||!Number.isSafeInteger(Number(input.state))||Number(input.state)<1||Number(input.state)>99999||(input.action!=='rankings'&&Number(input.state)!==3573))return respond(res,400,{error:'Invalid state. Roster and profile lookups are limited to State 3573.'});
  const base=process.env.GAME_API_URL,key=process.env.GAME_API_PUBLIC_KEY;
  if(!base||!key||!process.env.GAME_SITE_TOKEN)return respond(res,503,{error:'Game data access is not configured yet.'});
  const body={action:input.action,state:Number(input.state)};
  if(input.action==='alliance'){if(!/^[\p{L}\p{N}_-]{1,16}$/u.test(input.tag||''))return respond(res,400,{error:'Enter a valid alliance tag.'});body.tag=input.tag;}
  if(input.action==='player_details'){if(!/^[1-9]\d{3,14}$/.test(String(input.fid||'')))return respond(res,400,{error:'Enter a valid player ID.'});body.fid=String(input.fid);}
  if(input.action==='rankings'){if(!['personal_power','kills','furnace','state_transfer','labyrinth','chief_gear','chief_charm','pet_power','troop_power','hero_total','single_hero','research_power','building_power','island_prosperity','alliance_power','alliance_kills'].includes(input.board))return respond(res,400,{error:'Unsupported ranking.'});body.board=input.board;body.limit=Math.max(1,Math.min(100,Number(input.limit)||100));}
  try{
    const response=await fetch(`${base.replace(/\/$/,'')}/functions/v1/caroline3573`,{method:'POST',headers:{'Content-Type':'application/json',apikey:key,'x-caroline-site-key':process.env.GAME_SITE_TOKEN,Authorization:`Bearer ${key}`},body:JSON.stringify(body),signal:AbortSignal.timeout(100000)});
    const payload=await response.json().catch(()=>({error:'Game data service returned an unreadable response.'}));
    return respond(res,response.status,payload);
  }catch{return respond(res,502,{error:'Game data is unavailable. Try again shortly.'});}
}
