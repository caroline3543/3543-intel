import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newPlan,createTeam,setRecord,placePlayer,record,unassign} from '../roster-site/src/tal/planner.js';
import {intakePreview} from '../roster-site/src/tal/legionIntake.js';
import {matchPollEntries} from '../src/services/talPoll.js';
const players=Array.from({length:55},(_,i)=>({id:String(i),fid:String(10000+i),username:`Player ${i}`,alias:i===2?'Nickname':'',allianceTag:'HOT'}));
function plan(){let value={...newPlan(),teams:['HOT','ARC'].map(t=>({...createTeam(t),slots:['02:00','07:00','12:00']}))};for(const p of players)value=setRecord(value,p,{status:'available',times:value.times});return value;}
const entries=ids=>ids.map(id=>({entry:players[id].fid,player:players[id]}));
test('pasted exact names, nicknames and IDs match without fuzzy automatic choices',()=>{
 const matched=matchPollEntries(players,'Player 0\n10001\nNickname\nUnknown name');const value=intakePreview(plan(),players,'HOT:1',matched);assert.equal(value.added,3);assert.equal(value.needsReview,1);assert.equal(value.results[3].state,'unmatched');
 const duplicates=[...players,{...players[0],id:'other',fid:'99999'}];assert.equal(matchPollEntries(duplicates,'Player 0')[0].player,null);
});
test('bulk intake previews are immutable, skip duplicates and preserve existing players',()=>{
 let original=placePlayer(plan(),players,'0','HOT:1','substitute');const before=structuredClone(original);const result=intakePreview(original,players,'HOT:1',entries([0,1,1,2]));assert.deepEqual(original,before);assert.equal(result.added,2);assert.equal(result.skipped,2);assert.equal(result.plan.teams[0].members.find(m=>m.id==='0').role,'substitute');
});
test('bulk automatic roles stop at 30 combatants and 20 substitutes',()=>{
 const result=intakePreview(plan(),players,'HOT:1',entries(players.map((_,i)=>i)));assert.equal(result.added,50);assert.equal(result.needsReview,5);assert.equal(result.plan.teams[0].members.filter(m=>m.role==='combatant').length,30);assert.equal(result.plan.teams[0].members.filter(m=>m.role==='substitute').length,20);
});
test('moves require an explicit option and do not duplicate a player',()=>{
 const original=placePlayer(plan(),players,'0','ARC:1');assert.equal(intakePreview(original,players,'HOT:1',entries([0])).moved,0);const result=intakePreview(original,players,'HOT:1',entries([0]),{moveExisting:true});assert.equal(result.moved,1);assert.equal(result.plan.teams.flatMap(t=>t.members).filter(m=>m.id==='0').length,1);assert.equal(result.plan.teams[1].members.length,0);
});
test('explicit availability override allows pending participants but never declined or blacklisted players',()=>{
 let original={...newPlan(),teams:[createTeam('HOT')]};const subset=players.slice(0,3).map(p=>({...p}));subset[2].blacklisted=true;original=setRecord(original,subset[1],{status:'declined'});
 assert.equal(intakePreview(original,subset,'HOT:1',entries([0])).added,0);const result=intakePreview(original,subset,'HOT:1',entries([0,1,2]),{allowConflicts:true});assert.equal(result.added,1);assert.equal(result.needsReview,2);assert.equal(record(result.plan,subset[0]).status,'available');assert.deepEqual(record(result.plan,subset[0]).times,[]);
});
test('locked plans reject intake and removing a member keeps availability',()=>{
 const original=plan();assert.equal(intakePreview({...original,locked:true},players,'HOT:1',entries([0])).added,0);const added=intakePreview(original,players,'HOT:1',entries([0])).plan;const removed=unassign(added,'0');assert.equal(removed.teams[0].members.length,0);assert.deepEqual(removed.records['0'],original.records['0']);
});
