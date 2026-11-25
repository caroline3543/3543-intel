import assert from 'node:assert/strict';
import test from 'node:test';
import { combineScreenshotRows, pickScreenshotRows, readScreenshotLegion, readScreenshotPower, readScreenshotRow } from '../roster-site/src/foundry/rosterScreenshotModel.js';
import { parseBulkPlayers } from '../roster-site/src/components/bulkImportModel.js';
import { plannerSlot, updateEventPlanner } from '../src/services/eventPlanner.js';

test('the header must identify exactly one supported legion', () => {
  assert.equal(readScreenshotLegion('Legion 1 Combatants'), 1);
  assert.equal(readScreenshotLegion('Legion 2 Combatants\nLegion 1 dispatched'), 2);
  assert.equal(readScreenshotLegion('Legion 1 dispatched'), null);
  assert.equal(readScreenshotLegion('Legion 1 Combatants Legion 2 Combatants'), null);
});

test('power readings preserve exact figures and omit ambiguous numbers', () => {
  assert.deepEqual(readScreenshotRow('안개\n15,630'), { name: '안개', power: 15630 });
  assert.deepEqual(readScreenshotRow('Northvale\n946,105,130'), { name: 'Northvale', power: 946105130 });
  assert.deepEqual(readScreenshotRow('Wren\n1.25 B'), { name: 'Wren', power: 1250000000 });
  assert.deepEqual(readScreenshotRow('Wren\n1,20'), { name: 'Wren', power: null });
  assert.equal(readScreenshotPower('5 15,630'), null);
  assert.equal(readScreenshotPower('1.0.0M'), null);
  assert.equal(readScreenshotRow('Wren\n4381\nLegion 2 dispatched'), null);
  assert.equal(parseBulkPlayers('Wren\t1.25B', readScreenshotPower)[0].power, 1250000000);
  assert.equal(parseBulkPlayers('Wren\t1,20', readScreenshotPower)[0].power, null);
});

test('roster row detection ignores rank headers and keeps adjacent player rows separate', () => {
  const width = 100, height = 300;
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (const [top, bottom, rgb] of [
    [103, 114, [114, 168, 228]], [119, 143, [167, 194, 236]], [146, 170, [167, 194, 236]],
  ]) {
    for (let y = top; y < bottom; y++) {
      for (let x = 0; x < width; x++) pixels.set(rgb, (y * width + x) * 4);
    }
  }
  assert.deepEqual(pickScreenshotRows(pixels, width, height), [{top:119,bottom:143},{top:146,bottom:170}]);
});

test('confirmed screenshot power writes to the selected legion while preserving registration', () => {
  const existing = { players: [{ id:'a', lastFoundryTroopPower:47 }], foundry:{
    registrations:{a:'join'}, registeredUnder:{a:'ARC'}, teams:{}, assignments:{},
  } };
  const second = plannerSlot(existing.foundry, 'canyon', 'ARC', 2);
  const payload = { kind:'canyon', alliance:'ARC', legion:2, expectedOccurrenceId:second.occurrenceId,
    powers:[{id:'a',value:946105130}] };
  const next = updateEventPlanner(existing, payload, 1795635805964);
  assert.equal(next.players[0].lastCanyonClashTroopPower,946105130);
  assert.equal(next.players[0].lastFoundryTroopPower,47);
  assert.equal(plannerSlot(next.foundry,'canyon','ARC',2).powerByPlayer.a,946105130);
  assert.deepEqual(plannerSlot(next.foundry,'canyon','ARC',2).registrations,{});
  assert.equal(plannerSlot(next.foundry,'foundry','ARC',1).registrations.a,'join');
  assert.equal(updateEventPlanner(existing,{...payload,expectedOccurrenceId:'older-event'}),existing);
});

test('batch import removes identical overlapping rows and keeps conflicting readings for review', () => {
  const first = { name: 'Hope_闇', power: 245779411 };
  const newer = { ...first, power: 245779412 };
  const partial = { name: '', power: 38 };
  assert.deepEqual(combineScreenshotRows([
    { rows: [first, partial] },
    { rows: [{ ...first }, newer, partial] },
  ]), [first, partial, newer, partial]);
});
