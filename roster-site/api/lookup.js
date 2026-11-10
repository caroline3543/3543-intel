import {authorized,sameOrigin,respond} from '../server/access.js';
const actions=new Set(['alliance','player_details','rankings']);
export default async function handler(req,res){
 if(req.method!=='POST')return respond(res,405,{error:'Method not allowed'});
 if(!authorized(req))return respond(res,401,{error:'Sign in to Caroline 3739 to load game data.'});
 if(!sameOrigin(req))return respond(res,403,{error:'Open Caroline 3739 directly to refresh.'});
 const input=req.body||{};
 if(!actions.has(input.action)||Number(input.state)!==3739||!Number.isSafeInteger(Number(input.state)))return respond(res,400,{error:'Caroline 3739 only supports State 3739 game data.'});
 if(input.action==='alliance'&&!/^[\p{L}\p{N}_-]{1,16}$/u.test(input.tag||''))return respond(res,400,{error:'Enter a valid alliance tag.'});
 if(input.action==='player_details'&&!/^[1-9]\d{3,14}$/.test(String(input.fid||'')))return respond(res,400,{error:'Enter a valid player ID.'});
 const boards=['personal_power','kills','furnace','state_transfer','labyrinth','chief_gear','chief_charm','pet_power','troop_power','hero_total','single_hero','research_power','building_power','island_prosperity','alliance_power','alliance_kills'];
 if(input.action==='rankings'&&!boards.includes(input.board))return respond(res,400,{error:'Unsupported ranking.'});
 const base=process.env.GAME_API_URL,key=process.env.GAME_API_PUBLIC_KEY,token=process.env.GAME_SITE_TOKEN;
 if(!base||!key||!token)return respond(res,503,{error:'Game API connection is not configured.'});
 const body={action:input.action,state:3739};
 if(input.action==='alliance')body.tag=input.tag;
 if(input.action==='player_details')body.fid=String(input.fid);
 if(input.action==='rankings'){body.board=input.board;body.limit=Math.max(1,Math.min(100,Number(input.limit)||100));}
 try{
  const response=await fetch(base.replace(/\/$/,'')+'/functions/v1/caroline3739-roster',{method:'POST',headers:{'Content-Type':'application/json',apikey:key,Authorization:'Bearer '+key,'x-caroline-site-key':token},body:JSON.stringify(body),signal:AbortSignal.timeout(100000)});
  const data=await response.json().catch(()=>({error:'Could not read game provider response.'}));
  return respond(res,response.status,data);
 }catch{return respond(res,502,{error:'Game data service unavailable.'});}
}
