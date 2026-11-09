import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newPlan,createTeam,setRecord,suggest,placePlayer,unassign,coverage,readyIssues,teamIssues,record} from '../roster-site/src/tal/planner.js';
import {buildTalWorkbook} from '../roster-site/src/tal/export.js';
import * as XLSX from 'xlsx';
const people=(n,start=0)=>Array.from({length:n},(_,i)=>({id:String(start+i),fid:String(10000+start+i),username:'Player '+(start+i),allianceTag:i%2?'HOT':'ARC'}));
function available(plan,players,times){return players.reduce((p,player)=>setRecord(p,player,{status:'available',times}),plan);}
test('suggestions find different time triples for disjoint availability groups',()=>{
 const a=people(15),b=people(15,15),players=[...a,...b];let plan={...newPlan(),teams:[createTeam('ARC'),createTeam('RKG')]};plan=available(available(plan,a,['02:00','07:00','12:00']),b,['12:00','14:00','19:00']);
 const next=suggest(plan,players);assert.notDeepEqual(next.teams[0].slots,next.teams[1].slots);assert.equal(next.teams.flatMap(t=>t.members).length,30);assert.ok(next.teams.every(t=>t.members.length===15));
 for(const t of next.teams)assert.ok(coverage(next,t,players).every(c=>c.combatants===15));
});
test('suggestions preserve manual assignments, avoid duplicates and enforce 30/20 capacity',()=>{
 const players=people(160);let plan={...newPlan(),teams:[createTeam('ARC'),createTeam('HOT'),createTeam('RKG')]};plan=available(plan,players,plan.times);plan.teams[0].slots=plan.times.slice(0,3);plan=placePlayer(plan,players,'0','ARC:1','substitute');plan.teams[0].members[0].building='Boiler Room';
 const before=structuredClone(plan),next=suggest(plan,players),ids=next.teams.flatMap(t=>t.members.map(m=>m.id));assert.deepEqual(plan,before);assert.equal(new Set(ids).size,ids.length);assert.equal(ids.length,150);assert.equal(next.teams[0].members.find(m=>m.id==='0').role,'substitute');assert.equal(next.teams[0].members.find(m=>m.id==='0').building,'Boiler Room');
 for(const t of next.teams){assert.ok(t.members.filter(m=>m.role==='combatant').length<=30);assert.ok(t.members.filter(m=>m.role==='substitute').length<=20);}
});
test('pending, declined, blacklisted and one-time players are not assigned',()=>{
 const players=people(4);players[3].blacklisted=true;let plan={...newPlan(),teams:[createTeam('ARC')]};plan=setRecord(plan,players[0],{status:'available',times:['02:00']});plan=setRecord(plan,players[1],{status:'declined',times:plan.times});plan=setRecord(plan,players[3],{status:'available',times:plan.times});assert.equal(suggest(plan,players).teams[0].members.length,0);
});
test('manual moves and swaps preserve uniqueness, capture home alliance and reset registration on role change',()=>{
 const players=people(2);let plan={...newPlan(),teams:[{...createTeam('ARC'),slots:['02:00','07:00','12:00']},{...createTeam('RKG'),slots:['02:00','07:00','12:00']}]};plan=available(plan,players,plan.times);plan=placePlayer(plan,players,'0','ARC:1');plan=placePlayer(plan,players,'1','RKG:1','substitute');plan.teams[0].members[0].registered=true;
 const swapped=placePlayer(plan,players,'0','RKG:1','combatant','1');assert.equal(swapped.teams[0].members[0].id,'1');assert.equal(swapped.teams[1].members[0].id,'0');assert.equal(swapped.teams[1].members[0].role,'substitute');assert.equal(swapped.teams[1].members[0].registered,false);assert.equal(record(swapped,{...players[0],allianceTag:'RKG'}).homeAlliance,'ARC');
 const changed=placePlayer(plan,players,'0','ARC:1','substitute');assert.equal(changed.teams[0].members[0].registered,false);assert.equal(unassign(changed,'0').teams[0].members.length,0);
});
test('invalid move, over-capacity and locked edits fail without mutation',()=>{
 const players=people(32);let plan={...newPlan(),teams:[{...createTeam('ARC'),slots:planTimes()}]};plan=available(plan,players,plan.times);for(let i=0;i<30;i++)plan=placePlayer(plan,players,String(i),'ARC:1');const before=JSON.stringify(plan);assert.throws(()=>placePlayer(plan,players,'30','ARC:1'),/places/);assert.equal(JSON.stringify(plan),before);assert.throws(()=>placePlayer({...plan,locked:true},players,'30','ARC:1','substitute'),/Unlock/);
 function planTimes(){return ['02:00','07:00','12:00'];}
});
test('coverage and review flag weak times and registration prerequisites independently',()=>{
 const players=people(15);let plan={...newPlan(),teams:[{...createTeam('ARC'),slots:['02:00','07:00','12:00'],captain:'0'}]};plan=available(plan,players,['02:00','07:00']);for(const p of players)plan=placePlayer(plan,players,p.id,'ARC:1');assert.ok(teamIssues(plan,plan.teams[0],players).some(s=>s.includes('12:00: 0 available for combatant places')));assert.ok(readyIssues(plan,players).some(s=>s.includes('deadline')));assert.ok(readyIssues(plan,players).some(s=>s.includes('five battle times')));
});
test('Excel plan includes assignments, times and transfer list with text IDs',()=>{
 const players=people(1);players[0].fid='001234567890123456';let plan={...newPlan(),teams:[{...createTeam('RKG'),slots:['02:00','07:00','12:00']}]};plan=available(plan,players,plan.times);plan=placePlayer(plan,players,'0','RKG:1');const wb=buildTalWorkbook(plan,players),read=XLSX.read(XLSX.write(wb,{type:'buffer',bookType:'xlsx'}),{type:'buffer'});assert.deepEqual(read.SheetNames,['Assignments','Legions','Availability','Alliance moves']);assert.equal(read.Sheets.Assignments.B2.t,'s');assert.equal(read.Sheets.Assignments.B2.v,players[0].fid);assert.equal(XLSX.utils.sheet_to_json(read.Sheets['Alliance moves']).length,1);
});
