import test from 'node:test';
import assert from 'node:assert/strict';
import {previewTalBulk,applyTalBulk} from '../roster-site/src/tal/bulkActions.js';
import {newPlan,createTeam} from '../roster-site/src/tal/planner.js';
import {validateWorkspace} from '../roster-site/shared/workspace.js';

function fixture(){
 return {
  players:[
   {id:'a',fid:'12345',username:'Player A',gameLanguage:'Korean',notes:'Manual note'},
   {id:'b',fid:'23456',username:'Player B',gameLanguage:'Chinese'},
   {id:'c',fid:'34567',username:'Player C',gameLanguage:'English'}],
  events:[],customRoles:[],settings:{stateId:'3739'},
  talPlan:{...newPlan(),teams:[{...createTeam('GLR',1),members:[{id:'a',role:'combatant',registered:false},{id:'b',role:'pending',registered:false}]}],
   records:{a:{status:'available',times:['19:00']},b:{status:'available',times:['12:00','14:00']},c:{status:'pending',times:[]}},
   availability:{a:['19:00'],b:['12:00','14:00']}},
  talTeamPreferences:{players:{},pairs:[['a','c']]}
 };
}
test('3739 language bulk keeps game language and unrelated profiles',()=>{
 const original=fixture(),copy=structuredClone(original);
 const next=applyTalBulk(original,['a','b'],{type:'language',language:'Mandarin'}).data;
 assert.equal(next.players[0].communicationLanguage,'Mandarin');
 assert.equal(next.players[0].gameLanguage,'Korean');
 assert.equal(next.players[2].communicationLanguage,undefined);
 assert.deepEqual(original,copy);
 assert.doesNotThrow(()=>validateWorkspace(next));
});
test('3739 availability updates records and separate availability index',()=>{
 let next=applyTalBulk(fixture(),['a','b'],{type:'availability',mode:'add',times:['14:00']}).data;
 assert.deepEqual(next.talPlan.availability.a,['19:00','14:00']);
 assert.deepEqual(next.talPlan.records.a.times,['19:00','14:00']);
 assert.deepEqual(next.talPlan.availability.b,['12:00','14:00']);
 next=applyTalBulk(next,['b'],{type:'availability',mode:'replace',times:['02:00']}).data;
 assert.deepEqual(next.talPlan.availability.b,['02:00']);
 assert.deepEqual(next.talPlan.records.a.times,['19:00','14:00']);
 assert.doesNotThrow(()=>validateWorkspace(next));
});
test('3739 registration keeps pending role unregistered and updates members with valid role',()=>{
 const original=fixture();
 const planning=applyTalBulk(original,['a','b'],{type:'registration',value:'verified'}).data;
 assert.equal(planning.talPlan.teams[0].members[0].registered,false);
 assert.throws(()=>applyTalBulk(planning,['a','b'],{type:'registration',value:'registered'}),/Confirm combatant/);
 const confirmed=applyTalBulk(planning,['a'],{type:'registration',value:'registered'}).data;
 assert.equal(confirmed.talPlan.teams[0].members[0].registered,true);
 assert.equal(confirmed.talPlan.teams[0].members[1].registered,false);
 assert.doesNotThrow(()=>validateWorkspace(confirmed));
});
test('3739 working pairs are symmetric and deduplicated',()=>{
 const first=applyTalBulk(fixture(),['a','b','c'],{type:'teamwork',mode:'pair'}).data;
 assert.equal(first.talTeamPreferences.pairs.length,3);
 const second=applyTalBulk(first,['c','b','a'],{type:'teamwork',mode:'pair'}).data;
 assert.equal(second.talTeamPreferences.pairs.length,3);
 assert.doesNotThrow(()=>validateWorkspace(second));
});
test('bulk editing respects locks and prevents unrecognised times',()=>{
 const x=fixture();
 assert.throws(()=>previewTalBulk(x,[],{type:'language',language:'English'}),/Select/);
 assert.throws(()=>applyTalBulk(x,['a'],{type:'availability',mode:'add',times:['23:00']}),/valid UTC/);
 x.talPlan.locked=true;
 assert.throws(()=>applyTalBulk(x,['a'],{type:'language',language:'English'}),/Unlock/);
});
