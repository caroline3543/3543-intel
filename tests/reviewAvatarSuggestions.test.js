import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewAvatarSuggestions} from '../roster-site/src/foundry/reviewAvatarSuggestions.js';
const fp=n=>({difference:'1'.repeat(n)+'0'.repeat(64-n),average:'1'.repeat(n)+'0'.repeat(64-n)});
const candidates=[{id:'a'},{id:'b'}];
const run=(get,extra={})=>reviewAvatarSuggestions({fingerprint:fp(0),candidates,referenceCache:{get},...extra});
test('recommendation is advisory and limited to shortlist',async()=>{
 assert.deepEqual(await run(async p=>fp(p.id==='a'?0:40)),{candidateId:'a',scope:'username-shortlist',advisory:true});
});
test('shared or missing references suppress suggestion',async()=>{
 assert.equal(await run(async()=>fp(0)),null);
 assert.equal(await run(async p=>p.id==='a'?fp(0):null),null);
});
test('cancelled and oversized shortlists do not fetch',async()=>{
 const controller=new AbortController();controller.abort();
 const get=()=>{throw Error('unexpected fetch');};
 assert.equal(await run(get,{signal:controller.signal}),null);
 assert.equal(await run(get,{candidates:Array.from({length:9},(_,id)=>({id}))}),null);
});
test('deduplicates candidates and limits concurrent requests',async()=>{
 let active=0,max=0,calls=0;
 await run(async p=>{calls++;active++;max=Math.max(max,active);await Promise.resolve();active--;return fp(p.id==='a'?0:40);},{candidates:[...candidates,{id:'a'},{id:'c'},{id:'d'}]});
 assert.equal(calls,4);assert.equal(max,2);
});

test('reference retrieval exceptions suppress advisory evidence',async()=>{assert.equal(await run(async()=>{throw Error('unavailable');}),null);});
