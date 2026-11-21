import test from 'node:test';
import assert from 'node:assert/strict';
import {createMembershipQueueAdapter} from '../src/services/automaticMembershipQueueAdapter.js';
const job={id:1,jobKind:'player_verify',fid:'12345678',lease_token:'valid-lease'};
const valid={status:'verified',fresh:true,fid:'12345678',state:'3573',tag:'',at:'2026-11-20T11:00:00Z',source:'whiteoutstats-player'};
for(const [label,change] of [
 ['missing alliance',{tag:undefined}],
 ['missing state',{state:undefined}],
 ['unconfirmed freshness',{fresh:false}],
 ['mismatched FID',{fid:'99999999'}],
 ['invalid alliance',{tag:'bad tag'}]
]){
 test('private queue adapter rejects '+label+' before SQL',async()=>{
  const calls=[];
  const adapter=createMembershipQueueAdapter({query:async(...args)=>{calls.push(args);return []}});
  await assert.rejects(adapter.commitPlayerObservation({job,observation:{...valid,...change},detectedAt:'2026-11-20T12:00:00Z'}));
  assert.equal(calls.length,0);
 });
}
test('private queue adapter accepts explicit No Alliance and commits verified observation',async()=>{
 const calls=[];
 const adapter=createMembershipQueueAdapter({query:async(sql,params)=>{
  calls.push({sql,params});
  if(sql.includes('select revision'))return [{revision:0}];
  return [{applied:true,outcome:'alliance_change'}];
 }});
 await adapter.commitPlayerObservation({job,observation:valid,detectedAt:'2026-11-20T12:00:00Z'});
 assert.equal(calls.length,2);
 assert.equal(calls[1].params[2],'');
});

test('seeding never advances an existing scheduled refresh',async()=>{
 const calls=[];
 const adapter=createMembershipQueueAdapter({query:async(sql,params)=>{calls.push({sql,params});return []}});
 await adapter.enqueue({jobKey:'roster:ARC',jobKind:'alliance_roster',allianceTag:'ARC',priority:5,dueAt:'2026-11-21T00:00:00Z'});
 assert.match(calls[0].sql,/on conflict\(job_key\) do update/i);
 assert.match(calls[0].sql,/status='cancelled'/i);
 assert.match(calls[0].sql,/updated_at < now\(\)-interval '1 hour'/i);
 assert.doesNotMatch(calls[0].sql,/due_at\s*=\s*least/i);
});

test('leased PostgreSQL row is normalized for worker dispatch',async()=>{
 const adapter=createMembershipQueueAdapter({query:async()=>[{
  id:7,job_key:'roster:ARC',job_kind:'alliance_roster',alliance_tag:'ARC',
  lease_token:'lease-token',attempts:2
 }]});
 const leased=await adapter.leaseNext({now:'2026-11-20T12:00:00Z'});
 assert.equal(leased.jobKind,'alliance_roster');
 assert.equal(leased.jobKey,'roster:ARC');
 assert.equal(leased.allianceTag,'ARC');
 assert.equal(leased.lease_token,'lease-token');
 assert.equal(leased.attempts,2);
});

test('shared budget adapter reserves credits using private SQL RPC',async()=>{
 const calls=[];
 const adapter=createMembershipQueueAdapter({query:async(sql,params)=>{
  calls.push({sql,params});return [{allowed:true}];
 }});
 assert.equal(await adapter.reserveCredits({credits:1,providerUsed:200,providerMinuteUsed:7,now:'2026-11-20T12:00:00Z'}),true);
 assert.match(calls[0].sql,/membership_3573\.reserve_request_credits/);
 assert.deepEqual(calls[0].params,['2026-11-20T12:00:00Z',1,200,7]);
});
test('invalid shared budget reservation does not query database',async()=>{
 let called=false;
 const adapter=createMembershipQueueAdapter({query:async()=>{called=true;return [];}});
 assert.equal(await adapter.reserveCredits({credits:0,providerUsed:200,providerMinuteUsed:7,now:'2026-11-20T12:00:00Z'}),false);
 assert.equal(called,false);
});

test('secondary alliances are derived from workspace players, excluding primary and departed',async()=>{
 const adapter=createMembershipQueueAdapter({query:async()=>[{players:[
  {fid:'12345',allianceTag:'ARC'},
  {fid:'12346',allianceTag:'FAM'},
  {fid:'12347',allianceTag:'BDE'},
  {fid:'12348',allianceTag:'FAM'},
  {fid:'12349',allianceTag:'OLD',membershipStatus:'transferred_out'},
  {fid:'12350',allianceTag:''}
 ]}]});
 assert.deepEqual(await adapter.getSecondaryTags(),['BDE','FAM']);
});
test('missing workspace roster fails closed for secondary eligibility',async()=>{
 const adapter=createMembershipQueueAdapter({query:async()=>[]});
 await assert.rejects(adapter.getSecondaryTags(),/unavailable/);
});

test('the worker can enqueue a roster in one statement and deduplicates repeated job keys',async()=>{
 const calls=[];
 const adapter=createMembershipQueueAdapter({query:async(sql,params)=>{calls.push({sql,params});return []}});
 const player={jobKey:'player:12345',jobKind:'player_verify',fid:'12345',dueAt:'2026-11-21T00:00:00Z'};
 const roster={jobKey:'roster:HOT',jobKind:'alliance_roster',allianceTag:'HOT',dueAt:player.dueAt};
 await adapter.enqueueMany([player,roster,player]);
 assert.equal(calls.length,1);
 assert.match(calls[0].sql,/jsonb_to_recordset/);
 assert.deepEqual(JSON.parse(calls[0].params[0]).map(job=>job.job_key),[player.jobKey,roster.jobKey]);
});
