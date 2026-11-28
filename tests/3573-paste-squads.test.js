import assert from 'node:assert/strict';
import test from 'node:test';
import {parseRosterPaste} from '../roster-site/src/foundry/parseRosterPaste.js';
import {createScreenshotMatcher} from '../roster-site/src/foundry/screenshotImportPlan.js';
import {balanceEventSquads} from '../roster-site/src/foundry/balanceEventSquads.js';
import {configured} from '../roster-site/server/access.js';
import {validateEventPlannerData} from '../roster-site/server/eventPlannerValidation.js';
import {plannerKey,plannerSlot,prepareEventRoles} from '../src/services/eventPlanner.js';

test('paste accepts TSV, CSV, pipe, username and power, and structured legion headings',()=>{
 for(const line of ['雪☆莉\t1,234,567\t2\tCombatant\t123','"雪☆莉","1,234,567",2,Combatant,123','雪☆莉|1,234,567|2|Combatant|123']){
  const {rows,errors}=parseRosterPaste(line,1);
  assert.deepEqual(errors,[]);
  assert.deepEqual(rows.map(({name,power,legion,registration,fid})=>({name,power,legion,registration,fid})),
   [{name:'雪☆莉',power:1234567,legion:2,registration:'combatant',fid:'123'}]);
 }
 const {rows,errors}=parseRosterPaste('Legion 2: Substitutes\n- \u200b김 사 · 123\n- 김 사 — 12 345\n# Legion 1\nΑλφα, 987,654',1);
 assert.deepEqual(errors,[]);
 assert.deepEqual(rows.map(row=>[row.name,row.power,row.legion,row.registration]),[
  ['김 사 ·',123,2,'substitute'],['김 사',12345,2,'substitute'],['Αλφα',987654,1,'unknown'],
 ]);
 const quoted=parseRosterPaste('Username,Power,Legion,Status\n"Lee, Jr.","125,000",1,Substitute',2);
 assert.deepEqual(quoted.errors,[]);
 assert.equal(quoted.rows[0].name,'Lee, Jr.');
});

test('paste exposes malformed lines and preserves duplicate evidence',()=>{
 const {rows,errors}=parseRosterPaste('A,1.5\nB,1,23\nC|30|3|Combatant\nD|22|1|maybe\nE|10|1|Substitute|ABC\nF|12|1|Substitute|7\nF|12|1|Substitute|7\nG,9007199254740992',1);
 assert.deepEqual(errors.map(error=>error.line),[1,2,3,4,5,8]);
 assert.equal(rows.length,2);
 assert.notEqual(rows[0].rowId,rows[1].rowId);
});

test('explicit FID corroborates a name and cannot fall back on conflicting or duplicate destinations',()=>{
 const a={name:'Luna',id:'a',fid:'12',alliance:'ARC',nickname:'Moon',searchFields:['Old Luna']};
 const b={name:'Nova',id:'b',fid:'34',alliance:'ARC'};
 let match=createScreenshotMatcher([a,b],'ARC');
 assert.equal(match('Lu\u200bna',{fid:'12',source:'paste'}).player?.id,'a');
 assert.equal(match('Old Luna',{fid:'12',source:'paste'}).player?.id,'a');
 assert.equal(match('moon',{fid:'12',source:'paste'}).player?.id,'a');
 assert.equal(match('Nova',{fid:'12',source:'paste'}).player,null);
 assert.equal(match('Lun',{fid:'12',source:'paste'}).player,null);
 assert.equal(match('Luna',{fid:'999',source:'paste'}).player,null);
 match=createScreenshotMatcher([a,b,{...a,id:'d',alliance:'HOT',name:'FormerLuna'}],'ARC');
 assert.equal(match('FormerLuna',{fid:'12',source:'paste'}).player?.id,'a');
 match=createScreenshotMatcher([a,b,{...a,id:'d',name:'FormerLuna'}],'ARC');
 assert.equal(match('Luna',{fid:'12',source:'paste'}).player,null);
});

test('squad allocation anchors distinct leaders and preserves manual and locked players',()=>{
 const players=[20,19,13,10,5,0].map((power,index)=>({id:String(index),name:'Player '+index,hasPower:index!==5,power}));
 const options={players,count:2,leaderIds:['0','1'],plan:{teams:{2:'Blue',3:'Yellow'},teamLocks:{2:true},manualTeams:{3:true}},preferences:{}};
 const result=balanceEventSquads(options);
 assert.deepEqual(result.leaders,{Blue:'0',Yellow:'1'});
 assert.equal(result.teams['2'],'Blue');
 assert.equal(result.teams['3'],'Yellow');
 assert.deepEqual(Object.values(result.members).map(team=>team.length),[3,3]);
 assert.equal(Object.keys(result.teams).length,players.length);
 assert.match(balanceEventSquads({...options,leaderIds:['0','1','2']}).error,/eligible combatant/);
 assert.match(balanceEventSquads({...options,leaderIds:['substitute']}).error,/eligible combatant/);
 assert.match(balanceEventSquads({...options,plan:{teams:{2:'Purple'},teamLocks:{2:true}}}).error,/before reducing/);
 assert.match(balanceEventSquads({...options,leaderIds:['2','3'],plan:{teams:{2:'Blue',3:'Blue'},manualTeams:{2:true,3:true}}}).error,/same team/);
});

test('two teams and protected assignments pass validation and are cleaned on removal',()=>{
 const key=plannerKey('foundry','ARC',1);
 const plan={...plannerSlot(null,'foundry','ARC',1),teamCount:2,registrations:{p:'join'},registeredUnder:{p:'ARC'},teams:{p:'Blue'},teamLocks:{p:true},manualTeams:{p:true},teamLeaders:{Blue:'p'}};
 const storage={eventPlans:{[key]:plan}};
 assert.doesNotThrow(()=>validateEventPlannerData({players:[{id:'p'}],foundry:storage}));
 const {slots}=prepareEventRoles(storage,{kind:'foundry',alliance:'ARC',legion:1,expectedOccurrenceId:key},[{id:'p',role:'sub',expectedRole:'join'}]);
 assert.deepEqual(slots[0].plan.teamLocks,{});
 assert.deepEqual(slots[0].plan.manualTeams,{});
 assert.deepEqual(slots[0].plan.teamLeaders,{});
});

test('candidate preview disables shared workspace access even with production-shaped credentials',()=>{
 const credentials={SESSION_SECRET:'x'.repeat(32),ACCESS_PASSWORD_HASH:'salt:hash'};
 for(const branch of ['fix/3573-review-speed','fix/3573-paste-first','fix/3573-paste-only']){
  assert.equal(configured({...credentials,VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:branch}),false);
  assert.equal(configured({...credentials,VERCEL_ENV:'production',VERCEL_GIT_COMMIT_REF:branch}),true);
 }
});
