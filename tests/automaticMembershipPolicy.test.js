import test from 'node:test';
import assert from 'node:assert/strict';
import {PRIMARY_ALLIANCES,refreshClass,nextRefreshAt,estimatedCredits,availableBudget,canSchedule,classifyLocation,classifyRosterDiscovery,upsertTransferEvent,transferFilterState,monthlyTransferHistory} from '../src/services/automaticMembershipPolicy.js';
const now=Date.parse('2026-11-20T12:00:00Z');
const date=new Date(now).toISOString();
const player={fid:'12345678',username:'Player',stateId:'3573',allianceTag:'ARC',membershipObservedAt:'2026-11-19T12:00:00Z'};
test('primary tags are exact, ordered and case sensitive',()=>{
 assert.deepEqual(PRIMARY_ALLIANCES,['ARC','RKG','HOT','LUN']);
 assert.equal(refreshClass(player,now),'primary');
 assert.equal(refreshClass({...player,allianceTag:'arc'},now),null);
 assert.equal(refreshClass({...player,allianceTag:'FARM'},now,['FARM']),'secondary');
});
test('refresh categories and exclusion',()=>{
 assert.equal(refreshClass({...player,allianceTag:''},now),'noAlliance');
 assert.equal(refreshClass({...player,membershipStatus:'transferred_out'},now),null);
 assert.equal(refreshClass({...player,allianceTag:'FARM',leftPrimaryAt:'2026-11-19T12:00:00Z'},now),'recentDeparture');
 assert.equal(refreshClass({...player,allianceTag:'FARM',leftPrimaryAt:'2026-11-16T12:00:00Z'},now,['FARM']),'secondary');
 assert.equal(nextRefreshAt({...player,membershipLastSuccessfulAt:'2026-11-20T06:00:00Z'},now),now+6*60*60*1000);
});
test('budget is conservative for member and batch requests',()=>{
 assert.equal(estimatedCredits({kind:'alliance_members_full',memberCount:100}),100);\n assert.equal(estimatedCredits({kind:'alliance_roster'}),1);
 assert.equal(estimatedCredits({kind:'players_batch',ids:Array(50).fill('1')}),50);
 assert.equal(availableBudget({used:4000,reserved:1000}),0);
 assert.equal(canSchedule({used:3900,reserved:1000,credits:100,minuteUsed:0}),false);
 assert.equal(canSchedule({used:3000,reserved:1000,credits:10,minuteUsed:55}),false);
});
test('verified external state creates transfer but stale or incomplete responses do not',()=>{
 const observed={status:'verified',state:'3600',tag:'XYZ',at:'2026-11-20T11:00:00Z'};
 const result=classifyLocation(player,observed,date);
 assert.equal(result.kind,'transfer_out');
 assert.equal(result.event.actualTransferAt,null);
 assert.equal(classifyLocation(player,{...observed,status:'unverified'},date).kind,'unchanged');
 assert.equal(classifyLocation(player,{...observed,at:'2026-11-18T12:00:00Z'},date).reason,'older_observation');
 assert.equal(classifyLocation(player,{...observed,state:'3573',tag:''},date).kind,'alliance_change');
});
test('new roster discovery never implies a confirmed transfer',()=>{
 const discovery=classifyRosterDiscovery(null,{fid:'12345678',username:'Player',allianceTag:'HOT'},date);
 assert.equal(discovery.kind,'new_discovery');
 assert.equal(discovery.confidence,'previous_state_unknown');
 assert.equal(classifyRosterDiscovery(player,{fid:'12345678'},date).kind,'existing_player');
});
test('transfer events are idempotent and preserve first detection',()=>{
 const event=classifyLocation(player,{status:'verified',state:'3600',tag:'XYZ',at:'2026-11-20T11:00:00Z'},date).event;
 const once=upsertTransferEvent([],event);
 const twice=upsertTransferEvent(once,{...event,firstDetectedAt:'2026-11-21T12:00:00Z',verifiedAt:'2026-11-21T12:00:00Z'});
 assert.equal(twice.length,1);
 assert.equal(twice[0].firstDetectedAt,date);
 assert.equal(twice[0].verifiedAt,'2026-11-21T12:00:00Z');
 assert.deepEqual(transferFilterState(twice,now),{in:0,out:1});
 assert.deepEqual(transferFilterState(twice,now+73*60*60*1000),{in:0,out:0});
 assert.equal(monthlyTransferHistory(twice)[0].net,-1);
});
