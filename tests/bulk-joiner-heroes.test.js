import test from 'node:test';
import assert from 'node:assert/strict';
import {FIELD_DEFS,assignFieldValue,removeFieldValue} from '../src/services/fieldRegistryService.js';

const hero=FIELD_DEFS.find(f=>f.id==='joinerHeroes');

test('bulk adding a joiner hero keeps structured skill and verification data',()=>{
  const player={id:'1',joinerHeroes:[{hero:'Jessie',skillLevel:5,verified:true}]};
  const result=assignFieldValue(player,hero,'Jasser');
  assert.deepEqual(result.joinerHeroes.map(h=>h.hero),['Jessie','Jasser']);
  assert.equal(result.joinerHeroes[1].skillLevel,5);
  assert.equal(result.joinerHeroes[1].verified,false);
  assert.equal(player.joinerHeroes.length,1);
});

test('bulk joiner hero assignment does not duplicate existing skill 5 hero',()=>{
  const player={joinerHeroes:[{hero:'Jessie',skillLevel:5,verified:true}]};
  assert.equal(assignFieldValue(player,hero,'Jessie'),player);
});

test('bulk removal deletes only the selected joiner hero',()=>{
  const player={joinerHeroes:[{hero:'Jessie',skillLevel:5},{hero:'Jasser',skillLevel:5}]};
  assert.deepEqual(removeFieldValue(player,hero,'Jessie').joinerHeroes.map(h=>h.hero),['Jasser']);
});
