import {test} from 'node:test';
import assert from 'node:assert/strict';
import catalog from '../src/data/heroCatalog.json' with {type:'json'};
import {interpretHero,interpretHeroGear,interpretedStars,interpretChiefGear} from '../src/services/equipmentCatalogService.js';
test('game ID catalogue distinguishes early heroes and late additions',()=>{
 for(const [id,name] of [[50000,'Eugene'],[50001,'Smith'],[50012,'Molly'],[50014,'Reina'],[50018,'Alonso'],[50021,'Flint'],[50027,'Seo-yoon'],[50037,'Ling Xue'],[50064,'Eleanor']])assert.equal(interpretHero({id}).name,name);
 assert.equal(Object.keys(catalog).length,65);assert.equal(new Set(Object.values(catalog).map(h=>h.name)).size,65);
});
test('ID-only heroes acquire portrait, troop class, generation and actual widget name without mutation',()=>{
 const raw={id:50012,name:'Hero 50012',lv:80,pos:2,exclusive_equip:1050012,exclusive_equip_lv:0,equipment:[{eid:1013501,slv:100,rlv:10}]},before=structuredClone(raw);
 const h=interpretHero(raw);assert.deepEqual(raw,before);assert.equal(h.name,'Molly');assert.equal(h.level,80);assert.equal(h.position,2);assert.equal(h.troop,'Lancer');assert.equal(h.widgetName,'Yeti Spirit');assert.equal(h.widgetLevel,0);assert.equal(h.hasWidget,true);assert.match(h.icon,/b686c68ba1cc955ee75cf2725a4cd0210ec7cd1e\/images\/heroes\/Molly\/Molly.png$/);assert.equal(h.gear[0].troop,'Marksman');
});
test('provider-normalized data and safe provider images remain supported',()=>{
 const h=interpretHero({id:50012,level:70,position:1,icon:'https://example.com/molly.png',exclusive_gear:{name:'Named widget',level:4},gear:[{slot:'Gloves',troop_label:'Lancer',enhancement_level:80,refine_level:9}]});
 assert.equal(h.level,70);assert.equal(h.icon,'https://example.com/molly.png');assert.equal(h.widgetName,'Named widget');assert.equal(h.widgetLevel,4);assert.equal(h.gear[0].name,'Gloves');assert.equal(h.gear[0].enhancement,80);assert.equal(h.gear[0].mastery,9);
});
test('seven-digit equipment IDs decode slot, troop and quality with red enhancement separately',()=>{
 const g=interpretHeroGear({eid:1032501,slv:120,rlv:12});assert.equal(g.name,'Belt');assert.equal(g.troop,'Lancer');assert.equal(g.quality,'Red');assert.equal(g.enhancement,20);assert.equal(g.mastery,12);assert.equal(g.red,true);assert.match(g.icon,/belt-lancer.png$/);
 const gold=interpretHeroGear({eid:1011501,slv:100,rlv:10});assert.equal(gold.quality,'Mythic');assert.equal(gold.red,false);assert.equal(gold.enhancement,100);
});
test('star codes use six upgrades per star while explicit stars take precedence',()=>{
 assert.equal(interpretedStars({star:30}),'5 ★');assert.equal(interpretedStars({star:25}),'4 ★ · tier 1/6');assert.equal(interpretedStars({star:6}),'1 ★');assert.equal(interpretedStars({star:4}),'0 ★ · tier 4/6');assert.equal(interpretedStars({stars:4.2,star:25}),'4.2 ★');assert.equal(interpretedStars({star_label:'4-Star (Tier 2)',star:26}),'4-Star (Tier 2)');assert.equal(interpretedStars({star:99}),null);
});
test('unknown or malformed IDs never turn into guessed heroes or equipment',()=>{
 for(const id of [50065,999999,null,'../../molly']){const h=interpretHero({id,gear:{}});assert.equal(h.name,'Unidentified hero');assert.equal(h.icon,null);assert.deepEqual(h.gear,[]);}
 assert.equal(interpretHeroGear({eid:'bogus',sid:99}).name,'Unidentified equipment');assert.equal(interpretHeroGear({eid:'bogus',sid:99}).icon,null);
 assert.equal(interpretHero({id:50012,icon:'javascript:alert(1)'}).icon.includes('raw.githubusercontent.com'),true);
});
test('chief gear tiers decode known strength boundaries and never infer charm levels',()=>{
 const g=interpretChiefGear({slot:'Coat',equipid:1230039,gems:[{id:999}]});assert.equal(g.name,'Coat');assert.equal(g.quality,'Red');assert.equal(g.tier,'Red T2');assert.match(g.icon,/Coat-Legendary.png$/);assert.deepEqual(g.gems,[{id:999}]);
 assert.equal(interpretChiefGear({slot:99}).name,'Chief equipment');assert.equal(interpretChiefGear({slot:99}).icon,null);
});
