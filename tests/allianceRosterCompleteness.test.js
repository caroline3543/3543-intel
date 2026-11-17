import test from 'node:test';
import assert from 'node:assert/strict';
import {isExplicitlyCompleteAllianceRoster} from '../roster-site/src/services/allianceRosterCompleteness.js';

test('partial and unlabelled responses never authorize membership removal',()=>{
 for(const response of [null,{}, {data:{members:[{fid:'1'}]}},{data:{complete:false}},{data:{complete:'true'}},{data:{is_complete:1}}]){
  assert.equal(isExplicitlyCompleteAllianceRoster(response),false);
 }
});
test('explicit provider completeness flags authorize reconciliation',()=>{
 assert.equal(isExplicitlyCompleteAllianceRoster({data:{complete:true}}),true);
 assert.equal(isExplicitlyCompleteAllianceRoster({data:{is_complete:true}}),true);
});
