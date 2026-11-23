import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../database/3573_approved_profile_rpc_review_only.sql',import.meta.url),'utf8');
const statements=sql.replace(/--[^\n]*/g,'').toLowerCase();
test('approved-organiser RPC checks private membership and revocation in both entrypoints',()=>{
 assert.equal((statements.match(/from app_private\.state3573_profile_editors/g)||[]).length,2);
 assert.equal((statements.match(/e\.revoked_at is null/g)||[]).length,2);
 assert.equal((statements.match(/auth\.uid\(\)/g)||[]).length>=4,true);
});
test('organiser updates are state-scoped, version guarded and field limited',()=>{
 assert.match(statements,/p\.state_id='3573' and p\.id=p_id/);
 assert.match(statements,/p\.updated_at=p_expected_updated_at/);
 assert.match(statements,/p\.alliance_tag/);
 for(const key of ['notes','joinerHeroes','teamworkTraitStates','communicationLanguage'])assert.ok(sql.includes("'"+key+"'"));
 assert.match(statements,/jsonb_object_keys\(p_changes\)/);
 assert.doesNotMatch(statements,/create\s+policy|alter\s+policy|grant\s+update\s+on\s+public\.players/);
});
test('public and anonymous RPC access is revoked',()=>{
 assert.match(statements,/revoke all on function public\.read_3573_profile_for_edit\(text\) from public,anon/);
 assert.match(statements,/revoke all on function public\.update_3573_profile_fields\(text,timestamptz,text,jsonb\) from public,anon/);
});
