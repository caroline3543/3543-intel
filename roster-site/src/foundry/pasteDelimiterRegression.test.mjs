import test from 'node:test';
import assert from 'node:assert/strict';
import {parseRosterPaste} from './parseRosterPaste.js';
for(const delimiter of ['\t','|']) test('grouped power with '+JSON.stringify(delimiter),()=>{const result=parseRosterPaste('Alice'+delimiter+'443,581,938',1);assert.deepEqual(result.errors,[]);assert.equal(result.rows[0].name,'Alice');assert.equal(result.rows[0].power,443581938);});
