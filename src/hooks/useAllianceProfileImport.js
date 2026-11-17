import { useCallback } from 'react';
import { mergeAllianceProfiles, reconcileAllianceMembership } from '../services/allianceImportService.js';
import { pushPlayer } from '../services/cloudSyncService.js';
import { activeStateId } from '../services/stateWorkspaceService.js';

/**
 * Apply observed profiles and membership statuses in one local state update.
 * Do not interpret a missing player as departed without authoritative evidence.
 */
export function useAllianceProfileImport(data, setData, showToast) {
  return useCallback((rows, assessment=null) => {
    const stateId=activeStateId();
    const tag=rows[0]?.allianceTag || assessment?.allianceTag;
    if (!tag || !Array.isArray(rows) || !rows.length) throw new Error('No valid alliance roster to import.');
    if (assessment && (assessment.stateId!==String(stateId) ||
        assessment.allianceTag.toUpperCase()!==String(tag).toUpperCase() ||
        assessment.problems.some(problem=>problem!=='completeness_unverified'))) {
      throw new Error('Roster validation failed or state changed. Refresh before importing.');
    }
    const merged=mergeAllianceProfiles(data.players || [], rows, stateId);
    const checkedAt=new Date().toISOString();
    const players=reconcileAllianceMembership(merged.players,rows,tag,checkedAt,assessment);
    const original=new Map((data.players||[]).map(player=>[player.id,player]));
    const changed=players.filter(player=>{
      const before=original.get(player.id);
      return !before || merged.added.some(added=>added.id===player.id) ||
        merged.updated.some(updated=>updated.id===player.id) ||
        before.membershipStatus!==player.membershipStatus ||
        before.membershipCheckedAt!==player.membershipCheckedAt;
    });
    setData(prev=>({...prev,players,lastUpdated:checkedAt}));
    Promise.all(changed.map(player=>pushPlayer(player,player.allianceTag))).then(results=>{
      const failures=results.filter(result=>!result).length;
      if(failures)showToast(`${failures} cloud update(s) failed. Local changes remain.`,'error');
    }).catch(()=>showToast('Cloud update failed. Local changes remain.','error'));
    const unverified=players.filter(player=>
      String(player.allianceTag||'').toUpperCase()===String(tag).toUpperCase() &&
      player.membershipStatus==='unverified').length;
    showToast(`${merged.updated.length} updated · ${merged.added.length} added · ${unverified} unverified`);
    return {updated:merged.updated.length,added:merged.added.length,unverified};
  },[data.players,setData,showToast]);
}
