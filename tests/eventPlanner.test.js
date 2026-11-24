import test from 'node:test';
import assert from 'node:assert/strict';
import {
  attendanceOpen, eventStart, plannerAlliances, plannerSlot, recentNoShow, resizePlannerTeams,
  updateEventPlanner, formatPlannerPower,
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
  const next=updateEventPlanner(data,{...second,plan:{...read(data,second),registrations:{b:'join'},registeredUnder:{b:'ARC'}}},early);
  assert.equal(read(next,second).registrations.b,'join');
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
