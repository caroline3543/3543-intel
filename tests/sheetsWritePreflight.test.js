import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../supabase/functions/sheets-write-preflight/index.ts',import.meta.url),'utf8');
test('Write preflight is owner-only, state-scoped and read-only',()=>{
 assert.ok(source.includes('user?.id!==OWNER'));
 assert.ok(source.includes(".eq('state_id',state)"));
 assert.ok(source.includes("linked?.spreadsheet_id!==id"));
 assert.ok(source.includes('writeEnabled:false'));
 assert.ok(!source.includes('method:\'PUT\''));
 assert.ok(!source.includes('values:batchUpdate'));
});
test('Write preflight checks Google identity and proposed cells again',()=>{
 assert.ok(source.includes('valueRenderOption=UNFORMATTED_VALUE'));
 assert.ok(source.includes('fid===String(proposal.fid'));
 assert.ok(source.includes('rowState===state'));
 assert.ok(source.includes('unchanged=current===proposal.expected.trim()'));
 assert.ok(source.includes('Worksheet exceeds safe review limit'));
 assert.ok(source.includes('Duplicate proposed cell'));
});
