import {test} from 'node:test';
import assert from 'node:assert/strict';
import {enrichAllianceLanguages} from '../src/services/allianceLanguageService.js';
import {mergeAllianceProfiles} from '../src/services/allianceImportService.js';
const row=(fid,language)=>({fid,stateId:'3573',allianceTag:'LUN',raw:{language},retrievedAt:'2026-11-04T00:00:00Z'});
const response=(fid,language,kid=3573)=>({data:{player:{chief_id:fid,kid,language}}});
test('roster settings need no extra request; missing settings are fetched and imported by FID',async()=>{
 const calls=[];
 const result=await enrichAllianceLanguages([row('1234','en'),row('5678',null)],'3573',async fid=>{calls.push(fid);return response(fid,'ko');});
 assert.deepEqual(calls,['5678']);assert.equal(result.known,2);
 const saved=mergeAllianceProfiles([{id:'local',fid:'5678',languages:['Spanish'],notes:'Keep'}],result.rows,'3573');
 const player=saved.updated[0];assert.equal(player.gameLanguage,'ko');assert.deepEqual(player.languages,['Korean','Spanish']);assert.equal(player.notes,'Keep');
});
test('mismatched player and state never supply a language; other lookups continue',async()=>{
 const result=await enrichAllianceLanguages([row('1234'),row('5678'),row('9999')],'3573',async fid=>fid==='1234'?response('0000','ko'):fid==='5678'?response(fid,'en',1):response(fid,'ja'));
 assert.equal(result.failed,2);assert.equal(result.known,1);assert.equal(result.rows[0].raw.language,undefined);
});
test('rate limits stop further lookups and failed settings retain existing saved language',async()=>{
 let calls=0;
 const result=await enrichAllianceLanguages([row('1234'),row('5678')],'3573',async()=>{calls++;throw Object.assign(new Error('limit'),{status:429});});
 assert.equal(calls,1);assert.equal(result.limited,true);
 const saved=mergeAllianceProfiles([{id:'old',fid:'1234',gameLanguage:'en',languages:['English']}],result.rows,'3573');
 assert.equal(saved.updated[0].gameLanguage,'en');
});
