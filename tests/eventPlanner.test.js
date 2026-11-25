import { mergeEventWorkspace } from '../roster-site/src/sharedWorkspace.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  attendanceOpen, eventStart, plannerAlliances, plannerSlot, recentNoShow, resizePlannerTeams,
  updateEventPlanner, formatPlannerPower, EVENT_LIMITS,
} from '../src/services/eventPlanner.js';
import {validateEventPlannerData} from '../roster-site/server/eventPlannerValidation.js';

const early=Date.parse('2026-11-25T21:00:00Z');
const cutoff=Date.parse('2026-11-26T00:30:00Z');
const slot={kind:'foundry',alliance:'ARC',legion:1};
const initial=()=>({players:[{id:'a',lastFoundryTroopPower:123,lastFoundryTroopPowerAt:'2026-11-24T23:00:00Z'},{id:'b'},{id:'c'}],
 foundry:{registrations:{a:'join',b:'sub',c:'out'},registeredUnder:{a:'ARC',b:'ARC',c:'ARC'},teams:{a:'Blue'},assignments:{a:'Prototype Site I'},teamNames:{Blue:'Anchor'}}});
const read=(data,{kind,alliance,legion}=slot)=>plannerSlot(data.foundry,kind,alliance,legion);
const schedule=(data=initial(),which=slot)=>updateEventPlanner(data,{...which,plan:{...read(data,which),date:'2026-11-25',time:'23:30'}},early);
const record=(data,player=0,which=slot)=>data.players[player].plannerAttendance?.[read(data,which).occurrenceId];

test('event alliance priority and independent legion plans preserve legacy Foundry',()=>{
  assert.deepEqual(plannerAlliances(['PRO','HOT','LUN','ARC','RKG','WAR']),['ARC','HOT','RKG','WAR','LUN','PRO']);
  const data=initial(),second={...slot,legion:2};
  assert.equal(read(data).teamNames.Blue,'Anchor');
  assert.deepEqual(read(data,second).registrations,{});
  const next=updateEventPlanner(data,{...second,plan:{...read(data,second),registrations:{c:'join'},registeredUnder:{c:'ARC'}}},early);
  assert.equal(read(next,second).registrations.c,'join');
  assert.equal(read(next).registrations.b,'sub');
  assert.deepEqual(next.foundry.teams,data.foundry.teams);
});
test('schedule updates are idempotent and opting out removes only future attendance',()=>{
  const data=schedule();
  assert.equal(record(data).startAt,'2026-11-25T23:30:00.000Z');
  assert.equal(record(data,1).role,'sub');
  assert.equal(record(data,2),undefined);
  const next=updateEventPlanner(data,{...slot,plan:{...read(data),time:'23:45',registrations:{a:'sub',b:'out',c:'out'},teams:{},assignments:{}}},early);
  assert.equal(record(next).role,'sub');
  assert.equal(record(next).startAt,'2026-11-25T23:45:00.000Z');
  assert.equal(record(next,1),undefined);
  assert.deepEqual(updateEventPlanner(next,{...slot,plan:read(next)},early),next);
  assert.equal(eventStart('2026-02-30','00:00'),null);
});
test('attendance opens at the exact UTC rollover and holds an unused substitute harmless',()=>{
  let data=schedule();
  const set=(id,update,now=cutoff)=>{data=updateEventPlanner(data,{...slot,attendance:{id,...update}},now);};
  assert.equal(attendanceOpen(record(data).startAt,cutoff-1),false);
  assert.equal(attendanceOpen(record(data).startAt,cutoff),true);
  set('a',{result:'attended'},cutoff-1);
  assert.equal(record(data).result,undefined);
  set('a',{result:'attended'});
  assert.equal(record(data).result,'attended');
  set('b',{result:'no-show'});
  assert.equal(record(data,1).result,undefined);
  set('b',{result:'not-called'});
  assert.equal(record(data,1).result,'not-called');
  assert.equal(recentNoShow(data.players[1].plannerAttendance),false);
  set('b',{calledUp:true});
  set('b',{result:'no-show'});
  assert.equal(record(data,1).result,'no-show');
  assert.equal(recentNoShow(data.players[1].plannerAttendance),true);
  set('b',{result:'excused'});
  assert.equal(recentNoShow(data.players[1].plannerAttendance),false);
});
test('a no-show carries over until later attendance, even after starting another event',()=>{
  let data=schedule();
  const occurrenceId=read(data).occurrenceId;
  data=updateEventPlanner(data,{...slot,attendance:{id:'a',result:'no-show'}},cutoff);
  const canyon={...slot,kind:'canyon'};
  const nextPlan={...read(data,canyon),registrations:{a:'join'},registeredUnder:{a:'ARC'},date:'2026-11-27',time:'23:30'};
  data=updateEventPlanner(data,{...canyon,plan:nextPlan},cutoff);
  assert.equal(recentNoShow(data.players[0].plannerAttendance,record(data,0,canyon).startAt),true);
  data=updateEventPlanner(data,{...slot,plan:{...read(data),occurrenceId:occurrenceId+':next',date:'',time:'',registrations:{},teams:{},assignments:{}}},cutoff);
  assert.equal(data.players[0].plannerAttendance[occurrenceId].result,'no-show');
  data=updateEventPlanner(data,{...canyon,attendance:{id:'a',result:'attended'}},Date.parse('2026-11-28T00:30:00Z'));
  assert.equal(recentNoShow(data.players[0].plannerAttendance),false);
});
test('exact power survives separate event writes, repeated saves and later occurrences',()=>{
  let data=schedule();
  const power=946105130,canyon={...slot,kind:'canyon'};
  data=updateEventPlanner(data,{...slot,powers:[{id:'a',value:power}]},early);
  const repeat=updateEventPlanner(data,{...slot,powers:[{id:'a',value:power}]},early+500);
  assert.deepEqual(repeat,data);
  data=updateEventPlanner(data,{...canyon,powers:[{id:'a',value:1251234567}]},early);
  assert.equal(data.players[0].lastFoundryTroopPower,power);
  assert.equal(data.players[0].lastCanyonClashTroopPower,1251234567);
  assert.equal(Object.values(data.players[0].plannerPowerReadings).length,3);
  assert.equal(formatPlannerPower(power,'foundry'),'946,105,130');
  assert.equal(formatPlannerPower(power,'canyon'),'946.11M');
  assert.equal(formatPlannerPower(1251234567,'canyon'),'1.25B');
});
test('shrinking from six to three preserves roles and removes only retired assignments',()=>{
  const plan={...read(initial()),teams:{a:'Blue',b:'Pink',c:'Teal'},assignments:{a:'Prototype Site I',b:'Repair Facility II',c:'Boiler Room'}};
  const resized=resizePlannerTeams(resizePlannerTeams(plan,6),3);
  assert.deepEqual(resized.teams,{a:'Blue'});
  assert.deepEqual(resized.assignments,{a:'Prototype Site I'});
  assert.equal(resized.registrations.b,'sub');
});
test('the workspace save rejects decisions made before the cutoff or unused substitute no-shows',()=>{
  const data=schedule();
  const failed=structuredClone(data);
  const sub=record(failed,1);
  sub.result='no-show';
  sub.markedAt=new Date(cutoff).toISOString();
  assert.throws(()=>validateEventPlannerData(failed,cutoff),/Invalid attendance/);
  sub.calledUp=true;
  sub.markedAt=new Date(cutoff-1).toISOString();
  assert.throws(()=>validateEventPlannerData(failed,cutoff),/Invalid attendance/);
  sub.markedAt=new Date(cutoff).toISOString();
  assert.equal(validateEventPlannerData(failed,cutoff),failed);
});

test('moving a player changes both legions, clears the old team and carries the recorded power',()=>{
  const second={...slot,legion:2};
  let data=schedule(schedule(),second);
  data=updateEventPlanner(data,{...slot,powers:[{id:'a',value:54321}]},early);
  const source=read(data),destination=read(data,second);
  const action={...second,expectedOccurrenceId:destination.occurrenceId,
    move:{id:'a',role:'join',sourceOccurrenceId:source.occurrenceId}};
  const next=updateEventPlanner(data,action,early);
  assert.equal(read(next).registrations.a,undefined);
  assert.equal(read(next).teams.a,undefined);
  assert.equal(read(next).assignments.a,undefined);
  assert.equal(read(next,second).registrations.a,'join');
  assert.equal(read(next,second).powerByPlayer.a,54321);
  assert.equal(record(next),undefined);
  assert.equal(record(next,0,second).role,'join');
  assert.equal(updateEventPlanner(next,action,early),next);
  assert.equal(updateEventPlanner(data,{...action,move:{...action.move,role:'sub'}},early),data);
  assert.equal(updateEventPlanner(data,{...action,move:{...action.move,sourceOccurrenceId:'stale'}},early),data);
  assert.equal(updateEventPlanner(data,{...second,plan:{...destination,registrations:{a:'join'},registeredUnder:{a:'ARC'}}},early),data);
  assert.equal(validateEventPlannerData(next,early),next);
});

test('legion moves preserve past attendance, and full destinations reject the entire move',()=>{
  const second={...slot,legion:2};
  let data=schedule();
  data=updateEventPlanner(data,{...slot,attendance:{id:'b',result:'not-called'}},cutoff);
  const source=read(data),destination=read(data,second);
  const action={...second,expectedOccurrenceId:destination.occurrenceId,
    move:{id:'b',role:'sub',sourceOccurrenceId:source.occurrenceId}};
  const next=updateEventPlanner(data,action,cutoff);
  assert.equal(record(next,1).result,'not-called');
  assert.equal(read(next,second).registrations.b,'sub');
  const registrations=Object.fromEntries(Array.from({length:10},(_,i)=>['sub-'+i,'sub']));
  const full=updateEventPlanner(data,{...second,plan:{...destination,registrations}},cutoff);
  assert.equal(updateEventPlanner(full,action,cutoff),full);
  assert.equal(read(full).registrations.b,'sub');
  assert.deepEqual(EVENT_LIMITS,{foundry:{join:30,sub:10},canyon:{join:30,sub:10},tal:{join:30,sub:20}});
  const overflow=updateEventPlanner(full,{...second,plan:{...destination,registrations:{...registrations,overflow:'sub'}}},cutoff);
  assert.throws(()=>validateEventPlannerData(overflow,cutoff),/Invalid event registration/);
});

test('cross-alliance batch move requires current source confirmation and is atomic',()=>{
 const kind='canyon', target={kind,alliance:'ARC',legion:1};
 const key=JSON.stringify([kind,'WAR',2]);
 const source={...plannerSlot(null,kind,'WAR',2),registrations:{a:'sub'},registeredUnder:{a:'WAR'}};
 const workspace={players:[{id:'a'},{id:'b'}],foundry:{eventPlans:{[key]:source}}};
 const expectedOccurrenceId=plannerSlot(workspace.foundry,kind,'ARC',1).occurrenceId;
 const change={id:'a',role:'join',expectedRole:''},other={id:'b',role:'sub',expectedRole:''};
 const action={...target,expectedOccurrenceId,roleChanges:[change,other]};
 assert.strictEqual(updateEventPlanner(workspace,action,early),workspace);
 const moveFrom={alliance:'WAR',legion:2,role:'sub',occurrenceId:source.occurrenceId};
 const confirmed={...action,roleChanges:[{...change,moveFrom},other]};
 const next=JSON.parse(JSON.stringify(updateEventPlanner(workspace,confirmed,early)));
 assert.deepEqual(plannerSlot(next.foundry,kind,'ARC',1).registrations,{a:'join',b:'sub'});
 assert.deepEqual(plannerSlot(next.foundry,kind,'WAR',2).registrations,{});
 assert.strictEqual(updateEventPlanner(next,confirmed,early),next);
 const stale={...confirmed,roleChanges:[{...change,moveFrom:{...moveFrom,role:'join'}},other]};
 assert.strictEqual(updateEventPlanner(workspace,stale,early),workspace);
 const full={...workspace,foundry:{eventPlans:{[key]:source,[expectedOccurrenceId]:{
   ...plannerSlot(null,kind,'ARC',1),registrations:Object.fromEntries(Array.from({length:30},(_,n)=>['filled-'+n,'join'])),
 }}}};
 assert.strictEqual(updateEventPlanner(full,confirmed,early),full);
});

test('sync asks for review if concurrent registration edits would create two assignments',()=>{
 const base={players:[{id:'a'}],events:[],customRoles:[],settings:{stateId:'3573'},foundry:{}};
 function assign(alliance){
  const kind='foundry',legion=1;
  const expectedOccurrenceId=plannerSlot(base.foundry,kind,alliance,legion).occurrenceId;
  return updateEventPlanner(base,{kind,alliance,legion,expectedOccurrenceId,
   roleChanges:[{id:'a',role:'join',expectedRole:''}]},early);
 }
 const local=assign('ARC'),remote=assign('WAR');
 const result=mergeEventWorkspace(base,local,remote);
 assert.equal(result.conflicts.length,1);
 assert.deepEqual(result.data.foundry,local.foundry);
});
