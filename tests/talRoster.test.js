import {applyPlayerDetails} from '../src/services/playerDetailsService.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {allianceCheck,recentNameChanges,legionForPlayer,legionLabel} from '../src/services/talRosterService.js';
import {mergeAllianceProfiles} from '../src/services/allianceImportService.js';
const team={id:'HOT:1',host:'HOT',number:1,members:[{id:'one'}]},day='2026-11-07T00:00:00Z';
test('legion membership uses stable IDs and separates the host from current alliance',()=>{
 assert.equal(legionLabel(team),'HOT Legion 1');assert.equal(legionForPlayer({teams:[team]},'one'),team);
 assert.equal(legionForPlayer({teams:[team]},'other'),undefined);
 assert.equal(allianceCheck({allianceTag:'HOT'},team).status,'unknown');
 assert.equal(allianceCheck({allianceTag:'HOT',providerStats:{allianceTag:'ARC',retrievedAt:day}},team).status,'move');
 assert.equal(allianceCheck({providerStats:{allianceTag:'hot',retrievedAt:day}},team).status,'in-host');
});
test('newer direct profile checks override old roster snapshots, including no alliance',()=>{
 const p={providerStats:{allianceTag:'ARC',retrievedAt:day},providerDetails:{retrievedAt:'2026-11-07T01:00:00Z',raw:{player:{alliance:{abbr:'HOT'}}}}};
 assert.equal(allianceCheck(p,team).status,'in-host');
 p.providerDetails.raw.player.alliance=null;assert.equal(allianceCheck(p,team).status,'move');assert.match(allianceCheck(p,team).label,/No alliance/);
 p.providerDetails.retrievedAt='2026-11-06T01:00:00Z';assert.equal(allianceCheck(p,team).tag,'ARC');
});
test('name feed only includes dated username changes and keeps latest first',()=>{
 const entry=(at,before,after,stream='profile')=>({stream,observedAt:at,changes:[{field:'username',before,after}]});
 const p={id:'one',username:'Now',pastUsernames:['Undated'],observationHistory:[entry(day,'First','Second'),entry('2026-11-07T01:00:00Z','Second','Now'),entry('bad','Wrong','Date'),entry(day,'Not','Profile','ranking:power')]};
 const rows=recentNameChanges([p]);assert.equal(rows.length,2);assert.equal(rows[0].before,'Second');assert.equal(rows[0].playerId,'one');assert.ok(!rows.some(r=>r.before==='Undated'));
});
test('first refresh detects a changed saved name without inventing a prior date',()=>{
 const existing={id:'one',fid:'12345',username:'Old',alias:'Keep',notes:'Keep'};
 const rows=[{fid:'12345',stateId:'3573',username:'New',allianceTag:'HOT',retrievedAt:day}];
 const p=mergeAllianceProfiles([existing],rows,'3573').players[0];
 const changes=recentNameChanges([p]);assert.equal(changes.length,1);assert.equal(changes[0].before,'Old');assert.equal(changes[0].at,new Date(day).toISOString());assert.equal(p.alias,'Keep');assert.equal(p.id,'one');
});

test('missing or malformed direct alliance data never restamps a manual or old alliance',()=>{
 const response=alliance=>({retrieved_at:'2026-11-07T01:00:00Z',data:{player:{kid:3573,chief_id:'12345',...alliance}}});
 for(const base of [{},{alliance:{}},{alliance:'HOT'}]){
  const manual=applyPlayerDetails({id:'one',fid:'12345',username:'Old',allianceTag:'HOT'},response(base),'3573');
  assert.equal(allianceCheck(manual,team).status,'unknown');assert.equal(allianceCheck(manual,team).at,null);
  const prior=applyPlayerDetails({id:'one',fid:'12345',allianceTag:'HOT',providerStats:{allianceTag:'ARC',retrievedAt:day}},response(base),'3573');
  assert.equal(allianceCheck(prior,team).tag,'ARC');assert.equal(allianceCheck(prior,team).at,day);
 }
 const none=applyPlayerDetails({id:'one',fid:'12345',allianceTag:'ARC'},response({alliance:null}),'3573');
 assert.equal(none.allianceTag,'');assert.equal(none.providerStats.allianceTag,'');assert.equal(allianceCheck(none,team).status,'move');assert.match(allianceCheck(none,team).label,/No alliance/);
});
