import test from 'node:test';
import assert from 'node:assert/strict';
import {makeStateWorkbook,ROSTER_HEADERS} from '../src/services/stateWorkbookBuilder.js';
test('state workbook isolates other states and alliance tabs',()=>{
 const players=[
 {id:'123456789',state_id:'3573',alliance_tag:'LUN',data:{fid:'123456789',username:'Alpha',power:100}},
 {id:'333333333',state_id:'3573',alliance_tag:'MBT',data:{fid:'333333333',username:'Beta'}},
 {id:'987654321',state_id:'3543',alliance_tag:'LUN',data:{fid:'987654321',username:'Wrong state'}},
 ];
 const result=makeStateWorkbook('3573',players);
 assert.deepEqual(result.worksheets.map(w=>w.title),['LUN','MBT']);
 assert.equal(result.worksheets.reduce((n,w)=>n+w.values.length-1,0),2);
 assert.equal(result.worksheets[0].values[1][2],'3573');
 assert.equal(result.worksheets[0].values[1][3],'LUN');
 assert.deepEqual(result.worksheets[0].values[0],ROSTER_HEADERS);
 assert.equal(JSON.stringify(result).includes('Wrong state'),false);
});
test('unknown troop tiers stay empty, and camp levels are not mistaken for tiers',()=>{
 const w=makeStateWorkbook('3573',[{id:'123456789',state_id:'3573',alliance_tag:'LUN',data:{infantryCampLevel:30,lancerCampLevel:31,marksmanCampLevel:30}}]);
 assert.deepEqual(w.worksheets[0].values[1].slice(8,11),['','','']);
});
test('invalid state numbers rejected',()=>{
 assert.throws(()=>makeStateWorkbook('0',[]),/Invalid state/);
});
