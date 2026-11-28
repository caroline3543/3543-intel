import test from 'node:test';
import assert from 'node:assert/strict';
import {createScreenshotMatcher} from './screenshotImportPlan.js';

const hermes={id:'hermes',name:'HΞRMΞS',alliance:'HOT',alias:'HERMES'};
const match=(players,name='HERMES')=>createScreenshotMatcher(players,'HOT')(name);
test('stored profile alias resolves decorative username',()=>{
 assert.equal(match([hermes]).player?.id,'hermes');
});
test('duplicate stored aliases require review even across alliances',()=>{
 const result=match([hermes,{id:'other',name:'Other',alliance:'ARC',alias:'HERMES'}]);
 assert.equal(result.player,null);
 assert.deepEqual(new Set(result.candidates.map(p=>p.id)),new Set(['hermes','other']));
});
test('stored alias conflicting with current username requires review',()=>{
 assert.equal(match([hermes,{id:'other',name:'HERMES',alliance:'HOT'}]).player,null);
});
test('out-of-alliance alias cannot auto-match without eligibility',()=>{
 assert.equal(match([{...hermes,alliance:'ARC'}]).player,null);
});
test('duplicate and invalid alias values do not prevent a valid match',()=>{
 assert.equal(match([{...hermes,nickname:'HERMES',ocrAliases:['HERMES',null,42,' ']}]).player?.id,'hermes');
});
test('legacy nickname and learned aliases remain supported',()=>{
 for(const fields of [{nickname:'HERMES'},{ocrAliases:['HERMES']}])
  assert.equal(match([{id:'hermes',name:'HΞRMΞS',alliance:'HOT',...fields}]).player?.id,'hermes');
});
