import {test} from 'node:test';
import assert from 'node:assert/strict';
import {arenaResearch} from '../src/data/arenaResearch.js';
import {skillScaling,explorationResearchAdvice} from '../src/services/arenaResearchService.js';
import {compareArenaTeams,arenaTeam,placeArenaHero} from '../src/services/arenaComparisonService.js';
test('official references have five skill levels, correct identity URLs and Exploration-only data',()=>{
 assert.equal(arenaResearch['50026'].name,'Gwen');assert.ok(arenaResearch['50026'].source.endsWith('/gwen-2/'));
 for(const hero of Object.values(arenaResearch)){assert.ok(hero.source.startsWith('https://www.whiteoutsurvival.wiki/heroes/'));for(const skill of hero.skills)assert.equal(skill.percent.length,5)}
});
test('skill arithmetic never substitutes hero power for Attack and does not assume unknown levels',()=>{
 assert.equal(skillScaling('50018',0,'',1000),null);assert.equal(skillScaling('50018',0,6,1000),null);assert.equal(skillScaling('unknown',0,5,1000),null);
 assert.equal(skillScaling('50018',0,5,1000).base,2800);assert.equal(skillScaling('50018',0,5,'').base,null);
 assert.equal(skillScaling('50024',0,5,1000).base,null);assert.equal(skillScaling('50024',0,5,1000).percent,120);
});
test('Mia ranges follow skill text without assuming a uniform distribution or win chance',()=>{
 const damage=skillScaling('50016',1,1,1000),heal=skillScaling('50016',2,5,1000);
 assert.equal(damage.base,500);assert.equal(damage.min,25);assert.equal(damage.max,3000);assert.equal(heal.base,1400);assert.equal(heal.min,70);assert.equal(heal.max,5600);assert.equal(heal.mean,undefined);
});
test('Gwen and Lynn references separate targeting, control, healing reduction and actual damage',()=>{
 assert.equal(skillScaling('50026',1,5,1000).max,2800);assert.equal(skillScaling('50022',2,5,1000).percent,60);assert.equal(skillScaling('50022',2,5,1000).base,null);
 const advice=explorationResearchAdvice([{name:'Mia'},{name:'Lynn'},{name:'Alonso'}],[{name:'Mia'},{name:'Lynn'},{name:'Gwen'},{name:'Hector'}]);
 assert.ok(advice.some(x=>x.kind==='Healing matchup'));assert.ok(advice.some(x=>x.kind==='Backline threat'));assert.ok(advice.some(x=>x.kind==='Control timing'));assert.ok(advice.every(x=>x.source));
});
test('portrait moves preserve exact hero objects, Holger, records and opponent snapshots',()=>{
 const p={id:'a',fid:'12345',notes:'Keep',providerDetails:{fid:'12345',stateId:'3573',heroes:{items:[{id:50024},{id:50016},{id:50022},{id:50018},{id:50026}]}}};
 const a=arenaTeam(p,'3573');a.holger={arenaElite:10,legacy:8};const before=structuredClone(a),opponent={...structuredClone(a),fid:'67890'};
 const moved=placeArenaHero(a,3,a.slots[0]);assert.equal(moved.heroes,a.heroes);assert.deepEqual(moved.holger,a.holger);assert.equal(moved.confirmed,false);assert.deepEqual(a,before);assert.equal(opponent.slots[0],before.slots[0]);assert.equal(p.notes,'Keep');
 assert.equal(compareArenaTeams(moved,opponent).winChance,undefined);
});
