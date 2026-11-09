import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_FILTERS, matchesRosterFilters, rosterFilterCount, latestRosterFetch } from '../src/services/rosterViewService.js';
const player={id:'1',fid:123,username:'New name',alias:'Caroline',pastUsernames:['Old name'],allianceTag:'HOT',roles:['Translator'],gameLanguage:'ko',troops:{infantry:'Helios FC6',lancer:'FC6',marksman:'FC6'},joinerHeroes:[{hero:'Jessie',skillLevel:5,verified:true}]};
const matches=(p,patch={},search='')=>matchesRosterFilters(p,search,{...EMPTY_FILTERS,...patch});
test('combined filters intersect alliance, joiner role, troop type, verified skill and game language',()=>{
  const filters={alliance:'HOT',role:'joiner',tier:'helios-infantry',hero:'Jessie',verified:true,language:'Korean'};
  assert.equal(matches(player,filters),true);
  for(const patch of [{allianceTag:'RKG'},{roles:['Rally Lead']},{troops:{infantry:'FC6'}},{gameLanguage:'en'},{joinerHeroes:[{hero:'Jessie',skillLevel:4,verified:true}]},{joinerHeroes:[{hero:'Jessie',skillLevel:5,verified:false}]}])assert.equal(matches({...player,...patch},filters),false);
});
test('custom roles do not hide joiners and excluded players are not counted as joiners',()=>{
  assert.equal(matches(player,{role:'joiner'}),true);
  assert.equal(matches({...player,blacklisted:true},{role:'joiner'}),false);
});
test('review filter finds gaps without treating optional fields as requirements',()=>{
  assert.equal(matches(player,{review:true}),false);
  assert.equal(matches({...player,troops:{infantry:'FC6'}},{review:true}),true);
  assert.equal(matches({...player,fid:null},{review:true}),true);
});
test('search accepts numeric IDs and nicknames and past names but excludes alliance tags',()=>{
  assert.equal(matches(player,{},' 123 '),true);
  assert.equal(matches(player,{},'Caroline'),true);
  assert.equal(matches(player,{},'new NAME'),true);
  assert.equal(matches(player,{},'HOT'),false);
  assert.equal(matches(player,{},'old NAME'),true);
  assert.equal(matches(player,{},'unrelated'),false);
});
test('latest fetch ignores manual edits and invalid dates; verified modifier only counts with a hero',()=>{
  assert.equal(latestRosterFetch([{profileLastUpdated:'2099-01-01'},{providerStats:{retrievedAt:'bad'}}, {providerStats:{retrievedAt:'2026-11-01T00:00:00Z'}},{providerStats:{retrievedAt:'2026-11-02T00:00:00Z'}}]),'2026-11-02T00:00:00Z');
  assert.equal(rosterFilterCount({...EMPTY_FILTERS,verified:true}),0);
});
test('full FC7 and FC8 filters include matching Helios and exclude lower or incomplete troops',()=>{
 for(const tier of [7,8]){
  const troops={infantry:`FC${tier}`,lancer:`Helios FC${tier}`,marksman:`FC${tier}`};
  assert.equal(matches({...player,troops},{tier:`full-fc${tier}`}),true);
  assert.equal(matches({...player,troops:{...troops,marksman:'FC6'}},{tier:`full-fc${tier}`}),false);
  assert.equal(matches({...player,troops:{infantry:`FC${tier}`}},{tier:`full-fc${tier}`}),false);
 }
});
