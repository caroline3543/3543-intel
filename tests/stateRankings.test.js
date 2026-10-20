import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rankingsPath} from '../supabase/functions/whiteoutstats/rankings.js';
import {normalizeRankings,filterRankingRows,rankingScore,rankingProfileUpdates,matchedRankingPlayer} from '../src/services/stateRankingsService.js';
import {assertImportState} from '../src/services/stateWorkspaceService.js';
const wrap=rows=>({retrieved_at:'2026-10-21T00:00:00Z',data:{kid:3573,boards:{personal_power:{rows}}}});
const rows=[{chief_id:123,nick_name:'One',score:200,alliance_abbr:'LUN'},{chief_id:456,nick_name:'Two',score:100,alliance_abbr:'ABC'},{uid:999,nick_name:'Missing FID',score:0}];
test('rankings proxy allowlists boards and validates state and top-100 bounds',()=>{
  assert.equal(rankingsPath('3573','state_transfer',100),'/states/3573/ranks?board=state_transfer&limit=100');
  for(const [state,board,size] of [[0,'kills',100],[3573,'../../usage',100],[3573,'kills',101],[3573,'kills',0],[3573.1,'kills',100],[3573,'kills',2.5]])assert.equal(rankingsPath(state,board,size),null);
});
test('normalization preserves provider order, values and real chief IDs, never substitutes UID',()=>{
  const result=normalizeRankings(wrap(rows),'3573','personal_power');
  assert.equal(result.stateId,'3573');assert.equal(result.rows[0].fid,'123');assert.equal(result.rows[1].rank,2);assert.equal(result.rows[2].fid,null);assert.equal(result.rows[2].score,0);
  assert.equal(result.rows[0].allianceTag,'LUN');
});
test('explicit board wrappers and numeric board keys are supported',()=>{
  const indexed=normalizeRankings({data:{kid:3573,boards:{'3':{rows}}}},'3573','personal_power');assert.equal(indexed.rows.length,3);
  const array=normalizeRankings({data:{boards:[{key:'personal_power',rows}]}},'3573','personal_power');assert.equal(array.rows[0].score,200);
  const direct=normalizeRankings({data:{kid:3573,board:'personal_power',rows}},'3573','personal_power');assert.equal(direct.rows.length,3);
});
test('wrong states, wrong board and unrecognised responses fail without becoming empty successes',()=>{
  assert.throws(()=>normalizeRankings(wrap(rows),'3543','personal_power'),/different state/);
  assert.throws(()=>normalizeRankings(wrap([{kid:3543,chief_id:1}]),'3573','personal_power'),/different state/);
  assert.throws(()=>normalizeRankings({data:{kid:3573,board:'kills',rows}},'3573','personal_power'),/different ranking/);
  assert.throws(()=>normalizeRankings({data:{unexpected:true}},'3573','personal_power'),/Unrecognised/);
});
test('local filters retain actual state ranks rather than renumbering results',()=>{
  const result=normalizeRankings(wrap(rows),'3573','personal_power');
  const filtered=filterRankingRows(result.rows,{alliance:'abc',minimum:'50'});assert.equal(filtered.length,1);assert.equal(filtered[0].rank,2);
  assert.equal(filterRankingRows(result.rows,{query:'456'}).length,1);assert.equal(filterRankingRows(result.rows,{minimum:'150'}).length,1);
  assert.equal(rankingScore({score:55},'furnace'),'FC5');assert.equal(rankingScore({score:0},'kills'),'0');assert.equal(rankingScore({score:null},'kills'),'—');
});
test('saving a ranking adds a snapshot to the unique FID match without altering manual fields or another board',()=>{
  const players=[{id:'local',fid:'123',username:'Manual name',power:900,notes:'Keep',troops:{infantry:'FC8'},eventHistory:[{id:'history'}],providerRankings:{kills:{stateId:'3573',rank:5,score:99}}},{id:'other',fid:'888'}];
  const before=structuredClone(players),result=normalizeRankings(wrap(rows),'3573','personal_power');
  const updates=rankingProfileUpdates(players,result,'3573');assert.equal(updates.length,1);
  assert.deepEqual(players,before);const p=updates[0];assert.equal(p.id,'local');assert.equal(p.power,900);assert.equal(p.username,'Manual name');assert.equal(p.notes,'Keep');assert.deepEqual(p.troops,players[0].troops);assert.deepEqual(p.eventHistory,players[0].eventHistory);
  assert.equal(p.providerRankings.personal_power.score,200);assert.equal(p.providerRankings.kills.score,99);
  assert.throws(()=>rankingProfileUpdates(players,result,'3543'),/correct state/);
});
test('ambiguous FIDs, UID-only records and alliance boards never update player profiles',()=>{
  assert.equal(matchedRankingPlayer([{fid:'123'},{fid:'123'}],'123'),null);
  const result=normalizeRankings(wrap(rows),'3573','personal_power');assert.equal(rankingProfileUpdates([{id:'a',fid:'123'},{id:'b',fid:'123'}],result,'3573').length,0);
  const alliances=normalizeRankings({data:{rows:[{aid:123,name:'Alliance',abbr:'LUN',score:500}]}},'3573','alliance_power');
  assert.equal(rankingProfileUpdates([{id:'a',fid:'123'}],alliances,'3573').length,0);
});
test('backup import rejects rankings belonging to another state',()=>{
  assert.throws(()=>assertImportState({players:[{providerRankings:{kills:{stateId:'3573'}}}]},'3543'),/rankings from a different state/);
});
test('furnace filters use FC tiers rather than raw provider codes',()=>{
  const rows=[{username:'Low',fid:'1',allianceTag:'',score:50},{username:'High',fid:'2',allianceTag:'',score:55}];
  assert.equal(filterRankingRows(rows,{minimum:'5',board:'furnace'}).length,1);
  assert.equal(filterRankingRows(rows,{minimum:'FC5',board:'furnace'})[0].fid,'2');
});
