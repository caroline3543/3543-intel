import {test} from 'node:test';
import assert from 'node:assert/strict';
import {arenaFetchedPlayer,requestArenaPlayer} from '../src/services/arenaFetchService.js';
import {arenaTeam,compareArenaTeams} from '../src/services/arenaComparisonService.js';
import {holgerSkill,compareHolger} from '../src/services/arenaHolgerService.js';
const response=(fid='12345',kid=3573)=>({retrieved_at:'2026-10-21T00:00:00Z',data:{chief_id:fid,player:{fid,kid,nick_name:'Fetched',alliance:{abbr:'LUN'}},heroes:[{id:50004,level:80,position:1,gear:[{slot:'Gloves',enhancement_level:80,refine_level:5}]}]}});
test('fetch by ID creates an isolated comparison profile with returned defence gear',()=>{
 const p=arenaFetchedPlayer(response(),'12345','3573'),team=arenaTeam(p,'3573');
 assert.equal(p.id,'arena-fetched-12345');assert.equal(p.username,'Fetched');assert.equal(team.heroes[0].raw.gear[0].refine_level,5);assert.equal(team.confirmed,false);assert.equal(team.holger.legacy,null);
});
test('invalid ID, wrong state/identity, missing heroes and malformed dates keep previous comparisons',()=>{
 for(const [r,id,state] of [[response(),'123','3573'],[response(),'99999','3573'],[response('12345',3543),'12345','3573'],[{...response(),retrieved_at:null},'12345','3573'],[{...response(),data:{...response().data,heroes:[]}},'12345','3573']])assert.throws(()=>arenaFetchedPlayer(r,id,state));
});
test('uses authenticated player-details action and drops delayed results after cancellation',async()=>{
 let calls=[];const options={fid:' 12345 ',stateId:'3573',request:async(action,params)=>{calls.push({action,params});return response()},active:()=>true};
 assert.equal((await requestArenaPlayer(options)).fid,'12345');assert.deepEqual(calls,[{action:'player_details',params:{fid:'12345',state:3573}}]);
 assert.equal(await requestArenaPlayer({...options,active:()=>false}),null);
 let called=false;await assert.rejects(()=>requestArenaPlayer({...options,fid:'invalid',request:async()=>{called=true}}));assert.equal(called,false);
});
test('Holger validates levels and keeps unknown distinct from not unlocked',()=>{
 for(const value of [null,undefined,'',false,11,-1,2.5,'bad'])assert.equal(holgerSkill(value).known,false);
 assert.deepEqual(holgerSkill(0),{known:true,level:0,attackPercent:0,healthPercent:0});assert.equal(holgerSkill(10).attackPercent,20);assert.equal(holgerSkill('5').healthPercent,10);
});
test('Holger compares hero and escort pools separately without altering reported power',()=>{
 const a=arenaTeam(arenaFetchedPlayer(response(),'12345','3573'),'3573'),b=arenaTeam(arenaFetchedPlayer(response('67890'),'67890','3573'),'3573');
 a.holger={arenaElite:10,legacy:5};b.holger={arenaElite:5,legacy:10};
 const h=compareHolger(a.holger,b.holger);assert.equal(h.escortDifference,10);assert.equal(h.heroDifference,-10);assert.equal(h.complete,true);
 const r=compareArenaTeams(a,b);assert.equal(r.holger.heroDifference,-10);assert.ok(r.recommendations.some(x=>x.kind==='Holger bonus gap'));assert.equal(r.yourPower,null);assert.equal(r.winChance,undefined);
 b.holger.legacy=null;assert.equal(compareHolger(a.holger,b.holger).heroDifference,null);assert.ok(compareArenaTeams(a,b).gaps.some(x=>x.includes('Holger')));
});
