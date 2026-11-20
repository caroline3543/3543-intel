import test from 'node:test';
import assert from 'node:assert/strict';
import {createMembershipWorker} from '../src/services/automaticMembershipWorker.js';
const now=Date.parse('2026-11-20T12:00:00Z');
function harness({enabled=true,usage={used:100,minuteUsed:0},observation={fid:'12345678',source:'whiteoutstats-player',status:'verified',state:'3573',tag:'HOT',at:'2026-11-20T11:00:00Z'},roster=null}={}){
 const calls=[];const player={fid:'12345678',username:'Test',stateId:'3573',allianceTag:'ARC',membershipObservedAt:'2026-11-19T00:00:00Z'};
 const job={jobKey:'player:12345678',jobKind:'player_verify',fid:'12345678',attempts:0};
 const store={isEnabled:async()=>enabled,leaseNext:async()=>job,getPlayer:async()=>player,enqueue:async j=>calls.push(['enqueue',j]),commitPlayerObservation:async v=>calls.push(['commit',v]),commitRosterSnapshot:async v=>calls.push(['snapshot',v]),complete:async()=>calls.push(['complete']),retry:async(_,v)=>calls.push(['retry',v])};
 const api={usage:async()=>usage,verifyPlayer:async()=>observation,roster:async()=>roster};
 return {worker:createMembershipWorker({store,api,clock:()=>now}),calls,job,store,api};
}
test('worker disabled by default has no side effects',async()=>{const h=harness({enabled:false});assert.equal((await h.worker.tick()).status,'disabled');assert.equal(h.calls.length,0)});
test('unavailable usage fails closed',async()=>{const h=harness({usage:null});assert.equal((await h.worker.tick()).status,'usage_unavailable');assert.equal(h.calls.length,0)});
test('daily reserve prevents refresh',async()=>{const h=harness({usage:{used:4500,minuteUsed:0}});assert.equal((await h.worker.tick()).status,'budget_exhausted');assert.equal(h.calls.length,0)});
test('minute limit reschedules without fetching',async()=>{const h=harness({usage:{used:100,minuteUsed:60}});assert.equal((await h.worker.tick()).status,'rate_limited');assert.equal(h.calls[0][0],'retry')});
test('verified player observation commits, then completes',async()=>{const h=harness();assert.equal((await h.worker.tick()).status,'completed');assert.equal(h.calls[0][1].decision.kind,'alliance_change');assert.deepEqual(h.calls.map(x=>x[0]),['commit','complete'])});
test('unverified player observation preserves data and retries',async()=>{const h=harness({observation:{status:'cached'}});assert.equal((await h.worker.tick()).status,'retry_scheduled');assert.deepEqual(h.calls.map(x=>x[0]),['retry'])});
test('roster disappearance does not cause transfer',async()=>{const h=harness({roster:{complete:true,fresh:true,observedAt:'2026-11-20T11:00:00Z',members:[]}});h.job.jobKind='alliance_roster';h.job.allianceTag='ARC';assert.equal((await h.worker.tick()).status,'completed');assert.deepEqual(h.calls[0][1].discoveries,[]);assert.equal(h.calls[0][0],'snapshot')});
test('incomplete roster does not overwrite snapshot',async()=>{const h=harness({roster:{complete:false,fresh:true,members:[]}});h.job.jobKind='alliance_roster';h.job.allianceTag='ARC';assert.equal((await h.worker.tick()).status,'retry_scheduled');assert.equal(h.calls[0][0],'retry')});
test('seeding creates exact primary roster jobs and due player jobs',async()=>{const h=harness();const n=await h.worker.seed([{fid:'12345678',allianceTag:'ARC',membershipLastSuccessfulAt:'2026-11-20T06:00:00Z'}]);assert.equal(n,1);assert.equal(h.calls.length,5);assert.deepEqual(h.calls.slice(1).map(x=>x[1].allianceTag),['ARC','RKG','HOT','LUN'])});
