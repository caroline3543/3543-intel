import test from 'node:test';
import assert from 'node:assert/strict';
import {newFoundryPlan} from '../src/data/playerSchema.js';
import {battleSheet,validateFoundry} from '../src/services/foundryService.js';
import {mergeImportedData} from '../src/services/exportImportService.js';
test('Foundry export preserves Unicode, roles and phase instructions',()=>{
 const p=newFoundryPlan({date:'2026-10-18',time:'02:00'});
 p.teams[0].members=[{playerId:'a',role:'leader',note:'Defend'}];
 p.teams[0].targets[1]=['imperial'];p.teams[0].instructions[1]='Move after capture';
 const text=battleSheet(p,[{id:'a',username:'나다 • Салфетка',fid:'123',furnaceLevel:'FC7'}]);
 assert.match(text,/★ 나다 • Салфетка \(123\) · FC7 · Defend/);
 assert.match(text,/Centre contest: Imperial Foundry · Move after capture/);
 assert.deepEqual(validateFoundry(p),[]);
});
test('Foundry guards duplicate members and missing leaders',()=>{
 const p=newFoundryPlan();p.teams[0].members=[{playerId:'a',role:'joiner'}];p.teams[1].members=[{playerId:'a',role:'leader'}];
 assert.ok(validateFoundry(p).some(w=>w.includes('multiple')));
 assert.ok(validateFoundry(p).some(w=>w.includes('needs a rally leader')));
});
test('backup merge retains both plans and newer edits',()=>{
 const a={id:'a',updatedAt:'2026-10-18',title:'New'};
 const merged=mergeImportedData({players:[],events:[],svsPlans:[],foundryPlans:[a]}, {players:[],events:[],svsPlans:[],foundryPlans:[{...a,title:'Old',updatedAt:'2026-10-17'},{id:'b'}]});
 assert.equal(merged.foundryPlans.length,2);assert.equal(merged.foundryPlans[0].title,'New');
});

test('linked Foundry roster isolates legions and retains substitute status', async()=>{
 const {foundryEventRoster,withFoundryEvent}=await import('../src/services/foundryService.js');
 const event={id:'l2',type:'Foundry',legion:2,date:'2026-11-01',time:'18:00',participantIds:['a','b'],snapshots:[{playerId:'b',rsvp:{substitute:true}}]};
 const roster=foundryEventRoster(event,[{id:'a'},{id:'b'},{id:'otherLegion'}]);
 assert.deepEqual(roster.map(p=>p.id),['a','b']);assert.equal(roster[1].foundrySubstitute,true);
 assert.deepEqual(foundryEventRoster({...event,participantIds:[]},[{id:'a'}]),[]);
 const linked=withFoundryEvent(newFoundryPlan({eventId:'l2'}),[event]);
 assert.equal(linked.legion,'2');assert.equal(linked.date,'2026-11-01');assert.equal(linked.time,'18:00');
});
