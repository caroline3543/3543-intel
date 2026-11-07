import {test} from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync,gunzipSync} from 'node:zlib';
import {createHmac} from 'node:crypto';
import workspace from '../roster-site/api/workspace.js';
import {passwordHash,sessionToken,cookie,accessContext} from '../roster-site/server/access.js';
const env={ACCESS_PASSWORD_HASH:passwordHash('test-only-long-password'),SESSION_SECRET:'test-only-session-key-that-is-long-enough',GAME_API_URL:'https://example.supabase.co',GAME_API_PUBLIC_KEY:'test-public-key',GAME_SITE_TOKEN:'test-only-server-bridge-key'};
const data={players:[],events:[],customRoles:[],settings:{stateId:'3573'}};
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this},json(v){this.body=v;},send(v){this.body=JSON.parse(gunzipSync(v));}});
test('workspace route rejects missing sessions and untrusted roles',async()=>{
 const res=response();await workspace({method:'GET',headers:{}},res);assert.equal(res.code,401);
 const token=sessionToken(env),payload=Buffer.from(JSON.stringify({...JSON.parse(Buffer.from(token.split('.')[0],'base64url')),role:'player'})).toString('base64url');const sig=createHmac('sha256',env.SESSION_SECRET).update(`${payload}:${env.ACCESS_PASSWORD_HASH}`).digest('base64url');assert.equal(accessContext({headers:{cookie:cookie(payload+'.'+sig)}},env),null);
});
test('leader proxy validates state and origin, never trusts browser roles, and supports compressed data',async()=>{
 const before={...process.env},oldFetch=global.fetch;Object.assign(process.env,env);let calls=0,sent;
 global.fetch=async(url,options)=>{calls++;sent=JSON.parse(options.body);assert.ok(url.endsWith('/caroline3573-workspace'));return {status:200,json:async()=>({data:sent.data||data,revision:1})};};
 const req={method:'POST',headers:{cookie:cookie(sessionToken(env)),host:'3573-caroline.vercel.app',origin:'https://3573-caroline.vercel.app'},body:{revision:0,data}};
 try{
  let res=response();await workspace(req,res);assert.equal(res.code,200);assert.equal(sent.role,'leader');assert.equal(sent.workspaceId,'3573-leaders');assert.ok(sent.actor);assert.equal(res.headers['Cache-Control'],'no-store');
  req.body={revision:1,encoded:gzipSync(JSON.stringify(data)).toString('base64')};res=response();await workspace(req,res);assert.equal(res.code,200);assert.deepEqual(sent.data,data);
  for(const body of [{revision:1,data,role:'leader'},{revision:1,data:{...data,settings:{stateId:'3543'}}},{revision:1,data:{...data,SESSION_SECRET:'bad'}}]){const count=calls;req.body=body;res=response();await workspace(req,res);assert.equal(res.code,400);assert.equal(calls,count);}
  req.headers.origin='https://attacker.example';req.body={revision:1,data};res=response();await workspace(req,res);assert.equal(res.code,403);
 }finally{global.fetch=oldFetch;for(const k of Object.keys(process.env))if(!(k in before))delete process.env[k];Object.assign(process.env,before);}
});
