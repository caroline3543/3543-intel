import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newAllianceWatch,allianceSnapshot,appendAllianceSnapshot,allianceChanges,allianceSummary,mergeAllianceWatches,ALLIANCE_SNAPSHOT_LIMIT} from '../src/services/allianceWatchService.js';
import {mergeImportedData} from '../src/services/exportImportService.js';
import {assertImportState} from '../src/services/stateWorkspaceService.js';
const response=(at,members)=>({retrieved_at:at,data:{alliance:{kid:3573},members}});
const member=(id,power=1000,furnace=55,extra={})=>({chief_id:id,nick_name:`Player ${id}`,power,furnace_level:furnace,kid:3573,...extra});
const first='2026-10-22T00:00:00Z',second='2026-10-23T00:00:00Z';
const save=(watch,at,members)=>appendAllianceSnapshot(watch,allianceSnapshot(response(at,members),'3573','LUN'));
const baseline=()=>save(newAllianceWatch('3573','LUN'),first,[member(1),member(2)]);
test('watching a whole alliance establishes a baseline for every returned FID',()=>{
 const watch=baseline();assert.equal(watch.snapshots[0].members.length,2);assert.deepEqual(allianceChanges(watch),[]);
 assert.equal(watch.snapshots[0].members[0].furnaceLevel,'FC5');assert.equal(allianceSummary(watch).power,2000);
});
test('furnace changes and configurable power spikes cover every member',()=>{
 const watch=save(baseline(),second,[member(1,1100,60),member(2,900)]);
 assert.equal(allianceChanges(watch,{kind:'furnaceLevel'}).length,1);
 assert.equal(allianceChanges(watch,{kind:'powerSpike'})[0].delta,100);
 assert.equal(allianceChanges(watch,{kind:'powerDrop'})[0].delta,-100);
 assert.equal(allianceChanges({...watch,powerSpikePercent:20},{kind:'powerSpike'}).length,0);
 assert.equal(allianceChanges(watch,{query:'Player 2'}).length,1);
 assert.equal(allianceChanges(watch,{since:Date.parse(second)+1}).length,0);
});
test('membership differences are observations, not departures; totals compare matching players',()=>{
 const watch=save(baseline(),second,[member(1,1100),member(3,9000)]),summary=allianceSummary(watch);
 assert.equal(summary.power,10100);assert.equal(summary.comparable,1);assert.equal(summary.powerDelta,100);
 assert.equal(allianceChanges(watch,{kind:'missing'})[0].member.fid,'2');
 assert.equal(allianceChanges(watch,{kind:'appeared'})[0].member.fid,'3');
});
test('missing values do not create power drops or invented furnace upgrades',()=>{
 const watch=save(baseline(),second,[member(1,null,null),member(2,1000)]);
 assert.equal(allianceChanges(watch).length,0);assert.equal(allianceSummary(watch).powerKnown,1);
 const zero=save(baseline(),second,[member(1,0),member(2)]);
 assert.equal(allianceChanges(zero,{kind:'powerDrop'})[0].delta,-1000);
});
test('invalid, cross-state and empty responses preserve existing snapshots',()=>{
 const watch=baseline();assert.throws(()=>allianceSnapshot(response(second,[]),'3573','LUN'),/No members/);
 assert.throws(()=>allianceSnapshot(response(second,[member(1,1000,55,{kid:3543})]),'3573','LUN'),/another state/);
 assert.throws(()=>newAllianceWatch('3573','../bad'),/valid/);
 assert.throws(()=>assertImportState({allianceWatches:[watch]},'3543'),/different state/);
 assert.equal(watch.snapshots.length,1);
});
test('older and duplicate-time responses cannot rewrite history; retention is bounded',()=>{
 const watch=baseline();assert.equal(save(watch,first,[member(1,500)]),watch);
 assert.equal(save(watch,'2026-10-21T00:00:00Z',[member(1,500)]),watch);
 let full=watch;for(let day=1;day<40;day++)full=save(full,new Date(Date.parse(first)+day*86400000).toISOString(),[member(1,1000+day)]);
 assert.equal(full.snapshots.length,ALLIANCE_SNAPSHOT_LIMIT);
});
test('JSON backup merges preserve watches and both devices snapshot history',()=>{
 const a=baseline(),b=save(newAllianceWatch('3573','LUN'),second,[member(1,1100)]);
 const base={players:[],events:[],svsPlans:[],allianceWatches:[a]};
 const result=mergeImportedData(base,{...base,allianceWatches:[b]});
 assert.equal(result.allianceWatches[0].snapshots.length,2);
 assert.equal(mergeAllianceWatches([a],[])[0].snapshots.length,1);
 assert.equal(JSON.parse(JSON.stringify(result)).allianceWatches[0].tag,'LUN');
});
