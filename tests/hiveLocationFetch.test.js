import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyHiveLocation,fetchHiveLocations} from '../src/services/hiveLocationFetchService.js';
import {reportedLocation,hiveRoster} from '../src/services/hiveIntegrationService.js';
const player={id:'a',fid:'12345',allianceTag:'LUN',username:'One',notes:'Keep',power:99,providerStats:{stateId:'3573',retrievedAt:'2026-10-20T00:00:00Z',raw:{fid:'12345',kid:3573,x:4,y:8}}};
const response=(fid='12345',extra={})=>({retrieved_at:'2026-10-21T00:00:00Z',data:{chief_id:fid,player:{fid,kid:3573,x:0,y:1199,...extra},cached_at:'cache date'}});
const roster=players=>hiveRoster(players,'3573','LUN');
test('location fetch changes only the independent observation; preserves records and source dates',()=>{
 const before=structuredClone(player),p=applyHiveLocation(player,response(),'3573');
 assert.deepEqual(player,before);assert.equal(p.power,99);assert.equal(p.notes,'Keep');
 assert.deepEqual(p.providerStats.raw,player.providerStats.raw);assert.equal(p.providerStats.retrievedAt,player.providerStats.retrievedAt);
 assert.deepEqual(reportedLocation(p,'3573'),{x:0,y:1199,retrievedAt:'2026-10-21T00:00:00.000Z'});
 assert.equal(reportedLocation(p,'3543'),null);
});
test('wrong identity/state and malformed timestamps reject; absent/invalid coordinates keep previous',()=>{
 for(const r of [response('99999'),response('12345',{kid:3543}),{...response(),retrieved_at:null}])assert.throws(()=>applyHiveLocation(player,r,'3573'));
 for(const xy of [{x:null},{y:1200},{x:''},{x:false},{x:1.5}])assert.equal(applyHiveLocation(player,response('12345',xy),'3573'),null);
 const newer=applyHiveLocation(player,response(),'3573');assert.equal(applyHiveLocation(newer,{...response(),retrieved_at:'2026-10-20T12:00:00Z'},'3573'),null);
});
test('batch requests only selected alliance sequentially; partial failures preserve other players',async()=>{
 const players=[player,{...player,id:'b',fid:'23456',username:'Two'},{...player,id:'c',fid:'34567',allianceTag:'MBT'}],saved=[],calls=[];let inFlight=0;
 const result=await fetchHiveLocations({roster:roster(players),request:async(action,{fid})=>{assert.equal(inFlight++,0);calls.push([action,fid]);await Promise.resolve();inFlight--;if(fid==='23456')throw Error('Unavailable');return response(fid)},getPlayers:()=>players,save:p=>saved.push(p),active:()=>true,onProgress:()=>{}});
 assert.deepEqual(calls,[['player','12345'],['player','23456']]);assert.equal(saved.length,1);assert.equal(result.failed.length,1);assert.equal(result.done,2);
});
test('stop during a request discards its response and starts no further requests',async()=>{
 const players=[player,{...player,id:'b',fid:'23456'}];let active=true,count=0;
 const r=await fetchHiveLocations({roster:roster(players),request:async()=>{count++;active=false;return response()},getPlayers:()=>players,save:()=>assert.fail('cancelled save'),active:()=>active,onProgress:()=>{}});
 assert.equal(count,1);assert.equal(r.stopped,true);assert.equal(r.saved,0);
});
test('reads latest record after fetch and rejects removed, changed or duplicated identities',async()=>{
 for(const current of [[],[{...player,allianceTag:'MBT'}],[{...player,fid:'77777'}],[player,{...player,id:'dup'}]]){
 const r=await fetchHiveLocations({roster:roster([player]),request:async()=>response(),getPlayers:()=>current,save:()=>assert.fail('invalid save'),active:()=>true,onProgress:()=>{}});assert.equal(r.failed.length,1);
 }
 let saved;await fetchHiveLocations({roster:roster([player]),request:async()=>response(),getPlayers:()=>[{...player,notes:'Edited during request'}],save:p=>saved=p,active:()=>true,onProgress:()=>{}});assert.equal(saved.notes,'Edited during request');
});
test('authentication and rate-limit errors stop the batch without automatic retry',async()=>{
 for(const status of [401,403,429]){let calls=0;const r=await fetchHiveLocations({roster:roster([player,{...player,id:'b',fid:'23456'}]),request:async()=>{calls++;throw Object.assign(Error('Rejected'),{status})},getPlayers:()=>[player],save:()=>assert.fail('save'),active:()=>true,onProgress:()=>{}});assert.equal(calls,1);assert.equal(r.stopped,true)}
});
