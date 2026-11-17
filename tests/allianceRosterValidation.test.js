import test from 'node:test';
import assert from 'node:assert/strict';
import {assessAllianceRoster} from '../src/services/allianceRosterValidation.js';
const member=fid=>({chief_id:String(fid),kid:3573});
const opts={stateId:3573,allianceTag:'HOT'};
test('unmarked API roster is not assumed complete',()=>{
 const result=assessAllianceRoster({data:{members:[member(1)]}},opts);
 assert.equal(result.authoritative,false);
 assert.ok(result.problems.includes('completeness_unverified'));
});
test('explicitly complete valid roster is authoritative',()=>{
 const result=assessAllianceRoster({data:{complete:true,members:[member(1),member(2)]}},opts);
 assert.equal(result.authoritative,true);
 assert.equal(result.uniqueFidCount,2);
});
test('duplicate FIDs invalidate even complete response',()=>{
 const result=assessAllianceRoster({data:{complete:true,members:[member(1),member(1)]}},opts);
 assert.ok(result.problems.includes('duplicate_fid'));
 assert.equal(result.authoritative,false);
});
test('wrong state invalidates response',()=>{
 const result=assessAllianceRoster({data:{complete:true,members:[{chief_id:'1',kid:3574}]}},opts);
 assert.ok(result.problems.includes('wrong_member_state'));
});
test('more than alliance capacity invalidates response',()=>{
 const result=assessAllianceRoster({data:{complete:true,members:Array.from({length:101},(_,i)=>member(i+1))}},opts);
 assert.ok(result.problems.includes('over_capacity'));
});
test('missing members never becomes authoritative',()=>{
 const result=assessAllianceRoster({data:{complete:true}},opts);
 assert.ok(result.problems.includes('missing_members'));
});
