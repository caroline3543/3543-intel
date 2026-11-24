import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSpreadsheetPreview } from '../src/services/spreadsheetPreviewModel.js';

const metadata={properties:{title:'Alliance Roster'},sheets:[{properties:{sheetId:7,title:'Players'}}]};
test('builds a read-only, approval-required preview',()=>{
 const result=buildSpreadsheetPreview({
  spreadsheetId:'test-id',metadata,worksheetId:7,stateId:'3543',
  players:[{id:'record-1',fid:'596099868'}],
  values:[['FID','Furnace','Notes'],['596099868','FC7','Ready']],
 });
 assert.equal(result.writeEnabled,false);
 assert.equal(result.approvalRequired,true);
 assert.equal(result.matchedRows,1);
 assert.equal(result.recommendedFieldMapping[1].authority,'api');
 assert.equal(result.recommendedFieldMapping[2].authority,'manual');
});
test('refuses worksheet IDs absent from provider metadata',()=>{
 assert.throws(()=>buildSpreadsheetPreview({
  spreadsheetId:'id',metadata,worksheetId:999,players:[],stateId:'3543',values:[],
 }));
});
