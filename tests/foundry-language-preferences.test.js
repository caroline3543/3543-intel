import test from 'node:test';
import assert from 'node:assert/strict';
import {addRecordedLanguage,gameLanguageCode,gameLanguageName,recordedLanguageNames,withGameLanguage} from '../src/services/gameLanguageService.js';

test('language display uses full names including Chinese script variants',()=>{
 assert.equal(gameLanguageName('ko'),'Korean');
 assert.equal(gameLanguageName('zh-TW'),'Traditional Chinese');
 assert.equal(gameLanguageName('zh-CN'),'Simplified Chinese');
 assert.equal(gameLanguageCode('Chinese (Traditional)'),'zh-TW');
 assert.equal(gameLanguageCode('Traditional Chinese'),'zh-TW');
});

test('manual language takes precedence over imported provider language',()=>{
 const player={gameLanguage:'ko',gameLanguageSource:'manual',providerDetails:{raw:{player:{language:'en'}},retrievedAt:'2026-11-17T00:00:00Z'}};
 const result=withGameLanguage(player);
 assert.equal(result.gameLanguage,'ko');
 assert.equal(result.languages[0],'Korean');
});

test('provider language fills an unset language',()=>{
 const player={providerDetails:{raw:{player:{language:'tr'}},retrievedAt:'2026-11-17T00:00:00Z'}};
 const result=withGameLanguage(player);
 assert.equal(result.gameLanguage,'tr');
 assert.equal(result.languages[0],'Turkish');
});

test('new provider language replaces an older imported language',()=>{
 const player={gameLanguage:'en',languages:['English','Portuguese'],providerDetails:{raw:{player:{language:'ru'}},retrievedAt:'2026-11-17T00:00:00Z'}};
 const result=withGameLanguage(player);
 assert.equal(result.gameLanguage,'ru');
 assert.deepEqual(result.languages,['Russian','Portuguese']);
});

test('planner additions preserve other languages and the primary game language',()=>{
 const player={gameLanguage:'ko',gameLanguageSource:'provider',languages:['ko','Japanese']};
 const next=addRecordedLanguage(player,'en');
 assert.deepEqual(recordedLanguageNames(next),['Korean','Japanese','English']);
 assert.equal(next.gameLanguage,'ko');
 assert.equal(next.gameLanguageSource,'provider');
 assert.strictEqual(addRecordedLanguage(next,'English'),next);
});
