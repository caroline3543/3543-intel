import test from 'node:test';
import assert from 'node:assert/strict';
import {createCurrentAvatarEvidence} from '../roster-site/src/foundry/currentAvatarEvidence.js';
const player=url=>({fid:'123',avatarUrl:url});
const a='https://example.com/a.png',b='https://example.com/b.png';
test('concurrent requests share only the current reference',async()=>{
 const calls=[];const cache=createCurrentAvatarEvidence({loadFingerprint:async url=>{calls.push(url);return url;}});
 assert.deepEqual(await Promise.all([cache.get(player(a)),cache.get(player(a))]),[a,a]);
 assert.equal(await cache.get(player(b)),b);
 assert.equal(await cache.get(player(a)),a);
 assert.deepEqual(calls,[a,b,a]);
 cache.clear();await cache.get(player(a));assert.equal(calls.length,4);
});
test('missing and failed avatars do not block identity review',async()=>{
 const cache=createCurrentAvatarEvidence({loadFingerprint:async()=>{throw Error('network');}});
 assert.equal(await cache.get(player(a)),null);
 assert.equal(await cache.get(player(null)),null);
});
test('late obsolete reference cannot overwrite current avatar',async()=>{
 let release;const cache=createCurrentAvatarEvidence({loadFingerprint:url=>url===a?new Promise(r=>{release=r;}):b});
 const old=cache.get(player(a));await Promise.resolve();
 assert.equal(await cache.get(player(b)),b);release(a);assert.equal(await old,null);
});
