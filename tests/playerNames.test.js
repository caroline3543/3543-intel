import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pastPlayerNames} from '../src/services/playerNames.js';
import {matchesRosterFilters,EMPTY_FILTERS} from '../src/services/rosterViewService.js';
import {matchPollEntries,pollSuggestions} from '../src/services/talPoll.js';
import {searchPlayers} from '../src/services/playerAutosuggest.js';
const player={id:'a',fid:'681766601',username:'Current',alias:'Chosen nickname',pastUsernames:['Older',' older ','Current'],observationHistory:[{stream:'profile',values:{username:'Previous'},changes:[{field:'username',before:'First name',after:'Previous'}]}]};
test('recovers past names from saved history without replacing nickname or current name',()=>{
 assert.deepEqual(pastPlayerNames(player),['Older','Previous','First name']);
 assert.equal(player.alias,'Chosen nickname');
 assert.equal(player.username,'Current');
 assert.equal(matchesRosterFilters(player,'first NAME',EMPTY_FILTERS),true);
 assert.deepEqual(searchPlayers([player],'previous'),[player]);
 assert.deepEqual(pollSuggestions([player],'first name'),[player]);
});
test('old names match uniquely but reused names require a player ID',()=>{
 assert.equal(matchPollEntries([player],'First name')[0].player,player);
 const other={id:'b',fid:'123',username:'First name'};
 const result=matchPollEntries([player,other],'First name')[0];
 assert.equal(result.ambiguous,true);
 assert.equal(result.player,null);
 assert.equal(matchPollEntries([player,other],'681766601')[0].player,player);
});
