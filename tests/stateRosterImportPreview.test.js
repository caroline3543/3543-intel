import test from 'node:test';import assert from 'node:assert/strict';
import {planStateRosterImport} from '../src/services/stateRosterImportPreview.js';
test('matches existing players by ID without changing roster',()=>{
 const players=[{id:'local-1',fid:'123456789',allianceTag:'LUN'}];
 const source=JSON.stringify(players);
 const result=planStateRosterImport({stateId:'3573',worksheetAlliance:'LUN',players,mapping:{chief_id:'0',state:'1',infantry_tier:'2'},values:[['Player ID','State','Infantry Troop Level'],['123456789','3573','FC7'],['987654321','3573','FC6']]});
 assert.equal(result.matched,1);assert.equal(result.newPlayers,1);assert.equal(result.canApply,false);
 assert.equal(result.candidates[0].manualFields.infantry,'FC7');assert.equal(JSON.stringify(players),source);
});
test('wrong-state and wrong-alliance rows are not accepted',()=>{
 const result=planStateRosterImport({stateId:'3573',worksheetAlliance:'LUN',players:[{id:'p',fid:'123456789',allianceTag:'MBT'}],mapping:{chief_id:'0',state:'1'},values:[['ID','State'],['123456789','3573'],['222222222','3543']]});
 assert.equal(result.candidates.length,0);assert.equal(result.errors.length,2);
});

test('reports changed manual troop tiers without touching API-owned fields',()=>{
 const players=[{id:'p1',fid:'123456789',allianceTag:'LUN',troops:{infantry:'T10'}}];
 const plan=planStateRosterImport({stateId:'3573',worksheetAlliance:'LUN',players,mapping:{chief_id:'0',state:'1',alliance:'2',infantry_tier:'3'},values:[['ID','State','Alliance','Infantry Troop Level'],['123456789','3573','LUN','FC1']]});
 assert.equal(plan.proposedChanges,1);assert.equal(plan.candidates[0].manualFields.infantry,'FC1');assert.equal(players[0].troops.infantry,'T10');
});
test('rejects an alliance value different from the worksheet tab',()=>{
 const plan=planStateRosterImport({stateId:'3573',worksheetAlliance:'LUN',players:[],mapping:{chief_id:'0',state:'1',alliance:'2'},values:[['ID','State','Alliance'],['123456789','3573','MBT']]});
 assert.equal(plan.candidates.length,0);assert.match(plan.errors[0],/alliance/);
});

test('event power and game language are compared as user supplied fields',()=>{
 const players=[{id:'local',fid:'123456789',allianceTag:'LUN',foundryTroopPower:100,gameLanguage:'English'}];
 const mapping={chief_id:'0',state:'1',foundry_troop_power:'2',canyon_troop_power:'3',game_language:'4'};
 const p=planStateRosterImport({values:[['FID','State','Foundry Troop Power','Canyon Clash Troop Power','In-game Language'],['123456789','3573','250000','123000','Korean']],mapping,players,stateId:'3573',worksheetAlliance:'LUN'});
 assert.equal(p.proposedChanges,1);
 assert.deepEqual(p.candidates[0].extraFields,{foundryTroopPower:250000,canyonTroopPower:123000,gameLanguage:'Korean'});
});
test('invalid event power blocks import review',()=>{
 const p=planStateRosterImport({values:[['FID','State','Foundry'],['123456789','3573','garbage']],mapping:{chief_id:'0',state:'1',foundry_troop_power:'2'},players:[],stateId:'3573',worksheetAlliance:'LUN'});
 assert.equal(p.errors.length,1);
});
