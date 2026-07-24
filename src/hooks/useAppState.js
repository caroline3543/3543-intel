import { useState, useEffect, useCallback } from 'react';
import { loadFromStorage, saveToStorage, mergeImportedData } from '../services/exportImportService.js';
import {
  pushPlayer, deletePlayerRemote, pushPlan, deletePlanRemote, pullAll, isCloudConfigured,
} from '../services/cloudSyncService.js';
import { newPlayer } from '../data/playerSchema.js';
import { withBuiltinRole } from '../utils/roles.js';

import defaultData from '../data/defaultData.json';

const TOAST_DURATION = 2800;

/**
 * useAppState
 *
 * Central state hook for the app.
 * App.jsx stays a thin coordinator — all state lives here.
 */
export function useAppState() {
  const [data, setData]           = useState(() => loadFromStorage(defaultData));
  const [toast, setToast]         = useState(null);
  const [syncStatus, setSyncStatus] = useState('idle'); // idle | syncing | error
  const [lastSyncedAt, setLastSyncedAt] = useState(null);

  // Auto-save on every data change
  useEffect(() => { saveToStorage(data); }, [data]);

  // ── Toast ─────────────────────────────────────────────────
  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), TOAST_DURATION);
  }, []);

  // Warn user if localStorage is full
  useEffect(() => {
    function handler() {
      showToast('⚠️ Storage full — export your data now to avoid losing changes', 'error');
    }
    window.addEventListener('sunfire:storage-full', handler);
    return () => window.removeEventListener('sunfire:storage-full', handler);
  }, [showToast]);

  const allianceTag = () => data.settings?.allianceTag || '';

  // ── Player operations ─────────────────────────────────────
  const savePlayer = useCallback((player) => {
    setData(prev => {
      const isEdit = prev.players.some(p => p.id === player.id);
      return {
        ...prev,
        players: isEdit
          ? prev.players.map(p => p.id === player.id ? player : p)
          : [...prev.players, player],
        lastUpdated: new Date().toISOString(),
      };
    });
    pushPlayer(player, allianceTag()); // fire-and-forget cloud push
    showToast('Player saved ✓');
  }, [showToast]);

  const addPlayers = useCallback((newPlayers) => {
    setData(prev => ({
      ...prev,
      players: [...prev.players, ...newPlayers],
      lastUpdated: new Date().toISOString(),
    }));
    newPlayers.forEach(p => pushPlayer(p, allianceTag()));
    if (newPlayers.length) showToast(`${newPlayers.length} player${newPlayers.length !== 1 ? 's' : ''} added ✓`);
  }, [showToast]);

  const updatePlayers = useCallback((updatedPlayers) => {
    setData(prev => ({
      ...prev,
      players: prev.players.map(p => {
        const u = updatedPlayers.find(u => u.id === p.id);
        return u ? u : p;
      }),
      lastUpdated: new Date().toISOString(),
    }));
    updatedPlayers.forEach(p => pushPlayer(p, allianceTag()));
    if (updatedPlayers.length) showToast(`${updatedPlayers.length} updated ✓`);
  }, [showToast]);

  const deletePlayer = useCallback((id) => {
    setData(prev => ({
      ...prev,
      players: prev.players.filter(p => p.id !== id),
      lastUpdated: new Date().toISOString(),
    }));
    deletePlayerRemote(id);
    showToast('Player removed');
  }, [showToast]);

  // ── Event operations ──────────────────────────────────────
  const createEvent = useCallback((ev) => {
    setData(prev => ({
      ...prev,
      events: [...(prev.events || []), ev],
      lastUpdated: new Date().toISOString(),
    }));
    showToast('Event created ✓');
  }, [showToast]);

  const updateEvent = useCallback((ev) => {
    setData(prev => ({
      ...prev,
      events: (prev.events || []).map(e => e.id === ev.id ? ev : e),
      lastUpdated: new Date().toISOString(),
    }));
  }, []);

  const deleteEvent = useCallback((id) => {
    setData(prev => ({
      ...prev,
      events: (prev.events || []).filter(e => e.id !== id),
      lastUpdated: new Date().toISOString(),
    }));
    showToast('Event deleted');
  }, [showToast]);

  // ── SvS plan operations ───────────────────────────────────
  // Note: saveSvsPlans replaces the whole array (existing behavior), so on
  // every call we push every plan in it — fine at this data volume (a
  // handful of plans per alliance), and guarantees nothing gets missed.
  const saveSvsPlans = useCallback((plans) => {
    setData(prev => ({ ...prev, svsPlans: plans, lastUpdated: new Date().toISOString() }));
    plans.forEach(p => pushPlan(p, allianceTag()));
  }, []);

  const deleteSvsPlan = useCallback((id) => {
    setData(prev => ({
      ...prev,
      svsPlans: (prev.svsPlans || []).filter(p => p.id !== id),
      lastUpdated: new Date().toISOString(),
    }));
    deletePlanRemote(id);
    showToast('Plan deleted');
  }, [showToast]);

  // ── Prep scores ───────────────────────────────────────────
  const updatePrepScores = useCallback((scores) => {
    setData(prev => ({ ...prev, prepScores: scores, lastUpdated: new Date().toISOString() }));
  }, []);

  // ── Settings ──────────────────────────────────────────────
  const saveSettings = useCallback((settings) => {
    setData(prev => ({ ...prev, settings, lastUpdated: new Date().toISOString() }));
  }, []);

  // ── Player roles ──────────────────────────────────────────
  // "Rally Lead" is the only built-in role (see utils/roles.js) — every
  // other role is alliance-defined. saveCustomRoles replaces the whole
  // custom-roles array, same pattern as saveSvsPlans; create/rename/
  // delete/reorder in the UI all go through this one setter.
  const saveCustomRoles = useCallback((customRoles) => {
    setData(prev => ({ ...prev, customRoles, lastUpdated: new Date().toISOString() }));
  }, []);

  // ── Import ────────────────────────────────────────────────
  const applyImport = useCallback((imported, mode) => {
    setData(prev => {
      if (mode === 'merge') return { ...mergeImportedData(prev, imported), lastUpdated: new Date().toISOString() };
      return { ...prev, ...imported, lastUpdated: new Date().toISOString() };
    });
    showToast(`Imported (${mode}) ✓`);
  }, [showToast]);

  // ── Cloud sync (manual pull — "🔄 Sync" button) ───────────
  // Pulls the latest players + plans from Supabase and merges them into
  // local data using the same merge logic as file import, so nothing
  // gets silently overwritten either direction.
  const syncFromCloud = useCallback(async () => {
    if (!isCloudConfigured()) {
      showToast('Cloud sync not set up yet', 'error');
      return;
    }
    setSyncStatus('syncing');
    const remote = await pullAll();
    if (!remote) {
      setSyncStatus('error');
      showToast('Sync failed — check your connection', 'error');
      return;
    }
    setData(prev => ({
      ...mergeImportedData(prev, remote),
      lastUpdated: new Date().toISOString(),
    }));
    setSyncStatus('idle');
    setLastSyncedAt(new Date().toISOString());
    showToast('Synced ✓');
  }, [showToast]);

  // ── Derived state (computed, not stored) ──────────────────
  const players     = data.players     || [];
  const events      = data.events      || [];
  const svsPlans    = data.svsPlans    || [];
  const prepScores  = data.prepScores  || [];
  const settings    = data.settings    || {};
  const customRoles = data.customRoles || [];
  const roles       = withBuiltinRole(customRoles);

  return {
    // Raw data
    data,

    // Derived arrays
    players,
    events,
    svsPlans,
    prepScores,
    settings,

    // Toast
    toast,
    showToast,

    // Player ops
    savePlayer,
    addPlayers,
    updatePlayers,
    deletePlayer,

    // Event ops
    createEvent,
    updateEvent,
    deleteEvent,

    // SvS plan ops
    saveSvsPlans,
    deleteSvsPlan,

    // Prep scores
    updatePrepScores,

    // Settings
    saveSettings,

    // Player roles
    roles,
    saveCustomRoles,

    // Import
    applyImport,

    // Cloud sync
    syncFromCloud,
    syncStatus,
    lastSyncedAt,
    isCloudConfigured: isCloudConfigured(),
  };
}
