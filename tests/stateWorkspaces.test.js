import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initializeWorkspaces, stateStorageKey, assertImportState, normalizeStateId } from '../src/services/stateWorkspaceService.js';
import { allianceRows, newAlliancePlayers } from '../src/services/allianceImportService.js';
const storage = entries => { const map = new Map(entries); return { getItem:k => map.get(k) ?? null, setItem:(k,v) => map.set(k,v), map }; };
test('migration preserves legacy roster and operational records only in their original state', () => {
  const original = JSON.stringify({ settings:{stateId:'3543'}, players:[{id:'keep', notes:'Original'}] });
  const s = storage([['svs_rally_data', original], ['svs_live_rally_room_v2', '{"timers":["original"]}']]);
  assert.deepEqual(initializeWorkspaces(s).states, ['3543','3573']);
  assert.equal(s.getItem('svs_rally_data'), original);
  assert.equal(s.getItem(stateStorageKey('svs_rally_data','3543')), original);
  assert.equal(s.getItem(stateStorageKey('svs_rally_data','3573')), null);
  assert.equal(s.getItem(stateStorageKey('svs_live_rally_room_v2','3573')), null);
  s.setItem(stateStorageKey('svs_rally_data','3573'), '{"players":["second"]}');
  initializeWorkspaces(s);
  assert.equal(s.getItem(stateStorageKey('svs_rally_data','3543')), original);
  assert.equal(s.getItem(stateStorageKey('svs_rally_data','3573')), '{"players":["second"]}');
});
test('migration respects a saved State 3573 and never copies into the other state', () => {
  const s = storage([['svs_rally_data','{"settings":{"stateId":"3573"},"players":[1]}']]);
  assert.equal(initializeWorkspaces(s).activeStateId,'3573');
  assert.equal(s.getItem(stateStorageKey('svs_rally_data','3543')),null);
});
test('failed migration retains original and does not publish an incomplete registry', () => {
  const s = storage([['svs_rally_data','{"players":[1]}']]);
  s.setItem = () => { throw new Error('Full'); };
  assert.throws(() => initializeWorkspaces(s), /Full/);
  assert.equal(s.getItem('svs_rally_data'),'{"players":[1]}');
  assert.equal(s.getItem('svs_state_workspaces_v1'),null);
});
test('file imports reject another state including provider snapshots', () => {
  assert.throws(() => assertImportState({settings:{stateId:'3573'}},'3543'), /Switch states/);
  assert.throws(() => assertImportState({players:[{providerStats:{stateId:'3573'}}]},'3543'), /different state/);
  assert.doesNotThrow(() => assertImportState({settings:{stateId:'3543'}},'3543'));
  for (const invalid of ['0','12x','-4','999999']) assert.throws(() => normalizeStateId(invalid));
});
const response = {data:{alliance:{kid:3573},members:[
  {chief_id:123,nick_name:'Provider rename',kid:3573,power:10},
  {chief_id:456,nick_name:'New player',kid:3573,power:99,kills:45,furnace_level:35},
  {chief_id:456,nick_name:'Duplicate',kid:3573},
]}};
test('alliance import keeps every existing field unchanged and adds unique FIDs only', () => {
  const existing = [{id:'manual',fid:'123',username:'Officer name',notes:'Keep',troops:{infantry:'FC5'},eventHistory:[{id:1}]}];
  const before = structuredClone(existing);
  const rows = allianceRows(response,'3573','LUN');
  const added = newAlliancePlayers(existing,rows,'3573');
  assert.deepEqual(existing,before);
  assert.equal(added.length,1);
  assert.equal(added[0].fid,'456');
  assert.equal(added[0].providerStats.power,99);
  assert.equal(added[0].providerStats.furnaceLevel,35);
  assert.equal(added[0].furnaceLevel,'FC1');
  assert.equal(newAlliancePlayers([...existing,...added],rows,'3573').length,0);
});
test('different alliance tags can be imported into the same state without replacing other alliances', () => {
  const lun = newAlliancePlayers([],allianceRows(response,'3573','LUN'),'3573');
  const other = newAlliancePlayers(lun,allianceRows({data:{members:[{chief_id:789,nick_name:'Other',kid:3573}]}},'3573','ABC'),'3573');
  assert.equal(lun[0].allianceTag,'LUN'); assert.equal(other[0].allianceTag,'ABC');
  assert.throws(() => allianceRows(response,'3543','LUN'), /different state/);
  assert.throws(() => allianceRows({data:{members:[{chief_id:1,kid:3543}]}},'3573','LUN'), /another state/);
  assert.throws(() => newAlliancePlayers([],allianceRows(response,'3573','LUN'),'3543'), /correct state/);
});

import {createScopedCloud} from '../src/services/scopedCloudService.js';
test('cloud sync isolates colliding player and plan IDs across states for save, read and delete', async () => {
  const tables = {players:[],svs_plans:[]};
  const client = { from(table) {
    return {
      async upsert(row) { const old=tables[table].findIndex(r=>r.id===row.id&&r.state_id===row.state_id); if(old<0)tables[table].push(row);else tables[table][old]=row;return {error:null}; },
      select() { return {eq:async(k,v)=>({data:tables[table].filter(r=>r[k]===v),error:null})}; },
      delete() {
        const filters=[];const q={eq(k,v){filters.push([k,v]);return q;},then(resolve){tables[table]=tables[table].filter(row=>!filters.every(([k,v])=>row[k]===v));resolve({error:null});}};return q;
      },
    };
  }};
  const first=createScopedCloud(client,'3543'),second=createScopedCloud(client,'3573');
  for(const table of ['players','svs_plans']) {
    await first.push(table,{id:'same',username:'First original'});
    await second.push(table,{id:'same',username:'Second original'});
  }
  await second.push('players',{id:'same',username:'Second edited'});
  assert.equal((await first.pull()).players[0].username,'First original');
  assert.equal((await second.pull()).players[0].username,'Second edited');
  await second.remove('players','same');await second.remove('svs_plans','same');
  assert.equal((await second.pull()).players.length,0);
  assert.equal((await second.pull()).svsPlans.length,0);
  assert.equal((await first.pull()).players.length,1);
  assert.equal((await first.pull()).svsPlans.length,1);
});
