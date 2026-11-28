import assert from 'node:assert/strict';
import test from 'node:test';
import { combineScreenshotRows, pickScreenshotRows, readRosterRegistrationLabel, readScreenshotLegion, readScreenshotPower, readScreenshotRow } from '../roster-site/src/foundry/rosterScreenshotModel.js';
import { parseBulkPlayers } from '../roster-site/src/components/bulkImportModel.js';
import { plannerSlot, updateEventPlanner } from '../src/services/eventPlanner.js';

test('the header must identify exactly one supported legion', () => {
  assert.equal(readScreenshotLegion('Legion 1 Combatants'), 1);
  assert.equal(readScreenshotLegion('Legion 2 Combatants\nLegion 1 dispatched'), 2);
  assert.equal(readScreenshotLegion('Legion 1 dispatched'), null);
  assert.equal(readScreenshotLegion('Legion 1 Combatants Legion 2 Combatants'), null);
});

test('power readings preserve exact figures and omit ambiguous numbers', () => {
  assert.deepEqual(readScreenshotRow('안개\n15,630'), { name: '안개', otherLegion: null, power: 15630 });
  assert.deepEqual(readScreenshotRow('Northvale\n946,105,130'), { name: 'Northvale', otherLegion: null, power: 946105130 });
  assert.deepEqual(readScreenshotRow('Wren\n1.25 B'), { name: 'Wren', otherLegion: null, power: 1250000000 });
  assert.deepEqual(readScreenshotRow('Wren\n1,20'), { name: 'Wren', otherLegion: null, power: null });
  assert.equal(readScreenshotPower('5 15,630'), null);
  assert.equal(readScreenshotPower('1.0.0M'), null);
  assert.deepEqual(readScreenshotRow('Wren\n4381\nLegion 2 dispatched'), { name: 'Wren', otherLegion: 2, power: 4381 });
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
  const combined = combineScreenshotRows([
    { rows: [first, partial] },
    { rows: [{ ...first }, newer, partial] },
  ]);
  assert.deepEqual(combined.map(({ name, power }) => ({ name, power })), [first, partial, newer, partial]);
  assert.deepEqual(combined.map(row => row.sources), [[0,1],[0],[1],[1]]);
  assert.ok(combined[0].conflict && combined[2].conflict);
  assert.equal(new Set(combined.map(row => row.rowId)).size, combined.length);
});

test('commander roster retains complete rows below the checkbox layout cutoff', () => {
  const width = 200, height = 1000;
  const pixels = new Uint8ClampedArray(width * height * 4);
  const paint = (top, bottom, rgb) => {
    for (let y = top; y < bottom; y++) {
      for (let x = 0; x < width; x++) pixels.set(rgb, (y * width + x) * 4);
    }
  };
  paint(255, 256, [127, 176, 230]);
  paint(310, 311, [119, 169, 223]);
  paint(330, 331, [218, 230, 246]);
  paint(439, 516, [167, 193, 235]);
  paint(522, 599, [167, 193, 235]);
  paint(605, 682, [167, 193, 235]);
  paint(688, 765, [167, 193, 235]);
  paint(771, 791, [167, 193, 235]);
  paint(805, 881, [167, 193, 235]);

  assert.deepEqual(pickScreenshotRows(pixels, width, height), [
    {top:439,bottom:516}, {top:522,bottom:599}, {top:605,bottom:682},
    {top:688,bottom:765}, {top:771,bottom:791,partial:true},
  ]);

  paint(330, 331, [0, 0, 0]);
  assert.deepEqual(pickScreenshotRows(pixels, width, height).at(-1), {
    top:688,bottom:747,partial:true,
  });
});

test('commander roster registration requires a complete recognised label', () => {
  assert.equal(readRosterRegistrationLabel(' Join '), 'combatant');
  assert.equal(readRosterRegistrationLabel('Substitute'), 'substitute');
  assert.equal(readRosterRegistrationLabel('No\nengagements'), 'unassigned');
  for (const text of ['', 'Voted', 'Not joined', 'Subs', 'Join Substitute', 'Legion 2 dispatched']) {
    assert.equal(readRosterRegistrationLabel(text), 'unknown');
  }
});
