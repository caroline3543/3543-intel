import test from 'node:test';import assert from 'node:assert/strict';
import {makeSheetReadBaseline} from '../src/services/sheetReadBaselineService.js';
import {planSheetWrites} from '../src/services/sheetWritePlanService.js';
const spreadsheetId='1fGK_RpX6KRWXeMLza0lxhjB8uBfJ5-m-MF4FHyVcqHc',headers=['Player ID','State','Alliance','Availability'];
const rows=[headers,['123456789','3573','LUN','Maybe']];
const make=(overrides={})=>makeSheetReadBaseline({stateId:'3573',spreadsheetId,worksheetTitle:'LUN',rows,...overrides});
test('Reviewed read-only values provide an exact baseline for the export planner',()=>{
 const baseline=make();assert.equal(baseline.rows['123456789'].Availability,'Maybe');assert.equal(baseline.readOnly,true);
 const result=planSheetWrites({stateId:'3573',spreadsheetId,worksheetTitle:'LUN',rows,baseline,players:[{fid:'123456789',allianceTag:'LUN',sheetFields:{availability:'Yes'}}]});
 assert.equal(result.proposals.length,1);assert.equal(result.canWrite,false);
});
test('Baseline rejects cross-state, duplicate IDs and oversized worksheets',()=>{
 assert.throws(()=>make({rows:[headers,['123456789','3543','LUN','Maybe']]}),/Cross-state/);
 assert.throws(()=>make({rows:[...rows,rows[1]]}),/Duplicate player/);
 assert.throws(()=>make({rows:[headers,...Array.from({length:101},()=>['123456789','3573','LUN','Maybe'])]}),/truncated/);
});
