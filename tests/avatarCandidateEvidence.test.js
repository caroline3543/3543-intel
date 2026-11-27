import test from 'node:test';
import assert from 'node:assert/strict';
import {rankAvatarEvidence} from '../roster-site/src/foundry/avatarCandidateEvidence.js';
const fingerprint=(n=0)=>({difference:'1'.repeat(n)+'0'.repeat(64-n),average:'1'.repeat(n)+'0'.repeat(64-n)});
const source=fingerprint();
test('distinct close reference is advisory only',()=>{
 const result=rankAvatarEvidence(source,[{id:'a',fingerprint:fingerprint(2)},{id:'b',fingerprint:fingerprint(40)}]);
 assert.equal(result.recommendedId,'a');assert.equal(result.reason,'advisory-only');
});
test('identical shared avatars cannot recommend an identity',()=>{
 const result=rankAvatarEvidence(source,[{id:'a',fingerprint:source},{id:'b',fingerprint:source}]);
 assert.equal(result.recommendedId,null);assert.equal(result.reason,'ambiguous-reference');
});
test('near-identical avatars remain ambiguous',()=>{
 assert.equal(rankAvatarEvidence(source,[{id:'a',fingerprint:fingerprint(1)},{id:'b',fingerprint:fingerprint(3)}]).recommendedId,null);
});
test('missing, malformed and distant references are not recommended',()=>{
 for(const references of [[],[{id:'a',fingerprint:null}],[{id:'a',fingerprint:{difference:'0',average:'0'}}],[{id:'a',fingerprint:fingerprint(64)}]])assert.equal(rankAvatarEvidence(source,references).recommendedId,null);
 assert.equal(rankAvatarEvidence(null,[{id:'a',fingerprint:source}]).recommendedId,null);
});
