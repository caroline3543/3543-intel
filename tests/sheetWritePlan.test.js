import test from 'node:test';import assert from 'node:assert/strict';
import {planSheetWrites} from '../src/services/sheetWritePlanService.js';
const id='1fGK_RpX6KRWXeMLza0lxhjB8uBfJ5-m-MF4FHyVcqHc',headers=['Player ID','State','Alliance','Availability','Total Power'];
const rows=[headers,['123456789','3573','LUN','Maybe','50']];
const baseline={stateId:'3573',spreadsheetId:id,worksheetTitle:'LUN',rows:{'123456789':{Availability:'Maybe'}}};
const players=[{fid:'123456789',allianceTag:'LUN',sheetFields:{availability:'Yes'},power:999}];
const plan=(overrides={})=>planSheetWrites({stateId:'3573',spreadsheetId:id,worksheetTitle:'LUN',players,rows,baseline,...overrides});
test('Export planner proposes guarded user field only, never API-owned power',()=>{const p=plan();assert.equal(p.canWrite,false);assert.equal(p.proposals.length,1);assert.equal(p.proposals[0].range,"'LUN'!D2");assert.equal(p.proposals[0].expected,'Maybe');assert.equal(p.proposals[0].value,'Yes');});
test('No baseline blocks export',()=>assert.throws(()=>plan({baseline:null}),/baseline/));
test('A different sheet baseline blocks export',()=>assert.throws(()=>plan({baseline:{...baseline,spreadsheetId:'other'}}),/baseline/));
test('Simultaneous edits become conflicts, not automatic writes',()=>{const p=plan({rows:[headers,['123456789','3573','LUN','No','50']]});assert.equal(p.proposals.length,0);assert.equal(p.conflicts.length,1)});
test('Duplicate IDs and mismatched alliances never produce writes',()=>{const p=plan({rows:[headers,['123456789','3573','BAD','Maybe','50'],['123456789','3573','LUN','Maybe','50']]});assert.equal(p.proposals.length,0);assert.equal(p.conflicts.length,2)});

test('Duplicate IDs block every occurrence even if the first row otherwise matches',()=>{
 const p=plan({rows:[headers,['123456789','3573','LUN','Maybe','50'],['123456789','3573','LUN','Maybe','50']]});
 assert.equal(p.proposals.length,0);
 assert.equal(p.conflicts.length,2);
});
