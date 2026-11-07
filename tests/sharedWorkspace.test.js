import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSharedWorkspace} from '../roster-site/src/sharedWorkspace.js';
import {sharedData,mergeWorkspace,resolveConflicts,validateWorkspace,sameWorkspaceValue} from '../roster-site/shared/workspace.js';
const player=(id,extra={})=>({id,fid:id==='a'?'12345':'23456',username:id,notes:'',...extra});
const initial=()=>sharedData({players:[player('a'),player('b')],events:[],customRoles:[],settings:{stateId:'3573'},talPlan:{records:{},teams:[]}});
function server(){let data=null,revision=0;return {get data(){return data;},get revision(){return revision;},async request(method,input){if(method==='GET')return {data:structuredClone(data),revision,updatedAt:'2026-11-07T00:00:00Z'};if(input.revision!==revision)return {conflict:true,data:structuredClone(data),revision};data=JSON.parse(JSON.stringify(input.data,Object.keys(input.data).sort()));data=structuredClone(input.data);revision++;return {data:structuredClone(data),revision,updatedAt:'2026-11-07T00:00:00Z'};}};}
function client(remote,seed=initial(),saved){let cache=saved;const c=createSharedWorkspace({initial:seed,cache:{read:async()=>cache,write:async v=>{cache=structuredClone(v)}},request:(...args)=>remote.request(...args)});return {c,get cache(){return cache}};}
const edit=(c,id,patch)=>c.update(data=>({...data,players:data.players.map(p=>p.id===id?{...p,...patch}:p)}));
test('shared values compare independently of JSONB object key order',()=>{assert.equal(sameWorkspaceValue({b:2,a:1},{a:1,b:2}),true);assert.equal(sameWorkspaceValue([1,2],[2,1]),false);});
test('first publish is explicit; another device loads the same shared roster',async()=>{
 const s=server(),a=client(s);await a.c.initialize();assert.equal(s.revision,0);assert.equal(a.c.getState().mode,'unpublished');await a.c.publish();assert.equal(s.revision,1);
 const b=client(s,sharedData({players:[],events:[],customRoles:[],settings:{stateId:'3573'}}));await b.c.initialize();assert.equal(b.c.getState().joined,true);assert.equal(b.c.getState().local.players.length,2);a.c.dispose();b.c.dispose();
});
test('existing device data requires joining and is retained as a device backup',async()=>{
 const s=server(),a=client(s);await a.c.initialize();await a.c.publish();const seed=initial();seed.players[0].notes='Device only';const b=client(s,seed);await b.c.initialize();assert.equal(b.c.getState().mode,'join');assert.equal(s.data.players[0].notes,'');await b.c.join();assert.equal(b.cache.deviceBackup.players[0].notes,'Device only');assert.equal(b.c.getState().local.players[0].notes,'');a.c.dispose();b.c.dispose();
});
test('two leaders merge edits to different players and fields without loss',async()=>{
 const s=server(),a=client(s);await a.c.initialize();await a.c.publish();const b=client(s,initial(),{...a.cache});await b.c.initialize();edit(a.c,'a',{notes:'Leader A'});edit(b.c,'b',{username:'New B'});await a.c.sync();await b.c.sync();await a.c.sync();assert.equal(s.data.players[0].notes,'Leader A');assert.equal(s.data.players[1].username,'New B');assert.equal(a.c.getState().local.players[1].username,'New B');a.c.dispose();b.c.dispose();
});
test('same-field conflicts wait for a deliberate choice while other edits merge',async()=>{
 const s=server(),a=client(s);await a.c.initialize();await a.c.publish();const b=client(s,initial(),{...a.cache});await b.c.initialize();edit(a.c,'a',{notes:'A'});edit(b.c,'a',{notes:'B'});edit(b.c,'b',{notes:'Independent'});await a.c.sync();await b.c.sync();assert.equal(b.c.getState().conflicts.length,1);assert.equal(s.data.players[0].notes,'A');await b.c.resolve('shared');await b.c.sync();assert.equal(s.data.players[0].notes,'A');assert.equal(s.data.players[1].notes,'Independent');a.c.dispose();b.c.dispose();
});
test('network loss after commit preserves pending edits and retry does not create another revision',async()=>{
 const s=server();let lost=false;const remote={async request(method,input){const result=await s.request(method,input);if(method==='POST'&&!lost){lost=true;throw Error('Offline');}return result;}};const a=client(remote);await a.c.initialize();await a.c.publish();assert.equal(s.revision,1);assert.equal(a.cache.local.players.length,2);await a.c.sync();assert.equal(s.revision,1);assert.equal(a.c.getState().joined,true);a.c.dispose();
});
test('offline edits survive reload and a failed authorization leaves the durable copy intact',async()=>{
 const s=server(),a=client(s);await a.c.initialize();await a.c.publish();edit(a.c,'a',{notes:'Waiting'});const denial={request:async()=>{throw Error('Sign in again')}};const b=client(denial,initial(),a.c.getState());await b.c.initialize();assert.equal(b.cache.local.players[0].notes,'Waiting');assert.ok(b.c.getState().status.includes('Sign in'));a.c.dispose();b.c.dispose();
});
test('concurrent cross-legion moves and deletion-versus-edit produce resolvable conflicts',()=>{
 const base=initial();base.talPlan.teams=['HOT','ARC','RKG'].map((host,i)=>({id:host,host,slots:[],members:i===0?[{id:'a',role:'combatant'}]:[]}));const mine=structuredClone(base),shared=structuredClone(base);mine.talPlan.teams[0].members=[];mine.talPlan.teams[1].members=[{id:'a',role:'combatant'}];shared.talPlan.teams[0].members=[];shared.talPlan.teams[2].members=[{id:'a',role:'combatant'}];const merged=mergeWorkspace(base,mine,shared);assert.ok(merged.conflicts.length);validateWorkspace(resolveConflicts(merged.data,merged.conflicts,'shared'));
 const deleted=structuredClone(base);deleted.players=deleted.players.filter(p=>p.id!=='a');const edited=structuredClone(base);edited.players[0].notes='Keep';const deletion=mergeWorkspace(base,deleted,edited);assert.ok(deletion.conflicts.length);assert.equal(resolveConflicts(deletion.data,deletion.conflicts,'shared').players.find(p=>p.id==='a').notes,'Keep');
});
test('workspace validation rejects permissions, prototype fields, cross-state data and duplicate assignments',()=>{
 for(const bad of [{...initial(),role:'player'},{...initial(),settings:{stateId:'3543'}},{...initial(),players:[player('a'),player('a')]}])assert.throws(()=>validateWorkspace(bad));
 const bad=initial();bad.players[0].providerDetails={stateId:'3543'};assert.throws(()=>validateWorkspace(bad));assert.throws(()=>validateWorkspace(JSON.parse('{"players":[],"events":[],"customRoles":[],"settings":{"stateId":"3573"},"talPlan":{"constructor":{}}}')));
});
test('two initial publishers cannot overwrite one another',async()=>{
 const s=server(),a=client(s),b=client(s);await Promise.all([a.c.initialize(),b.c.initialize()]);edit(b.c,'a',{username:'Other seed'});await Promise.all([a.c.publish(),b.c.publish()]);assert.equal(s.revision,1);assert.equal(b.c.getState().mode,'join');assert.equal(s.data.players[0].username,'a');a.c.dispose();b.c.dispose();
});
test('same-player edits to different fields merge, and different registration checks remain checked',()=>{
 const base=initial();base.talPlan.teams=[{id:'HOT',host:'HOT',slots:[],members:[{id:'a',role:'combatant',registered:false},{id:'b',role:'combatant',registered:false}]}];
 const mine=structuredClone(base),shared=structuredClone(base);mine.players[0].notes='Mine';shared.players[0].alias='Other';mine.talPlan.teams[0].members[0].registered=true;shared.talPlan.teams[0].members[1].registered=true;
 const merged=mergeWorkspace(base,mine,shared);assert.equal(merged.conflicts.length,0);assert.equal(merged.data.players[0].notes,'Mine');assert.equal(merged.data.players[0].alias,'Other');assert.ok(merged.data.talPlan.teams[0].members.every(m=>m.registered));
});
test('site and Edge Function validate with the same shared module',async()=>{
 const {readFile}=await import('node:fs/promises');const [site,edge]=await Promise.all([readFile(new URL('../roster-site/shared/workspace.js',import.meta.url),'utf8'),readFile(new URL('../supabase/functions/caroline3573-workspace/workspace.js',import.meta.url),'utf8')]);assert.equal(edge,site);
});
