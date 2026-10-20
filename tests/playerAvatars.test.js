import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeAvatarUrl, playerAvatarUrl} from '../src/services/playerAvatarService.js';
import {allianceRows, mergeAllianceProfiles} from '../src/services/allianceImportService.js';
const avatar='https://cdn.example.com/player/avatar.jpg';
const rows=member=>allianceRows({data:{members:[{chief_id:123,kid:3543,...member}]}},'3543','ABC');
test('avatar import updates an existing FID and preserves profile history',()=>{
  const before={id:'stable',fid:'123',avatarUrl:'https://cdn.example.com/old.jpg',notes:'Keep',eventHistory:[{id:'event'}]};
  const p=mergeAllianceProfiles([before],rows({avatar_url:avatar}),'3543').updated[0];
  assert.equal(p.avatarUrl,avatar);assert.equal(p.providerStats.raw.avatar_url,avatar);
  assert.equal(p.id,'stable');assert.equal(p.notes,'Keep');assert.deepEqual(p.eventHistory,before.eventHistory);
  assert.equal(before.avatarUrl,'https://cdn.example.com/old.jpg');
});
test('missing and unusable avatar responses preserve the existing picture',()=>{
  for(const value of [null,'','javascript:alert(1)','data:image/svg+xml,invalid','/relative/path',{},'https://name:secret@cdn.example.com/a.jpg']) {
    assert.equal(normalizeAvatarUrl(value),null);
    const p=mergeAllianceProfiles([{id:'stable',fid:'123',avatarUrl:avatar}],rows({avatar_url:value}),'3543').updated[0];
    assert.equal(p.avatarUrl,avatar);
  }
});
test('previously imported complete provider data displays without another fetch',()=>{
  assert.equal(playerAvatarUrl({providerStats:{raw:{avatar_url:avatar}}}),avatar);
  assert.equal(playerAvatarUrl({providerStats:{avatarUrl:avatar}}),avatar);
  assert.equal(playerAvatarUrl({avatarUrl:'invalid',providerStats:{raw:{avatar_url:avatar}}}),avatar);
  assert.equal(playerAvatarUrl({}),null);
});
test('new profiles receive the actual supplied avatar URL',()=>{
  const p=mergeAllianceProfiles([],rows({avatar_url:avatar,nick_name:'Player'}),'3543').added[0];
  assert.equal(p.avatarUrl,avatar);assert.equal(playerAvatarUrl(p),avatar);
});
