import test from 'node:test';
import assert from 'node:assert/strict';
import { detectMapping, assessMapping } from '../src/services/worksheetMappingPreview.js';

test('recognises common column headings',()=>{
 const mapping=detectMapping(['Player ID','Username','Alliance','State','Notes']);
 assert.deepEqual([mapping.chief_id,mapping.username,mapping.alliance,mapping.state,mapping.notes],['0','1','2','3','4']);
});
test('valid sample produces read-only structural report',()=>{
 const values=[['Player ID','State'],['123456789','3573'],['987654321','3573']];
 const report=assessMapping(values,detectMapping(values[0]));
 assert.equal(report.totalRows,2);
 assert.equal(report.validForFutureImport,true);
 assert.equal(report.readOnly,true);
});
test('duplicate identifiers and invalid IDs are blocked',()=>{
 const rows=[['FID','State'],['123456789','3573'],['123456789','3573'],['abc','3573']];
 const report=assessMapping(rows,detectMapping(rows[0]));
 assert.equal(report.duplicates,1);
 assert.equal(report.invalidIds,1);
 assert.equal(report.validForFutureImport,false);
});
test('one source column cannot map to two app fields',()=>{
 const report=assessMapping([['FID'],['123456789']],{chief_id:'0',state:'0'});
 assert.equal(report.validForFutureImport,false);
 assert.match(report.errors.join(' '),/only one field/);
});
