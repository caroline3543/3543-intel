import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePastedRoster} from './rosterScreenshotModel.js';
test('paste supports multilingual names and formatted powers',()=>{
 const result=parsePastedRoster('Jessie Reyes, 443,581,938\n玩家 — 443.58M\nBob\t114200');
 assert.equal(result.error,'');
 assert.deepEqual(result.rows.map(r=>r.power),[443581938,443580000,114200]);
 assert.ok(result.rows.every(r=>r.registration==='unknown'&&r.evidence.length===0));
});
test('invalid power blocks entire batch',()=>{
 for(const value of ['Alice, -1','Alice, unknown','Alice, 1.2','Alice, 9007199254740992']){
  const result=parsePastedRoster('Bob, 100\n'+value);
  assert.ok(result.error);
  assert.equal(result.rows.length,0);
 }
});
test('duplicate names remain separate for shared identity validation',()=>{
 const result=parsePastedRoster('Alice, 100\nAlice, 200');
 assert.equal(result.rows.length,2);
 assert.notEqual(result.rows[0].rowId,result.rows[1].rowId);
});
test('empty and oversized batches rejected',()=>{
 assert.ok(parsePastedRoster(' ').error);
 assert.ok(parsePastedRoster(Array(101).fill('Alice, 100').join('\n')).error);
});
