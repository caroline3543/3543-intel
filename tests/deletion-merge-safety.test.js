import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeImportedData,recordDeletion,clearDeletion} from '../src/services/exportImportService.js';

const initial={players:[{id:'p1',username:'Old',profileLastUpdated:'2026-01-01T00:00:00Z'}],events:[],svsPlans:[],customRoles:[],labyrinthEntries:[]};

test('older import cannot resurrect deleted player',()=>{
  const deleted=recordDeletion({...initial,players:[]},'players','p1','2026-02-01T00:00:00Z');
  const merged=mergeImportedData(deleted,initial);
  assert.deepEqual(merged.players,[]);
  assert.equal(merged.deletedRecords.players.p1,'2026-02-01T00:00:00Z');
});

test('newer explicit record can supersede a deletion marker',()=>{
  const deleted=recordDeletion({...initial,players:[]},'players','p1','2026-02-01T00:00:00Z');
  const updated={...initial,players:[{id:'p1',username:'New',profileLastUpdated:'2026-03-01T00:00:00Z'}]};
  assert.equal(mergeImportedData(deleted,updated).players[0].username,'New');
});

test('deletion markers survive merge from both sides',()=>{
  const a=recordDeletion({...initial,players:[]},'players','p1','2026-02-01T00:00:00Z');
  const b=recordDeletion({...initial,players:[]},'events','e1','2026-02-02T00:00:00Z');
  const result=mergeImportedData(a,b);
  assert.ok(result.deletedRecords.players.p1);
  assert.ok(result.deletedRecords.events.e1);
});

test('explicitly readding a player clears their deletion marker',()=>{
  const deleted=recordDeletion(initial,'players','p1');
  assert.equal(clearDeletion(deleted,'players','p1').deletedRecords.players.p1,undefined);
});
