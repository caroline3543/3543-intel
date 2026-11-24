import {authorized,configured,cookie,credentialHash,passwordMatches,sameOrigin,sessionToken,respond} from '../server/access.js';
const attempts=new Map();
export default function handler(req,res){
  if(!configured())return respond(res,503,{error:'Site access is not configured yet.'});
  if(req.method==='GET')return respond(res,200,{authenticated:authorized(req),role:authorized(req)?'leader':null});
  if(!['POST','DELETE'].includes(req.method))return respond(res,405,{error:'Method not allowed'});
  if(!sameOrigin(req))return respond(res,403,{error:'Open this website directly to sign in.'});
  if(req.method==='DELETE'){res.setHeader('Set-Cookie',cookie('',true));return respond(res,200,{authenticated:false});}
  const ip=String(req.headers['x-forwarded-for']||'unknown').split(',')[0];
  const now=Date.now(),bucket=attempts.get(ip);
  if(bucket&&bucket.until>now&&bucket.count>=10)return respond(res,429,{error:'Too many attempts. Try again in 15 minutes.'});
  if(attempts.size>10000)for(const [key,value] of attempts)if(value.until<now)attempts.delete(key);
  const entry=bucket&&bucket.until>now?bucket:{count:0,until:now+15*60*1000};entry.count++;attempts.set(ip,entry);
  const accountId = typeof req.body?.organiser === 'string' ? req.body.organiser.trim().toLowerCase() || 'owner' : 'owner';
  const hash = credentialHash(accountId);
  const matches = passwordMatches(req.body?.password,hash ?? process.env.ACCESS_PASSWORD_HASH);
  if(!hash || !matches)return respond(res,401,{error:'Incorrect sign-in details.'});
  attempts.delete(ip);const remember=req.body?.remember===true;res.setHeader('Set-Cookie',cookie(sessionToken(process.env,Date.now(),remember,accountId),false,remember));return respond(res,200,{authenticated:true,role:'leader'});
}
