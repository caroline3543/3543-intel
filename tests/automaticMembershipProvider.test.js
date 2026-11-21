import test from 'node:test';
import assert from 'node:assert/strict';
import {verifiedPlayerLocation,verifiedProviderUsage} from '../src/services/verifiedPlayerLocation.js';
const now=Date.parse('2026-11-20T12:00:00Z');
const payload={fresh:true,cached_at:'2026-11-20T11:00:00Z',player:{chief_id:'12345678',kid:3573,alliance:{abbr:'HOT'}}};
test('fresh verified provider payload yields immutable ID and source',()=>{
 assert.deepEqual(verifiedPlayerLocation({data:payload},'12345678',now),{
  status:'verified',fresh:true,fid:'12345678',state:'3573',tag:'HOT',at:'2026-11-20T11:00:00.000Z',source:'whiteoutstats-player'
 });
});
test('explicit null alliance is No Alliance',()=>{
 assert.equal(verifiedPlayerLocation({...payload,player:{...payload.player,alliance:null}},'12345678',now).tag,'');
});
test('stale refresh state never authorises membership change',()=>{
 assert.throws(()=>verifiedPlayerLocation({...payload,fresh:false},'12345678',now),/fresh/);
});
test('missing alliance cannot be interpreted as No Alliance',()=>{
 assert.throws(()=>verifiedPlayerLocation({...payload,player:{chief_id:'12345678',kid:3573}},'12345678',now),/omitted alliance/);
});
test('wrong FID cannot update another profile',()=>{
 assert.throws(()=>verifiedPlayerLocation(payload,'99999999',now),/mismatch/);
});

test('reported freshness cannot override an observation older than the free-tier freshness window',()=>{
 assert.throws(()=>verifiedPlayerLocation({...payload,cached_at:'2026-11-20T10:59:59Z'},'12345678',now),/stale/);
});

test('numeric and string Unix timestamps use the same freshness check',()=>{
 const seconds=Date.parse(payload.cached_at)/1000;
 for(const cached_at of [seconds,String(seconds),seconds*1000,String(seconds*1000)]){
  assert.equal(verifiedPlayerLocation({...payload,cached_at},'12345678',now).at,'2026-11-20T11:00:00.000Z');
 }
});

test('usage parser requires internally consistent free-tier account counters',()=>{
 const usage={
  ok:true,
  minute:{limit:60,used:18,remaining:42},
  daily:{limit:5000,used:1750,remaining:3250}
 };
 assert.deepEqual(verifiedProviderUsage(usage),{used:1750,minuteUsed:18});
 assert.throws(()=>verifiedProviderUsage({...usage,daily:{...usage.daily,remaining:3249}}),/Unverified/);
 assert.throws(()=>verifiedProviderUsage({used:1750,minute_used:18}),/Unverified/);
});
