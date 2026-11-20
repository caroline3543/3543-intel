import test from 'node:test';
import assert from 'node:assert/strict';
import {transferNavigation,filterTransferPlayers} from '../src/services/automaticMembershipTransferView.js';
const now=Date.parse('2026-11-20T12:00:00Z');
const events=[
 {fid:'12345678',confidence:'confirmed',fromState:'3573',toState:'3600',firstDetectedAt:'2026-11-19T12:00:00Z'},
 {fid:'23456789',confidence:'confirmed',fromState:'3600',toState:'3573',firstDetectedAt:'2026-11-19T12:00:00Z'},
 {fid:'34567890',confidence:'previous_state_unknown',fromState:null,toState:'3573',firstDetectedAt:'2026-11-20T11:00:00Z'}
];
test('confirmed inbound and outbound appear as promoted filters',()=>{
 const v=transferNavigation(events,now);
 assert.equal(v.promoted,true);
 assert.deepEqual(v.filters.map(f=>f.count),[1,1]);
 assert.deepEqual(v.filters.map(f=>f.promoted),[true,true]);
});
test('72-hour expiry hides promoted filters without deleting history',()=>{
 const v=transferNavigation(events,now+73*60*60*1000);
 assert.equal(v.promoted,false);
 assert.equal(v.transferredOut.length,1);
 assert.equal(v.transferredIn.length,1);
});
test('unknown-origin discoveries never count as confirmed transfers',()=>{
 const v=transferNavigation(events,now);
 assert.equal(v.transferredIn.some(e=>e.fid==='34567890'),false);
});
test('transfer filter uses immutable player IDs',()=>{
 const players=[{fid:'12345678',username:'A'},{fid:'23456789',username:'B'},{fid:'34567890',username:'C'}];
 assert.deepEqual(filterTransferPlayers(players,events,'out').map(p=>p.username),['A']);
 assert.deepEqual(filterTransferPlayers(players,events,'in').map(p=>p.username),['B']);
});

test('routine re-verification does not extend the 72-hour promotion',()=>{
 const old={...events[0],firstDetectedAt:'2026-11-16T11:00:00Z',lastVerifiedAt:'2026-11-20T11:00:00Z'};
 const view=transferNavigation([old],now);
 assert.equal(view.promoted,false);
 assert.equal(view.transferredOut.length,1);
});
