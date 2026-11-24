import {createHmac,randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';
const COOKIE='__Host-caroline_access';
const TTL=8*60*60;
const REMEMBER_TTL=30*24*60*60;
export function passwordHash(password,salt=randomBytes(16).toString('hex')){return `${salt}:${scryptSync(password,salt,32).toString('hex')}`;}
export function passwordMatches(password,hash){
  if(typeof password!=='string'||password.length>256||!hash)return false;
  const [salt,value]=hash.split(':');
  if(!salt||!/^[a-f0-9]{64}$/.test(value||''))return false;
  return timingSafeEqual(Buffer.from(value,'hex'),scryptSync(password,salt,32));
}
function organiserHashes(env) {
  if (env.ACCESS_ORGANISER_HASHES === undefined) return {};
  try {
    const hashes = JSON.parse(env.ACCESS_ORGANISER_HASHES);
    if (!hashes || Array.isArray(hashes) || typeof hashes !== 'object') return null;
    if (Object.entries(hashes).some(([id,hash]) => !/^[a-z0-9][a-z0-9_-]{0,31}$/.test(id) ||
        id === 'owner' || typeof hash !== 'string' || !/^[^:]+:[a-f0-9]{64}$/.test(hash))) return null;
    return hashes;
  } catch { return null; }
}
export function credentialHash(accountId, env=process.env) {
  if (accountId === 'owner') return env.ACCESS_PASSWORD_HASH;
  const hashes = organiserHashes(env);
  return hashes && Object.hasOwn(hashes,accountId) ? hashes[accountId] : null;
}
function sign(payload,env,hash){
  return createHmac('sha256',env.SESSION_SECRET).update(`${payload}:${hash}`).digest('base64url');
}
export function configured(env=process.env){
  return Boolean(env.SESSION_SECRET?.length>=32&&env.ACCESS_PASSWORD_HASH?.includes(':')&&organiserHashes(env));
}
export function sessionToken(env=process.env,now=Date.now(),remember=false,accountId='owner'){
  const hash=credentialHash(accountId,env);
  if(!hash)throw new Error('Account access is unavailable');
  const payload=Buffer.from(JSON.stringify({role:'leader',workspaceId:'3573-leaders',accountId,exp:Math.floor(now/1000)+(remember?REMEMBER_TTL:TTL),nonce:randomBytes(16).toString('hex')})).toString('base64url');
  return `${payload}.${sign(payload,env,hash)}`;
}
export function accessContext(req,env=process.env,now=Date.now()){
  if(!configured(env))return false;
  const token=(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(COOKIE+'='))?.slice(COOKIE.length+1)||'';
  const [payload,signature,...rest]=token.split('.');
  if(rest.length||!payload||!signature||payload.length>1024)return false;
  try{
    const value=JSON.parse(Buffer.from(payload,'base64url'));
    if(value.accountId===undefined&&env.ACCESS_ORGANISER_HASHES!==undefined)return null;
    const accountId=value.accountId??'owner';
    const hash=credentialHash(accountId,env);
    if(!hash)return null;
    const a=Buffer.from(signature),b=Buffer.from(sign(payload,env,hash));
    if(a.length!==b.length||!timingSafeEqual(a,b))return false;
    const {exp}=value;
    if(!Number.isInteger(exp)||exp<=Math.floor(now/1000)||exp>Math.floor(now/1000)+REMEMBER_TTL)return null;
    if(value.role&&value.role!=='leader'||value.workspaceId&&value.workspaceId!=='3573-leaders')return null;
    return {role:'leader',workspaceId:'3573-leaders',actor:createHmac('sha256',env.SESSION_SECRET).update(value.nonce||payload).digest('hex').slice(0,24)};
  }catch{return null;}
}
export function authorized(req,env=process.env,now=Date.now()){return Boolean(accessContext(req,env,now));}
export function cookie(token,clear=false,remember=false){return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${clear?0:remember?REMEMBER_TTL:TTL}`;}
export function sameOrigin(req){
  const origin=req.headers.origin;
  return typeof origin==='string'&&origin===`https://${req.headers.host}`;
}
export function respond(res,status,data){res.setHeader('Cache-Control','no-store');return res.status(status).json(data);}
