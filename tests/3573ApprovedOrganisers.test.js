import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(new URL('../database/3573_approved_organisers_review_only.sql',import.meta.url),'utf8');
test('explicit organiser approval is keyed to authenticated user IDs',()=>{
 assert.match(sql,/user_id uuid primary key references auth\.users\(id\)/i);
 assert.match(sql,/approved_at timestamptz/i);
 assert.match(sql,/revoked_at timestamptz/i);
});
test('organiser allowlist is private and has no anonymous or authenticated table privileges',()=>{
 assert.match(sql,/revoke all on schema app_private from public, anon, authenticated/i);
 assert.match(sql,/revoke all on app_private\.state3573_profile_editors from public, anon, authenticated/i);
});
test('review-only SQL never grants direct player updates or broadens RLS',()=>{
 const statements=sql.split(';').map(x=>x.replace(/--[^\n]*/g,'').trim()).filter(Boolean).join(';').toLowerCase();
 assert.doesNotMatch(statements,/create\s+policy|alter\s+policy|grant\s+update\s+on\s+(public\.)?players|insert\s+into\s+app_private\.state3573_profile_editors/);
});
