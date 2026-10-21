import {withGameLanguage} from './gameLanguageService.js';
import { recordPlayerObservation, PROFILE_HISTORY_FIELDS } from './playerObservationService.js';
import { newPlayer } from '../data/playerSchema.js';
import { providerNumber, providerProfilePatch } from './providerProfileService.js';
export function allianceRows(response, stateId, tag) {
  const data = response?.data;
  if (!Array.isArray(data?.members)) throw new Error('The provider did not return an alliance roster.');
  if (data.alliance?.kid && String(data.alliance.kid) !== String(stateId)) throw new Error('The provider returned a different state. Nothing was imported.');
  const seen = new Set();
  return data.members.map(member => {
    if (member.kid && String(member.kid) !== String(stateId)) throw new Error('The roster contains a player from another state. Nothing was imported.');
    const rank = member.alliance_rank_label ?? (member.alliance_rank != null ? `R${member.alliance_rank}` : null);
    return {
      fid: String(member.chief_id ?? member.fid ?? member.governor_id ?? ''), username: member.nick_name || '',
      stateId: String(stateId), allianceTag: tag.trim(),
      avatarUrl: member.avatar_url ?? null,
      power: providerNumber(member.power), kills: providerNumber(member.kills),
      furnaceLevel: member.furnace_level ?? member.stove_lv ?? member.town_center_level ?? null,
      furnaceLabel: member.furnace_level_label ?? member.tg_label ?? null,
      allianceRank: rank, raw: structuredClone(member),
      retrievedAt: response.retrieved_at || new Date().toISOString(),
    };
  }).filter(row => {
    if (!/^\d+$/.test(row.fid) || seen.has(row.fid)) return false;
    seen.add(row.fid); return true;
  });
}
export function mergeAllianceProfiles(existing, rows, stateId) {
  const players = [...existing], byFid = new Map();
  existing.forEach((p,index) => {
    const fid = String(p.fid || '').trim();
    if (fid) byFid.set(fid, [...(byFid.get(fid) || []), index]);
  });
  const added = [], updated = [], seen = new Set();
  for (const row of rows) {
    if (row.stateId !== String(stateId)) throw new Error('Switch to the correct state before importing.');
    if (!/^\d+$/.test(row.fid) || seen.has(row.fid)) continue;
    seen.add(row.fid);
    const matches = byFid.get(row.fid) || [];
    if (matches.length > 1) throw new Error(`FID ${row.fid} matches multiple profiles. Resolve the duplicates before importing.`);
    const index = matches[0];
    const previous = index == null ? null : players[index];
    const patch = providerProfilePatch(row);
    const at = new Date().toISOString();
    const snapshot = {...(previous?.providerStats || {})};
    for (const [key,value] of Object.entries(row)) if (value != null && value !== '') snapshot[key] = value;
    snapshot.raw = {...previous?.providerStats?.raw, ...row.raw};
    snapshot.source = 'Whiteout Stats';
    const player = {
      ...(previous || newPlayer({fid:row.fid})), ...patch,
      providerStats:snapshot, profileLastUpdated:at,
      ...(patch.furnaceLevel && patch.furnaceLevel !== previous?.furnaceLevel ? {tiersUpdatedAt:at} : {}),
    };
    if (previous?.username && patch.username && previous.username !== patch.username) {
      const history = previous.pastUsernames || [];
      player.pastUsernames = history.at(-1) === previous.username ? history : [...history, previous.username];
    }
    if (previous && patch.allianceTag && previous.allianceTag !== patch.allianceTag) {
      player.allianceHistory = [...(previous.allianceHistory || []), {from:previous.allianceTag || '',to:patch.allianceTag,at}];
    }
    const tracked=recordPlayerObservation(previous,withGameLanguage(player,previous?.gameLanguage),{stateId,stream:'profile',observedAt:row.retrievedAt,values:Object.fromEntries(PROFILE_HISTORY_FIELDS.filter(key=>patch[key]!=null).map(key=>[key,patch[key]]))});
    if (previous) { players[index] = tracked; updated.push(tracked); }
    else { players.push(tracked); added.push(tracked); }
  }
  return {players, added, updated};
}
export function newAlliancePlayers(existing, rows, stateId) {
  return mergeAllianceProfiles(existing,rows,stateId).added;
}
