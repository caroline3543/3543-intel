import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parsePower,comparePlayers,teamPower,powerPastePreview,targetGap} from '../roster-site/src/tal/power.js';
import {newPlan,createTeam,planText} from '../roster-site/src/tal/planner.js';
const players=[{id:'a',fid:'12345',username:'Alice',allianceRank:'R5',power:10},{id:'b',fid:'23456',username:'Bob',allianceRank:'R4',power:999},{id:'c',fid:'34567',username:'Cara',allianceRank:'R4',power:55},{id:'d',fid:'45678',username:'Dan'}];
const plan={...newPlan(),records:{a:{troopPower:'3179'},b:{troopPower:'8643'},c:{troopPower:'5890'},d:{troopPower:''}},teams:[]};
test('power parsing preserves zero and missing, supports grouping and suffixes, rejects malformed values',()=>{
 for(const [input,n] of [['',null],['0',0],['3,179',3179],['123.4M',123400000],['2k',2000]])assert.equal(parsePower(input),n);
 for(const input of ['-1','12,34','0.1','2cats','Infinity','9007199254740992'])assert.throws(()=>parsePower(input));
});
test('game order ranks R5 to R1 before troop power and leaves unknown last; city power stays separate',()=>{
 assert.deepEqual([...players].sort(comparePlayers(plan,'game')).map(p=>p.id),['a','b','c','d']);
 assert.deepEqual([...players].sort(comparePlayers(plan)).map(p=>p.id),['b','c','a','d']);
 assert.deepEqual([...players].sort(comparePlayers(plan,'city')).map(p=>p.id),['b','c','a','d']);
});
test('planned and registered top20 include substitutes, exclude missing and count completed players',()=>{
 const ps=Array.from({length:23},(_,i)=>({id:String(i)}));const records=Object.fromEntries(ps.map((p,i)=>[p.id,{troopPower:i===22?'':String(i+1)}]));
 const team={members:ps.map((p,i)=>({id:p.id,role:i>15?'substitute':'combatant',registered:i>2}))};
 const result=teamPower({...plan,records},team,ps);assert.equal(result.planned,250);assert.equal(result.confirmed,247);assert.equal(result.total,253);assert.equal(result.missing,1);assert.equal(result.registeredMissing,1);
 assert.equal(targetGap(90,100),'10 below target');assert.equal(targetGap(100,100),'Target reached');
});
test('paste resolves IDs, names and past names but blocks ambiguity, duplicate rows and malformed values',()=>{
 const ps=[...players.map(p=>({...p,pastUsernames:p.id==='a'?['Past Alice']:[]})),{id:'z',fid:'98765',username:'Bob'}];
 const preview=powerPastePreview('12345\t3,179\nCara 5,890\nPast Alice,8,643\nBob 555\nNobody 100\n45678\t-10',ps,plan);
 assert.match(preview[0].error,/twice/);assert.equal(preview[1].value,5890);assert.match(preview[2].error,/twice/);assert.match(preview[3].error,/more than one/);assert.ok(preview[4].error);assert.ok(preview[5].error);
 assert.equal(powerPastePreview('12345,3,179',players,plan)[0].value,3179);
});
test('new teams have target field and shared text no longer exposes saved building assignments',()=>{
 const team={...createTeam('HOT'),members:[{id:'a',role:'combatant',building:'Boiler Room'}]};assert.equal(team.targetPower,'');assert.ok(!planText({...plan,teams:[team]},players).includes('Boiler Room'));
});
test('Excel export includes power totals and targets and omits building columns',async()=>{
 const {buildTalWorkbook}=await import('../roster-site/src/tal/export.js');
 const XLSX=await import('xlsx');
 const team={...createTeam('HOT'),targetPower:'20000',members:[{id:'a',role:'combatant',registered:true},{id:'b',role:'substitute',registered:false,building:'Boiler Room'}]};
 const wb=buildTalWorkbook({...plan,teams:[team]},players);
 const assignments=XLSX.utils.sheet_to_json(wb.Sheets.Assignments,{header:1});
 assert.ok(!assignments[0].includes('Initial building'));assert.ok(assignments[0].includes('TAL troop power'));
 const legions=XLSX.utils.sheet_to_json(wb.Sheets.Legions,{header:1});
 const row=Object.fromEntries(legions[0].map((k,i)=>[k,legions[1][i]]));
 assert.equal(row['Planned top 20 power'],11822);assert.equal(row['Confirmed top 20 power'],3179);assert.equal(row['Target power'],20000);assert.equal(row['Planned target gap'],'8,178 below target');
});
