import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileAllianceMembership} from '../src/services/allianceImportService.js';
const players=[{fid:'1',allianceTag:'HOT',membershipStatus:'confirmed'},{fid:'2',allianceTag:'HOT',membershipStatus:'confirmed',notes:'keep'},{fid:'3',allianceTag:'ARC',membershipStatus:'confirmed'}];
const rows=[{fid:'1'}];
test('partial roster does not declare absent players departed',()=>{
 const result=reconcileAllianceMembership(players,rows,'HOT','2026-11-18T00:00:00Z',{authoritative:false});
 assert.equal(result[1].membershipStatus,'unverified');
 assert.equal(result[1].notes,'keep');
 assert.equal(result[2],players[2]);
});
test('only authoritative roster can flag an absent member',()=>{
 const result=reconcileAllianceMembership(players,rows,'HOT','2026-11-18T00:00:00Z',{authoritative:true});
 assert.equal(result[1].membershipStatus,'not_in_roster');
 assert.equal(result[0].membershipStatus,'confirmed');
});
