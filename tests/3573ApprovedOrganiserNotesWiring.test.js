import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/components/players/RosterTab.jsx',import.meta.url),'utf8');
test('approved organiser editing is controlled by separate opt-in flag',()=>{
 assert.match(source,/VITE_ENABLE_3573_APPROVED_ORGANISER_NOTES==='true'/);
 assert.match(source,/approvedOrganiserNotesEnabled\|\|import\.meta\.env\.VITE_ENABLE_GUARDED_PROFILE_NOTES/);
});
test('approved organiser notes use guarded read and patch without unguarded fallback',()=>{
 assert.match(source,/readApproved3573Profile\(\{playerId:player\.id,stateId,client:supabase\}\)/);
 assert.match(source,/saveApproved3573Profile\(\{snapshot,changes:\{notes\},expectedFields:\{notes:originalNotes\},stateId,client:supabase\}\)/);
 assert.match(source,/if\(!result\.persisted\)return result/);
});
