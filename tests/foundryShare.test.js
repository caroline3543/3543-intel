import test from 'node:test';
import assert from 'node:assert/strict';
import {foundryShareMessages,foundryMessageStats} from '../roster-site/src/foundry/foundryShare.js';

const names=['༺ŁΔĐ¥ ĐƗŇỮ༻','강인ㅇ_ㅇ','̶S̶H̶A̶D̶O̶WⒽⓄⓉ','&&Mohammed&&','︻デXAVI━─'];
test('three messages preserve Unicode usernames, positions and editable team names',()=>{
 const buildings={Blue:['Prototype Site I','Boiler Room'],Pink:['Repair Facility II','Repair Facility IV'],Green:['Repair Facility I','Repair Facility III'],Yellow:['Prototype Site II','Central Transit Station']};
 const colours=['Blue','Green','Green','Pink','Yellow'];
 const destinations=['Prototype Site I','Repair Facility I','Repair Facility III','Repair Facility II','Prototype Site II'];
 const active=names.map((name,id)=>({name,id:String(id)}));
 const teams=Object.fromEntries(active.map((p,i)=>[p.id,colours[i]]));
 const assignments=Object.fromEntries(active.map((p,i)=>[p.id,destinations[i]]));
 const messages=foundryShareMessages({teamNames:{Blue:'Azure'},buildings,active,teams,assignments,instructions:'Custom instructions'});
 assert.equal(messages.length,3);
 assert.match(messages[0][1],/AZURE · Top left/);
 assert.match(messages[0][1],/PINK · Top right/);
 assert.match(messages[1][1],/GREEN · Bottom left/);
 assert.match(messages[1][1],/YELLOW · Bottom right/);
 for(const name of names)assert.equal(messages.filter(([,body])=>body.includes(name)).length,1,name);
 assert.equal(messages[2][1],'FOUNDRY INSTRUCTIONS\n\nCustom instructions');
 assert.equal(foundryMessageStats(messages[2][1]).lines,3);
});
test('counters include empty lines, spaces, newlines and count Unicode code points',()=>{
 assert.deepEqual(foundryMessageStats('A 🐼\n\nB'),{characters:6,lines:3});
 assert.deepEqual(foundryMessageStats(''),{characters:0,lines:1});
});
