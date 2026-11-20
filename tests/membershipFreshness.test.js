import test from 'node:test';
import assert from 'node:assert/strict';
import { membershipFreshness, suspectedTransferOut, reassignReviewedPlayer, applyVerifiedMembership } from '../src/services/rosterViewService.js';

const now = Date.parse('2026-11-19T12:00:00.000Z');
const player = (capturedAt, extra={}) => ({
  allianceTag: 'HOT',
  membershipStatus: 'active',
  providerStats: { capturedAt, retrievedAt: new Date(now).toISOString() },
  ...extra,
});

test('flags an observation older than 72 hours despite a fresh API retrieval', () => {
  const p = player(new Date(now - 73 * 60 * 60 * 1000).toISOString());
  assert.equal(membershipFreshness(p, now), 'stale');
  assert.equal(suspectedTransferOut(p, now), true);
});

test('does not suppress stale flags after manual review', () => {
  const p = player(new Date(now - 73 * 60 * 60 * 1000).toISOString(), {
    membershipReviewedAt: new Date(now).toISOString(),
    allianceTag: '',
  });
  assert.equal(suspectedTransferOut(p, now), true);
});

test('flags missing observation timestamp for review', () => {
  const p = { allianceTag: 'ARC', membershipStatus: 'active', providerStats: {} };
  assert.equal(membershipFreshness(p, now), 'unknown');
  assert.equal(suspectedTransferOut(p, now), true);
});

test('excludes archived transfers', () => {
  const p = player(null, { membershipStatus: 'transferred_out' });
  assert.equal(membershipFreshness(p, now), 'excluded');
  assert.equal(suspectedTransferOut(p, now), false);
});

test('keeps recent provider observations fresh', () => {
  const p = player(new Date(now - 60 * 60 * 1000).toISOString());
  assert.equal(membershipFreshness(p, now), 'fresh');
});

test('manual bulk reassignment preserves history and stale status', () => {
  const p=player(new Date(now-73*3600000).toISOString());
  const updated=reassignReviewedPlayer(p,'ARC',new Date(now).toISOString());
  assert.equal(updated.allianceTag,'ARC');
  assert.equal(updated.allianceHistory.at(-1).from,'HOT');
  assert.equal(updated.allianceHistory.at(-1).to,'ARC');
  assert.equal(membershipFreshness(updated,now),'stale');
});
test('verified membership observation clears stale warning', () => {
  const p=player(new Date(now-73*3600000).toISOString());
  const updated=applyVerifiedMembership(p,{status:'verified',state:'3573',tag:'',at:new Date(now-3600000).toISOString()});
  assert.equal(updated.allianceTag,'');
  assert.equal(updated.allianceHistory.at(-1).from,'HOT');
  assert.equal(membershipFreshness(updated,now),'fresh');
});
test('unverified membership cannot be applied', () => {
  assert.throws(()=>applyVerifiedMembership(player(null),{status:'error',state:'3573',tag:'',at:new Date(now).toISOString()}),/verified/);
});

test('fresh request without captured observation stays unverified', () => {
  const p=player(null);
  assert.equal(membershipFreshness(p,now),'unknown');
});
test('verified membership without alliance change refreshes membership timestamp', () => {
  const p=player(new Date(now-73*3600000).toISOString());
  const updated=applyVerifiedMembership(p,{status:'verified',state:'3573',tag:'HOT',at:new Date(now-3600000).toISOString()});
  assert.equal(updated.allianceTag,'HOT');
  assert.equal(membershipFreshness(updated,now),'fresh');
});
test('archived transfer cannot be manually reallocated', () => {
  assert.throws(()=>reassignReviewedPlayer(player(null,{membershipStatus:'transferred_out'}),'ARC'),/archived/);
});

test('older API snapshot cannot overwrite a newer manual assignment', () => {
  const p=reassignReviewedPlayer(player(new Date(now-73*3600000).toISOString()),'ARC',new Date(now).toISOString());
  assert.throws(()=>applyVerifiedMembership(p,{status:'verified',state:'3573',tag:'HOT',at:new Date(now-3600000).toISOString()}),/predates/);
});
test('newer API snapshot can update a manual assignment', () => {
  const reviewedAt=new Date(now-7200000).toISOString();
  const p=reassignReviewedPlayer(player(new Date(now-73*3600000).toISOString()),'ARC',reviewedAt);
  const updated=applyVerifiedMembership(p,{status:'verified',state:'3573',tag:'RKG',at:new Date(now-3600000).toISOString()});
  assert.equal(updated.allianceTag,'RKG');
});

test('48 hours retains confirmed alliance without review', () => {
 const p=player(new Date(now-48*3600000).toISOString());
 assert.equal(membershipFreshness(p,now),'fresh');
 assert.equal(suspectedTransferOut(p,now),false);
 assert.equal(p.allianceTag,'HOT');
});
test('exactly 72 hours is not overdue; one millisecond later is', () => {
 const p=player(new Date(now-72*3600000).toISOString());
 assert.equal(membershipFreshness(p,now),'fresh');
 assert.equal(membershipFreshness(p,now+1),'stale');
 assert.equal(p.allianceTag,'HOT');
});
test('failed request does not refresh membership freshness or overwrite alliance', () => {
 const p=player(new Date(now-73*3600000).toISOString(),{membershipLastSuccessfulAt:new Date(now-73*3600000).toISOString(),membershipCheckedAt:new Date(now).toISOString()});
 assert.equal(membershipFreshness(p,now),'stale');
 assert.equal(p.allianceTag,'HOT');
});
test('verified empty alliance retains history and clears overdue review', () => {
 const p=player(new Date(now-73*3600000).toISOString());
 const updated=applyVerifiedMembership(p,{status:'verified',state:'3573',tag:'',at:new Date(now-3600000).toISOString()});
 assert.equal(updated.allianceTag,'');
 assert.equal(updated.lastKnownAlliance,'HOT');
 assert.equal(updated.membershipLastSuccessfulAt,new Date(now-3600000).toISOString());
 assert.equal(membershipFreshness(updated,now),'fresh');
});
