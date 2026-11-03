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
test('partial overlap produces an explicit attendance warning',()=>{
 const cfg={...config,availability:{'0':['02:00']}};const team=suggestTalTeams(cfg,players,event)[0];
 assert.ok(teamWarnings(team,cfg).some(w=>w.includes('cannot confirm')));
});
test('combination search finds full overlap at later slots',()=>{
 const cfg={...config,availability:Object.fromEntries(players.slice(0,20).map(p=>[p.id,['12:00','14:00','19:00']]))};
 assert.deepEqual(suggestTalTeams(cfg,players,event)[0].slots,['12:00','14:00','19:00']);
});
