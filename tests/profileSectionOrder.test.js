import test from 'node:test';
import assert from 'node:assert/strict';
import {PROFILE_SECTION_IDS,normalizeProfileSectionOrder,moveProfileSection} from '../src/services/profileSectionOrder.js';

test('all eleven sections remain present, including hero power', () => {
  assert.equal(PROFILE_SECTION_IDS.length, 11);
  assert.equal(new Set(PROFILE_SECTION_IDS).size, 11);
  assert.ok(PROFILE_SECTION_IDS.includes('hero-pet-expert-power'));
});
test('unknown, duplicate and legacy preferences never hide sections', () => {
  const actual=normalizeProfileSectionOrder(['teamwork','teamwork','deleted','event-power']);
  assert.deepEqual(actual.slice(0,2),['teamwork','event-power']);
  assert.equal(actual.length,11);
  assert.deepEqual(new Set(actual),new Set(PROFILE_SECTION_IDS));
});
test('keyboard reordering preserves section identity and handles boundaries', () => {
  const start=normalizeProfileSectionOrder();
  assert.deepEqual(moveProfileSection(start,start[0],-1),start);
  const next=moveProfileSection(start,'troop-tiers',-1);
  assert.equal(next[0],'troop-tiers');
  assert.equal(next[1],'event-power');
  assert.deepEqual(new Set(next),new Set(start));
});
test('invalid preferences recover to safe default', () => {
  assert.deepEqual(normalizeProfileSectionOrder(null),PROFILE_SECTION_IDS);
  assert.deepEqual(normalizeProfileSectionOrder({}),PROFILE_SECTION_IDS);
});
