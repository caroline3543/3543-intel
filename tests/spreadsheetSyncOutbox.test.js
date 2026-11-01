import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalJobKey,makeSyncJobs,retryDelayMs,shouldRetry} from '../src/services/spreadsheetSyncOutbox.js';
const base={connectionId:'conn',mappingId:'map',revision:8};
test('same change yields same idempotency key',()=>{
 const item={...base,recordId:'p1',fieldKey:'availability',direction:'db_to_sheet'};
 assert.equal(canonicalJobKey(item),canonicalJobKey(item));
 assert.notEqual(canonicalJobKey(item),canonicalJobKey({...item,revision:9}));
});
test('jobs include expected values and never enqueue conflicts',()=>{
 const op={recordId:'p1',fieldKey:'availability',sheetRange:"'Roster'!C4",action:'write_sheet',
 value:'12 UTC',expectedDatabase:'12 UTC',expectedSheet:'Unknown'};
 const jobs=makeSyncJobs({...base,operations:[op]});
 assert.equal(jobs[0].direction,'db_to_sheet');
 assert.equal(jobs[0].payload.expected_sheet,'Unknown');
 assert.throws(()=>makeSyncJobs({...base,operations:[{...op,action:'conflict'}]}));
});
test('throttled and server errors retry, invalid requests do not',()=>{
 assert.equal(shouldRetry(429,1),true);
 assert.equal(shouldRetry(503,2),true);
 assert.equal(shouldRetry(403,1),false);
 assert.equal(shouldRetry(503,6),false);
 assert.ok(retryDelayMs(3,0.5)>retryDelayMs(2,0.5));
});
