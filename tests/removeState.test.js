import {test} from 'node:test';
import assert from 'node:assert/strict';
import {removeWorkspace} from '../src/services/stateWorkspaceService.js';
const key='svs_state_workspaces_v1';
function memory(states=['3543','3573','9999'],activeStateId='9999') {
  const map=new Map([[key,JSON.stringify({version:1,states,activeStateId})],['svs_rally_data:state:9999','original saved players'],['svs_rally_data:state:3543','other players']]);
  return {map,getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};
}
test('remove wrong active state switches to a remaining state and retains every record',()=>{
  const s=memory();const next=removeWorkspace(s,'9999');
  assert.deepEqual(next.states,['3543','3573']);assert.equal(next.activeStateId,'3543');
  assert.equal(s.getItem('svs_rally_data:state:9999'),'original saved players');
  assert.equal(s.getItem('svs_rally_data:state:3543'),'other players');
  assert.deepEqual(JSON.parse(s.getItem(key)),next);
});
test('remove inactive state leaves current state selected and reads latest registry',()=>{
  const s=memory(['3543','3573'],'3573');const next=removeWorkspace(s,'3543');
  assert.equal(next.activeStateId,'3573');assert.deepEqual(next.states,['3573']);
});
test('last state cannot be removed and missing/invalid states do not change data',()=>{
  const s=memory(['3543'],'3543');const before=[...s.map];
  assert.throws(()=>removeWorkspace(s,'3543'),/correct state/);
  assert.throws(()=>removeWorkspace(s,'9999'),/no longer/);
  assert.throws(()=>removeWorkspace(s,'bad'),/valid state/);
  assert.deepEqual([...s.map],before);
});
test('registry write failure leaves the state and its records intact',()=>{
  const s=memory();const before=[...s.map];s.setItem=()=>{throw new Error('Storage unavailable');};
  assert.throws(()=>removeWorkspace(s,'9999'),/Storage unavailable/);assert.deepEqual([...s.map],before);
});
