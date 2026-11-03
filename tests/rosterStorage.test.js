import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRosterStorage } from '../src/services/rosterStorageService.js';

function fixture(entries = []) {
  const local = new Map(entries), durable = new Map();
  const storage = {
    get length() { return local.size; },
    key: i => [...local.keys()][i],
    getItem: key => local.get(key) ?? null,
    setItem: (key, value) => { if (String(value).length > 1000) throw new DOMException('Full', 'QuotaExceededError'); local.set(key, value); },
    removeItem: key => local.delete(key),
  };
  const database = {
    entries: async () => [...durable],
    get: async key => durable.get(key),
    put: async (key, value) => { durable.set(key, value); },
  };
  return {local, durable, storage, database};
}

test('large rosters migrate losslessly and retain state boundaries, registry and unrelated keys', async () => {
  const first = JSON.stringify({players:[{notes:'keep'.repeat(10000)}],settings:{stateId:'3573'}});
  const second = JSON.stringify({players:[{id:'other'}],settings:{stateId:'3598'}});
  const f = fixture([['svs_rally_data:state:3573',first],['svs_rally_data:state:3598',second],['svs_state_workspaces_v1','registry'],['auth-token','untouched']]);
  const store = createRosterStorage(f.storage, f.database);
  await store.initialize();
  assert.equal(store.getItem('svs_rally_data:state:3573'), first);
  assert.equal(store.getItem('svs_rally_data:state:3598'), second);
  assert.equal(f.local.has('svs_rally_data:state:3573'), false);
  assert.equal(f.local.get('auth-token'), 'untouched');
  assert.equal(f.local.get('svs_state_workspaces_v1'), 'registry');
  store.setItem('svs_rally_data:state:3573', first + ' ');
  await store.flush();
  assert.equal(f.durable.get('svs_rally_data:state:3573'), first + ' ');
  assert.equal(f.durable.get('svs_rally_data:state:3598'), second);
  const reopened = createRosterStorage(f.storage, f.database);
  await reopened.initialize();
  assert.equal(reopened.getItem('svs_rally_data:state:3573'), first + ' ');
});

test('failed migration or failed readback never removes the original copy', async () => {
  for (const fault of ['write','verify']) {
    const f = fixture([['svs_rally_data','original']]);
    if (fault === 'write') f.database.put = async () => { throw new Error('disk full'); };
    else f.database.get = async () => 'wrong';
    await assert.rejects(createRosterStorage(f.storage, f.database).initialize());
    assert.equal(f.local.get('svs_rally_data'), 'original');
  }
});

test('interrupted migration is recoverable even after earlier records were migrated', async () => {
  const f = fixture([['svs_rally_data:state:3573','first'],['svs_rally_data:state:3598','second']]);
  const put = f.database.put;
  f.database.put = async (key, value) => {
    if (key.endsWith('3598')) throw new Error('interrupted');
    await put(key, value);
  };
  await assert.rejects(createRosterStorage(f.storage, f.database).initialize());
  assert.equal(f.durable.get('svs_rally_data:state:3573'), 'first');
  assert.equal(f.local.get('svs_rally_data:state:3598'), 'second');
  f.database.put = put;
  const resumed = createRosterStorage(f.storage, f.database);
  await resumed.initialize();
  assert.equal(resumed.getItem('svs_rally_data:state:3573'), 'first');
  assert.equal(resumed.getItem('svs_rally_data:state:3598'), 'second');
});

test('switching waits for durable save; failures remain visible and can be retried', async () => {
  const f = fixture(); let finish, errorCount = 0;
  const store = createRosterStorage(f.storage, f.database, () => errorCount++);
  await store.initialize();
  f.database.put = () => new Promise(resolve => { finish = resolve; });
  store.setItem('svs_rally_data:state:3573','pending');
  let flushed = false;
  const waiting = store.flush().then(() => { flushed = true; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(flushed, false);
  finish(); await waiting;
  f.database.put = async () => { throw new Error('disk full'); };
  store.setItem('svs_rally_data:state:3573','unsaved');
  await assert.rejects(store.flush(), /disk full/);
  assert.equal(store.getItem('svs_rally_data:state:3573'), 'unsaved');
  assert.equal(errorCount, 1);
  f.database.put = async (key, value) => f.durable.set(key,value);
  store.setItem('svs_rally_data:state:3573','retry');
  await store.flush();
  assert.equal(f.durable.get('svs_rally_data:state:3573'), 'retry');
});

test('rapid autosaves commit in order, and legacy data remains available for workspace migration', async () => {
  const f = fixture([['svs_rally_data','legacy']]);
  const store = createRosterStorage(f.storage, f.database);
  await store.initialize();
  assert.equal(store.getItem('svs_rally_data'),'legacy');
  const writes = [];
  f.database.put = async (key, value) => { writes.push(value); f.durable.set(key,value); };
  for (const value of ['one','two','three']) store.setItem('svs_rally_data:state:3573',value);
  await store.flush();
  assert.deepEqual(writes,['one','two','three']);
  assert.equal(f.durable.get('svs_rally_data:state:3573'),'three');
});
