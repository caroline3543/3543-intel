import test from 'node:test';import assert from 'node:assert/strict';
import {canonicalExportReview,prepareExportApproval} from '../src/services/sheetExportApprovalService.js';
const plan={stateId:'3573',spreadsheetId:'1fGK_RpX6KRWXeMLza0lxhjB8uBfJ5-m-MF4FHyVcqHc',worksheetTitle:'LUN',conflicts:[],proposals:[{fid:'123456789',row:2,column:'Availability',expected:'Maybe',value:'Yes'}]};
const checked={readOnly:true,writeEnabled:false,allMatched:true,checked:[{row:2,column:'Availability',match:true}]};
test('Export review produces deterministic unapproved receipt',async()=>{
 const a=await prepareExportApproval(plan,checked,{now:()=>new Date('2026-11-03T00:00:00Z')});
 const b=await prepareExportApproval(plan,checked,{now:()=>new Date('2026-11-03T00:01:00Z')});
 assert.equal(a.hash,b.hash);assert.equal(a.approved,false);assert.equal(a.writeEnabled,false);
 assert.equal(a.review.changes[0].expected,'Maybe');
});
test('Export review refuses unverified and conflicting data',()=>{
 assert.throws(()=>canonicalExportReview(plan,{...checked,allMatched:false}),/preflight/);
 assert.throws(()=>canonicalExportReview({...plan,conflicts:[{reason:'Conflict'}]},checked),/conflicts/);
 assert.throws(()=>canonicalExportReview(plan,{...checked,checked:[]}),/Incomplete/);
});

test('Receipt refuses a verified cell that does not match its proposal',()=>{
 assert.throws(()=>canonicalExportReview(plan,{...checked,checked:[{row:3,column:'Availability',match:true}]}),/Verification does not match/);
});
