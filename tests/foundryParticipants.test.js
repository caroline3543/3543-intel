// Foundry / Canyon Clash participant integration: squad balancing, Legion siblings,
// substitutes and attendance summaries. Pure services only, synthetic data.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {balanceSquads,squadTotalPower,powerSpread} from '../src/services/squadBalancerService.js';
import {findSiblingLegionEvent,legionColor,evSum,noShowStreak,recentMisses} from '../src/services/eventListHelpers.js';
import {TROOP_POWER_EVENTS} from '../src/utils/constants.js';

const P=(id,power)=>({id,username:id,power});
const getPower=p=>p.power??null;
const ids=r=>r.squads.flatMap(s=>[s.leaderId,...s.memberIds]).filter(Boolean).sort();

test('Foundry and Canyon Clash are the troop-power (squad) events',()=>{
 assert.deepEqual([...TROOP_POWER_EVENTS].sort(),['Canyon Clash','Foundry']);
});

test('every participant lands in exactly one squad, leaders anchor their own squad',()=>{
 const ps=[P('L1',90),P('L2',80),P('a',70),P('b',60),P('c',50),P('d',40),P('e',null),P('f',null)];
 const r=balanceSquads(ps,['L1','L2'],2,getPower);
 assert.deepEqual(ids(r),ps.map(p=>p.id).sort());
 assert.equal(new Set(ids(r)).size,ps.length,'no duplicates');
 assert.equal(r.squads[0].leaderId,'L1');assert.equal(r.squads[1].leaderId,'L2');
 assert.equal(r.noPowerCount,2);
});

test('greedy balance keeps the power spread small and is deterministic',()=>{
 const ps=Array.from({length:30},(_,i)=>P('p'+i,1000-i*17));
 const a=balanceSquads(ps,[],3,getPower),b=balanceSquads(ps,[],3,getPower);
 assert.deepEqual(a,b,'same input, same squads');
 const spread=powerSpread(a.squads,ps,getPower),max=Math.max(...ps.map(getPower));
 assert.ok(spread<=max,`spread ${spread} should not exceed one player's power ${max}`);
 for(const s of a.squads)assert.equal(squadTotalPower(s,ps,getPower),s.totalPower);
});

test('players without recorded power are spread round-robin to keep headcounts even',()=>{
 const ps=[P('a',null),P('b',null),P('c',null),P('d',null)];
 const r=balanceSquads(ps,[],2,getPower);
 assert.deepEqual(r.squads.map(s=>s.memberIds.length),[2,2]);
});

// Not reachable from the UI today (SquadBalancerPanel.toggleLeader caps leaders at teamCount),
// but the service silently drops extra leaders. Tracked as a todo until the service is hardened.
test('more leaders than squads: extra leaders are not silently dropped',{todo:'harden balanceSquads against leaders > teamCount'},()=>{
 const ps=[P('L1',10),P('L2',9),P('L3',8)];
 const r=balanceSquads(ps,['L1','L2','L3'],2,getPower);
 assert.ok(ids(r).includes('L3'),'third leader must still be placed in a squad');
});

test('Legion 1/2 events on the same date and type are siblings with distinct colours',()=>{
 const l1={id:'e1',type:'Foundry',date:'2026-10-25',legion:1},l2={id:'e2',type:'Foundry',date:'2026-10-25',legion:2};
 const other={id:'e3',type:'Foundry',date:'2026-11-01',legion:2};
 assert.equal(findSiblingLegionEvent(l1,[l1,l2,other])?.id,'e2');
 assert.equal(findSiblingLegionEvent({...l1,legion:null},[l1,l2]),null);
 assert.ok(legionColor('Foundry',1)&&legionColor('Foundry',2));
 assert.notEqual(legionColor('Foundry',1),legionColor('Foundry',2));
 assert.equal(legionColor('Bear Trap',1),null);
});

test('attendance summary counts only current participants (removed players do not inflate totals)',()=>{
 const ev={status:'completed',participantIds:['a','b'],snapshots:[
  {playerId:'a',attendance:{attended:true}},{playerId:'b',attendance:{noShow:true,excused:true}},{playerId:'gone',attendance:{attended:true}}]};
 assert.deepEqual(evSum(ev),{total:2,attended:1,noShow:1,excused:1,voice:0});
});

test('no-show streaks are per event type, excused absences neither extend nor break them',()=>{
 const mk=(id,date,type,att)=>({id,date,type,status:'completed',snapshots:[{playerId:'a',attendance:att}]});
 const events=[mk('1','2026-10-01','Foundry',{noShow:true}),mk('2','2026-10-08','Foundry',{noShow:true,excused:true}),
  mk('3','2026-10-15','Foundry',{noShow:true}),mk('4','2026-10-16','Canyon Clash',{attended:true})];
 assert.equal(noShowStreak('a','Foundry',null,events),2);
 assert.equal(noShowStreak('a','Canyon Clash',null,events),0);
 assert.equal(recentMisses('a','Foundry',null,events).missed.length,2);
});
