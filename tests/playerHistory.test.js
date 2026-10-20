import {test} from 'node:test';
import assert from 'node:assert/strict';
import {recordPlayerObservation,playerObservations,mergeObservationHistory,HISTORY_LIMIT} from '../src/services/playerObservationService.js';
import {playerChangeFeed,historyPoints,historyMetrics} from '../src/services/playerChangeService.js';
import {allianceRows,mergeAllianceProfiles} from '../src/services/allianceImportService.js';
import {rankingProfileUpdates,normalizeRankings} from '../src/services/stateRankingsService.js';
import {mergeImportedData} from '../src/services/exportImportService.js';
import {assertImportState} from '../src/services/stateWorkspaceService.js';
const day1='2026-10-20T01:00:00Z',day2='2026-10-21T01:00:00Z';
const observe=(p,values,at=day1,stream='profile')=>recordPlayerObservation(p,{...p},{stateId:'3573',stream,observedAt:at,values});
const base=()=>observe({id:'one',fid:'123',username:'Player'}, {power:1000,kills:0,furnaceLevel:'FC5',username:'Player',allianceTag:'LUN'});
test('first observations establish baselines without inventing progress or alerts',()=>{
 const p=base();assert.equal(p.observationHistory.length,1);assert.equal(p.observationHistory[0].baseline,true);assert.equal(playerChangeFeed([p],'3573').length,0);
 assert.equal(playerObservations(p,'3543').length,0);assert.equal(historyPoints(p,'3573',historyMetrics(p,'3573')[0]).length,1);
});
test('repeated same-day imports deduplicate, while another day records a flat measurement',()=>{
 const p=base(),same=observe(p,{power:1000,kills:0,furnaceLevel:'FC5',username:'Player',allianceTag:'LUN'},'2026-10-20T05:00:00Z');
 assert.equal(same.observationHistory.length,1);
 const next=observe(same,{power:1000,kills:0},day2);assert.equal(next.observationHistory.length,2);assert.equal(next.observationHistory[1].changes.length,0);
});
test('changed values record before/after, zero kills and real source timestamps',()=>{
 const p=observe(base(),{power:800,kills:200000,furnaceLevel:'FC6',username:'New name',allianceTag:'ABC'},day2);
 const feed=playerChangeFeed([p],'3573');assert.equal(feed.length,5);assert.ok(feed.some(e=>e.category==='powerDrop'&&e.delta===-200));assert.ok(feed.some(e=>e.category==='killGain'&&e.change.before===0));
 assert.equal(playerChangeFeed([p],'3573',{kind:'allianceTag'})[0].change.before,'LUN');
 assert.equal(playerChangeFeed([p],'3543').length,0);assert.equal(playerChangeFeed([p],'3573',{since:Date.parse(day2)+1}).length,0);
});
test('missing fields neither erase previous values nor create zero chart points',()=>{
 const p=observe(base(),{username:'Renamed'},day2);
 const metric=historyMetrics(p,'3573').find(m=>m.field==='power');assert.equal(historyPoints(p,'3573',metric).length,1);
 assert.equal(p.observationHistory.at(-1).values.power,1000);assert.equal(playerChangeFeed([p],'3573').length,1);
});
test('alliance imports add history while preserving manual fields and source histories',()=>{
 const existing={id:'stable',fid:'123',username:'Player',notes:'Keep',troops:{infantry:'FC8'}};
 const response=(at,power)=>({retrieved_at:at,data:{members:[{chief_id:123,kid:3573,nick_name:'Player',power,kills:0,furnace_level:55}]}});
 const first=mergeAllianceProfiles([existing],allianceRows(response(day1,1000),'3573','LUN'),'3573').players;
 const second=mergeAllianceProfiles(first,allianceRows(response(day2,800),'3573','LUN'),'3573').updated[0];
 assert.equal(second.observationHistory.length,2);assert.equal(second.notes,'Keep');assert.equal(second.troops.infantry,'FC8');assert.equal(second.id,'stable');assert.equal(playerChangeFeed([second],'3573',{kind:'powerDrop'}).length,1);
 assert.equal(existing.observationHistory,undefined);
});
test('rankings keep independent streams and absence from a board creates no departure alert',()=>{
 const player={id:'one',fid:'123',username:'Player',notes:'Keep'};
 const result=(at,score,rank)=>normalizeRankings({retrieved_at:at,data:{kid:3573,rows:[{chief_id:123,score,rank}]}},'3573','personal_power');
 const first=rankingProfileUpdates([player],result(day1,1000,3),'3573')[0];
 const second=rankingProfileUpdates([first],result(day2,800,4),'3573')[0];
 assert.ok(second.observationHistory.every(e=>e.stream==='ranking:personal_power'));
 assert.equal(playerChangeFeed([second],'3573',{kind:'powerDrop'}).length,1);assert.equal(playerChangeFeed([second],'3573',{kind:'ranking'}).length,2);
 const absent=normalizeRankings({data:{rows:[]}},'3573','personal_power');assert.deepEqual(rankingProfileUpdates([second],absent,'3573'),[]);assert.equal(second.notes,'Keep');
});
test('existing dated snapshots seed a baseline; undated records do not invent dates',()=>{
 const p={id:'one',providerStats:{stateId:'3573',retrievedAt:day1,power:10,kills:0},providerRankings:{kills:{stateId:'3573',retrievedAt:day1,score:0,rank:10}}};
 assert.equal(playerObservations(p,'3573').length,2);assert.equal(playerObservations({power:10},'3573').length,0);assert.equal(playerChangeFeed([p],'3573').length,0);
});
test('history retention is bounded and merges preserve observations from both devices',()=>{
 const rows=Array.from({length:HISTORY_LIMIT+5},(_,i)=>({id:String(i),stateId:'3573',stream:'profile',observedAt:new Date(Date.parse(day1)+i*1000).toISOString(),values:{power:i},fields:['power'],changes:[]}));
 const merged=mergeObservationHistory(rows.slice(0,100),rows.slice(90));assert.equal(merged.length,HISTORY_LIMIT);assert.equal(merged[0].id,'5');
 const a=base(),b=observe(a,{power:1200},day2);
 const data=mergeImportedData({players:[a]}, {players:[b]});assert.equal(data.players[0].observationHistory.length,2);
 assert.equal(mergeObservationHistory(b.observationHistory,b.observationHistory).length,2);
});
test('out-of-order history responses do not rewrite the recorded sequence and UTC dates are canonical',()=>{
 const p=observe(base(),{power:1200},day2);const late=observe(p,{power:900},'2026-10-20T02:00:00Z');assert.equal(late.observationHistory.length,2);
 const offset=observe({id:'one'}, {power:10},'2026-10-21T01:00:00+13:00');assert.equal(offset.observationHistory[0].observedAt,'2026-10-20T12:00:00.000Z');
});
test('backup imports reject a different state in observation history',()=>{
 assert.throws(()=>assertImportState({players:[base()]},'3543'),/history from a different state/);assert.doesNotThrow(()=>assertImportState({players:[base()]},'3573'));
});
