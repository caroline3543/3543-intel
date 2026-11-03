import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const edge=readFileSync(new URL('../supabase/functions/sheets-approve-review/index.ts',import.meta.url),'utf8');
const sheet=readFileSync(new URL('../src/components/spreadsheets/SpreadsheetManager.jsx',import.meta.url),'utf8');
const sql=readFileSync(new URL('../supabase/migrations/20261104013000_spreadsheet_export_approval_audit_only.sql',import.meta.url),'utf8');
test('Approval requires explicit confirmation and owner identity, but never writes to Google',()=>{
 assert.ok(edge.includes("user?.id!==OWNER"));
 assert.ok(edge.includes("input.confirmation!=='APPROVE READ-ONLY REVIEW'"));
 assert.ok(edge.includes("'/functions/v1/sheets-write-preflight'"));
 assert.ok(edge.includes('Google data changed or verification failed'));
 assert.ok(edge.includes("status:'approved_not_executed'"));
 assert.ok(edge.includes('googleModified:false'));
 assert.ok(edge.includes('writeEnabled:false'));
 assert.ok(!edge.includes('values:batchUpdate'));
 assert.ok(!edge.includes("method:'PUT'"));
});
test('Approval is bound to a saved review and exact live-verified cells',()=>{
 assert.ok(edge.includes(".eq('owner_user_id',user.id)"));
 assert.ok(edge.includes('c.expected!==p.expected'));
 assert.ok(edge.includes('c.value!==p.value'));
 assert.ok(edge.includes('x.row!==changes[i].row'));
 assert.ok(edge.includes('Review expired'));
 assert.ok(edge.includes("insertError.code==='23505'"));
});
test('Approval audit table has owner-only read access, no direct authenticated writes',()=>{
 assert.ok(sql.includes('enable row level security'));
 assert.ok(sql.includes('grant select on public.spreadsheet_export_approvals to authenticated'));
 assert.ok(sql.includes('(select auth.uid()) = owner_user_id'));
 assert.ok(sql.includes("check (status = 'approved_not_executed')"));
 assert.ok(!sql.includes('grant insert on public.spreadsheet_export_approvals to authenticated'));
});
test('UI clearly labels approval as no-write and requires confirmation',()=>{
 assert.ok(sheet.includes('Approve reviewed changes (no Google write)'));
 assert.ok(sheet.includes("window.confirm('Record your approval"));
 assert.ok(sheet.includes("'/functions/v1/sheets-approve-review'"));
 assert.ok(sheet.includes('No Google changes were made.'));
 assert.ok(sheet.includes('setExportApproval(null)'));
});
