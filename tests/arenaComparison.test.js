import {test} from 'node:test';
import assert from 'node:assert/strict';
import {arenaTeam,placeArenaHero,compareArenaTeams,activeArenaHeroes,arenaCoverage} from '../src/services/arenaComparisonService.js';
import {addArenaResult,loadArenaResults,arenaResultsKey} from '../src/services/arenaResultsService.js';
const hero=(id,pos,power=100)=>({id,position:pos,level:80,stars:4,power,exclusive_gear_level:1,gear:[{slot:'Goggles',quality_label:'Mythic',troop_label:'Infantry',enhancement_level:20,refine_level:3}]});
const player=(fid='12345',id='a',heroes=[hero(50004,1),hero(50001,2),hero(50006,3),hero(50005,4),hero(50012,5)])=>({id,fid,username:id,notes:'untouched',providerDetails:{fid,stateId:'3573',heroes:{items:heroes,retrievedAt:'2026-10-21T00:00:00Z'}}});
const team=p=>arenaTeam(p,'3573');
test('snapshot validates state/FID and preserves source positions without claiming verified mapping',()=>{
 const p=player(),before=structuredClone(p),a=team(p);assert.deepEqual(p,before);assert.equal(a.confirmed,false);assert.equal(a.sourceAt,p.providerDetails.heroes.retrievedAt);assert.equal(a.heroes[0].origin,'Saved defence');
 assert.equal(arenaTeam(p,'3543').heroes.length,0);assert.equal(team({...p,fid:'wrong'}).heroes.length,0);assert.equal(team({...p,providerDetails:null}).heroes.length,0);
 a.heroes[0].raw.level=1;assert.equal(p.providerDetails.heroes.items[0].level,80);
});
test('swapping a selected hero preserves unique slots, resets confirmation and leaves snapshots unchanged',()=>{
 const a={...team(player()),confirmed:true},before=structuredClone(a),b=placeArenaHero(a,0,a.slots[3]);assert.deepEqual(a,before);assert.equal(b.slots[3],a.slots[0]);assert.equal(new Set(b.slots).size,5);assert.equal(b.confirmed,false);
 assert.throws(()=>placeArenaHero(a,7,'bad'));assert.throws(()=>placeArenaHero(a,0,'missing'));assert.equal(placeArenaHero(a,0,'').slots[0],'');
});
test('rejects same player or cross-state comparisons; does not use overall player power as hero power',()=>{
 const a=team(player());assert.equal(compareArenaTeams(a,a).available,false);assert.equal(compareArenaTeams(a,{...a,fid:'67890',stateId:'3543'}).available,false);
 const b=team(player('67890','b'));const r=compareArenaTeams(a,b);assert.equal(r.yourPower,500);assert.equal(r.powerDifference,0);assert.equal(r.winChance,undefined);
 const missing=team(player('67890','b',[hero(50004,1,null)]));assert.equal(compareArenaTeams(a,missing).opponentPower,null);assert.equal(compareArenaTeams(a,missing).powerDifference,null);
});
test('position advice needs complete confirmed formations and suggests a reversible infantry-front trial',()=>{
 const a=placeArenaHero(team(player()),0,'saved-50006'),b=team(player('67890','b'));
 assert.equal(compareArenaTeams(a,b).recommendations.some(r=>r.swap),false);
 const r=compareArenaTeams({...a,confirmed:true},{...b,confirmed:true});assert.equal(r.recommendations.some(r=>r.swap),true);
 assert.equal(compareArenaTeams({...a,slots:['','','','',''],confirmed:true},{...b,confirmed:true}).recommendations.some(r=>r.swap),false);
});
test('only compares gear gaps for the same hero, class, quality and ascension stage',()=>{
 const p=player('67890','b');p.providerDetails.heroes.items[0].gear[0].enhancement_level=30;
 const a=team(player()),b=team(p);assert.equal(compareArenaTeams(a,b).recommendations.filter(r=>r.kind==='Gear review').length,1);
 b.heroes[0].raw.gear[0].quality_label='Epic';assert.equal(compareArenaTeams(a,b).recommendations.filter(r=>r.kind==='Gear review').length,0);
});
test('unknown/duplicate heroes and missing stats stay explicit without fabricated values',()=>{
 const a=team(player('12345','a',[hero(99999,3),hero(99999,3),{id:50004}]));assert.equal(a.heroes.length,2);const c=arenaCoverage(a);assert.equal(c.unknown,1);assert.equal(c.filled,2);assert.equal(c.power,1);
 assert.equal(activeArenaHeroes(a)[1].level,undefined); // no source position sorts after the positioned hero
});
const storage=()=>{const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)}};
test('battle log is bounded, state isolated, copied and survives reload without modifying players',()=>{
 const s=storage(),a=team(player()),b=team(player('67890','b')),entry={id:'1',stateId:'3573',outcome:'win',yours:a,theirs:b,at:'2026-10-21T00:00:00Z'};
 const saved=addArenaResult(s,'3573',[],entry);entry.yours.slots[0]='';assert.notEqual(saved[0].yours.slots[0],'');assert.equal(loadArenaResults(s,'3573').length,1);assert.equal(loadArenaResults(s,'3543').length,0);
 assert.equal(addArenaResult(s,'3573',Array(100).fill(saved[0]),saved[0]).length,100);assert.throws(()=>addArenaResult(s,'3543',[],entry));s.setItem(arenaResultsKey('3573'),'{broken');assert.deepEqual(loadArenaResults(s,'3573'),[]);
});
