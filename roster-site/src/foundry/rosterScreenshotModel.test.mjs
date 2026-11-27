import test from 'node:test';
import assert from 'node:assert/strict';
import * as m from './rosterScreenshotModel.js';
test('power formats',()=>{for(const [input,expected] of [['15,630',15630],['4.2M',4200000],['invalid',null],['1,23',null]])assert.equal(m.readScreenshotPower(input),expected)});
test('legion ambiguity',()=>{assert.equal(m.readScreenshotLegion('Legion 1 Combatants'),1);assert.equal(m.readScreenshotLegion('Legion 1 Combatants Legion 2 Combatants'),null)});
test('other legion retained',()=>assert.deepEqual(m.readScreenshotRow('DopaMin\n11137\nLegion 2 dispatched'),{name:'DopaMin',power:11137,otherLegion:2}));
test('multiline totals',()=>assert.deepEqual(m.readRegistrationTotals('Join\n30/30\nSubstitute\n10/10'),{combatant:{count:30,limit:30},substitute:{count:10,limit:10}}));
test('overlap preserves power conflict',()=>assert.deepEqual(m.combineScreenshotRows([{rows:[{name:'A',power:10}]},{rows:[{name:'A',power:10,powerConflict:[10,11]}]}])[0].powerConflict,[10,11]));
test('different powers remain separate',()=>assert.ok(m.combineScreenshotRows([{rows:[{name:'A',power:10},{name:'A',power:11}]}]).every(r=>r.conflict)));
test('inconsistent totals never guessed',()=>assert.equal(m.registrationCountReview([{totals:{combatant:{count:30}}},{totals:{combatant:{count:29}}}],[])[0].expected,null));

import {createScreenshotMatcher} from './screenshotImportPlan.js';
test('cross-alliance current username collision is never automatically accepted',()=>{
 const players=[{id:'arc-1',name:'Northvale',alliance:'ARC'},{id:'hot-1',name:'Northvale',alliance:'HOT'}];
 const match=createScreenshotMatcher(players,'ARC',['arc-1'],['arc-1'])('Northvale');
 assert.equal(match.player,null);assert.equal(match.suggested,null);
 assert.deepEqual(new Set(match.candidates.map(p=>p.id)),new Set(['arc-1','hot-1']));
});
test('cross-alliance OCR lookalike remains advisory even with a registered local player',()=>{
 const players=[{id:'arc-1',name:'Northvale',alliance:'ARC'},{id:'hot-1',name:'Northva1e',alliance:'HOT'}];
 const match=createScreenshotMatcher(players,'ARC',['arc-1'],['arc-1'])('Northva1e');
 assert.equal(match.player,null);assert.equal(match.suggested,null);
 assert.ok(match.candidates.some(p=>p.id==='hot-1'));
});
