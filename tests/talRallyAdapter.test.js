import {test} from 'node:test';
import assert from 'node:assert/strict';
import {talBattleRallyInputs} from '../roster-site/src/battle/talRallyAdapter.js';
import {generateTalRallyDraft} from '../src/services/talRallyTeamGenerator.js';

const person=(id,fid)=>({id,fid,username:id,marchCapacity:200,leaderProfile:{role:id==='lead'?'leader':'none',rallyCapacity:400},talTroopInventory:{infantry:{t11:100,t10:0},lancer:{t11:0,t10:0},marksman:{t11:100,t10:0}}});
function fixture(){
 const players=[person('lead','12345'),person('join','23456'),person('unverified','34567'),person('unselected','45678')];
 const plan={teams:[{id:'HOT:1',host:'HOT',number:1,members:[{id:'lead',role:'combatant',registered:false},{id:'join',role:'combatant',registered:true},{id:'unverified',role:'combatant',registered:true}]}],records:{lead:{sheetRegistration:'Verified'},join:{sheetRegistration:'Verified'},unverified:{sheetRegistration:'Pending'},unselected:{sheetRegistration:'Verified'}}};
 const battle={id:'battle1',type:'tal',sourceTeamId:'HOT:1',time:'19:00',participants:[{id:'lead',role:'combatant',attendance:'available',power:'7000'},{id:'join',role:'combatant',attendance:'available',power:'5000'},{id:'unverified',role:'combatant',attendance:'available',power:'6000'},{id:'unselected',role:'combatant',attendance:'available',power:'10000'}]};
 return {players,plan,battle};
}
test('actual battle adapter enforces sheet Verified plus legion selected membership',()=>{
 const v=fixture(),out=talBattleRallyInputs(v);
 assert.equal(out.ready,true);
 assert.deepEqual(out.team.members.map(m=>m.id),['lead','join']);
 assert.equal(out.excluded.length,2);
 assert.ok(out.warnings.some(w=>w.includes('in-game registration')));
 assert.equal(out.event.snapshots.find(s=>s.playerId==='lead').troopPower,7000);
 const draft=generateTalRallyDraft({team:out.team,config:out.config,players:v.players,event:out.event,settings:{teamCount:1,ratio:[50,0,50]}});
 assert.equal(draft.teams.length,1);
 assert.equal(draft.rosterVerification,'verified');
 assert.equal(draft.teams[0].fill,400);
});
test('battle-specific attendance prevents non-attending joiners being allocated',()=>{
 const v=fixture();v.battle.participants.find(p=>p.id==='join').attendance='unavailable';
 const out=talBattleRallyInputs(v);
 const draft=generateTalRallyDraft({team:out.team,config:out.config,players:v.players,event:out.event,settings:{teamCount:1}});
 assert.ok(!draft.teams[0].players.some(p=>p.id==='join'));
 assert.equal(draft.teams[0].fill,200);
});
test('unlinked TAL battle is blocked, and Foundry battle does not use TAL teams',()=>{
 const v=fixture();v.battle.sourceTeamId='';
 assert.equal(talBattleRallyInputs(v).ready,false);
 v.battle.type='foundry';
 assert.equal(talBattleRallyInputs(v).ready,false);
});
test('missing or invalid game IDs are not considered verified matches',()=>{
 const v=fixture();v.players.find(p=>p.id==='join').fid='';
 const out=talBattleRallyInputs(v);
 assert.deepEqual(out.team.members.map(m=>m.id),['lead']);
 assert.ok(out.excluded.some(x=>x.id==='join'&&x.reason.includes('player ID')));
});
