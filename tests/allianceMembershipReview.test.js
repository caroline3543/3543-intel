import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileAllianceMembership} from '../src/services/allianceImportService.js';

test('a successful roster observation marks missing members unverified without deleting profiles',()=>{
 const players=[
  {id:'1',fid:'101',allianceTag:'HOT',username:'Present',troops:{infantry:'T11'}},
  {id:'2',fid:'102',allianceTag:'HOT',username:'Missing',troops:{lancer:'T10'},talTeamwork:{priority:true}},
  {id:'3',fid:'103',allianceTag:'ARC',username:'Other alliance'}
 ];
 const result=reconcileAllianceMembership(players,[{fid:'101'}],'HOT','2026-11-16T01:00:00Z');
 assert.equal(result[0].membershipStatus,'confirmed');
 assert.equal(result[1].membershipStatus,'unverified');
 assert.equal(result[1].allianceTag,'HOT');
 assert.deepEqual(result[1].troops,{lancer:'T10'});
 assert.deepEqual(result[1].talTeamwork,{priority:true});
 assert.deepEqual(result[2],players[2]);
 assert.deepEqual(players[1].membershipStatus,undefined);
});

test('a returning member becomes confirmed on the next successful observation',()=>{
 const old={id:'2',fid:'102',allianceTag:'HOT',membershipStatus:'unverified',username:'Return'};
 const [next]=reconcileAllianceMembership([old],[{fid:'102'}],'HOT','2026-11-17T01:00:00Z');
 assert.equal(next.membershipStatus,'confirmed');
 assert.equal(next.membershipCheckedAt,'2026-11-17T01:00:00Z');
});
