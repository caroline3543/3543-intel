import {test} from 'node:test';
import assert from 'node:assert/strict';
import {authorized,cookie,passwordHash,passwordMatches,sessionToken} from '../roster-site/server/access.js';
import lookup from '../roster-site/api/lookup.js';
const env={ACCESS_PASSWORD_HASH:passwordHash('test-only-long-password'),SESSION_SECRET:'test-only-session-key-that-is-long-enough'};
const request=token=>({headers:{cookie:cookie(token)}});
test('password hashes validate without storing plaintext',()=>{
 assert.equal(passwordMatches('test-only-long-password',env.ACCESS_PASSWORD_HASH),true);
 assert.equal(passwordMatches('incorrect',env.ACCESS_PASSWORD_HASH),false);
 assert.equal(passwordMatches('test-only-long-password','invalid'),false);
});
test('sessions reject expiry, tampering, missing configuration and password rotation',()=>{
 const now=Date.now(),token=sessionToken(env,now);
 assert.equal(authorized(request(token),env,now),true);
 assert.equal(authorized(request(token+'x'),env,now),false);
 assert.equal(authorized(request(token),env,now+9*3600*1000),false);
 assert.equal(authorized(request(token),{...env,ACCESS_PASSWORD_HASH:passwordHash('new-password')},now),false);
 assert.equal(authorized(request(token),{},now),false);
});
test('unauthenticated requests cannot reach the game API',async()=>{
 let called=false;const previous=global.fetch;global.fetch=()=>{called=true;throw new Error('unexpected');};
 const res={setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;}};
 try{await lookup({method:'POST',headers:{},body:{action:'alliance',state:3573,tag:'HOT'}},res);assert.equal(res.code,401);assert.equal(called,false);}finally{global.fetch=previous;}
});
test('authenticated alliance lookups support valid states, but profile details require 3573 and origin checks',async()=>{
 const previousEnv={...process.env},previous=global.fetch;
 Object.assign(process.env,env,{GAME_API_URL:'https://example.supabase.co',GAME_API_PUBLIC_KEY:'test-public-key',GAME_SITE_TOKEN:'test-only-bridge-key'});
 let fetched=null;global.fetch=async(url,options)=>{fetched={url,options};return {status:200,json:async()=>({data:{members:[]}})};};
 const req={method:'POST',headers:{cookie:cookie(sessionToken(env)),host:'3573-caroline.vercel.app',origin:'https://3573-caroline.vercel.app'},body:{action:'alliance',state:3543,tag:'HOT'}};
 const res={setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;}};
 try{
  await lookup(req,res);assert.equal(res.code,200);
  assert.equal(fetched.url,'https://example.supabase.co/functions/v1/caroline3573');
  assert.equal(JSON.parse(fetched.options.body).state,3543);
  fetched=null;req.body={action:'player_details',state:3543,fid:'12345'};await lookup(req,res);
  assert.equal(res.code,400);assert.equal(fetched,null);
  req.body.state=3573;await lookup(req,res);assert.equal(res.code,200);assert.equal(JSON.parse(fetched.options.body).state,3573);
  fetched=null;req.headers.origin='https://attacker.example';await lookup(req,res);assert.equal(res.code,403);assert.equal(fetched,null);
 }finally{global.fetch=previous;for(const key of Object.keys(process.env))if(!(key in previousEnv))delete process.env[key];Object.assign(process.env,previousEnv);}
});
