import {test} from 'node:test';
import assert from 'node:assert/strict';
import {moveMessageGroups,discordBlocks} from '../roster-site/src/tal/moveMessages.js';
import {newPlan,createTeam,suggest} from '../roster-site/src/tal/planner.js';
import {comparePlayers,top20Ids,teamPower} from '../roster-site/src/tal/power.js';
const players=[{id:'a',username:'zebra',allianceTag:'ARC',fid:'12345',providerRankings:{labyrinth:{stateId:'3573',rank:1,score:999}}},{id:'b',username:'Alice',allianceTag:'HOT',fid:'23456',providerRankings:{labyrinth:{stateId:'3573',rank:10,score:500}}},{id:'c',username:'맥주는 얼굴에 양보 Choco',allianceTag:'HOT',fid:'34567'}];
const team={...createTeam('HOT'),slots:['12:00','14:00','19:00'],members:players.map(p=>({id:p.id,role:'combatant'}))};
const plan={...newPlan(),teams:[team],records:{a:{homeAlliance:'HOT',troopPower:'100',times:['12:00'],status:'available'},b:{homeAlliance:'ARC',troopPower:'200',times:['12:00','14:00'],status:'available'},c:{homeAlliance:'HOT',troopPower:'',times:['14:00'],status:'available'}}};
test('move messages group original home to destination legion including stays, times and Unicode',()=>{
 const groups=moveMessageGroups(plan,players);assert.equal(groups.length,2);
 assert.ok(groups.find(g=>g.home==='HOT').text.includes('HOT players staying in HOT for Legion 1'));
 assert.ok(groups.find(g=>g.home==='ARC').text.includes('ARC players going to HOT for Legion 1'));
 assert.ok(groups[0].text.includes('12:00 UTC, 14:00 UTC, 19:00 UTC'));
 const all=groups.flatMap(g=>g.players.map(p=>p.id));assert.deepEqual([...all].sort(),['a','b','c']);
 assert.ok(groups.find(g=>g.home==='HOT').text.includes(players[2].username));
});
test('Discord blocks split long groups safely and protect embedded code fences',()=>{
 const ps=Array.from({length:100},(_,i)=>({id:String(i),username:`Player ${String(i).padStart(3,'0')} ${'x'.repeat(35)}`,allianceTag:'HOT'}));ps[0].username='```Backticks';
 const group=moveMessageGroups({...newPlan(),teams:[{...team,members:ps.map(p=>({id:p.id}))}]},ps)[0];
 const blocks=discordBlocks(group);assert.ok(blocks.length>1);assert.ok(blocks.every(b=>b.length<2000));assert.ok(blocks.every(b=>b.startsWith('```\n')&&b.endsWith('\n```')));assert.ok(blocks.every(b=>!b.slice(4,-4).includes('```')));
 assert.ok(blocks.join('\n').includes('Player 099'));
});
test('Labyrinth rank wins over troop and city power, missing ranks sort last',()=>{
 assert.deepEqual([...players].sort(comparePlayers(plan,'labyrinth')).map(p=>p.id),['a','b','c']);
 const scoped={id:'wrong',providerRankings:{labyrinth:{stateId:'3543',rank:1,score:9999}}};
 assert.ok(comparePlayers(plan,'labyrinth')(players[1],scoped)<0);
});
test('suggestions keep availability first and use Labyrinth for equally available players',()=>{
 const ps=Array.from({length:31},(_,i)=>({id:String(i),username:`P${i}`,providerRankings:{labyrinth:{stateId:'3573',rank:i+1,score:100-i}}}));
 const records=Object.fromEntries(ps.map((p,i)=>[p.id,{status:'available',times:['02:00','07:00','12:00'],troopPower:String(i*1000)}]));
 const next=suggest({...newPlan(),records,teams:[{...createTeam('HOT'),slots:['02:00','07:00','12:00']}]},ps);
 assert.equal(next.teams[0].members[0].id,'0');assert.equal(next.teams[0].members.find(m=>m.id==='30').role,'substitute');
});
test('availability power sums only available assigned players and top20 badges use recorded troop power',()=>{
 const at=team.members.filter(m=>plan.records[m.id].status==='available'&&plan.records[m.id].times.includes('12:00'));
 const stats=teamPower(plan,{...team,members:at},players);assert.equal(stats.total,300);assert.equal(stats.planned,300);assert.equal(stats.missing,0);
 assert.deepEqual([...top20Ids(plan,team,players)],['b','a']);
});
