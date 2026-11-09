import test from 'node:test';
import assert from 'node:assert/strict';
import {normaliseRallyPreferences,joinerPreferenceScore,relationshipMatches,mergeRallyPreferences,withBattlePairOverride} from '../src/services/talTeamPreferences.js';
import {generateTalRallyDraft} from '../src/services/talRallyTeamGenerator.js';

const player=(id,lead=false,inventory={infantry:{t11:100,t10:0},lancer:{t11:0,t10:0},marksman:{t11:100,t10:0}})=>({
  id,username:id,marchCapacity:200,
  leaderProfile:{role:lead?'leader':'none',rallyCapacity:400},
  talTroopInventory:inventory
});
const draft=(players,preferences,settings={})=>generateTalRallyDraft({
  team:{id:'HOT:1',matchTime:'19:00',members:players.map(p=>({id:p.id,role:'combatant',verified:true}))},
  config:{},players,event:{},settings:{teamCount:1,ratio:[50,0,50],preferences,...settings}
}).teams[0];

test('priority joiner selected over otherwise equivalent available player',()=>{
  const roster=[player('leader',true),player('a'),player('b')];
  const r=draft(roster,{players:{b:{priority:true,reliable:true,voice:true,punctual:true,strategy:true}}});
  assert.equal(r.players.find(p=>!p.leader).id,'b');
  assert.equal(r.priorityJoiners,1);
  assert.equal(r.status,'confirmed-full');
});
test('familiar pairing nudges equivalent joiners toward their leader',()=>{
  const roster=[player('leader',true),player('a'),player('b')];
  const r=draft(roster,{pairs:[['leader','b']]});
  assert.equal(r.players.find(p=>!p.leader).id,'b');
  assert.equal(r.familiarPairs,1);
});
test('uncorroborated criteria are false, relationships deduplicate without self pairing',()=>{
  const p=normaliseRallyPreferences({players:{a:{reliable:'yes',strategy:true,priority:true}},pairs:[['a','b'],['b','a'],['a','a'],['b','c']]});
  assert.equal(p.players.a.reliable,false);
  assert.equal(p.players.a.priority,true);
  assert.equal(p.pairs.length,2);
  assert.equal(relationshipMatches('b',['a'],p),1);
  assert.ok(joinerPreferenceScore('a',['b'],p)>joinerPreferenceScore('c',[],p));
});
test('priorities cannot override explicit absence, ratio or troop tier',()=>{
  const roster=[player('leader',true),player('t11'),player('priority',false,{infantry:{t11:0,t10:100},lancer:{t11:100,t10:0},marksman:{t11:0,t10:100}})];
  const r=draft(roster,{players:{priority:{priority:true,reliable:true,strategy:true,voice:true,punctual:true}}});
  assert.equal(r.players.find(p=>!p.leader).id,'t11');
  assert.equal(r.players.reduce((sum,p)=>sum+p.troops.lancer.t11+p.troops.lancer.t10,0),0);
});
test('preferences do not override absence or reuse the same player in separate teams',()=>{
  const roster=[player('leader',true),player('leader2',true),player('b')];
  const team={id:'HOT:1',matchTime:'19:00',members:roster.map(p=>({id:p.id,role:'combatant',verified:true})),battleAttendance:{b:'not-attending'}};
  const result=generateTalRallyDraft({team,config:{},players:roster,event:{},settings:{teamCount:2,ratio:[50,0,50],preferences:{players:{b:{priority:true}},pairs:[['leader','b']]}}});
  assert.equal(result.teams.flatMap(x=>x.players).some(p=>p.id==='b'),false);
  const used=result.teams.flatMap(t=>t.players.map(p=>p.id));
  assert.equal(used.length,new Set(used).size);
});
test('priority preferences never modify source player profiles',()=>{
  const roster=[player('leader',true),player('joiner')];
  const original=structuredClone(roster);
  draft(roster,{players:{joiner:{priority:true,voice:true}},pairs:[['leader','joiner']]});
  assert.deepEqual(roster,original);
});

test('shared preferences apply to a new battle without storing them on player profiles',()=>{
 const shared={players:{b:{priority:true,voice:true,reliable:true}},pairs:[['leader','b']]};
 const roster=[player('leader',true),player('a'),player('b')];
 const effective=mergeRallyPreferences(shared,{});
 const result=draft(roster,effective);
 assert.equal(result.players.find(p=>!p.leader).id,'b');
 assert.deepEqual(roster[2].joinerHeroes,undefined);
});
test('match-day overrides can explicitly negate a default and inherit other criteria',()=>{
 const shared={players:{b:{priority:true,voice:true,reliable:true}},pairs:[['leader','b']]};
 const override={players:{b:{priority:false,voice:false}}};
 const result=mergeRallyPreferences(shared,override);
 assert.equal(result.players.b.priority,false);
 assert.equal(result.players.b.voice,false);
 assert.equal(result.players.b.reliable,true);
 assert.deepEqual(shared.players.b,{priority:true,voice:true,reliable:true});
});
test('match-day pair exclusion does not delete reusable pairing',()=>{
 const shared={players:{},pairs:[['leader','b']]};
 const battle=withBattlePairOverride({},shared,'leader','b',false);
 assert.deepEqual(mergeRallyPreferences(shared,battle).pairs,[]);
 assert.deepEqual(shared.pairs,[['leader','b']]);
 const restored=withBattlePairOverride(battle,shared,'leader','b',true);
 assert.deepEqual(mergeRallyPreferences(shared,restored).pairs,[['leader','b']]);
});
test('battle additions do not leak into reusable defaults',()=>{
 const shared={players:{},pairs:[]};
 const battle=withBattlePairOverride({},shared,'leader','b',true);
 assert.deepEqual(mergeRallyPreferences(shared,battle).pairs,[['leader','b']]);
 assert.deepEqual(shared.pairs,[]);
 assert.deepEqual(mergeRallyPreferences(shared,withBattlePairOverride(battle,shared,'leader','b',false)).pairs,[]);
});
