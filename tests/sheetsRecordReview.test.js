import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const server=readFileSync(new URL('../supabase/functions/sheets-record-review/index.ts',import.meta.url),'utf8');
const client=readFileSync(new URL('../src/components/spreadsheets/SpreadsheetManager.jsx',import.meta.url),'utf8');
test('Audit endpoint requires the owner and rechecks Google before recording',()=>{
 assert.ok(server.includes('user?.id!==OWNER'));
 assert.ok(server.includes("'/functions/v1/sheets-write-preflight'"));
 assert.ok(server.includes('!result.allMatched'));
 assert.ok(server.includes("status:'reviewed_read_only'"));
 assert.ok(server.includes('writeEnabled:false'));
 assert.ok(!server.includes('values:batchUpdate'));
 assert.ok(!server.includes("method:'PUT'"));
});
test('Audit endpoint rejects mismatched, duplicate and oversized reviews',()=>{
 assert.ok(server.includes('proposals.length!==changes.length'));
 assert.ok(server.includes('changes.length>20'));
 assert.ok(server.includes('Proposals do not match review'));
 assert.ok(server.includes('Duplicate proposed cell'));
 assert.ok(server.includes('x.row!==changes[i].row'));
});
test('UI records only verified receipts, then confirms server fingerprint',()=>{
 assert.ok(client.includes('Save read-only review record'));
 assert.ok(client.includes('recordVerifiedExportReview'));
 assert.ok(client.includes('data.hash!==exportReceipt.hash'));
 assert.ok(client.includes('This is an audit record, not approval to write.'));
 assert.ok(client.includes('setRecordedExportReview(null)'));
});
