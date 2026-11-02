import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const paths=['players/RosterTab.jsx','stats/IntelTab.jsx','events/EventsTab.jsx','svs/BattleTab.jsx','hive/HiveTab.jsx'];
test('Every core tab has a consistent, explicit workspace purpose',()=>{
 for(const path of paths){
  const source=readFileSync(new URL('../src/components/'+path,import.meta.url),'utf8');
  assert.ok(source.includes('<WorkspaceIntro'),path);
  assert.ok(source.includes('description='),path);
 }
});
test('Workspace introductions use semantic headings and readable text',()=>{
 const source=readFileSync(new URL('../src/components/common/WorkspaceIntro.jsx',import.meta.url),'utf8');
 assert.ok(source.includes('<h2'));
 assert.ok(source.includes('lineHeight:1.5'));
});
