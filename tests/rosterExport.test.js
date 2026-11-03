import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { ROSTER_HEADERS,rosterExportRow,latestTroopPowers } from '../src/services/rosterExportRows.js';
import { buildRosterSheet } from '../src/services/exportXlsx.js';
import {talPollResultsText} from '../src/services/talPoll.js';
const player={id:'a',fid:'001234567890123456',username:'Caroline',allianceTag:'LUN',power:123456789,furnaceLevel:'FC5',roles:['Rally Lead'],troops:{infantry:'FC5',lancer:'FC4',marksman:'FC5'},joinerHeroes:[{hero:'Jessie',skillLevel:5}],providerRankings:{labyrinth:{rank:12,score:9988}}};
const events=[{id:'old',type:'Canyon Clash',snapshots:[{playerId:'a',troopPower:100,updatedAt:'2026-10-01T00:00:00Z'}]},{id:'new',type:'Canyon Clash',snapshots:[{playerId:'a',troopPower:150,updatedAt:'2026-11-01T00:00:00Z'}]},{type:'Foundry',snapshots:[{playerId:'a',troopPower:250,createdAt:'2026-10-01T00:00:00Z'}]},{type:'Tundra Arms League',snapshots:[{playerId:'a',troopPower:350,createdAt:'2026-10-02T00:00:00Z'}]},{type:'Frostdragon Tyrant',snapshots:[{playerId:'a',troopPower:450,createdAt:'2026-10-03T00:00:00Z'}]}];
test('roster columns align with every requested field and retain numeric values',()=>{
 const row=rosterExportRow(player,{settings:{stateId:'3573'},events});assert.equal(row.length,ROSTER_HEADERS.length);
 const record=Object.fromEntries(ROSTER_HEADERS.map((h,i)=>[h,row[i]]));
 assert.equal(record['Player ID'],player.fid);assert.equal(record.Username,'Caroline');assert.equal(record['Rally leader / joiner'],'Rally leader / Joiner');assert.equal(record['Labyrinth score'],9988);assert.equal(record['Labyrinth rank'],12);assert.equal(record.Power,123456789);assert.equal(record['Infantry troop level'],'FC5');
 assert.equal(record['Last Canyon Clash troop power'],150);assert.equal(record['Last Foundry troop power'],250);assert.equal(record['Last Tundra Arms League troop power'],350);assert.equal(record['Last Frostdragon Tyrant troop power'],450);assert.equal(record['Joiner heroes'],'Jessie (Skill 5)');
});
test('missing measurements stay blank and zero remains a numeric zero',()=>{
 const record=rosterExportRow({id:'b',power:0},{events});assert.equal(record[5],0);assert.equal(record[7],'');assert.equal(record[12],'');
});
test('latest troop power skips invalid records and uses snapshot timestamps',()=>{
 const powers=latestTroopPowers(player,[...events,{type:'Canyon Clash',snapshots:[{playerId:'a',troopPower:null,updatedAt:'2026-11-04T00:00:00Z'},{playerId:'other',troopPower:9999,updatedAt:'2026-11-04T00:00:00Z'}]}]);assert.equal(powers.canyon.power,150);
});
test('xlsx round trip preserves editable cell types, identifiers, flat rows and filters',()=>{
 const ws=buildRosterSheet([player],{settings:{stateId:'3573'},events});const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Roster');
 const read=XLSX.read(XLSX.write(wb,{type:'buffer',bookType:'xlsx'}),{type:'buffer'}).Sheets.Roster;
 assert.equal(read.D2.t,'s');assert.equal(read.D2.v,player.fid);assert.equal(read.F2.t,'n');assert.equal(read.F2.v,123456789);assert.equal(read['!autofilter'].ref,'A1:V2');assert.equal(read['!protect'],undefined);
 assert.equal(XLSX.utils.sheet_to_json(read).length,1);
});
test('poll result copy counts unique players and repeats a name at each chosen time',()=>{
 const text=talPollResultsText({slots:['02:00','07:00'],availability:{a:['02:00','07:00']},interestedIds:['a','b']},[player,{id:'b',fid:'223344',username:'Waiting'}]);
 assert.ok(text.includes('1 players with availability · 1 interested'));assert.ok(text.includes('02:00 UTC · 1'));assert.ok(text.includes('07:00 UTC · 1'));assert.equal(text.match(/Caroline/g).length,2);assert.equal(text.match(/Waiting/g).length,1);
});
