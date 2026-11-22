import {PRIORITY_ALLIANCES} from '../../src/services/state3573Alliances.js';
import {allianceRows, mergeAllianceProfiles} from '../../src/services/allianceImportService.js';
import {membershipTimestamp} from '../../src/services/rosterViewService.js';
import {verifiedAllianceRoster} from '../../src/services/verifiedPlayerLocation.js';

const state = '3573';
const fidOf = player => String(player.fid ?? '').trim();
const newerThanRoster = (player, observedAt) => {
  const last = membershipTimestamp(player?.membershipLastSuccessfulAt ?? player?.membershipObservedAt);
  const manual = membershipTimestamp(player?.manualMembershipAt);
  const observed = Date.parse(observedAt);
  return last > observed || manual >= observed;
};

export function preparePriorityRefresh(workspace, responses, now = Date.now()) {
  const succeeded = [];
  const unavailable = [];
  const sightings = new Map();
  const observations = new Map();
  for (const tag of PRIORITY_ALLIANCES) {
    try {
      const response = responses.get(tag);
      const verified = verifiedAllianceRoster(response, state, tag, now);
      const rows = allianceRows({data:response.data ?? response, retrieved_at:new Date(now).toISOString()}, state, tag);
      if (rows.length !== verified.members.length) throw Error('Incomplete roster');
      succeeded.push(tag);
      observations.set(tag, verified.observedAt);
      for (const row of rows) {
        const previous = sightings.get(row.fid);
        sightings.set(row.fid, previous === undefined ? {...row, capturedAt:verified.observedAt} : null);
      }
    } catch {
      unavailable.push(tag);
    }
  }
  if (!succeeded.length) return {succeeded, unavailable, missing:[], found:0};

  const existing = workspace.players ?? [];
  const counts = new Map();
  const byFid = new Map();
  for (const player of existing) {
    const fid = fidOf(player);
    counts.set(fid, (counts.get(fid) ?? 0) + 1);
    byFid.set(fid, player);
  }
  const missing = existing.filter(player =>
    player.membershipStatus !== 'transferred_out' &&
    observations.has(player.allianceTag) &&
    !newerThanRoster(player, observations.get(player.allianceTag)) &&
    /^[1-9]\d{3,14}$/.test(fidOf(player)) &&
    counts.get(fidOf(player)) === 1 &&
    !sightings.has(fidOf(player))
  ).map(fidOf);

  const rows = [...sightings.values()].filter(row => {
    if (!row || (counts.get(row.fid) ?? 0) > 1) return false;
    const prior = byFid.get(row.fid);
    if (prior?.membershipStatus === 'transferred_out') return false;
    return !newerThanRoster(prior, row.capturedAt);
  });
  const merged = mergeAllianceProfiles(existing, rows, state);
  const applied = new Set([...merged.added, ...merged.updated].map(fidOf));
  const atByFid = new Map(rows.map(row => [row.fid, row.capturedAt]));
  const players = merged.players.map(player => {
    const fid = fidOf(player);
    if (!applied.has(fid)) return player;
    const at = atByFid.get(fid);
    return {...player, membershipObservedAt:at, membershipLastSuccessfulAt:at, membershipCheckedAt:at};
  });
  return {
    succeeded, unavailable, missing, found:sightings.size,
    workspace:{...workspace, players, settings:{...workspace.settings, lastApiRefresh:{
      at:new Date(now).toISOString(), scope:'Priority alliance rosters', count:sightings.size
    }}}
  };
}
