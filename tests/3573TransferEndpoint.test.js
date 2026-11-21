import test from 'node:test';
import assert from 'node:assert/strict';
import {sessionToken} from '../roster-site/server/access.js';
import handler from '../roster-site/api/transfers.js';

const env={
 SESSION_SECRET:'x'.repeat(40),
 ACCESS_PASSWORD_HASH:'abcdef:'.concat('0'.repeat(64)),
 GAME_API_URL:'https://example.supabase.co',
 GAME_API_PUBLIC_KEY:'test-publishable',
 GAME_SITE_TOKEN:'test-server-token'
};
function response(){
 return {status(code){this.code=code;return this;},json(body){this.body=body;return this;},setHeader(){return this;}};
}
function request(method='GET',cookie=''){
 return {method,headers:{cookie},query:{}};
}
test('transfer history rejects anonymous requests before any upstream call',async()=>{
 const original=globalThis.fetch;let called=false;
 globalThis.fetch=async()=>{called=true;throw Error('unexpected fetch');};
 try{
  const res=response();
  await handler(request(),res);
  assert.equal(res.code,401);assert.equal(called,false);
 }finally{globalThis.fetch=original;}
});
test('transfer history is read-only',async()=>{
 const res=response();await handler(request('POST'),res);
 assert.equal(res.code,405);
});
test('authenticated transfer endpoint returns only validated event arrays',async()=>{
 const oldEnv={};
 for(const [k,v] of Object.entries(env)){oldEnv[k]=process.env[k];process.env[k]=v;}
 const original=globalThis.fetch;
 const cookie='__Host-caroline_access='+sessionToken(env);
 try{
  let input;
  globalThis.fetch=async(_url,options)=>{
   input=JSON.parse(options.body);
   return {ok:true,json:async()=>({events:[{fid:'12345',direction:'out'}]})};
  };
  const res=response();await handler(request('GET',cookie),res);
  assert.equal(res.code,200);
  assert.equal(res.body.events.length,1);
  assert.equal(input.action,'transfers');
  assert.equal(input.workspaceId,'3573-leaders');
  globalThis.fetch=async()=>({ok:true,json:async()=>({events:{invalid:true}})});
  const invalid=response();await handler(request('GET',cookie),invalid);
  assert.equal(invalid.code,502);
 }finally{
  globalThis.fetch=original;
  for(const [k,v] of Object.entries(oldEnv)){if(v===undefined)delete process.env[k];else process.env[k]=v;}
 }
});
