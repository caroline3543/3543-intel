import { activeStateId } from './stateWorkspaceService.js';
import { supabase } from './supabaseClient.js';
import { createScopedCloud } from './scopedCloudService.js';
let scoped;
const cloud = () => scoped ||= createScopedCloud(supabase, activeStateId());
export function isCloudConfigured() { return !!supabase; }
// Roster and plans only; other collections retain their existing local persistence.
export function pushPlayer(player, allianceTag = '') { return cloud().push('players',player,allianceTag); }
export function pushPlan(plan, allianceTag = '') { return cloud().push('svs_plans',plan,allianceTag); }
export function deletePlayerRemote(id) { return cloud().remove('players',id); }
export function deletePlanRemote(id) { return cloud().remove('svs_plans',id); }
export function pullAll() { return cloud().pull(); }
