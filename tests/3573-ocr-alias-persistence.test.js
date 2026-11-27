import test from 'node:test';
import assert from 'node:assert/strict';
import {createSharedWorkspace} from '../roster-site/src/sharedWorkspace.js';
import {sharedData,validateWorkspace} from '../roster-site/shared/workspace.js';
import {createScreenshotMatcher} from '../roster-site/src/foundry/screenshotImportPlan.js';

test('confirmed OCR alias travels through shared workspace to independent device', async () => {
 const initial=sharedData({players:[{id:'hermes',username:'HΞRMΞS',allianceTag:'HOT'},{id:'other',username:'Other',allianceTag:'HOT'}]});
 let remote={revision:1,data:initial}, fail=false;
 const request=async(method,input)=>{
  if(method==='GET')return structuredClone(remote);
  if(fail)throw Error('Simulated offline save');
  if(input.revision!==remote.revision)return {...structuredClone(remote),conflict:true};
  validateWorkspace(input.data);
  remote={revision:remote.revision+1,data:structuredClone(input.data)};
  return structuredClone(remote);
 };
 const device=()=>{let saved;return createSharedWorkspace({initial:sharedData({}),request,cache:{read:async()=>structuredClone(saved),write:async value=>{saved=structuredClone(value);}}});};
 const a=device(),b=device(),c=device();
 const match=(d,reading)=>createScreenshotMatcher(d.getState().local.players.map(p=>({...p,name:p.username,alliance:p.allianceTag})),'HOT')(reading);
 try {
  await a.initialize();await b.initialize();
  assert.equal(match(b,'HERMES').player,null);
  await a.update(prev=>({...prev,players:prev.players.map(p=>p.id==='hermes'?{...p,ocrAliases:['HERMES']}:p)}));
  fail=true;await a.sync();
  assert.ok(a.getState().issue);
  await b.sync();assert.equal(match(b,'HERMES').player,null);
  fail=false;await a.sync();
  assert.deepEqual(a.getState().base.players[0].ocrAliases,['HERMES']);
  await b.sync();assert.equal(match(b,'HERMES').player?.id,'hermes');
  await c.initialize();assert.equal(match(c,'HERMES').player?.id,'hermes');
  assert.equal(remote.data.players[0].username,'HΞRMΞS');
  assert.deepEqual(remote.data.players[1],initial.players[1]);
  await b.update(prev=>({...prev,players:prev.players.map(p=>p.id==='other'?{...p,ocrAliases:['HERMES']}:p)}));
  await b.sync();await a.sync();
  assert.equal(match(a,'HERMES').player,null,'Conflicting shared aliases must never auto-match');
 } finally {a.dispose();b.dispose();c.dispose();}
});
