import {authorized,configured,cookie,passwordMatches,sameOrigin,sessionToken,respond} from '../server/access.js';
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
  if(!passwordMatches(req.body?.password,process.env.ACCESS_PASSWORD_HASH))return respond(res,401,{error:'Incorrect password.'});
  attempts.delete(ip);res.setHeader('Set-Cookie',cookie(sessionToken()));return respond(res,200,{authenticated:true,role:'leader'});
}
