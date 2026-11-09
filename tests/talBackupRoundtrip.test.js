import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import {buildRosterDataSheet,buildEventsDataSheet} from '../src/services/xlsxDataSheets.js';
import {importFromXlsxFile} from '../src/services/xlsxImportService.js';

test('XLSX backup keeps TAL rally inventory, battle attendance and draft assignments',async()=>{
 const inventory={infantry:{t11:120000,t10:10000},lancer:{t11:0,t10:0},marksman:{t11:90000,t10:50000}};
 const player={id:'p1',fid:'681766601',username:'Player',marchCapacity:180000,leaderProfile:{role:'leader',rallyCapacity:600000},talTroopInventory:inventory,talTroopInventoryRecordedAt:'2026-11-09T00:00:00Z'};
 const participants=[{id:'p1',role:'combatant',attendance:'available',building:'Prototype Site I'}];
 const event={id:'battle-1',kind:'battle-plan',type:'tal',title:'HOT Legion 1',date:'2026-11-10',time:'19:00',sourceTeamId:'HOT:1',participants,battleTeams:[{id:'team1',leaderId:'p1'}],rallyTeamDraft:{mode:'strongest',teams:[{id:'rally-1',fill:1234}]},rallyMatchOverrides:{p1:{marchCapacity:150000}},rallyTeamPreferences:{players:{p1:{priority:true,voice:true}},pairs:[['p1','p2']]}};
 const wb=XLSX.utils.book_new();
 XLSX.utils.book_append_sheet(wb,buildRosterDataSheet([player]),'Roster Data');
 XLSX.utils.book_append_sheet(wb,buildEventsDataSheet([event]),'Events Data');
 XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet([{stateId:'3573',talTeamPreferences:JSON.stringify({players:{p1:{priority:true,reliable:true}},pairs:[['p1','p2']]})}]),'Workspace Data');
 const binary=XLSX.write(wb,{type:'binary',bookType:'xlsx'});
 const previous=globalThis.FileReader;
 globalThis.FileReader=class {
   readAsBinaryString(file){this.onload({target:{result:file.binary}});}
 };
 try{
   const result=await importFromXlsxFile({binary});
   assert.equal(result.players[0].marchCapacity,180000);
   assert.deepEqual(result.players[0].talTroopInventory,inventory);
   assert.deepEqual(result.players[0].leaderProfile,player.leaderProfile);
   assert.deepEqual(result.events[0].participants,participants);
   assert.deepEqual(result.events[0].rallyTeamDraft,event.rallyTeamDraft);
   assert.deepEqual(result.events[0].rallyMatchOverrides,event.rallyMatchOverrides);
   assert.deepEqual(result.events[0].rallyTeamPreferences,event.rallyTeamPreferences);
   assert.deepEqual(result.events[0].battleTeams,event.battleTeams);
   assert.deepEqual(result.talTeamPreferences,{players:{p1:{priority:true,reliable:true}},pairs:[['p1','p2']]});
 }finally{if(previous===undefined)delete globalThis.FileReader;else globalThis.FileReader=previous;}
});
