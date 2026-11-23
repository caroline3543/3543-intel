import test from 'node:test';
import assert from 'node:assert/strict';
import {readApproved3573Profile,saveApproved3573Profile} from '../src/services/approved3573ProfileService.js';
const snapshot={ready:true,updatedAt:'2026-11-24T01:00:00Z',allianceTag:'HOT',player:{id:'123',notes:'before',cityPower:100}};
test('reads only State 3573 through authenticated RPC',async()=>{
 let call;
 const client={rpc:async(name,params)=>{call=[name,params];return {data:[{updated_at:snapshot.updatedAt,alliance_tag:'HOT',data:snapshot.player}]}}};
 const result=await readApproved3573Profile({playerId:'123',stateId:'3573',client});
 assert.equal(result.ready,true);assert.equal(result.allianceTag,'HOT');
 assert.deepEqual(call,['read_3573_profile_for_edit',{p_id:'123'}]);
});
test('rejects cross-state requests without contacting database',async()=>{
 let called=false;const client={rpc:async()=>{called=true}};
 assert.equal((await readApproved3573Profile({playerId:'123',stateId:'3543',client})).ready,false);
 assert.equal((await saveApproved3573Profile({snapshot,changes:{notes:'after'},expectedFields:{notes:'before'},stateId:'3543',client})).persisted,false);
 assert.equal(called,false);
});
test('sends only allowed patch fields and authoritative version',async()=>{
 let call;const client={rpc:async(name,params)=>{call=[name,params];return {data:[{status:'saved',server_updated_at:'2026-11-24T01:01:00Z'}]}}};
 const result=await saveApproved3573Profile({snapshot,changes:{notes:'after'},expectedFields:{notes:'before'},stateId:'3573',client});
 assert.equal(result.persisted,true);
 assert.deepEqual(call,['update_3573_profile_fields',{p_id:'123',p_expected_updated_at:snapshot.updatedAt,p_expected_alliance_tag:'HOT',p_changes:{notes:'after'}}]);
 assert.equal(result.player.cityPower,100);
});
test('refuses forbidden fields and stale draft without a write',async()=>{
 let called=false;const client={rpc:async()=>{called=true}};
 assert.equal((await saveApproved3573Profile({snapshot,changes:{cityPower:999},expectedFields:{cityPower:100},stateId:'3573',client})).persisted,false);
 const stale=await saveApproved3573Profile({snapshot,changes:{notes:'after'},expectedFields:{notes:'older'},stateId:'3573',client});
 assert.equal(stale.conflict,true);assert.equal(called,false);
});
test('fails closed on RPC errors and database conflicts',async()=>{
 const denied=await readApproved3573Profile({playerId:'123',stateId:'3573',client:{rpc:async()=>({data:null,error:{message:'not authorised'}})}});
 assert.equal(denied.ready,false);
 const params={snapshot,changes:{notes:'after'},expectedFields:{notes:'before'},stateId:'3573'};
 const error=await saveApproved3573Profile({...params,client:{rpc:async()=>({error:{message:'not authorised'}})}});
 assert.equal(error.persisted,false);
 const conflict=await saveApproved3573Profile({...params,client:{rpc:async()=>({data:[{status:'not_saved'}]})}});
 assert.equal(conflict.conflict,true);
});
