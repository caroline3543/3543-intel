import test from 'node:test';import assert from 'node:assert/strict';import {compareEventCopies} from '../src/services/eventCloudComparison.js';
const base={id:'one',name:'Foundry',participantIds:['p1','p2'],snapshots:[{playerId:'p1',troopPower:100}],squads:[{id:'s1',memberIds:['p1']}]};
test('no changes to matching event backup',()=>assert.equal(compareEventCopies(base,structuredClone(base)).unchanged,true));
test('restore summary shows added and removed participants, changed snapshots and squads',()=>{const x=compareEventCopies(base,{...base,participantIds:['p2','p3'],snapshots:[{playerId:'p1',troopPower:200}],squads:[]});assert.equal(x.added,1);assert.equal(x.removed,1);assert.equal(x.changedSnapshots,1);assert.equal(x.changedSquads,true)});
test('rejects mismatched event identity',()=>assert.throws(()=>compareEventCopies(base,{id:'other'}),/identity/));
