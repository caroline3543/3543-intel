import { gameLanguageCode } from './gameLanguageService.js';

// Request only missing settings, sequentially to respect provider limits.
export async function enrichAllianceLanguages(rows, stateId, request, onProgress = () => {}) {
  const enriched = rows.map(row => ({...row, raw:{...row.raw}}));
  let checked = 0, failed = 0, limited = false;
  const missing = enriched.filter(row => !gameLanguageCode(row.raw.language));
  for (const row of missing) {
    try {
      const response = await request(row.fid);
      const body = response?.data, player = body?.player;
      const ids = [body?.chief_id, player?.chief_id, player?.fid].filter(id => id != null && id !== '');
      if (!player || !ids.length || ids.some(id => String(id) !== row.fid) || String(player.kid) !== String(stateId)) {
        throw new Error('Player identity or state did not match');
      }
      const language = gameLanguageCode(player.language);
      if (language) row.raw.language = language;
    } catch (error) {
      failed++;
      if (error.status === 429 || error.providerStatus === 429) limited = true;
    }
    checked++;
    onProgress({checked, total:missing.length});
    if (limited) break;
  }
  return {rows:enriched, failed, limited, known:enriched.filter(row => gameLanguageCode(row.raw.language)).length};
}
