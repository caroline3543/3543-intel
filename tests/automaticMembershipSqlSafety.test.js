import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../database/3573_automatic_membership_worker_functions.sql',import.meta.url),'utf8');
test('worker SQL functions use paired dollar quotes',()=>{
 const opens=(sql.match(/as \$\$/g)||[]).length;
 const closes=(sql.match(/end \$\$;/g)||[]).length;
 assert.equal(opens,4);
 assert.equal(closes,4);
 assert.doesNotMatch(sql,/as \$\s*\n/);
});
test('lease UUID generation uses a built-in PostgreSQL function',()=>{
 assert.match(sql,/pg_catalog\.gen_random_uuid\(\)/);
});

test('transfer ledger only records state changes crossing 3573',()=>{
 const commit=readFileSync(new URL('../database/3573_membership_atomic_commit.sql',import.meta.url),'utf8');
 assert.match(commit,/if v_old_state<>p_state and \(v_old_state='3573' or p_state='3573'\) then/);
});
