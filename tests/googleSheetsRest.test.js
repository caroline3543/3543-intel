import test from 'node:test';
import assert from 'node:assert/strict';
import { assertSpreadsheetId, makeSheetRange, createGoogleSheetsClient } from '../src/services/googleSheetsRest.js';

const ID = '1fGK_RpX6KRWXeMLza0lxhjB8uBfJ5-m-MF4FHyVcqHc';
test('validates sheet IDs and escapes worksheet titles', () => {
  assert.equal(assertSpreadsheetId(ID), ID);
  assert.throws(() => assertSpreadsheetId('../private'));
  assert.equal(makeSheetRange("Officer's roster", 'A1:C50'), "'Officer''s roster'!A1:C50");
});
test('reads ranges using an injected token and mock transport', async () => {
  let called = false;
  const client = createGoogleSheetsClient({accessToken:'test-token', fetchImpl: async (url, opts)=>{
    called = true;
    assert.match(url, /values:batchGet/);
    assert.match(url, /ranges=/);
    assert.equal(opts.headers.Authorization, 'Bearer test-token');
    return {ok:true,json:async()=>({valueRanges:[]})};
  }});
  assert.deepEqual(await client.readRanges(ID, ["'Roster'!A1:B5"]), {valueRanges:[]});
  assert.equal(called,true);
});
test('writes only validated cell updates and uses RAW input', async () => {
  const client = createGoogleSheetsClient({accessToken:'test-token',fetchImpl:async (url,opts)=>{
    assert.match(url,/values:batchUpdate$/);
    const body=JSON.parse(opts.body);
    assert.equal(body.valueInputOption,'RAW');
    assert.deepEqual(body.data,[{range:"'Roster'!B4",values:[['12 UTC']]}]);
    return {ok:true,json:async()=>({totalUpdatedCells:1})};
  }});
  assert.equal((await client.writeRanges(ID,[{range:"'Roster'!B4",values:[['12 UTC']]}])).totalUpdatedCells,1);
  await assert.rejects(()=>client.writeRanges(ID,[{range:"'Roster'!A1:B3",values:[[1,2]]}]));
});
test('provider failures are retryable only for throttling or server errors', async () => {
  const client = createGoogleSheetsClient({accessToken:'token',fetchImpl:async()=>({ok:false,status:429})});
  await assert.rejects(()=>client.metadata(ID),e=>e.retryable===true && e.status===429);
});
