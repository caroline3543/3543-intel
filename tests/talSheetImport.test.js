import {test} from 'node:test';
import assert from 'node:assert/strict';
import {importTalPlanningSheet} from '../scripts/importTalPlanningSheet.mjs';
import {newPlan,createTeam,placePlayer,suggest,teamIssues} from '../roster-site/src/tal/planner.js';
import {plannedMemberIds,legionForPlayer} from '../src/services/talRosterService.js';
import {validateWorkspace} from '../roster-site/shared/workspace.js';
const row=(id,name,extra={})=>({_row:2,Username:name,'Player ID':id,'Home Alliance':'HOT','Assigned Legion':'Legion1','TAL Alliance':'HOT',Selection:'Selected',Registration:'Verified',Infantry:'FC8T11',Lancer:'FC7T10',Marksman:'FC8T11','12:00 UTC':'TRUE','14:00 UTC':'TRUE','Joiner heroes':'Norah 5★',...extra});
const input=rows=>({players:rows,sheets:{'State Roster':{values:[[]]},'Data Sources':{values:[[]]},'HOT - Legion 1':{values:[[]]},'Dated Availability':{values:[['date'],['Awaiting reply','FALSE']]}}});
test('sheet import preserves troops, notes, availability and rawsource without inventing roles, skills or power',()=>{
 const result=importTalPlanningSheet(input([row('12345','Alice',{Notes:'Except Fridays'})]),{},'2026-11-07T00:00:00Z');const p=result.data.players[0],r=result.data.talPlan.records[p.id],m=result.data.talPlan.teams[0].members[0];
 assert.equal(p.troops.infantry,'Helios FC8');assert.equal(p.troops.lancer,'FC7');assert.deepEqual(r.times,['12:00','14:00']);assert.ok(r.note.includes('Except Fridays'));assert.equal(r.troopPower,'');assert.equal(m.role,'pending');assert.equal(m.registered,false);assert.equal(r.sheetRegistration,'Verified');assert.equal(p.joinerHeroes[0].stars,5);assert.equal(p.joinerHeroes[0].skillLevel,null);assert.equal(p.providerStats,null);assert.equal(p.importedSheet.fields.Infantry,'FC8T11');
});
test('proposals and withdrawals remain visible and excluded from automatic selection',()=>{
 const result=importTalPlanningSheet(input([row('12345','Alice',{Selection:'Under review'}),row('23456','Bob',{_row:3,Selection:'Withdrawn'})]));const plan=result.data.talPlan,team=plan.teams[0];assert.equal(team.members.length,0);assert.equal(team.candidates.length,2);assert.ok(plannedMemberIds(team).has(result.data.players[0].id));assert.ok(!plannedMemberIds(team).has(result.data.players[1].id));assert.equal(legionForPlayer(plan,result.data.players[0].id).proposalStatus,'Under review');assert.equal(suggest(plan,result.data.players).teams[0].members.length,0);
 const next=placePlayer(plan,result.data.players,result.data.players[0].id,team.id,'combatant','',{allowAvailabilityConflict:true});assert.equal(next.teams[0].candidates.length,1);assert.equal(next.teams[0].members[0].role,'combatant');assert.equal(next.records[result.data.players[0].id].excludeFromSuggestions,false);
});
test('pending roles count toward overall capacity and are flagged until explicitly chosen',()=>{
 const players=Array.from({length:51},(_,i)=>({id:String(i),fid:String(10000+i),username:String(i)}));const plan={...newPlan(),records:Object.fromEntries(players.map(p=>[p.id,{status:'available',times:['02:00','07:00','12:00']}])),teams:[{...createTeam('HOT'),slots:['02:00','07:00','12:00'],members:players.slice(0,50).map(p=>({id:p.id,role:'pending',registered:false}))}]};
 assert.ok(teamIssues(plan,plan.teams[0],players).some(s=>s.includes('roles are not set')));assert.throws(()=>placePlayer(plan,players,'50','HOT:1'),/50 players/);const data={players,events:[],customRoles:[],settings:{stateId:'3573'},talPlan:plan};validateWorkspace(data);plan.teams[0].members[0].registered=true;assert.throws(()=>validateWorkspace(data),/Confirm the player role/);
});
test('existing API profile data and chosen nicknames survive manual sheet supplementation',()=>{
 const existing={players:[{id:'stable',fid:'12345',username:'Current API name',alias:'Chosen',notes:'Existing',troops:{infantry:'FC7'},providerDetails:{stateId:'3573',raw:{keep:true}},providerRankings:{},pastUsernames:[],joinerHeroes:[]}],events:[],customRoles:[],settings:{stateId:'3573'}};
 const {data}=importTalPlanningSheet(input([row('12345','Old sheet name')]),existing);assert.equal(data.players[0].username,'Current API name');assert.equal(data.players[0].alias,'Chosen');assert.equal(data.players[0].troops.infantry,'FC7');assert.deepEqual(data.players[0].providerDetails,existing.players[0].providerDetails);assert.ok(data.players[0].pastUsernames.includes('Old sheet name'));
});
test('independent roster evidence recovers missing IDs and resolves a copied ID without merging two people',()=>{
 const source=input([row('12345','ChiefA',{'Home Alliance':'ARC','TAL Alliance':'ARC','Assigned Legion':'Legion2','Labyrinth rank':'7'}),row('12345','Other',{_row:3,'Home Alliance':'LUN','TAL Alliance':'RKG','Assigned Legion':'Legion3',Selection:'Under review'}),row('','NoID',{_row:4,'Home Alliance':'ARC','Assigned Legion':''})]);
 source.sheets['State Roster'].values=[[],['3573','ARC','ChiefAᴬᴿᶜ','54321','','','FC7','7'],['3573','LUN','Other','12345'],['3573','ARC','NoID','65432']];
 const result=importTalPlanningSheet(source);assert.equal(result.data.players.find(p=>p.username==='ChiefA').fid,'54321');assert.equal(result.data.players.find(p=>p.username==='Other').fid,'12345');assert.equal(result.data.players.find(p=>p.username==='NoID').fid,'65432');assert.equal(result.summary.identityCorrections.length,2);assert.equal(result.data.players[0].importedSheet.originalFID,'12345');assert.equal(result.data.talPlan.teams.find(t=>t.host==='RKG').candidates.length,1);
});
