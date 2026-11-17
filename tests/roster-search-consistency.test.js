import test from 'node:test';
import assert from 'node:assert/strict';
import { searchPlayers } from '../src/services/playerAutosuggest.js';
import { matchesRosterFilters, EMPTY_FILTERS } from '../src/services/rosterViewService.js';

const players = [
  { id: '1', username: 'Alexandria', fid: '9001' },
  { id: '2', username: 'Alex', fid: '9002' },
  { id: '3', username: 'Other', alias: 'Alexandra', fid: '9003' },
];

test('autocomplete prioritizes exact matches over earlier partial matches', () => {
  assert.deepEqual(searchPlayers(players, 'alex').map(p => p.id), ['2', '1', '3']);
});

test('autocomplete matches player IDs', () => {
  assert.deepEqual(searchPlayers(players, '9002').map(p => p.id), ['2']);
});

test('roster search uses the same normalized matching as autocomplete', () => {
  for (const player of searchPlayers(players, 'alex')) {
    assert.equal(matchesRosterFilters(player, 'alex', EMPTY_FILTERS), true);
  }
});

test('autocomplete respects its result limit', () => {
  assert.equal(searchPlayers(players, 'alex', 1).length, 1);
});
