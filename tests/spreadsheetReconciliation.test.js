import test from 'node:test';
import assert from 'node:assert/strict';
import {planSpreadsheetSync} from '../src/services/spreadsheetReconciliation.js';
const rows=[{recordId:'p1',sheetRow:5}];
const fields=[{key:'availability',columnIndex:3,authority:'manual'},{key:'power',columnIndex:4,authority:'api'}];
const baselineByRecord={p1:{availability:'Unknown',power:100}};
function plan(databaseByRecord,sheetByRecord,options={}){
 return planSpreadsheetSync({rows,fields,baselineByRecord,databaseByRecord,sheetByRecord,worksheetTitle:'Roster',...options});
}
test('plans only changed cells, not full sheet rewrites',()=>{
 const p=plan({p1:{availability:'12 UTC',power:120}},{p1:{availability:'Unknown',power:100}});
 assert.equal(p.operations.length,2);
 assert.deepEqual(p.operations.map(x=>x.sheetRange),["'Roster'!D5","'Roster'!E5"]);
 assert.ok(p.operations.every(x=>x.action==='write_sheet'));
});
test('manual sheet changes are imported, API changes are flagged',()=>{
 const p=plan({p1:{availability:'Unknown',power:100}},{p1:{availability:'19 UTC',power:200}});
 assert.deepEqual(p.operations.map(x=>x.action),['write_database']);
 assert.equal(p.conflicts[0].reason,'reject_sheet_edit');
});
test('simultaneous edits never overwrite',()=>{
 const p=plan({p1:{availability:'12 UTC',power:100}},{p1:{availability:'19 UTC',power:100}});
 assert.equal(p.operations.length,0);
 assert.equal(p.conflicts[0].reason,'conflict');
});
test('missing baseline or record is a conflict, not a write',()=>{
 const p=plan({p1:{availability:'12 UTC',power:100}},{p1:{availability:'Unknown',power:100}},{baselineByRecord:{p1:{power:100}}});
 assert.equal(p.operations.length,0);
 assert.equal(p.conflicts[0].reason,'missing_baseline');
});
test('duplicate IDs are rejected before planning',()=>{
 assert.throws(()=>plan({p1:{availability:'x',power:100}},{p1:{availability:'x',power:100}},{rows:[...rows,...rows]}));
});
