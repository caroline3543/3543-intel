import test from 'node:test';
import assert from 'node:assert/strict';
import {parseManualPlayerBatch,processManualMembershipBatch} from '../src/services/manualMembershipRefresh.js';
import {membershipExceptions,verifiedMembershipTime} from '../src/services/rosterViewService.js';
import {state3573AllianceTags} from '../src/services/state3573Alliances.js';
import refreshHandler from '../roster-site/api/membership-refresh.js';
import {gameApiConfig} from '../roster-site/server/gameApi.js';
import {sessionToken} from '../roster-site/server/access.js';

const now=Date.parse('2026-11-22T17:57:00Z');
const player=(fid,alliance={abbr:'FARM'})=>({ok:true,fresh:true,chief_id:fid,cached_at:now/1000,
  player:{chief_id:fid,fid,kid:3573,alliance}});

test('batch membership distinguishes explicit No Alliance, missing fields, duplicate and invalid FIDs',()=>{
  const missing=player('1002');
  delete missing.player.alliance;
  const mismatch=player('1004');
  mismatch.player.fid='9999';
  const malformed=player('1005',{abbr:{trim:1}});
  const cached={...player('1006'),fresh:false};
  const result=parseManualPlayerBatch({players:[player('1001',null),missing,player('1003'),player('1003'),mismatch,malformed,cached],pending:[{chief_id:'1007'}],not_found:['1008']},
    ['1001','1002','1003','1004','1005','1006','1007','1008','1009'],now);
  assert.equal(result.get('1001').observation.tag,'');
  assert.equal(result.get('1001').observation.at,new Date(now).toISOString());
  assert.deepEqual([...result.values()].map(r=>r.outcome),['verified','missing_membership','duplicate_provider_record','invalid_response','missing_membership','freshness_unverified','provider_pending','player_not_found','invalid_response']);
  assert.equal(result.get('1002').validPlayer,true);
  assert.ok(!result.get('1002').observation);
});

function harness(override={}) {
  const effects=[];
  const jobs=[{fid:'1001',attempts:0},{fid:'1002',attempts:2}];
  const store={
    hasManualWork:async()=>true,
    leaseManual:async limit=>{effects.push(['lease',limit]);return jobs;},
    reserveCredits:async ({credits})=>{effects.push(['reserve',credits]);return true;},
    beginManualRequest:async()=>{effects.push(['begin']);return 'request';},
    deferManual:async()=>effects.push(['defer']),
    recordManualHttp:async (id,response)=>effects.push(['http',id,response.status,response.transportFailed===true]),
    endManualItem:async (job,result,retry)=>effects.push(['outcome',job.fid,result.outcome,retry]),
    ...override.store
  };
  const api={usage:async()=>({used:100,minuteUsed:20}),verifyBatch:async()=>({status:200,body:{players:[player('1001')],failed:['1002']}}),...override.api};
  return {effects,store,run:()=>processManualMembershipBatch({store,api,clock:()=>now})};
}

test('worker reserves quota, persists successful siblings, retries failed records and counts distinct stages',async()=>{
  const {run,effects}=harness();
  assert.equal(await run(),'processed');
  assert.deepEqual(effects,[['lease',20],['reserve',2],['begin'],['http','request',200,false],['outcome','1001','verified',null],['outcome','1002','provider_failed',240]]);
});

test('worker distinguishes 429 and timeout and respects provider retry-after',async()=>{
  const limited=harness({api:{verifyBatch:async()=>({status:429,retryAfter:'600'})}});
  assert.equal(await limited.run(),'processed');
  assert.deepEqual(limited.effects.slice(-2),[['outcome','1001','rate_limited',600],['outcome','1002','rate_limited',600]]);
  const timeout=harness({api:{verifyBatch:async()=>{throw new DOMException('Timeout','TimeoutError');}}});
  await timeout.run();
  assert.deepEqual(timeout.effects[3],['http','request',null,true]);
  assert.deepEqual(timeout.effects[4],['outcome','1001','transport_failed',60]);
});

test('worker makes no player request when the account or shared ledger refuses credits',async()=>{
  const daily=harness({api:{usage:async()=>({used:4000,minuteUsed:0})}});
  assert.equal(await daily.run(),'budget_exhausted');
  assert.deepEqual(daily.effects,[]);
  const ledger=harness({store:{reserveCredits:async()=>false}});
  assert.equal(await ledger.run(),'budget_exhausted');
  assert.deepEqual(ledger.effects,[['lease',20],['defer']]);
});

test('failed persistence is retried without treating a valid response as a write',async()=>{
  const effects=[];
  const {run}=harness({store:{endManualItem:async (job,result,retry)=>{
    effects.push([job.fid,result.outcome,Boolean(result.observation),retry]);
    if(result.outcome==='verified')throw Error('isolated write failure');
  }}});
  await run();
  assert.deepEqual(effects,[['1001','verified',true,null],['1001','persistence_failed',true,60],['1002','provider_failed',false,240]]);
});

test('only ID exceptions or manual flags require review and saved timestamps support legacy Unix numbers',()=>{
  const players=[
    {id:'1',fid:'1001',allianceTag:'FARM',providerStats:{capturedAt:new Date(now).toISOString()}},
    {id:'2',fid:'1002',allianceTag:'WAR',membershipLastSuccessfulAt:now/1000-0.25},
    {id:'3',fid:'1003',allianceTag:'lun',membershipStatus:'transfer_review'},
    {id:'4',fid:'1004',allianceTag:''},{id:'5',fid:'1004'},
    {id:'6',fid:'missing'}
  ];
  assert.deepEqual([...membershipExceptions(players).keys()],['3','4','5','6']);
  assert.equal(verifiedMembershipTime(players[0],now),null);
  assert.equal(verifiedMembershipTime(players[1],now),new Date(now-250).toISOString());
  assert.deepEqual(state3573AllianceTags(players),['ARC','HOT','RKG','WAR','LUN','FARM','lun']);
});

test('manual endpoint rejects anonymous requests, cross-origin writes and production database access from preview',async()=>{
  const env={SESSION_SECRET:'a-test-secret-for-the-local-session-only',ACCESS_PASSWORD_HASH:'fixture:hash'};
  const prior={SESSION_SECRET:process.env.SESSION_SECRET,ACCESS_PASSWORD_HASH:process.env.ACCESS_PASSWORD_HASH};
  Object.assign(process.env,env);
  const res={setHeader(){},status(code){this.code=code;return this;},json(data){return {code:this.code,data};}};
  try {
    assert.equal((await refreshHandler({method:'GET',headers:{}},res)).code,401);
    const cookie='__Host-caroline_access='+sessionToken(env);
    assert.equal((await refreshHandler({method:'POST',headers:{cookie,origin:'https://other.invalid',host:'test.invalid'}},res)).code,403);
    const config={GAME_API_URL:'https://nrksysaynoklqzhyhnmd.supabase.co',GAME_API_PUBLIC_KEY:'fixture',GAME_SITE_TOKEN:'fixture',VERCEL_ENV:'preview'};
    assert.equal(gameApiConfig({...config,STATE_3573_PREVIEW_API_ORIGIN:config.GAME_API_URL}),null);
    assert.ok(gameApiConfig({...config,VERCEL_ENV:'production'}));
    assert.ok(gameApiConfig({...config,GAME_API_URL:'https://isolated.invalid',STATE_3573_PREVIEW_API_ORIGIN:'https://isolated.invalid'}));
  } finally {
    for(const [key,value] of Object.entries(prior)) {
      if(value===undefined)delete process.env[key];else process.env[key]=value;
    }
  }
});
