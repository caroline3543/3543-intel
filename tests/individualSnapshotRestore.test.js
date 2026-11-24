import test from 'node:test';
import assert from 'node:assert/strict';
import {proposeSnapshotRestores,applySnapshotRestore} from '../src/services/eventCloudComparison.js';
const local={id:'e',participantIds:['p'],squads:[{id:'s'}],snapshots:[{snapshotId:'local',playerId:'p',troopPower:100}]};
const cloud={...local,snapshots:[{snapshotId:'cloud',playerId:'p',troopPower:200}]};
test('selective restore preserves squads',()=>{const proposal=proposeSnapshotRestores(local,cloud)[0];const updated=applySnapshotRestore(local,proposal);assert.equal(updated.snapshots[0].troopPower,200);assert.deepEqual(updated.squads,local.squads);});

test('restore preview identifies only changed fields', async()=>{const {describeSnapshotChanges}=await import('../src/services/eventCloudComparison.js');assert.deepEqual(describeSnapshotChanges({troopPower:100,rsvp:{participating:true}},{troopPower:200,rsvp:{participating:true}}),['Troop power']);});
test('snapshot modified after review cannot be replaced',()=>{const proposal=proposeSnapshotRestores(local,cloud)[0];const changed={...local,snapshots:[{...local.snapshots[0],troopPower:999}]};assert.throws(()=>applySnapshotRestore(changed,proposal),/changed/);});

test('release guard: production origin is allowed by spreadsheet write endpoints',async()=>{const {readFileSync}=await import('node:fs');for(const endpoint of ['sheets-create-workbook','sheets-apply-troop-import']){const source=readFileSync(new URL('../supabase/functions/'+endpoint+'/index.ts',import.meta.url),'utf8');assert.match(source,/https:\/\/3543-intel\.vercel\.app/);}});

test('Events import date guard accepts numeric ISO dates',async()=>{const {readFileSync}=await import('node:fs');const source=readFileSync(new URL('../src/components/spreadsheets/SpreadsheetManager.jsx',import.meta.url),'utf8');assert.ok(source.includes(String.raw`/^\d{4}-\d{2}-\d{2}$/`));assert.ok(!source.includes(String.raw`/^\\d{4}-\\d{2}-\\d{2}$/`));});
