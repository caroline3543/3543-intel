import test from 'node:test';
import assert from 'node:assert/strict';
import {parseRosterPaste} from './parseRosterPaste.js';
for(const delimiter of ['\t','|']) test('grouped power with '+JSON.stringify(delimiter),()=>{const result=parseRosterPaste('Alice'+delimiter+'443,581,938',1);assert.deepEqual(result.errors,[]);assert.equal(result.rows[0].name,'Alice');assert.equal(result.rows[0].power,443581938);});

test('blank usernames preserve power, legion and registration for review',()=>{
 const result=parseRosterPaste('Username\tTroop power\tLegion\tRegistration\nFrankie\t516765645\t1\tCombatant\n\t1016736711\t1\tCombatant\n\t408575064\t1\tSubstitute',1);
 assert.deepEqual(result.errors,[]);
 assert.deepEqual(result.rows.map(r=>[r.name,r.power,r.legion,r.registration]),[['Frankie',516765645,1,'combatant'],['',1016736711,1,'combatant'],['',408575064,1,'substitute']]);
});
