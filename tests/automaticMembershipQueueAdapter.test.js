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
