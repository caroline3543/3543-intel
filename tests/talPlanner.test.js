import test from 'node:test';
import assert from 'node:assert/strict';
import { TAL_SLOTS, TAL_BUILDINGS, suggestTalTeams, assignTalBuildings, teamWarnings } from '../src/services/talPlanner.js';
const players = Array.from({length:160},(_,i)=>({id:String(i),username:`Player ${i}`,allianceTag:i%2?'LUN':'MBT'}));
const event = {snapshots:players.map((p,i)=>({playerId:p.id,troopPower:1000-i}))};
const config = {mode:'state',hostTags:['LUN','MBT','GLR'],slots:TAL_SLOTS,availability:Object.fromEntries(players.map(p=>[p.id,TAL_SLOTS]))};
test('up to six legions, unique players, valid times and role capacities',()=>{
 const teams=suggestTalTeams(config,players,event);assert.equal(teams.length,6);
 const ids=teams.flatMap(t=>t.members.map(m=>m.id));assert.equal(ids.length,160);assert.equal(new Set(ids).size,160);
 teams.forEach(t=>{assert.equal(t.slots.length,3);assert.ok(t.members.filter(m=>m.role==='combatant').length<=30);assert.ok(t.members.filter(m=>m.role==='substitute').length<=20);});
 assert.equal(teams[0].members[0].id,'0');
});
test('solo excludes other alliances; unanswered players are not suggested',()=>{
 const teams=suggestTalTeams({...config,mode:'solo',hostTags:['LUN'],availability:{...config.availability,'1':[]}},players,event);
 assert.ok(teams.flatMap(t=>t.members).every(m=>Number(m.id)%2===1&&m.id!=='1'));
});
test('strongest leaders respect building priority; followers unique in their legion',()=>{
 const team=suggestTalTeams(config,players,event)[0];team.buildings=[...TAL_BUILDINGS].reverse();
 const assignments=assignTalBuildings(team,players,event);assert.equal(assignments.Transit[0],'0');
 const ids=Object.values(assignments).flat();assert.equal(ids.length,30);assert.equal(new Set(ids).size,30);
 assert.ok(!ids.some(id=>team.members.find(m=>m.id===id).role==='substitute'));
});
test('one-time availability remains unassigned',()=>{
 const cfg={...config,availability:{'0':['02:00']}};const team=suggestTalTeams(cfg,players,event)[0];
 assert.equal(team.members.length,0);
});
test('combination search finds full overlap at later slots',()=>{
 const cfg={...config,availability:Object.fromEntries(players.slice(0,20).map(p=>[p.id,['12:00','14:00','19:00']]))};
 assert.deepEqual(suggestTalTeams(cfg,players,event)[0].slots,['12:00','14:00','19:00']);
});

import { moveTalMember, talConfig } from '../src/services/talPlanner.js';
import { isArchived } from '../src/services/eventListHelpers.js';
test('planning persists the current step and defaults to availability',()=>{
 assert.equal(talConfig({}).step,'Availability');
 assert.equal(talConfig({tal:{step:'Buildings'}}).step,'Buildings');
});
test('season plans stay visible without a fixed match date',()=>{
 assert.equal(isArchived({type:'Tundra Arms League',date:'2020-01-01',status:'upcoming'},'2026-11-03'),false);
 assert.equal(isArchived({type:'Tundra Arms League',date:'2020-01-01',status:'completed'},'2026-11-03'),true);
 assert.equal(isArchived({type:'Foundry',date:'2020-01-01',status:'upcoming'},'2026-11-03'),true);
});
test('manual move is atomic and clears obsolete building assignments',()=>{
 const teams=suggestTalTeams(config,players,event);const before=JSON.stringify(teams);
 const result=moveTalMember(teams,'0',teams[4].id);
 assert.equal(result[0].members.some(m=>m.id==='0'),false);
 assert.equal(result[4].members.some(m=>m.id==='0'),true);
 assert.equal(result.flatMap(t=>t.members).length,160);
 assert.equal(JSON.stringify(teams),before);
 assert.deepEqual(result[0].assignments,{});
});
test('full legion rejects move but supports swap preserving role capacities',()=>{
 const teams=suggestTalTeams(config,players,event);
 assert.throws(()=>moveTalMember(teams,'0',teams[1].id),/full/);
 const result=moveTalMember(teams,'0',teams[1].id,'80');
 assert.ok(result[0].members.some(m=>m.id==='80'&&m.role==='combatant'));
 assert.ok(result[1].members.some(m=>m.id==='0'&&m.role==='substitute'));
 const ids=result.flatMap(t=>t.members.map(m=>m.id));assert.equal(ids.length,new Set(ids).size);
 assert.equal(result[1].members.filter(m=>m.role==='combatant').length,30);
 assert.equal(result[1].members.filter(m=>m.role==='substitute').length,20);
});

import { meetsTalAvailability,talAvailabilityConflicts } from '../src/services/talPlanner.js';
test('every auto-assigned combatant and substitute has at least two of three times',()=>{
 const cfg={...config,availability:Object.fromEntries(players.map((p,i)=>[p.id,i%3===0?['02:00']:i%3===1?['07:00','19:00']:['02:00','12:00','14:00']]))};
 const teams=suggestTalTeams(cfg,players,event);
 teams.forEach(t=>t.members.forEach(m=>assert.ok(meetsTalAvailability({id:m.id},t.slots,cfg))));
 assert.ok(teams.flatMap(t=>t.members).every(m=>Number(m.id)%3!==0));
});
test('exactly two matches are accepted and one is rejected for every rank',()=>{
 for(const rank of [1,50,51,null]){
 const p={id:'x',providerRankings:{labyrinth:{rank}}};
 assert.equal(meetsTalAvailability(p,['02:00','07:00','12:00'],{availability:{x:['02:00','07:00']}}),true);
 assert.equal(meetsTalAvailability(p,['02:00','07:00','12:00'],{availability:{x:['02:00']}}),false);
 }
});
test('manual moves and both sides of swaps obey the two-time rule',()=>{
 const teams=[{id:'a',slots:['02:00','07:00','12:00'],members:[{id:'x',role:'combatant'}]},{id:'b',slots:['12:00','14:00','19:00'],members:[{id:'y',role:'combatant'}]}];
 const people=[{id:'x'},{id:'y'}];
 const cfg={availability:{x:['02:00','07:00','12:00'],y:['12:00','14:00','19:00']}};
 assert.throws(()=>moveTalMember(teams,'x','b',null,cfg,people),/at least two/);
 cfg.availability.x.push('14:00');
 assert.throws(()=>moveTalMember(teams,'x','b','y',cfg,people),/at least two/);
 cfg.availability.y.push('07:00');
 assert.equal(moveTalMember(teams,'x','b','y',cfg,people)[1].members[0].id,'x');
});
test('existing invalid plans surface conflicts without requiring rank data',()=>{
 assert.equal(talAvailabilityConflicts({slots:['02:00','07:00','12:00'],members:[{id:'x'}]},{availability:{x:['02:00']}}).length,1);
});
