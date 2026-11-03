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

test('Saved review history is read-only and state scoped',()=>{
 assert.ok(client.includes(".from('spreadsheet_export_reviews')"));
 assert.ok(client.includes(".eq('state_id',String(stateId))"));
 assert.ok(client.includes('Saved review history'));
 assert.ok(client.includes('Load recent reviews'));
 const sql=readFileSync(new URL('../supabase/migrations/20261103053759_spreadsheet_export_review_audit_read_only.sql',import.meta.url),'utf8');
 assert.ok(sql.includes('enable row level security'));
 assert.ok(sql.includes('grant select on public.spreadsheet_export_reviews to authenticated'));
 assert.ok(sql.includes('using ((select auth.uid())=owner_user_id)'));
 assert.ok(!sql.includes('grant insert on public.spreadsheet_export_reviews to authenticated'));
});
