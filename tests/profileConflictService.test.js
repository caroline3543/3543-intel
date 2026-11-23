import test from 'node:test';
import assert from 'node:assert/strict';
import {saveProfileIfUnchanged,loadPlayerVersion} from '../src/services/profileConflictService.js';
const player={id:'123',allianceTag:'HOT',notes:'updated'};
const args={player,expectedUpdatedAt:'2026-11-23T10:00:00.000Z',stateId:'3573'};
test('rejects missing version without attempting a write',async()=>{
 let called=false;
 const client={rpc:async()=>{called=true;return {data:[]}}};
 const result=await saveProfileIfUnchanged({...args,expectedUpdatedAt:null,client});
 assert.equal(result.persisted,false);assert.equal(called,false);
});
test('passes exact expected version to guarded RPC',async()=>{
 let call;
 const client={rpc:async(name,params)=>{call={name,params};return {data:[{status:'saved',server_updated_at:'2026-11-23T10:01:00Z'}],error:null}}};
 const result=await saveProfileIfUnchanged({...args,client});
 assert.equal(result.persisted,true);
 assert.equal(call.name,'update_player_if_unchanged');
 assert.equal(call.params.p_expected_updated_at,args.expectedUpdatedAt);
 assert.equal(call.params.p_state_id,'3573');
});
test('does not silently upsert on conflicts or RPC errors',async()=>{
 const conflict=await saveProfileIfUnchanged({...args,client:{rpc:async()=>({data:[{status:'not_saved'}],error:null})}});
 assert.equal(conflict.persisted,false);assert.equal(conflict.conflict,true);
 const unavailable=await saveProfileIfUnchanged({...args,client:{rpc:async()=>({data:null,error:{message:'function missing'}})}});
 assert.equal(unavailable.persisted,false);assert.match(unavailable.reason,/unavailable/);
});

test('reads database updated_at rather than JSON edit timestamp',async()=>{
 const queries=[];
 const client={from(table){
  assert.equal(table,'players');
  return {select(columns){
   assert.equal(columns,'updated_at,data');
   return {eq(field,value){
    queries.push([field,value]);
    return {eq(field2,value2){
     queries.push([field2,value2]);
     return {maybeSingle:async()=>({data:{updated_at:'2026-11-23T11:00:00Z',data:{profileLastUpdated:'2020-01-01T00:00:00Z'}},error:null})};
    }};
   }};
  }};
 }};
 const result=await loadPlayerVersion({playerId:'123',stateId:'3573',client});
 assert.equal(result.ready,true);
 assert.equal(result.updatedAt,'2026-11-23T11:00:00Z');
 assert.deepEqual(queries,[['state_id','3573'],['id','123']]);
});
test('version lookup fails closed for missing row',async()=>{
 const client={from:()=>({select:()=>({eq:()=>({eq:()=>({maybeSingle:async()=>({data:null,error:null})})})})})};
 const result=await loadPlayerVersion({playerId:'123',stateId:'3573',client});
 assert.equal(result.ready,false);
});
