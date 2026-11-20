import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../database/3573_automatic_membership_worker_functions.sql',import.meta.url),'utf8');
test('worker SQL functions use paired dollar quotes',()=>{
 const opens=(sql.match(/as \\$\\$/g)||[]).length;
 const closes=(sql.match(/end \\$\\$;/g)||[]).length;
 assert.equal(opens,4);
 assert.equal(closes,4);
 assert.doesNotMatch(sql,/as \\$\\s*\\n/);
});
test('lease UUID generation uses a built-in PostgreSQL function',()=>{
 assert.match(sql,/pg_catalog\\.gen_random_uuid\\(\\)/);
});
