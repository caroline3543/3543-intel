import { supabase } from './supabaseClient.js';

/**
 * Authenticated server-side proxy. Never store the Whiteout Stats secret in Vite variables.
 * Requires signed-in Supabase user allowlisted by the Edge Function.
 */
export async function mightpulseRequest(action, params = {}) {
  if (!supabase) throw new Error('Supabase is not configured');
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session?.access_token) throw new Error('Officer sign-in is required');
  const { data, error } = await supabase.functions.invoke('whiteoutstats', {
    body: { action, ...params },
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (error) {
    let detail = null;
    if (error.context instanceof Response) {
      try { detail = await error.context.clone().json(); } catch { /* Non-JSON gateway response. */ }
    }
    const status = detail?.provider_status ? ` (provider HTTP ${detail.provider_status})` : '';
    const providerDetail = typeof detail?.provider_error === 'string' ? `: ${detail.provider_error}` : '';
    throw new Error(detail?.error ? detail.error + status + providerDetail : error.message || 'Whiteout Stats request failed');
  }
  return data;
}

export function fetchMightpulseUsage() { return mightpulseRequest('usage'); }
export function fetchMightpulseAlliance(state, tag) {
  return mightpulseRequest('alliance', { state, tag });
}
export function fetchMightpulseKingdom(state) {
  return mightpulseRequest('kingdom', { state });
}
export function fetchMightpulsePlayer(fid) {
  return mightpulseRequest('player', { fid: String(fid) });
}

/**
 * PREVIEW ONLY. Link by immutable in-game FID, not local id/username.
 * Never overwrite the app's manual fields or remove absent members.
 */
export function previewMightpulseRoster(existingPlayers, response) {
  const remote = response?.data?.members || [];
  if (!Array.isArray(remote)) throw new Error('Invalid roster response');
  const localByFid = new Map(existingPlayers.filter(p => p.fid)
    .map(p => [String(p.fid), p]));
  return remote.map(member => {
    const fid = String(member.chief_id ?? member.fid ?? '');
    const existing = localByFid.get(fid);
    return {
      fid,
      localId: existing?.id || null,
      action: existing ? 'review-update' : 'review-new',
      oldName: existing?.username || null,
      username: member.nick_name ?? '',
      state: member.kid ?? null,
      allianceRank: member.alliance_rank_label ?? null,
      power: member.power ?? null,
      kills: member.kills ?? null,
      furnaceLevel: member.furnace_level ?? null,
    };
  }).filter(row => /^\d+$/.test(row.fid));
}
