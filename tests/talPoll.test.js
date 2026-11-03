import test from 'node:test';
import assert from 'node:assert/strict';
import { matchPollEntries,pollSuggestions,addPollPlayers,removePollPlayer } from '../src/services/talPoll.js';
import { suggestTalTeams,talConfig } from '../src/services/talPlanner.js';
const players=[{id:'a',fid:'123456',username:'Lady Zap',alias:'Zap',allianceTag:'LUN'},{id:'b',fid:'234567',username:'Caroline',allianceTag:'MBT'},{id:'c',fid:'345678',username:'Alex'},{id:'d',fid:'456789',username:'Alex'},{id:'e',username:'玩家'}];
test('bulk matches names aliases FIDs and Unicode, preserving spaces in names',()=>{
 const result=matchPollEntries(players,'lady zap\n234567;Zap,玩家');
 assert.deepEqual(result.map(r=>r.player.id),['a','b','a','e']);
});
test('ambiguous or partial names require explicit selection',()=>{
 const result=matchPollEntries(players,'Alex\nCarol\nUnknown');
 assert.equal(result[0].player,null);assert.equal(result[0].ambiguous,true);assert.equal(result[0].suggestions.length,2);
 assert.equal(result[1].player,null);assert.equal(result[1].suggestions[0].id,'b');
 assert.equal(result[2].player,null);
 assert.equal(matchPollEntries(players,'345678')[0].player.id,'c');
});
test('autocomplete supports partial names and player IDs',()=>{
 assert.equal(pollSuggestions(players,'lady')[0].id,'a');assert.equal(pollSuggestions(players,'1234')[0].id,'a');
});
test('one player can appear at multiple times without duplicate votes at one time',()=>{
 let cfg=talConfig({});cfg={...cfg,...addPollPlayers(cfg,'02:00',['a','a','b'])};cfg={...cfg,...addPollPlayers(cfg,'07:00',['a'])};
 assert.deepEqual(cfg.availability.a,['02:00','07:00']);assert.deepEqual(cfg.availability.b,['02:00']);
 const removed=removePollPlayer(cfg,'02:00','a');assert.deepEqual(removed.availability.a,['07:00']);
 assert.deepEqual(cfg.availability.a,['02:00','07:00']);
});
test('interested does not invent availability or get auto-assigned',()=>{
 let cfg={...talConfig({}),hostTags:['LUN']};cfg={...cfg,...addPollPlayers(cfg,'interested',['a','b'])};
 assert.deepEqual(cfg.interestedIds,['a','b']);assert.deepEqual(cfg.availability,{});
 assert.equal(suggestTalTeams(cfg,players,{}).flatMap(t=>t.members).length,0);
 cfg={...cfg,...addPollPlayers(cfg,'02:00',['a'])};assert.deepEqual(cfg.interestedIds,['b']);
 assert.deepEqual(addPollPlayers(cfg,'interested',['a']).interestedIds,['b']);
 assert.ok(removePollPlayer(cfg,'02:00','a').interestedIds.includes('a'));
});
test('overlapping responses still produce only one legion placement per player',()=>{
 let cfg={...talConfig({}),hostTags:['LUN','MBT']};for(const slot of cfg.slots) cfg={...cfg,...addPollPlayers(cfg,slot,['a','b'])};
 const ids=suggestTalTeams(cfg,players,{}).flatMap(t=>t.members.map(m=>m.id));assert.equal(ids.length,2);assert.equal(new Set(ids).size,2);
});
