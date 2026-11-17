import test from 'node:test';
import assert from 'node:assert/strict';
import { matchPollEntries } from '../src/services/talPoll.js';
import { searchPlayers } from '../src/services/playerAutosuggest.js';

const players = [
  { id:'a', fid:'12345', username:'Caroline' },
  { id:'b', fid:'67890', username:'Christopher' },
  { id:'c', fid:'54321', username:'Alexander' },
];

test('auto-matches a close spelling with a clear unique winner', () => {
  assert.equal(matchPollEntries(players, 'Carolne')[0].player?.id, 'a');
});

test('does not guess when two names are similarly close', () => {
  const ambiguous=[{id:'a',username:'Caroline'},{id:'b',username:'Carolinne'}];
  assert.equal(matchPollEntries(ambiguous,'Carolne')[0].player,null);
});

test('does not fuzzy auto-match a mistyped numeric ID', () => {
  assert.equal(matchPollEntries(players,'12346')[0].player,null);
});

test('autocomplete offers fuzzy matches for misspellings', () => {
  assert.equal(searchPlayers(players,'Carolne')[0]?.id,'a');
});
