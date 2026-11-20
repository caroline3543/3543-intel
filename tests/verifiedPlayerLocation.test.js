import test from 'node:test';
import assert from 'node:assert/strict';
import { verifiedPlayerLocation } from '../src/services/verifiedPlayerLocation.js';
const now=Date.parse('2026-11-19T12:00:00Z');
const response=(alliance,cached_at=new Date(now-3600000).toISOString())=>({data:{fresh:true,player:{chief_id:'12345',kid:3573,alliance,cached_at}}});
test('explicit null alliance is confirmed as No Alliance',()=>{
  assert.equal(verifiedPlayerLocation(response(null),'12345',now).tag,'');
});
test('confirmed alliance tag is accepted',()=>{
  assert.equal(verifiedPlayerLocation(response({abbr:'ARC'}),'12345',now).tag,'ARC');
});
test('omitted alliance is not treated as No Alliance',()=>{
  const r=response(null);delete r.data.player.alliance;
  assert.throws(()=>verifiedPlayerLocation(r,'12345',now),/omitted alliance/);
});
test('stale cache cannot trigger automatic relocation',()=>{
  assert.throws(()=>verifiedPlayerLocation(response(null,new Date(now-73*3600000).toISOString()),'12345',now),/stale/);
});
test('missing observation timestamp blocks confirmation',()=>{
  assert.throws(()=>verifiedPlayerLocation(response(null,null),'12345',now),/timestamp/);
});
test('player ID mismatch blocks confirmation',()=>{
  assert.throws(()=>verifiedPlayerLocation(response(null),'99999',now),/ID mismatch/);
});

test('verified location retains explicit freshness evidence for worker',()=>{
 const observation=verifiedPlayerLocation(response({abbr:'HOT'}),'12345',now);
 assert.equal(observation.fresh,true);
 assert.equal(observation.status,'verified');
});
test('unconfirmed freshness is rejected rather than synthesized',()=>{
 const r=response({abbr:'HOT'});delete r.data.fresh;
 assert.throws(()=>verifiedPlayerLocation(r,'12345',now),/fresh/);
});
test('invalid provider alliance tag is rejected',()=>{
 assert.throws(()=>verifiedPlayerLocation(response({abbr:'HOT wrong'}),'12345',now),/invalid characters/);
});
