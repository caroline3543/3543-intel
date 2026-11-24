import test from 'node:test';
import assert from 'node:assert/strict';
import {
  lookupKey, indexPlayers, resolveSpreadsheetRow,
  compareCell, columnName, sheetCellRange,
} from '../src/services/spreadsheetMappingService.js';

test('matches game FID within the correct state', () => {
  const index = indexPlayers([{ id: 'local1', fid: '596099868', username: 'Old Name' }], '3543');
  assert.equal(resolveSpreadsheetRow({ chief_id: '596099868', username: 'Renamed' }, index, '3543').player.id, 'local1');
  assert.equal(resolveSpreadsheetRow({ chief_id: '596099868' }, index, '3573').status, 'unmatched');
  assert.equal(lookupKey('03543', 596099868), '3543:596099868');
});
test('refuses ambiguous duplicate identities', () => {
  assert.throws(() => indexPlayers([{ id: '1', fid: '596099868' }, { id: '2', fid: '596099868' }], '3543'));
});
test('imports a one-sided sheet edit', () => {
  assert.deepEqual(compareCell({ baseline: 'Unknown', database: 'Unknown', sheet: '12 UTC' }), { action: 'write_database', value: '12 UTC' });
});
test('does not discard simultaneous changes', () => {
  assert.equal(compareCell({ baseline: 'Unknown', database: '12 UTC', sheet: '19 UTC' }).action, 'conflict');
});
test('protects API-owned values', () => {
  assert.equal(compareCell({ baseline: 'FC6', database: 'FC7', sheet: 'FC5', authority: 'api' }).action, 'reject_sheet_edit');
});
test('builds stable quoted A1 ranges', () => {
  assert.equal(columnName(27), 'AB');
  assert.equal(sheetCellRange("Officer's Roster", 12, 27), "'Officer''s Roster'!AB12");
});
