import { normalizeStateId } from './stateWorkspaceService.js';
// Capture the workspace once so an in-flight request cannot follow a state switch.
export function createScopedCloud(client, state) {
  const stateId = normalizeStateId(state);
  async function push(table, record, allianceTag = '') {
    if (!client) return false;
    try {
      const { error } = await client.from(table).upsert({
        id:record.id, state_id:stateId, alliance_tag:allianceTag,
        data:record, updated_at:new Date().toISOString(),
      }, {onConflict:'state_id,id'});
      return !error;
    } catch { return false; }
  }
  async function remove(table, id) {
    if (!client) return false;
    try {
      const {error} = await client.from(table).delete().eq('state_id',stateId).eq('id',id);
      return !error;
    } catch { return false; }
  }
  async function pull() {
    if (!client) return null;
    try {
      const [players, plans] = await Promise.all([
        client.from('players').select('data').eq('state_id',stateId),
        client.from('svs_plans').select('data').eq('state_id',stateId),
      ]);
      if (players.error || plans.error) return null;
      return {players:(players.data||[]).map(r=>r.data),svsPlans:(plans.data||[]).map(r=>r.data)};
    } catch { return null; }
  }
  return {push, remove, pull};
}
