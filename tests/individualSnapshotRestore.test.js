import test from 'node:test';
import assert from 'node:assert/strict';
import {proposeSnapshotRestores,applySnapshotRestore} from '../src/services/eventCloudComparison.js';
const local={id:'e',participantIds:['p'],squads:[{id:'s'}],snapshots:[{snapshotId:'local',playerId:'p',troopPower:100}]};
const cloud={...local,snapshots:[{snapshotId:'cloud',playerId:'p',troopPower:200}]};
test('selective restore preserves squads',()=>{const proposal=proposeSnapshotRestores(local,cloud)[0];const updated=applySnapshotRestore(local,proposal);assert.equal(updated.snapshots[0].troopPower,200);assert.deepEqual(updated.squads,local.squads);});
