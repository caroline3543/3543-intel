import test from 'node:test';
import assert from 'node:assert/strict';
import {normaliseRallyPreferences,joinerPreference} from '../src/services/talTeamPreferences.js';

test('TAL planner retains boolean preference contract',()=>{
 const p=normaliseRallyPreferences({players:{one:{priority:true,reliable:null,strategy:false}}});
 assert.equal(p.players.one.priority,true);
 assert.equal(p.players.one.reliable,false);
 assert.equal(p.players.one.strategy,false);
 assert.equal(joinerPreference('one',p).priority,true);
});
test('profile assessment can represent unknown without altering TAL preferences',()=>{
 const profile={teamworkTraitStates:{reliable:null,strategy:false,voice:true}};
 const tal=normaliseRallyPreferences({players:{one:{priority:true,reliable:true}}});
 assert.equal(profile.teamworkTraitStates.reliable,null);
 assert.equal(profile.teamworkTraitStates.strategy,false);
 assert.equal(profile.teamworkTraitStates.voice,true);
 assert.equal(tal.players.one.reliable,true);
});
