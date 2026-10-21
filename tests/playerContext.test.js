import {test} from 'node:test';
import assert from 'node:assert/strict';
import {gameLanguageCode,gameLanguageName,withGameLanguage,providerField} from '../src/services/gameLanguageService.js';
import {recordedTimestamp,recordedActivity} from '../src/services/recordedActivityService.js';
import {applyPlayerDetails} from '../src/services/playerDetailsService.js';
import {buildRosterDataSheet} from '../src/services/xlsxDataSheets.js';
import * as XLSX from 'xlsx';
test('game locale codes resolve to readable existing language names',()=>{
 for(const [code,name] of [['en','English'],['en_US','English'],['ru','Russian'],['zh-TW','Chinese (Traditional)'],['pt-BR','Portuguese'],['ko','Korean']])assert.equal(gameLanguageName(code),name);
 for(const invalid of [null,'',0,{},'not supplied','<script>'])assert.equal(gameLanguageCode(invalid),null);
});
test('saved provider language becomes primary and preserves additional manual languages without mutation',()=>{
 const p={id:'a',languages:['Portuguese'],providerStats:{raw:{language:'en'},retrievedAt:'2026-10-20T00:00:00Z'}};
 const before=structuredClone(p),next=withGameLanguage(p);assert.deepEqual(p,before);assert.equal(next.gameLanguage,'en');assert.deepEqual(next.languages,['English','Portuguese']);assert.equal(withGameLanguage(next),next);
});
test('newest supplied source wins; language changes replace the previous game language',()=>{
 const p={gameLanguage:'en',languages:['English','Portuguese'],providerStats:{raw:{language:'en'},retrievedAt:'2026-10-20T00:00:00Z'},providerDetails:{raw:{player:{language:'ru'}},retrievedAt:'2026-10-21T00:00:00Z'}};
 assert.equal(providerField(p,'language'),'ru');assert.deepEqual(withGameLanguage(p).languages,['Russian','Portuguese']);
 const empty={...p,providerDetails:{raw:{player:{language:null}},retrievedAt:'2026-10-22T00:00:00Z'}};assert.equal(withGameLanguage(empty).gameLanguage,'en');
});
test('authenticated profile refresh persists the game setting through the existing merge path',()=>{
 const p={id:'stable',fid:'596099868',languages:['Portuguese'],notes:'Keep'};
 const r={retrieved_at:'2026-10-21T03:00:00Z',data:{chief_id:p.fid,player:{fid:p.fid,kid:3573,language:'en'}}};
 const next=applyPlayerDetails(p,r,'3573');assert.deepEqual(next.languages,['English','Portuguese']);assert.equal(next.gameLanguage,'en');assert.equal(next.id,'stable');assert.equal(next.notes,'Keep');
 const sheet=buildRosterDataSheet([next]),row=XLSX.utils.sheet_to_json(sheet)[0];assert.equal(row.gameLanguage,'en');
});
test('activity timestamps accept Unix seconds, milliseconds and explicit UTC ISO strings',()=>{
 const expected='2026-10-21T01:40:46.000Z';assert.equal(recordedTimestamp(1792546846),expected);assert.equal(recordedTimestamp('1792546846'),expected);assert.equal(recordedTimestamp(1792546846000),expected);assert.equal(recordedTimestamp(expected),expected);
 for(const invalid of [null,'Last active 1h ago',0,-1,Infinity,'invalid'])assert.equal(recordedTimestamp(invalid),null);
});
test('relative activity uses the recorded timestamp, handles future times and keeps UTC text',()=>{
 const t=1792546846000;
 assert.deepEqual(recordedActivity(1792546846,t+3720000),{iso:'2026-10-21T01:40:46.000Z',utc:'2026-10-21 01:40:46 UTC',relative:'1h 2m ago'});
 assert.equal(recordedActivity(t,t+90000000).relative,'1d 1h ago');assert.equal(recordedActivity(t,t-3600000).relative,'1h 0m in the future');assert.equal(recordedActivity(null),null);
});
