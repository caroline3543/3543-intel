import test from 'node:test';
import assert from 'node:assert/strict';
import {talRows,talSheetPreview,applyTalSheetSnapshot,TAL_SHEET_ID} from '../roster-site/src/tal/sheetSync.js';
import {newPlan,createTeam} from '../roster-site/src/tal/planner.js';
import {validateWorkspace} from '../roster-site/shared/workspace.js';
const HEADERS=['Player ID','Username','Home Alliance','Selection','Registration','Assigned Legion','TAL Alliance','02:00 UTC','07:00 UTC','12:00 UTC','14:00 UTC','19:00 UTC','Power','Language','Notes'];
const row=(id,name,values={})=>HEADERS.map(k=>({
 'Player ID':id,Username:name,'Home Alliance':'HOT',Selection:'Selected',Registration:'Verified',
 'Assigned Legion':'Legion1','TAL Alliance':'HOT','02:00 UTC':false,'07:00 UTC':false,'12:00 UTC':true,'14:00 UTC':true,'19:00 UTC':false,
 Power:123456,Language:'Chinese',Notes:'Source note',
 ...values
})[k]);
const snapshot=rows=>({spreadsheetId:TAL_SHEET_ID,readAt:'2026-11-10T00:00:00Z',sheets:{Players:{values:[HEADERS,...rows]}}});
const base=()=>({players:[{id:'existing',fid:'12345',username:'Manually edited name',notes:'Keep my note',power:999,gameLanguage:'English',joinerHeroes:[{hero:'Norah',skillLevel:5}],languages:['English'],importedSheet:null}],
 events:[{id:'battle',type:'tal',participants:[{id:'existing',attendance:'available'}],rallyTeamDraft:{teams:[{id:'rally-1'}]}}],
 talPlan:{...newPlan(),teams:[{...createTeam('HOT',1),members:[{id:'existing',role:'combatant',registered:true}]}],records:{existing:{status:'available',times:['19:00'],sheetRegistration:'Pending'}}},
 customRoles:[],settings:{stateId:'3573'},talTeamPreferences:{players:{existing:{priority:true}},pairs:[]}
});
test('sheet preview rejects duplicate IDs without merging either row',()=>{
 const payload=snapshot([row('12345','A'),row('12345','B'),row('','Unnamed')]);
 const parsed=talRows(payload);
 assert.equal(parsed.safe.length,0);
 assert.equal(parsed.problems.length,3);
});
test('sheet link is fixed and selection is read without altering the workspace until confirmed',()=>{
 const data=base(),copy=structuredClone(data);
 const preview=talSheetPreview(data,snapshot([row('12345','Sheet Name')]));
 assert.equal(preview.changes.length,1);
 assert.equal(preview.changes[0].registrationChanged,true);
 assert.deepEqual(data,copy);
});
test('import preserves manual roster, battle plans, in-game registration and confirmed attendance',()=>{
 const data=base(),sheet=snapshot([row('12345','Sheet Name'),row('23456','New player',{Registration:'Awaiting',Selection:'Under review','19:00 UTC':true})]);
 const result=applyTalSheetSnapshot(data,sheet,'2026-11-10T01:00:00Z');
 assert.equal(result.players.length,2);
 assert.equal(result.players[0].username,'Manually edited name');
 assert.equal(result.players[0].power,999);
 assert.equal(result.players[0].notes,'Keep my note');
 assert.equal(result.players[0].gameLanguage,'English');
 assert.equal(result.players[0].joinerHeroes[0].skillLevel,5);
 assert.equal(result.players[0].importedSheet.fields.Username,'Sheet Name');
 assert.equal(result.players[0].languages.includes('Chinese'),true);
 assert.equal(result.talPlan.records.existing.sheetRegistration,'Verified');
 assert.deepEqual(result.talPlan.records.existing.times,['19:00']);
 assert.deepEqual(result.talPlan.records.existing.sheetAvailability,['12:00','14:00']);
 assert.deepEqual(result.talPlan.teams[0].members,data.talPlan.teams[0].members);
 assert.deepEqual(result.events,data.events);
 assert.deepEqual(result.talTeamPreferences,data.talTeamPreferences);
 assert.equal(result.players[1].fid,'23456');
 assert.equal(result.players[1].providerStats,null);
 assert.equal(result.talPlan.records[result.players[1].id].sheetSelection,'Under review');
 assert.doesNotThrow(()=>validateWorkspace(result));
});
test('locked TAL plan prevents data import',()=>{
 const data=base();data.talPlan.locked=true;
 assert.throws(()=>applyTalSheetSnapshot(data,snapshot([row('12345','A')])),/Unlock/);
});
test('idempotent import reuses existing player identities',()=>{
 const sheet=snapshot([row('12345','Name'),row('23456','New')]);
 const a=applyTalSheetSnapshot(base(),sheet);
 const b=applyTalSheetSnapshot(a,sheet);
 assert.equal(b.players.length,2);
 assert.equal(new Set(b.players.map(p=>p.id)).size,2);
 assert.equal(talSheetPreview(b,sheet).changes.length,0);
});
test('spreadsheet header validation blocks incompatible source',()=>{
 assert.throws(()=>talRows({sheets:{Players:{values:[['Username'],['A']]}}}),/Missing expected/);
});
