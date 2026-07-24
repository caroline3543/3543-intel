import { supabase } from './supabaseClient.js';

// ── cloudSyncService ─────────────────────────────────────────
// Push/pull helpers for the "roster + battle plans sync" feature.
// Every function is fail-soft: if Supabase isn't configured, or the
// network call fails, these resolve to false/null rather than throwing —
// localStorage is always the source of truth the app can fall back to.

export function isCloudConfigured() {
  return !!supabase;
}

// ── Push (one row at a time — never overwrites unrelated rows) ──

export async function pushPlayer(player, allianceTag = '') {
  if (!supabase) return false;
  const { error } = await supabase
    .from('players')
    .upsert({ id: player.id, alliance_tag: allianceTag, data: player, updated_at: new Date().toISOString() });
  if (error) { console.error('[3543 Intel] pushPlayer failed', error); return false; }
  return true;
}

export async function deletePlayerRemote(id) {
  if (!supabase) return false;
  const { error } = await supabase.from('players').delete().eq('id', id);
  if (error) { console.error('[3543 Intel] deletePlayerRemote failed', error); return false; }
  return true;
}

export async function pushPlan(plan, allianceTag = '') {
  if (!supabase) return false;
  const { error } = await supabase
    .from('svs_plans')
    .upsert({ id: plan.id, alliance_tag: allianceTag, data: plan, updated_at: new Date().toISOString() });
  if (error) { console.error('[3543 Intel] pushPlan failed', error); return false; }
  return true;
}

export async function deletePlanRemote(id) {
  if (!supabase) return false;
  const { error } = await supabase.from('svs_plans').delete().eq('id', id);
  if (error) { console.error('[3543 Intel] deletePlanRemote failed', error); return false; }
  return true;
}

// ── Pull everything (used by the manual Sync button) ──

export async function pullAll() {
  if (!supabase) return null;
  const [playersRes, plansRes] = await Promise.all([
    supabase.from('players').select('data'),
    supabase.from('svs_plans').select('data'),
  ]);
  if (playersRes.error || plansRes.error) {
    console.error('[3543 Intel] pullAll failed', playersRes.error || plansRes.error);
    return null;
  }
  return {
    players:  (playersRes.data  || []).map(r => r.data),
    svsPlans: (plansRes.data || []).map(r => r.data),
  };
}
