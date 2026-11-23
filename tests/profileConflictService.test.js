import test from 'node:test';
import assert from 'node:assert/strict';
import {saveProfileIfUnchanged,loadPlayerVersion,beginGuardedProfileEdit,commitGuardedProfileEdit} from '../src/services/profileConflictService.js';
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
   assert.equal(columns,'updated_at,data,alliance_tag');
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

test('guarded edit rejects fields outside explicit allowlist',async()=>{
 let called=false;
 const client={rpc:async()=>{called=true;return {data:[]}}};
 const snapshot={ready:true,updatedAt:'2026-11-23T10:00:00Z',player:{id:'123',notes:'before'}};
 const result=await commitGuardedProfileEdit({snapshot,changes:{cityPower:999},stateId:'3573',client});
 assert.equal(result.persisted,false);assert.equal(called,false);
});
test('guarded edit preserves unrelated server fields and uses CAS',async()=>{
 let submitted;
 const client={rpc:async(name,args)=>{submitted=args;return {data:[{status:'saved',server_updated_at:'2026-11-23T10:01:00Z'}]}}};
 const snapshot={ready:true,updatedAt:'2026-11-23T10:00:00Z',player:{id:'123',notes:'before',cityPower:100,allianceTag:'HOT'}};
 const result=await commitGuardedProfileEdit({snapshot,changes:{notes:'after'},expectedFields:{notes:'before'},stateId:'3573',client});
 assert.equal(result.persisted,true);
 assert.equal(result.player.notes,'after');
 assert.equal(result.player.cityPower,100);
 assert.equal(submitted.p_data.cityPower,100);
 assert.equal(submitted.p_data.notes,'after');
 assert.equal(submitted.p_expected_updated_at,snapshot.updatedAt);
});

test('rejects stale editor draft without invoking database write',async()=>{
 let called=false;
 const client={rpc:async()=>{called=true;return {data:[]}}};
 const snapshot={ready:true,updatedAt:'2026-11-23T10:00:00Z',player:{id:'123',notes:'newer officer note'}};
 const result=await commitGuardedProfileEdit({snapshot,changes:{notes:'older draft'},expectedFields:{notes:'original note'},stateId:'3573',client});
 assert.equal(result.persisted,false);
 assert.equal(result.conflict,true);
 assert.equal(called,false);
});
test('refuses guarded edits without original field values',async()=>{
 const snapshot={ready:true,updatedAt:'2026-11-23T10:00:00Z',player:{id:'123',notes:'original'}};
 const result=await commitGuardedProfileEdit({snapshot,changes:{notes:'changed'},stateId:'3573',client:{}});
 assert.equal(result.persisted,false);
});

test('guarded commit never falls back to upsert when RPC fails',async()=>{
 let upsertCalled=false;
 const client={
  rpc:async()=>({data:null,error:{message:'function unavailable'}}),
  from:()=>({upsert:async()=>{upsertCalled=true;return {error:null}}})
 };
 const snapshot={ready:true,updatedAt:'2026-11-23T10:00:00Z',player:{id:'123',notes:'before'}};
 const result=await commitGuardedProfileEdit({snapshot,changes:{notes:'after'},expectedFields:{notes:'before'},stateId:'3573',client});
 assert.equal(result.persisted,false);
 assert.equal(upsertCalled,false);
});

test('two editors: first save succeeds, second fails atomically without overwriting',async()=>{
 let row={updated_at:'2026-11-23T10:00:00.000Z',data:{id:'123',allianceTag:'HOT',notes:'initial',cityPower:100}};
 let writes=0;
 const client={
  from:()=>({
   select:()=>({eq:()=>({eq:()=>({maybeSingle:async()=>({data:structuredClone(row),error:null})})})})
  }),
  rpc:async(_name,args)=>{
   if(args.p_expected_updated_at!==row.updated_at)return {data:[{status:'not_saved',server_updated_at:null}],error:null};
   writes++;
   row={updated_at:'2026-11-23T10:00:01.000Z',data:structuredClone(args.p_data)};
   return {data:[{status:'saved',server_updated_at:row.updated_at}],error:null};
  }
 };
 const first=await beginGuardedProfileEdit({playerId:'123',stateId:'3573',client});
 const second=await beginGuardedProfileEdit({playerId:'123',stateId:'3573',client});
 assert.equal(first.ready,true);
 assert.equal(second.ready,true);
 const saved=await commitGuardedProfileEdit({snapshot:first,changes:{notes:'first editor'},expectedFields:{notes:'initial'},stateId:'3573',client});
 const stale=await commitGuardedProfileEdit({snapshot:second,changes:{notes:'second editor'},expectedFields:{notes:'initial'},stateId:'3573',client});
 assert.equal(saved.persisted,true);
 assert.equal(stale.persisted,false);
 assert.equal(stale.conflict,true);
 assert.equal(row.data.notes,'first editor');
 assert.equal(row.data.cityPower,100);
 assert.equal(writes,1);
});

test('guarded edit uses database alliance tag even when player JSON lacks it',async()=>{
 let submitted;
 const client={
  from:()=>({select:()=>({eq:()=>({eq:()=>({maybeSingle:async()=>({
   data:{updated_at:'2026-11-23T10:00:00Z',alliance_tag:'HOT',data:{id:'123',notes:'before',cityPower:100}},error:null
  })})})})}),
  rpc:async(_name,params)=>{submitted=params;return {data:[{status:'saved',server_updated_at:'2026-11-23T10:01:00Z'}],error:null}}
 };
 const snapshot=await beginGuardedProfileEdit({playerId:'123',stateId:'3573',client});
 assert.equal(snapshot.allianceTag,'HOT');
 const result=await commitGuardedProfileEdit({snapshot,changes:{notes:'after'},expectedFields:{notes:'before'},stateId:'3573',client});
 assert.equal(result.persisted,true);
 assert.equal(submitted.p_alliance_tag,'HOT');
 assert.equal(submitted.p_data.allianceTag,undefined);
});
