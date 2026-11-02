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

test('troop tiers and event powers map without requesting quantities',()=>{
 const headers=['Player ID','Infantry Troop Level','Lancer Troop Level','Marksman Troop Level','Foundry Troop Power','Canyon Clash Troop Power','In-game Language','Joiner Heroes'];
 const mapping=detectMapping(headers);
 assert.deepEqual([mapping.infantry_tier,mapping.lancer_tier,mapping.marksman_tier,mapping.foundry_troop_power,mapping.canyon_troop_power,mapping.game_language,mapping.joiner_heroes],['1','2','3','4','5','6','7']);
 assert.equal(assessMapping([headers,['123456789','T10','FC1','FC2','100000','150000','English','Jessie']],mapping).validForFutureImport,true);
});
