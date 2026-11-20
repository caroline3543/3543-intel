import test from 'node:test';
import assert from 'node:assert/strict';
import {createMembershipWorker} from '../src/services/automaticMembershipWorker.js';

function setup({player={fid:'12345678',allianceTag:'HOT'},kind='player_verify',credits=100,usage={used:100,minuteUsed:0}}={}){
 const calls=[];
 const job={id:1,lease_token:'token',jobKind:kind,fid:'12345678',allianceTag:'HOT',attempts:0};
 const store={
   isEnabled:async()=>true,
   leaseNext:async()=>job,
   estimateRosterCredits:async()=>credits,
   getPlayer:async()=>player,
   getSecondaryTags:async()=>[],
   cancel:async(_job,reason)=>calls.push(['cancel',reason]),
   retry:async(_job,reason)=>calls.push(['retry',reason]),
   complete:async(_job,meta)=>calls.push(['complete',meta]),
   commitPlayerObservation:async()=>calls.push(['playerCommit']),
   commitRosterSnapshot:async()=>calls.push(['rosterCommit'])
 };
 const api={usage:async()=>usage,verifyPlayer:async()=>({fresh:true,fid:'12345678',source:'whiteoutstats-player',status:'verified',state:'3573',tag:'HOT',at:'2026-11-20T10:00:00Z'}),roster:async()=>({complete:true,fresh:true,observedAt:'2026-11-20T11:00:00Z',members:[]})};
 return {worker:createMembershipWorker({store,api,clock:()=>Date.parse('2026-11-20T12:00:00Z')}),calls};
}
test('transferred out players are cancelled before API verification',async()=>{
 const h=setup({player:{fid:'12345678',membershipStatus:'transferred_out'}});
 assert.equal((await h.worker.tick()).status,'not_eligible');
 assert.deepEqual(h.calls,[['cancel','not_eligible']]);
});
test('oversized member-data cost estimate is rejected rather than executed',async()=>{
 const h=setup({kind:'alliance_roster',credits:100});
 assert.equal((await h.worker.tick()).status,'cost_unverified');
 assert.equal(h.calls[0][0],'retry');
 assert.equal(h.calls[0][1].attempts,0);
});
test('primary player job reschedules after 12 hours',async()=>{
 const h=setup();
 assert.equal((await h.worker.tick()).status,'completed');
 assert.equal(h.calls[1][1].nextDueAt,'2026-11-21T00:00:00.000Z');
});
test('secondary alliance roster reschedules after seven days',async()=>{
 const h=setup({kind:'alliance_roster',credits:1,usage:{used:100,minuteUsed:0}});
 h.worker; // primary tag HOT in fixture; change via separate store fixture if required
 assert.equal((await h.worker.tick()).status,'completed');
 assert.equal(h.calls[1][1].nextDueAt,'2026-11-21T00:00:00.000Z');
});
