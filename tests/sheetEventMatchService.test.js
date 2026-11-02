import test from 'node:test';import assert from 'node:assert/strict';
import {proposeSheetEventPower,applySheetEventPowerProposal} from '../src/services/sheetEventMatchService.js';
const event={id:'evt1',name:'Foundry',type:'Foundry',date:'2026-11-05',participantIds:['p1'],snapshots:[{snapshotId:'s1',playerId:'p1',troopPower:null,rsvp:{participating:true}}]};
const player={id:'p1',username:'Test',sheetEvents:{'evt1|2026-11-05':{'Event Troop Power':123456}}};
test('approved update changes only power and preserves RSVP',()=>{const r=proposeSheetEventPower({events:[event],players:[player]});assert.equal(r.proposals.length,1);const updated=applySheetEventPowerProposal(event,r.proposals[0]);assert.equal(updated.snapshots[0].troopPower,123456);assert.equal(updated.snapshots[0].rsvp.participating,true);assert.equal(event.snapshots[0].troopPower,null)});
test('unknown event or wrong date cannot apply',()=>{const r=proposeSheetEventPower({events:[event],players:[{...player,sheetEvents:{'evt1|2026-11-06':{'Event Troop Power':100}}}]});assert.equal(r.proposals.length,0);assert.equal(r.conflicts.length,1)});
test('existing conflicting power blocks write',()=>{const changed={...event,snapshots:[{...event.snapshots[0],troopPower:444}]};const r=proposeSheetEventPower({events:[changed],players:[player]});assert.equal(r.proposals.length,0);assert.equal(r.conflicts.length,1)});
test('player must already participate',()=>{const r=proposeSheetEventPower({events:[{...event,participantIds:[]}],players:[player]});assert.equal(r.proposals.length,0)});

test('unsupported event type cannot receive spreadsheet troop power',()=>{const r=proposeSheetEventPower({events:[{...event,type:'SvS Castle Battle'}],players:[player]});assert.equal(r.proposals.length,0);assert.equal(r.conflicts.length,1)});
