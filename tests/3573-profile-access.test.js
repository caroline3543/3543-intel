import test from 'node:test';
import assert from 'node:assert/strict';
import {accessContext,configured,credentialHash,passwordHash,passwordMatches,sessionToken} from '../roster-site/server/access.js';
import workspace from '../roster-site/api/workspace.js';

const owner = passwordHash('owner-fixture');
const editor = passwordHash('organiser-fixture');
const env = {SESSION_SECRET:'fixture-only-session-secret-with-adequate-length',ACCESS_PASSWORD_HASH:owner,ACCESS_ORGANISER_HASHES:JSON.stringify({juniper:editor})};
const req = token => ({headers:{cookie:'__Host-caroline_access='+token}});
test('the owner and explicitly approved organiser can authenticate',()=>{
  assert.equal(configured(env),true);
  assert.equal(passwordMatches('organiser-fixture',credentialHash('juniper',env)),true);
  for(const account of ['owner','juniper']) assert.equal(accessContext(req(sessionToken(env,Date.now(),false,account)),env).role,'leader');
});
test('unapproved, revoked, and rotated organiser credentials cannot grant access',()=>{
  assert.equal(credentialHash('stranger',env),null);
  assert.throws(()=>sessionToken(env,Date.now(),false,'stranger'));
  const token = req(sessionToken(env,Date.now(),false,'juniper'));
  assert.equal(accessContext(token,{...env,ACCESS_ORGANISER_HASHES:'{}'}),null);
  assert.equal(accessContext(token,{...env,ACCESS_ORGANISER_HASHES:JSON.stringify({juniper:owner})}),false);
  assert.equal(configured({...env,ACCESS_ORGANISER_HASHES:'[]'}),false);
});
test('a revoked organiser is denied at the workspace write endpoint',async()=>{
  const token = req(sessionToken(env,Date.now(),false,'juniper'));
  const original = Object.fromEntries(Object.keys(env).map(key=>[key,process.env[key]]));
  Object.assign(process.env,env,{ACCESS_ORGANISER_HASHES:'{}'});
  try{
    const res={setHeader(){},status(code){this.code=code;return this;},json(){return this;}};
    await workspace({...token,method:'POST',body:{}},res);
    assert.equal(res.code,401);
  }finally{
    for(const [key,value] of Object.entries(original)) {
      if(value===undefined)delete process.env[key];else process.env[key]=value;
    }
  }
});
