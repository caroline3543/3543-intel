import test from 'node:test';
import assert from 'node:assert/strict';
import {battleStatus,matchRoster,readinessForMatch} from '../src/services/talMatchReadiness.js';
import {plannedMemberIds,legionLabel} from '../src/services/talRosterService.js';

const team={id:'HOT:1',host:'HOT',legion:1,matchTime:'19:00',members:[
 {id:'one',role:'combatant'},{id:'two',role:'combatant'},{id:'three',role:'substitute'}]};
const config={availability:{one:['19:00','14:00'],two:['12:00'],three:['19:00']}};
const player=(id,tag)=>({id,username:id,providerStats:{retrievedAt:'2026-11-08T00:00:00.000Z',allianceTag:tag}});
const players=[player('one','HOT'),player('two','ARC'),player('three','RKG')];

test('legion IDs accept saved object records and legacy string IDs',()=>{
 assert.deepEqual([...plannedMemberIds(team)],['one','two','three']);
 assert.deepEqual([...plannedMemberIds({...team,members:['one','two']})],['one','two']);
 assert.equal(legionLabel(team),'HOT Legion 1');
});

test('match roster defaults only the matching time to expected',()=>{
 const rows=matchRoster(team,config,players);
 assert.deepEqual(rows.map(r=>r.status),['attending','unknown','attending']);
 const ready=readinessForMatch(team,config,players);
 assert.equal(ready.pollYes,2);
 assert.equal(ready.attending,2);
 assert.equal(ready.correct,1);
 assert.equal(ready.needMove,1);
});

test('explicit battle-day choices override poll without mutating poll results',()=>{
 const updated={...team,battleAttendance:{one:'not-attending',two:'attending',three:'unknown'}};
 assert.equal(battleStatus(updated,config,'one'),'not-attending');
 assert.equal(battleStatus(updated,config,'two'),'attending');
 assert.equal(battleStatus(updated,config,'three'),'unknown');
 assert.deepEqual(config.availability.one,['19:00','14:00']);
});
