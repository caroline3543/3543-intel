import { useCallback } from 'react';
import { mergeAllianceProfiles } from '../services/allianceImportService.js';
import { pushPlayer } from '../services/cloudSyncService.js';
import { activeStateId } from '../services/stateWorkspaceService.js';
export function useAllianceProfileImport(data, setData, showToast) {
  return useCallback(rows => {
    const result = mergeAllianceProfiles(data.players || [], rows, activeStateId());
    setData(prev => ({...prev, players:result.players, lastUpdated:new Date().toISOString()}));
    [...result.added,...result.updated].forEach(player => { void pushPlayer(player,player.allianceTag); });
    showToast(`${result.updated.length} profiles updated · ${result.added.length} added ✓`);
  }, [data.players,setData,showToast]);
}
