import test from 'node:test';
import assert from 'node:assert/strict';
import {dataFreshness,membershipFreshness} from '../src/services/profileFreshness.js';
const now=Date.parse('2026-11-23T00:00:00Z');
test('missing values are not represented as zero',()=>{assert.equal(dataFreshness(null,null,now).status,'missing');assert.equal(dataFreshness(0,'2026-11-22T00:00:00Z',now).status,'current');});
test('stale metric retains its value and its own timestamp',()=>{const x=dataFreshness(285600000,'2026-09-01T00:00:00Z',now);assert.equal(x.status,'stale');assert.match(x.label,/Outdated/);});
test('unknown dates are not treated as current',()=>{assert.equal(dataFreshness(42,null,now).status,'unknown');assert.equal(dataFreshness(42,'not a date',now).status,'unknown');});
test('membership verification never falls back to profile edit time',()=>{assert.equal(membershipFreshness({profileLastUpdated:'2026-11-23T00:00:00Z'},now).status,'unknown');assert.equal(membershipFreshness({membershipLastSuccessfulAt:'2026-11-20T00:00:00Z',profileLastUpdated:'2026-11-23T00:00:00Z'},now).status,'stale');});
