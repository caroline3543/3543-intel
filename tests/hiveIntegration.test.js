import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {hiveRoster,reportedLocation,locationBounds} from '../src/services/hiveIntegrationService.js';
const ctx=vm.createContext({});
for(const name of ['model','operations-model','attendance-model','layout-model','reference-layout','world-data','world-map','officer-model','template-data','templates-model','direct-model','intel-model'])vm.runInContext(readFileSync(`public/hive/${name}.js`,'utf8'),ctx);
const plain=value=>JSON.parse(JSON.stringify(value));
const scope={stateId:'3573',alliance:'LUN'};
const payload={version:1,...scope,players:[{id:'app-id',fid:'596099868',name:'Princess Bulma',location:{x:634,y:748,retrievedAt:'2026-10-21T02:00:00Z'}}]};
function empty(){const p=plain(ctx.Hive.emptyPlan());p.settings.state='3573';p.settings.alliance='LUN';return p}
test('planner roster import adds exact identities as Other with unknown attendance and no placement',()=>{
 const p=empty(),before=plain(p),r=ctx.HiveIntel.mergeRoster(p,payload,scope),m=r.plan.members[0];
 assert.deepEqual(p,before);assert.equal(m.name,'Princess Bulma');assert.equal(m.playerId,'596099868');assert.equal(m.trap,0);assert.equal(m.slot,null);assert.deepEqual(plain(m.current),{x:634,y:748});assert.equal(m.attendance[1].kind,'unknown');assert.equal(r.added,1);
 ctx.Hive.validate(r.plan);
});
test('refresh preserves manual assignment, locks, attendance and notes, and never deletes missing members',()=>{
 const p=plain(ctx.Hive.demo());p.settings.state='3573';p.settings.alliance='LUN';const old=p.members[0];old.playerId='596099868';old.notes='Keep me';old.locked=true;const before=plain(p);
 const r=ctx.HiveIntel.mergeRoster(p,payload,scope),m=r.plan.members[0];
 assert.deepEqual(p,before);assert.equal(r.plan.members.length,p.members.length);for(const key of ['id','slot','trap','locked','notes','attendance'])assert.deepEqual(plain(m[key]),plain(old[key]));assert.deepEqual(plain(r.plan.slots),p.slots);
});
test('wrong state, wrong alliance and duplicate IDs reject before changing a plan',()=>{
 const p=empty(),before=plain(p);
 for(const bad of [{...payload,stateId:'3543'},{...payload,alliance:'MBT'},{...payload,players:[...payload.players,...payload.players]}])assert.throws(()=>ctx.HiveIntel.mergeRoster(p,bad,scope));
 assert.deepEqual(p,before);
});
test('old or missing reported positions do not erase a newer current-position record',()=>{
 const p=plain(ctx.HiveIntel.mergeRoster(empty(),payload,scope).plan);
 const old={...payload,players:[{...payload.players[0],location:{x:1,y:2,retrievedAt:'2026-10-20T00:00:00Z'}}]};
 assert.deepEqual(plain(ctx.HiveIntel.mergeRoster(p,old,scope).plan.members[0].current),{x:634,y:748});
});
test('reported maps validate state, identity, paired coordinates and bounds',()=>{
 const player={id:'a',fid:'1234',allianceTag:'LUN',username:'Exact 名',providerDetails:{stateId:'3573',retrievedAt:'2026-10-21T00:00:00Z',raw:{player:{fid:'1234',kid:3573,x:0,y:1199}}}};
 assert.equal(reportedLocation(player,'3573').x,0);assert.equal(reportedLocation(player,'3543'),null);
 for(const raw of [{fid:'9999',kid:3573,x:1,y:2},{kid:3573,x:null,y:1},{kid:3573,x:1200,y:1},{kid:3543,x:1,y:1}])assert.equal(reportedLocation({...player,providerDetails:{...player.providerDetails,raw:{player:raw}}},'3573'),null);
 const roster=hiveRoster([player,{id:'b',fid:'',allianceTag:'LUN'},{...player,id:'c',allianceTag:'MBT'}],'3573','LUN');assert.equal(roster.players.length,1);assert.equal(roster.excluded,1);assert.equal(roster.players[0].name,'Exact 名');assert.ok(locationBounds(roster.players).w>=20);
 assert.equal(hiveRoster([player,{...player,id:'dup'}],'3573','LUN').players.length,0);
});
