import test from 'node:test';
import assert from 'node:assert/strict';
import {clearTalBattlePlans,deleteTalLegion,teamWarnings} from '../src/services/talPlanner.js';

const plan=[
 {id:'HOT:1',host:'HOT',legion:1,matchTime:'19:00',members:[{id:'a',role:'combatant'}],battleAttendance:{a:'attending'},assignments:{'Proto I':['a']},buildings:['Proto I','Repair I'],slots:['12:00','14:00','19:00']},
 {id:'ARC:2',host:'ARC',legion:2,matchTime:'14:00',members:[{id:'b',role:'combatant'}],battleAttendance:{b:'not-attending'},assignments:{'Repair I':['b']},buildings:['Repair I'],slots:['02:00','12:00','14:00']}
];
test('delete battle plans only clears battle-day data',()=>{
 const cleared=clearTalBattlePlans(plan);
 assert.equal(cleared.length,2);
 assert.deepEqual(cleared[0].members,plan[0].members);
 assert.deepEqual(cleared[0].buildings,plan[0].buildings);
 assert.equal(cleared[0].matchTime,'');
 assert.deepEqual(cleared[0].assignments,{});
 assert.deepEqual(cleared[1].battleAttendance,{});
 assert.equal(plan[0].matchTime,'19:00');
});
test('delete legion only removes targeted legion',()=>{
 const after=deleteTalLegion(plan,'HOT:1');
 assert.deepEqual(after.map(t=>t.id),['ARC:2']);
 assert.equal(plan.length,2);
});
test('two out of three availability does not raise a false three-time warning',()=>{
 const t={...plan[0],members:[{id:'a',role:'combatant'}]};
 const warnings=teamWarnings(t,{availability:{a:['12:00','19:00']}});
 assert.equal(warnings.some(w=>w.includes('cannot confirm every selected time')),false);
 assert.equal(warnings.some(w=>w.includes('need availability at two')),false);
});
