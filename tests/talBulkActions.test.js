import test from 'node:test';
import assert from 'node:assert/strict';
import {applyTalBulk,previewTalBulk} from '../roster-site/src/tal/bulkActions.js';
import {newPlan,createTeam} from '../roster-site/src/tal/planner.js';
import {validateWorkspace} from '../roster-site/shared/workspace.js';
const make=()=>({
 players:[{id:'a',fid:'12345',username:'A',gameLanguage:'Korean',notes:'Keep'},
  {id:'b',fid:'23456',username:'B',gameLanguage:'Chinese'},
  {id:'c',fid:'34567',username:'C',gameLanguage:'English'}],
 events:[{id:'e',type:'tal',rallyTeamDraft:{teams:[{leader:'a'}]}}],
 customRoles:[],settings:{stateId:'3573'},
 talPlan:{...newPlan(),teams:[{...createTeam('HOT'),members:[{id:'a',role:'combatant',registered:false},{id:'b',role:'pending',registered:false}]}],
 records:{a:{status:'available',times:['19:00'],sheetRegistration:'Pending'},
 b:{status:'available',times:['12:00','14:00']},c:{status:'pending',times:[]}}},
 talTeamPreferences:{players:{a:{priority:true,reliable:true}},pairs:[['a','c']]}
});
test('bulk language updates only selected profiles and preserves game UI and event plans',()=>{
 const data=make(),copy=structuredClone(data);
 const {data:next}=applyTalBulk(data,['a','b'],{type:'language',language:'Mandarin'});
 assert.deepEqual(next.players.map(x=>x.communicationLanguage),['Mandarin','Mandarin',undefined]);
 assert.equal(next.players[0].gameLanguage,'Korean');
 assert.deepEqual(next.events,data.events);
 assert.deepEqual(data,copy);
 assert.doesNotThrow(()=>validateWorkspace(next));
});
test('availability add, remove, replace preserve unrelated records and prevent invalid times',()=>{
 let next=applyTalBulk(make(),['a','b'],{type:'availability',mode:'add',times:['14:00']}).data;
 assert.deepEqual(next.talPlan.records.a.times,['19:00','14:00']);
 assert.deepEqual(next.talPlan.records.b.times,['12:00','14:00']);
 next=applyTalBulk(next,['a'],{type:'availability',mode:'remove',times:['19:00']}).data;
 assert.deepEqual(next.talPlan.records.a.times,['14:00']);
 next=applyTalBulk(next,['b'],{type:'availability',mode:'replace',times:['02:00']}).data;
 assert.deepEqual(next.talPlan.records.b.times,['02:00']);
 assert.deepEqual(next.talPlan.records.c.times,[]);
 assert.throws(()=>applyTalBulk(next,['a'],{type:'availability',mode:'add',times:['23:00']}),/valid UTC/);
 assert.doesNotThrow(()=>validateWorkspace(next));
});
test('bulk registration maintains separate sheet verification and in-game registration',()=>{
 let next=applyTalBulk(make(),['a','b'],{type:'registration',value:'verified'}).data;
 assert.equal(next.talPlan.records.a.sheetRegistration,'Verified');
 assert.equal(next.talPlan.teams[0].members[0].registered,false);
 assert.throws(()=>applyTalBulk(next,['a','b'],{type:'registration',value:'registered'}),/confirmed combatant/);
 next=applyTalBulk(next,['a'],{type:'registration',value:'registered'}).data;
 assert.equal(next.talPlan.teams[0].members[0].registered,true);
 assert.equal(next.talPlan.teams[0].members[1].registered,false);
 assert.doesNotThrow(()=>validateWorkspace(next));
});
test('all-pairs teamwork is bidirectional, deduplicated and preserves priority joiners',()=>{
 let next=applyTalBulk(make(),['a','b','c'],{type:'teamwork',mode:'pair'}).data;
 assert.equal(next.talTeamPreferences.pairs.length,3);
 assert.equal(next.talTeamPreferences.players.a.priority,true);
 const second=applyTalBulk(next,['b','a','c'],{type:'teamwork',mode:'pair'}).data;
 assert.equal(second.talTeamPreferences.pairs.length,3);
 assert.doesNotThrow(()=>validateWorkspace(second));
});
test('preferred group does not create unsupported pair relationships',()=>{
 const first=applyTalBulk(make(),['a','b','c'],{type:'teamwork',mode:'group'}).data;
 assert.equal(first.talTeamPreferences.pairs.length,1);
 assert.deepEqual(first.talTeamPreferences.groups[0].memberIds,['a','b','c']);
 const again=applyTalBulk(first,['c','a','b'],{type:'teamwork',mode:'group'}).data;
 assert.equal(again.talTeamPreferences.groups.length,1);
 assert.doesNotThrow(()=>validateWorkspace(again));
});
test('empty selection, plan lock and unknown registrations cannot update data',()=>{
 const data=make();
 assert.throws(()=>previewTalBulk(data,[],{type:'language',language:'English'}),/Select/);
 data.talPlan.locked=true;
 assert.throws(()=>applyTalBulk(data,['a'],{type:'language',language:'English'}),/Unlock/);
 assert.equal(data.players[0].communicationLanguage,undefined);
});
