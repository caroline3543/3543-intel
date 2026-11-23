import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('guarded notes remain opt-in and scoped to 3573',()=>{
 const roster=read('src/components/players/RosterTab.jsx');
 assert.match(roster,/VITE_ENABLE_GUARDED_PROFILE_NOTES==='true'/);
 assert.match(roster,/stateId!=='3573'/);
 assert.match(roster,/beginGuardedProfileEdit/);
 assert.match(roster,/commitGuardedProfileEdit/);
 assert.match(roster,/onApplyConfirmedProfileSave\?\.\(result\)/);
 assert.doesNotMatch(roster.slice(roster.indexOf('async function saveGuardedNotes'),roster.indexOf('  // Keep open profiles current')),/pushPlayer|onSavePlayer\(/);
});

test('guarded notes callback reaches editor and captures original notes',()=>{
 const roster=read('src/components/players/RosterTab.jsx');
 const view=read('src/components/players/ProfileView.jsx');
 const ordered=read('src/components/players/ProfileOrderedSections.jsx');
 const notes=read('src/components/players/ProfilePlanning.jsx');
 assert.match(roster,/onGuardedSaveNotes=\{guardedNotesEnabled\?saveGuardedNotes:null\}/);
 assert.match(view,/<ProfileOrderedSections[^>]*onGuardedSaveNotes=\{onGuardedSaveNotes\}/);
 assert.match(ordered,/<ProfileNotes[^>]*onGuardedSaveNotes=\{onGuardedSaveNotes\}/);
 assert.match(notes,/setOriginalNotes\(player\.notes\?\?null\)/);
 assert.match(notes,/onGuardedSaveNotes\(player,draft,originalNotes\)/);
});

test('confirmed-save local updater cannot call unguarded upsert',()=>{
 const state=read('src/hooks/useAppState.js');
 const start=state.indexOf('const applyConfirmedProfileSave =');
 const end=state.indexOf('const addPlayers =',start);
 assert.ok(start>=0&&end>start);
 const body=state.slice(start,end);
 assert.match(body,/result\?\.persisted !== true/);
 assert.doesNotMatch(body,/pushPlayer|upsert|savePlayer\(/);
});
