import { supabase } from './supabaseClient.js';

/**
 * Public read-only server-side lookups. Never store the Whiteout Stats secret in Vite variables.
 * The Edge Function must enforce request validation and durable rate limits before enabling anonymous calls.
 */
export async function mightpulseRequest(action, params = {}) {
  if (import.meta.env.VITE_ROSTER_API === 'true') {
    const response=await fetch('/api/lookup',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({action,...params})});
    const payload=await response.json().catch(()=>({error:'Unable to read the server response.'}));
    if(!response.ok){if(response.status===401)window.dispatchEvent(new Event('roster:locked'));const error=new Error(payload.error||'Unable to refresh game data.');error.status=response.status;error.providerStatus=payload.provider_status;throw error;}
    return payload;
  }
  if (!supabase) throw new Error('Supabase is not configured');
  const { data, error } = await supabase.functions.invoke('whiteoutstats', {
    body: { action, ...params },
  });
  if (error) {
    let detail = null;
    if (error.context instanceof Response) {
      try { detail = await error.context.clone().json(); } catch { /* Non-JSON gateway response. */ }
    }
    const status = detail?.provider_status ? ` (provider HTTP ${detail.provider_status})` : '';
    const providerDetail = typeof detail?.provider_error === 'string' ? `: ${detail.provider_error}` : '';
    const failure=new Error(detail?.error ? detail.error + status + providerDetail : error.message || 'Whiteout Stats request failed');
    failure.status=error.context instanceof Response?error.context.status:null;
    failure.providerStatus=detail?.provider_status || null;
    throw failure;
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
