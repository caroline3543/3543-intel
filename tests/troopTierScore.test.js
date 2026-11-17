import {test} from 'node:test';
import assert from 'node:assert/strict';
import {troopUnitPower,troopTierScore,compareByTroopTier} from '../src/services/troopTierScore.js';
const player=(infantry,lancer,marksman)=>({troops:{infantry,lancer,marksman}});
test('FC5–FC10 base power and Helios parse correctly',()=>{
 const standard=[94,99,104,110,115,121];
 const helios=[114,120,126,135,141,148];
 for(let fc=5;fc<=10;fc++){
  assert.equal(troopUnitPower('FC'+fc),standard[fc-5]);
  assert.equal(troopUnitPower('Inf Helios FC'+fc),helios[fc-5]);
  assert.equal(troopUnitPower('Lan FC'+fc),standard[fc-5]);
 }
 assert.equal(troopUnitPower('FC11'),null);
 assert.equal(troopUnitPower('Unknown'),null);
 assert.equal(troopUnitPower('T11'),null);
 assert.equal(troopUnitPower(null),null);
});
test('mixed Helios FC8 / standard FC8 / Helios FC7 averages unit base power',()=>{
 assert.equal(troopTierScore(player('Helios FC8','FC8','Helios FC7')),(135+110+126)/3);
 assert.equal(troopTierScore(player('Helios FC8','Helios FC8','Helios FC8')),135);
 assert.equal(troopTierScore(player('FC10','FC10','FC10')),121);
 assert.equal(troopTierScore(player('FC8','FC8','FC8')),110);
});
test('missing tiers remain last in both directions; numeric TAL power does not affect score',()=>{
 const high={...player('Helios FC8','Helios FC8','Helios FC8'),troopPower:100};
 const low={...player('FC8','FC8','FC8'),troopPower:999999};
 const incomplete=player('Helios FC10','FC10',null);
 assert.equal(troopTierScore(incomplete),null);
 assert.ok(compareByTroopTier(high,low,'desc')<0);
 assert.ok(compareByTroopTier(low,high,'asc')<0);
 assert.ok(compareByTroopTier(incomplete,high,'desc')>0);
 assert.ok(compareByTroopTier(incomplete,low,'asc')>0);
 assert.equal(troopTierScore(high),135);
});

test('substitute order shares the roster tier scorer and exposes real scores',async()=>{
 const {readFileSync}=await import('node:fs');
 const teams=readFileSync(new URL('../roster-site/src/tal/TalTeamsTab.jsx',import.meta.url),'utf8');
 assert.ok(teams.includes("import {troopTierScore} from '../../../src/services/troopTierScore.js'"));
 assert.ok(teams.includes("compare('rawTiers')||compare('troop')"));
 assert.ok(teams.includes("'Tier '+(rankDetails.get(String(p.id))?.rawTiers?.toFixed(1)"));
 assert.ok(!teams.includes('const T10='));
 assert.ok(!teams.includes('const tierPower='));
});
