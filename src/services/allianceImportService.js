import { assessAllianceRoster } from './allianceRosterValidation.js';
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
    if(row.allianceTag?.trim())snapshot.allianceObservation={tag:row.allianceTag.trim(),at:row.retrievedAt,noAlliance:false};
    const player = {
      ...(previous || newPlayer({fid:row.fid})), ...patch,
      providerStats:snapshot, profileLastUpdated:at, membershipStatus:'confirmed',membershipCheckedAt:at,
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

/**
 * Reconcile a successfully fetched roster without inventing departures.
 * Missing players remain unverified unless the provider explicitly certifies
 * that the returned list is complete and passes all validation checks.
 */
export function reconcileAllianceMembership(players, rows, tag, checkedAt=new Date().toISOString(), assessment=null) {
  const observed=new Set(rows.map(row=>String(row.fid)));
  const authoritative=assessment?.authoritative===true;
  return players.map(player=>{
    if(String(player.allianceTag||'').toUpperCase()!==String(tag).toUpperCase())return player;
    if(observed.has(String(player.fid)))return {...player,membershipStatus:'confirmed',membershipCheckedAt:checkedAt};
    return {...player,membershipStatus:authoritative?'not_in_roster':'unverified',membershipCheckedAt:checkedAt};
  });
}

/** Preview the reconciliation result before writing any records. */
export function previewAllianceMembershipReconciliation(players, response, stateId, tag) {
  const assessment=assessAllianceRoster(response,{stateId,allianceTag:tag});
  if(assessment.problems.some(problem=>problem!=='completeness_unverified'))
    return {assessment,changes:[],safeToApply:false};
  const rows=allianceRows(response,stateId,tag);
  const next=reconcileAllianceMembership(players,rows,tag,response.retrieved_at||new Date().toISOString(),assessment);
  const changes=next.flatMap((player,index)=>{
    const previous=players[index];
    return previous.membershipStatus===player.membershipStatus?[]:[{
      fid:String(player.fid),from:previous.membershipStatus||'unknown',
      to:player.membershipStatus,allianceTag:player.allianceTag
    }];
  });
  return {assessment,changes,safeToApply:true};
}
