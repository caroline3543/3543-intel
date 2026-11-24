import test from 'node:test';
import assert from 'node:assert/strict';
import {lastProfileLocation} from '../src/services/profileLocation.js';

const date = '2026-11-23T10:00:00Z';
const provider = {stateId:'3573',fid:'357300012',cachedAt:date,retrievedAt:'2026-11-24T16:00:00Z',
  raw:{player:{chief_id:'357300012',kid:3573,x:'432',y:618}}};
test('map coordinates use the matching cached provider observation time',()=>{
  assert.deepEqual(lastProfileLocation({fid:'357300012',providerDetails:provider}),{x:'432',y:618,observedAt:date});
  assert.equal(lastProfileLocation({fid:'357300021',providerDetails:provider}),null);
});
test('invalid and merged location fields cannot make old data look newly seen',()=>{
  const raw={player:{...provider.raw.player,x:null}};
  assert.equal(lastProfileLocation({fid:'357300012',providerDetails:{...provider,raw},providerStats:{raw:{x:5,y:4}}}),null);
  const saved={x:0,y:4,observedAt:'2026-11-24T10:00:00Z'};
  assert.deepEqual(lastProfileLocation({fid:'357300012',providerDetails:provider,lastKnownLocation:saved}),saved);
});
