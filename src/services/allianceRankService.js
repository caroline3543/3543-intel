export function normalizeAllianceRank(value) {
  const text = String(value ?? '').trim().toUpperCase();
  return /^[1-5]$/.test(text) ? 'R' + text : /^R[1-5]$/.test(text) ? text : null;
}

export function allianceRankFromRoster(member, alliance) {
  const chiefId = String(member.chief_id ?? member.fid ?? '');
  const leaderId = String(alliance?.leader_chief_id ?? '');
  return (/^\d+$/.test(chiefId) && chiefId === leaderId ? 'R5' : null)
    ?? normalizeAllianceRank(member.alliance_rank_label)
    ?? normalizeAllianceRank(member.alliance_rank);
}

export function allianceIdentityFields(player, tag, rank, name) {
  const sameAlliance = !!tag && player?.membershipStatus !== 'transferred_out' && String(player?.allianceTag ?? '').trim() === tag;
  return {
    allianceRank: tag ? normalizeAllianceRank(rank) ?? (sameAlliance ? normalizeAllianceRank(player?.allianceRank) : null) : null,
    allianceName: tag ? String(name ?? '').trim() || (sameAlliance ? player?.allianceName ?? '' : '') : '',
  };
}
