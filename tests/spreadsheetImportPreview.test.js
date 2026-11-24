import test from 'node:test';
import assert from 'node:assert/strict';
import { previewWorksheet } from '../src/services/spreadsheetImportPreview.js';

const players=[{id:'internal-a',fid:'596099868',username:'A'}];
test('read-only preview identifies matched rows without any writes',()=>{
 const result=previewWorksheet({values:[['Player ID','Name'],['596099868','Renamed'],['123456789','Unknown']],players,stateId:'3543'});
 assert.equal(result.matchedRows,1);
 assert.equal(result.unmatchedRows,1);
 assert.equal(result.candidates[0].match.recordId,'internal-a');
 assert.equal(result.candidates[1].match.status,'unmatched');
});
test('duplicate column headers prevent approved import',()=>{
 const result=previewWorksheet({values:[['FID','FID'],['596099868','596099868']],players,stateId:'3543'});
 assert.deepEqual(result.duplicateHeaders,['fid']);
 assert.equal(result.safeToImport,false);
});
test('does not match a player to another state',()=>{
 const result=previewWorksheet({values:[['FID','State'],['596099868','3573']],players,stateId:'3543'});
 assert.equal(result.matchedRows,0);
});
