import test from 'node:test';
import assert from 'node:assert/strict';
import {createScreenshotMatcher} from './screenshotImportPlan.js';
const local={id:'local',fid:'123456',name:'Jaguar',alliance:'RKG'};
const other={id:'other',fid:'123456',name:'Jaguar',alliance:'HOT'};
test('same permanent identity resolves to sole eligible workspace record',()=>{
  assert.equal(createScreenshotMatcher([local,other],'RKG')('Jaguar').player?.id,'local');
});
test('duplicate eligible records remain manual',()=>{
  assert.equal(createScreenshotMatcher([local,{...other,alliance:'RKG'}],'RKG')('Jaguar').player,null);
});
test('different permanent identities remain ambiguous within alliance',()=>{
  assert.equal(createScreenshotMatcher([local,{...other,fid:'654321',alliance:'RKG'}],'RKG')('Jaguar').player,null);
});
test('explicitly preferred second record preserves ambiguity',()=>{
  assert.equal(createScreenshotMatcher([local,other],'RKG',['other'])('Jaguar').player,null);
});
test('missing permanent IDs do not collapse records',()=>{
  assert.equal(createScreenshotMatcher([{...local,fid:''},{...other,fid:'',alliance:'RKG'}],'RKG')('Jaguar').player,null);
});
