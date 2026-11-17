import test from 'node:test';
import assert from 'node:assert/strict';
import {parseBulkPlayers,bulkCandidates,resolveBulkRows} from '../roster-site/src/components/bulkImportModel.js';
const players=[{id:'1',name:'REINTLESS RKG',alliance:'HOT',searchFields:['REINTLESS RKG','OldRKG']},{id:'2',name:'8ARl',alliance:'HOT',searchFields:['8ARl']},{id:'3',name:'8ARI',alliance:'ARC',searchFields:['8ARI']},{id:'4',name:'Бакит Кыргыз',alliance:'HOT',searchFields:['Бакит Кыргыз']}];
test('OCR import parses commas, separators and abbreviated numeric power',()=>{
 const rows=parseBulkPlayers('Name,Power\nREINTLESSRKG,5472\n8ARI — 3,593\nБакит Кыргыз: 5.1K\nAthena,325');
 assert.equal(rows.length,4);
 assert.deepEqual(rows.map(r=>r.power),[5472,3593,5100,325]);
 assert.equal(rows[2].username,'Бакит Кыргыз');
});
test('exact identity beats fuzzy suggestions across alliances',()=>{
 const candidates=bulkCandidates('8ARI',players,'HOT');
 assert.equal(candidates[0].id,'3');
 assert.equal(candidates[0].score,100);
 const rows=resolveBulkRows(parseBulkPlayers('8ARI,3593'),players,{}, {},'HOT');
 assert.equal(rows[0].status,'review');
 assert.equal(rows[0].player,null);
 assert.equal(rows[0].candidates[0].id,'3');
});
test('OCR variants are suggested but never silently approved',()=>{
 const rows=resolveBulkRows(parseBulkPlayers('REINTLESSRKG,5472'),players);
 assert.equal(rows[0].status,'review');
 assert.equal(rows[0].player,null);
 assert.equal(rows[0].candidates[0].id,'1');
});
test('explicit review can select a suggested player, and skip excludes it',()=>{
 const source=parseBulkPlayers('REINTLESSRKG,5472');
 assert.equal(resolveBulkRows(source,players,{0:'1'})[0].status,'approved');
 assert.equal(resolveBulkRows(source,players,{0:'skip'})[0].status,'skip');
});

test('exact match within selected alliance can be preselected',()=>{
 const rows=resolveBulkRows(parseBulkPlayers('Бакит Кыргыз,5049'),players,{}, {},'HOT');
 assert.equal(rows[0].status,'exact');
 assert.equal(rows[0].player.id,'4');
});

test('clearing edited troop power is missing, never zero',()=>{
 const rows=resolveBulkRows(parseBulkPlayers('Бакит Кыргыз,5049'),players,{}, {0:''},'HOT');
 assert.equal(rows[0].power,null);
});

test('duplicate exact usernames are never automatically selected',()=>{
 const roster=[...players,{id:'5',name:'Бакит Кыргыз',alliance:'HOT'}];
 const rows=resolveBulkRows(parseBulkPlayers('Бакит Кыргыз,5049'),roster,{}, {},'HOT');
 assert.equal(rows[0].status,'review');
 assert.equal(rows[0].player,null);
});
test('previous username alias requires review even when identical',()=>{
 const rows=resolveBulkRows(parseBulkPlayers('OldRKG,5049'),players,{}, {},'HOT');
 assert.equal(rows[0].status,'review');
});
