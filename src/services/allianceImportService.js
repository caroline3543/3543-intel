import { newPlayer } from '../data/playerSchema.js';
export function allianceRows(response, stateId, tag) {
  const data = response?.data;
  if (!Array.isArray(data?.members)) throw new Error('The provider did not return an alliance roster.');
  if (data.alliance?.kid && String(data.alliance.kid) !== String(stateId)) throw new Error('The provider returned a different state. Nothing was imported.');
  const seen = new Set();
  return data.members.map(member => {
    if (member.kid && String(member.kid) !== String(stateId)) throw new Error('The roster contains a player from another state. Nothing was imported.');
    return {
      fid: String(member.chief_id ?? member.fid ?? ''), username: member.nick_name || '',
      stateId: String(stateId), allianceTag: tag.trim(),
      power: member.power ?? null, kills: member.kills ?? null,
      furnaceLevel: member.furnace_level ?? null, allianceRank: member.alliance_rank_label ?? null,
      retrievedAt: response.retrieved_at || new Date().toISOString(),
    };
  }).filter(row => {
    if (!/^\d+$/.test(row.fid) || seen.has(row.fid)) return false;
    seen.add(row.fid); return true;
  });
}
export function newAlliancePlayers(existing, rows, stateId) {
  const fids = new Set(existing.filter(p => p.fid).map(p => String(p.fid).trim()));
  const added = [];
  for (const row of rows) {
    if (row.stateId !== String(stateId)) throw new Error('Switch to the correct state before importing.');
    if (fids.has(row.fid)) continue;
    fids.add(row.fid);
    added.push(newPlayer({
      fid: row.fid, username: row.username, allianceTag: row.allianceTag,
      allianceRank: /^R[1-5]$/.test(row.allianceRank || '') ? row.allianceRank : null,
      furnaceLevel: /^FC[1-5]$/.test(String(row.furnaceLevel)) ? row.furnaceLevel : null,
      providerStats: { ...row, source: 'Whiteout Stats' },
    }));
  }
  return added;
}
