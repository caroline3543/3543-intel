import { test } from 'node:test';
import assert from 'node:assert/strict';
import { providerFurnaceLevel, providerNumber, profileChanges } from '../src/services/providerProfileService.js';
import { allianceRows, mergeAllianceProfiles } from '../src/services/allianceImportService.js';
const member={chief_id:123,nick_name:'New name',kid:3573,power:'250000000',kills:0,stove_lv:55,alliance_rank:4,x:10,heroes:[{name:'Example',level:80}]};
const rows = data => allianceRows({data:{members:[data]}},'3573','LUN');
test('provider numeric furnace codes follow the provider FC tier boundaries',()=>{
  for(const [input,expected] of [[30,'F30'],[34,'F34'],[35,'FC1'],[39,'FC1'],[40,'FC2'],[55,'FC5'],[70,'FC8'],[80,'FC10'],['FC8','FC8'],['Fire Crystal 5','FC5'],['Furnace 30','F30']])assert.equal(providerFurnaceLevel(input),expected);
  for(const invalid of [null,'',-1,0,85,'unknown',true,{},'FC11'])assert.equal(providerFurnaceLevel(invalid),null);
});
test('refresh updates supplied fields by FID and preserves manual data and linked IDs',()=>{
  const old={id:'stable',fid:'123',username:'Old name',allianceTag:'OLD',furnaceLevel:'FC3',power:1,kills:999,notes:'Keep',troops:{infantry:'FC8'},joinerHeroes:[{hero:'Jessie',skillLevel:5}],eventHistory:[{snapshotId:'history'}],roles:['Rally Lead'],leaderProfile:{teams:[{id:'team'}]}};
  const before=structuredClone(old);
  const result=mergeAllianceProfiles([old],rows(member),'3573');
  const p=result.updated[0];
  assert.deepEqual(old,before);assert.equal(result.added.length,0);assert.equal(p.id,'stable');
  assert.equal(p.username,'New name');assert.equal(p.allianceTag,'LUN');assert.equal(p.allianceRank,'R4');
  assert.equal(p.power,250000000);assert.equal(p.kills,0);assert.equal(p.furnaceLevel,'FC5');
  for(const field of ['notes','troops','joinerHeroes','eventHistory','roles','leaderProfile'])assert.deepEqual(p[field],old[field]);
  assert.deepEqual(p.pastUsernames,['Old name']);assert.equal(p.allianceHistory[0].from,'OLD');
  assert.equal(p.providerStats.raw.x,10);assert.deepEqual(p.providerStats.raw.heroes,member.heroes);
  const again=mergeAllianceProfiles(result.players,rows(member),'3573');assert.equal(again.players.length,1);assert.deepEqual(again.updated[0].pastUsernames,['Old name']);assert.equal(again.updated[0].allianceHistory.length,1);
});
test('missing and invalid provider fields never erase recorded values, while zero remains valid',()=>{
  const old={id:'keep',fid:'123',username:'Keep name',power:42,kills:55,furnaceLevel:'FC8',allianceRank:'R3',notes:'Keep'};
  const p=mergeAllianceProfiles([old],rows({chief_id:123,nick_name:'',kid:3573,power:null,kills:'bad',furnace_level:'unknown'}),'3573').updated[0];
  for(const field of ['username','power','kills','furnaceLevel','allianceRank','notes'])assert.equal(p[field],old[field]);
  assert.equal(providerNumber(0),0);assert.equal(providerNumber('0'),0);assert.equal(providerNumber(-1),null);assert.equal(providerNumber(false),null);
});
test('preview describes the actual changes that will be applied',()=>{
  const changes=profileChanges({username:'New name',power:50,furnaceLevel:'FC1'},rows(member)[0]);
  assert.ok(changes.some(c=>c.field==='power'&&c.before===50&&c.after===250000000));
  assert.ok(changes.some(c=>c.field==='furnaceLevel'&&c.after==='FC5'));
  assert.ok(!changes.some(c=>c.field==='username'));
});
test('duplicate local FIDs and mismatched states fail before any mutation',()=>{
  const old=[{id:'a',fid:'123'},{id:'b',fid:'123'}];
  assert.throws(()=>mergeAllianceProfiles(old,rows(member),'3573'),/multiple profiles/);
  assert.throws(()=>mergeAllianceProfiles(old,rows(member),'3543'),/correct state/);
  assert.deepEqual(old,[{id:'a',fid:'123'},{id:'b',fid:'123'}]);
});
test('raw roster fields cannot overwrite protected manual or identity fields',()=>{
  const old={id:'stable',fid:'123',notes:'Keep',troops:{infantry:'FC8'}};
  const p=mergeAllianceProfiles([old],rows({...member,id:'evil',notes:'replace',troops:null}),'3573').updated[0];
  assert.equal(p.id,'stable');assert.equal(p.notes,'Keep');assert.deepEqual(p.troops,old.troops);assert.equal(p.providerStats.raw.notes,'replace');
});
