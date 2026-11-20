import test from 'node:test';
import assert from 'node:assert/strict';
import {planVerifiedMembershipUpdate,commitVerifiedMembershipWithCas} from '../src/services/automaticMembershipWorkspaceMerge.js';
const at='2026-11-20T11:00:00Z',detectedAt='2026-11-20T12:00:00Z';
const player={id:'local1',fid:'12345678',username:'Existing',alias:'Custom alias',notes:'Never overwrite',allianceTag:'HOT',membershipObservedAt:'2026-11-19T00:00:00Z',allianceHistory:[],roles:['Rally Lead']};
const workspace={players:[player],settings:{stateId:'3573'},events:[],customRoles:[]};
test('verified in-state alliance move preserves manual fields and history',()=>{
 const r=planVerifiedMembershipUpdate({workspace,fid:player.fid,observation:{status:'verified',state:'3573',tag:'ARC',at},detectedAt});
 const p=r.workspace.players[0];
 assert.equal(p.allianceTag,'ARC');
 assert.equal(p.alias,'Custom alias');
 assert.equal(p.notes,'Never overwrite');
 assert.deepEqual(p.roles,['Rally Lead']);
 assert.equal(p.allianceHistory.at(-1).from,'HOT');
 assert.equal(r.events.length,0);
});
test('explicit verified no-alliance retains previous alliance',()=>{
 const r=planVerifiedMembershipUpdate({workspace,fid:player.fid,observation:{status:'verified',state:'3573',tag:'',at},detectedAt});
 assert.equal(r.workspace.players[0].allianceTag,'');
 assert.equal(r.workspace.players[0].lastKnownAlliance,'HOT');
});
test('verified state transfer archives without deleting player profile',()=>{
 const r=planVerifiedMembershipUpdate({workspace,fid:player.fid,observation:{status:'verified',state:'3599',tag:'ABC',at},detectedAt});
 assert.equal(r.workspace.players[0].membershipStatus,'transferred_out');
 assert.equal(r.workspace.players[0].notes,'Never overwrite');
 assert.equal(r.events.length,1);
 assert.equal(r.events[0].actualTransferAt,null);
});
test('cached or unverified data cannot change membership',()=>{
 assert.throws(()=>planVerifiedMembershipUpdate({workspace,fid:player.fid,observation:{status:'cached',state:'3599',tag:'ABC',at},detectedAt}),/Verified/);
});
test('older observation is a no-op',()=>{
 const r=planVerifiedMembershipUpdate({workspace,fid:player.fid,observation:{status:'verified',state:'3573',tag:'ARC',at:'2026-11-18T11:00:00Z'},detectedAt});
 assert.equal(r.changed,false);
 assert.equal(r.workspace,workspace);
});
test('CAS retries re-read organiser edits and preserve them',async()=>{
 let reads=0,saves=0;
 const r=await commitVerifiedMembershipWithCas({
  fid:player.fid,observation:{status:'verified',state:'3573',tag:'ARC',at},detectedAt,
  loadLocked:async()=>({workspace:{...workspace,players:[{...player,notes:reads++?'Edited during retry':'Original'}]},events:[],revision:reads}),
  saveTransaction:async({workspace:w})=>{saves++;if(saves===1)return false;assert.equal(w.players[0].notes,'Edited during retry');return true;}
 });
 assert.equal(r.workspace.players[0].allianceTag,'ARC');
 assert.equal(saves,2);
});
