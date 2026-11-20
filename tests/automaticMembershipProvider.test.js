import test from 'node:test';
import assert from 'node:assert/strict';
import {verifiedPlayerLocation} from '../src/services/verifiedPlayerLocation.js';
const now=Date.parse('2026-11-20T12:00:00Z');
const payload={fresh:true,cached_at:'2026-11-20T11:00:00Z',player:{chief_id:'12345678',kid:3573,alliance:{abbr:'HOT'}}};
test('fresh verified provider payload yields immutable ID and source',()=>{
 assert.deepEqual(verifiedPlayerLocation({data:payload},'12345678',now),{
  status:'verified',fid:'12345678',state:'3573',tag:'HOT',at:'2026-11-20T11:00:00.000Z',source:'whiteoutstats-player'
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
