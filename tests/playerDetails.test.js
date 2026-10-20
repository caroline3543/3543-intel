import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyPlayerDetails,normalizePlayerDetails,heroStars} from '../src/services/playerDetailsService.js';
import {playerDetailsPath} from '../supabase/functions/whiteoutstats/playerDetails.js';
import {assertImportState} from '../src/services/stateWorkspaceService.js';
const player={id:'stable',fid:'596099868',username:'Old',power:42,furnaceLevel:'FC3',notes:'Keep',joinerHeroes:[{hero:'Jessie',skillLevel:5}],leaderProfile:{teams:[{id:'manual'}]}};
const response=(extra={},base={})=>({retrieved_at:'2026-10-20T12:00:00Z',data:{ok:true,chief_id:'596099868',player:{chief_id:'596099868',kid:3573,...base},...extra}});
test('player route permits only a validated chief ID and fixed profile sections',()=>{
 assert.equal(playerDetailsPath(3573,'596099868'),'/players/596099868?include=base,heroes,ranks,chief_gear');
 for(const fid of ['123','../players','1234?include=events','0',null])assert.equal(playerDetailsPath(3573,fid),null);
 for(const state of [0,100000,{},true])assert.equal(playerDetailsPath(state,'596099868'),null);
});
test('details update supplied stats while preserving identity and manual setups',()=>{
 const before=structuredClone(player),heroes=[{id:1,stars:4,exclusive_gear_level:0,gear:[{enhancement_level:100,refine_level:10}]}];
 const p=applyPlayerDetails(player,response({heroes,chief_gear:{hidden:false,items:[]},unknown:{keep:true}},{nick_name:'New',power:99,furnace_level:40}),'3573');
 assert.deepEqual(player,before);assert.equal(p.id,'stable');assert.equal(p.power,99);assert.equal(p.furnaceLevel,'FC2');
 for(const k of ['notes','joinerHeroes','leaderProfile'])assert.deepEqual(p[k],player[k]);
 assert.deepEqual(p.providerDetails.heroes.items,heroes);assert.deepEqual(p.providerDetails.raw.unknown,{keep:true});
});
test('mismatched state, any conflicting ID, and UID-only responses fail atomically',()=>{
 const before=structuredClone(player);
 for(const r of [response({}, {kid:3543}),response({chief_id:'999999'}),response({}, {fid:'888888'}),{retrieved_at:'2026-10-20T12:00:00Z',data:{player:{uid:'596099868',kid:3573}}}])assert.throws(()=>applyPlayerDetails(player,r,'3573'));
 assert.deepEqual(player,before);
});
test('missing or null sections preserve old snapshots, hidden gear clears visible items',()=>{
 const old={...player,providerDetails:{stateId:'3573',fid:player.fid,heroes:{items:[{id:1}],retrievedAt:'old'},chiefGear:{items:[{name:'Old gear'}],retrievedAt:'old'}}};
 const kept=normalizePlayerDetails(response({heroes:null}),old,'3573').details;
 assert.deepEqual(kept.heroes,old.providerDetails.heroes);assert.deepEqual(kept.chiefGear,old.providerDetails.chiefGear);
 const hidden=normalizePlayerDetails(response({chief_gear:{hidden:true,message:'Private'}}),old,'3573').details;
 assert.deepEqual(hidden.chiefGear.items,[]);assert.equal(hidden.chiefGear.hidden,true);
});
test('nested sections work; malformed sections reject the entire refresh',()=>{
 assert.equal(normalizePlayerDetails(response({}, {heroes:[{id:2}]}),player,'3573').details.heroes.items[0].id,2);
 for(const extra of [{heroes:{}},{chief_gear:[]},{chief_gear:{hidden:false}}])assert.throws(()=>applyPlayerDetails(player,response(extra),'3573'));
});
test('old equipment from another state is never retained or imported',()=>{
 const p={...player,providerDetails:{stateId:'3543',fid:player.fid,heroes:{items:[{id:1}]}}};
 assert.equal(normalizePlayerDetails(response(),p,'3573').details.heroes,undefined);
 assert.throws(()=>assertImportState({players:[p]},'3573'),/equipment/);
});
test('missing core stats survive refresh and stars never decode unknown raw codes',()=>{
 const p=applyPlayerDetails(player,response(),'3573');assert.equal(p.power,42);assert.equal(p.furnaceLevel,'FC3');
 assert.equal(heroStars({star_label:'4.2 stars',star:402}),'4.2 stars');assert.equal(heroStars({stars:0}),'0');assert.equal(heroStars({star:402}),null);assert.equal(heroStars({stars:''}),null);assert.equal(heroStars({stars:false}),null);
});
