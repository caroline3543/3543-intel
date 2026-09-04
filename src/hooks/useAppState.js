import { useState, useEffect, useCallback } from 'react';
import { loadFromStorage, saveToStorage, mergeImportedData } from '../services/exportImportService.js';
import {
  pushPlayer, deletePlayerRemote, pushPlan, deletePlanRemote, pullAll, isCloudConfigured,
} from '../services/cloudSyncService.js';
import { newPlayer } from '../data/playerSchema.js';
import { newAsciiArt, SEED_ASCII_ART } from '../data/asciiArtSchema.js';
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

  // One-time seed for the ASCII Art library — only runs if asciiArts
  // has never been set at all (undefined, not just empty), so
  // deliberately deleting every seeded piece doesn't bring them back.
  // After this it's persisted with stable IDs via the auto-save above,
  // same as anything the user saves themselves.
  useEffect(() => {
    if (data.asciiArts === undefined) {
      setData(prev => ({ ...prev, asciiArts: SEED_ASCII_ART.map(a => newAsciiArt(a)) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    window.addEventListener('app:storage-full', handler);
    return () => window.removeEventListener('app:storage-full', handler);
  }, [showToast]);

  const allianceTag = () => data.settings?.allianceTag || '';

  // ── Player operations ─────────────────────────────────────
  const savePlayer = useCallback((player) => {
    const stamped = { ...player, profileLastUpdated: new Date().toISOString() };
    setData(prev => {
      const isEdit = prev.players.some(p => p.id === stamped.id);
      return {
        ...prev,
        players: isEdit
          ? prev.players.map(p => p.id === stamped.id ? stamped : p)
          : [...prev.players, stamped],
        lastUpdated: new Date().toISOString(),
      };
    });
    pushPlayer(stamped, allianceTag()); // fire-and-forget cloud push
    showToast('Player saved ✓');
  }, [showToast]);

  const addPlayers = useCallback((newPlayers) => {
    const stamped = newPlayers.map(p => ({ ...p, profileLastUpdated: new Date().toISOString() }));
    setData(prev => ({
      ...prev,
      players: [...prev.players, ...stamped],
      lastUpdated: new Date().toISOString(),
    }));
    stamped.forEach(p => pushPlayer(p, allianceTag()));
    if (stamped.length) showToast(`${stamped.length} player${stamped.length !== 1 ? 's' : ''} added ✓`);
  }, [showToast]);

  const updatePlayers = useCallback((updatedPlayers) => {
    const stamped = updatedPlayers.map(p => ({ ...p, profileLastUpdated: new Date().toISOString() }));
    setData(prev => ({
      ...prev,
      players: prev.players.map(p => {
        const u = stamped.find(u => u.id === p.id);
        return u ? u : p;
      }),
      lastUpdated: new Date().toISOString(),
    }));
    stamped.forEach(p => pushPlayer(p, allianceTag()));
    if (stamped.length) showToast(`${stamped.length} updated ✓`);
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
      events: [...(prev.events || []), { ...ev, updatedAt: new Date().toISOString() }],
      lastUpdated: new Date().toISOString(),
    }));
    showToast('Event created ✓');
  }, [showToast]);

  const updateEvent = useCallback((ev) => {
    setData(prev => ({
      ...prev,
      events: (prev.events || []).map(e => e.id === ev.id ? { ...ev, updatedAt: new Date().toISOString() } : e),
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

  // ── Notice Library ────────────────────────────────────────
  // Local-only for now — no cloud push, unlike players/plans. Wiring
  // notices into cloud sync would need a push-notice equivalent added
  // to cloudSyncService.js first; not assumed here since that file
  // wasn't available to confirm against.
  //
  // No toast on save: copyAndMark in NoticeLibrary.jsx calls this on
  // every single copy (that's the whole "log a post" mechanism), and a
  // toast every time would be redundant with the in-component "✓
  // Copied & logged" button state it already shows.
  const saveNotice = useCallback((notice) => {
    setData(prev => {
      const isEdit = (prev.notices || []).some(n => n.id === notice.id);
      return {
        ...prev,
        notices: isEdit
          ? prev.notices.map(n => n.id === notice.id ? notice : n)
          : [...(prev.notices || []), notice],
        lastUpdated: new Date().toISOString(),
      };
    });
  }, []);

  const deleteNotice = useCallback((id) => {
    setData(prev => ({
      ...prev,
      notices: (prev.notices || []).filter(n => n.id !== id),
      lastUpdated: new Date().toISOString(),
    }));
    showToast('Notice deleted');
  }, [showToast]);

  // ── ASCII Art library ─────────────────────────────────────
  // Same shape as Notice Library ops — local-only, no cloud push.
  const saveAsciiArt = useCallback((art) => {
    setData(prev => {
      const isEdit = (prev.asciiArts || []).some(a => a.id === art.id);
      return {
        ...prev,
        asciiArts: isEdit
          ? prev.asciiArts.map(a => a.id === art.id ? art : a)
          : [...(prev.asciiArts || []), art],
        lastUpdated: new Date().toISOString(),
      };
    });
  }, []);

  const deleteAsciiArt = useCallback((id) => {
    setData(prev => ({
      ...prev,
      asciiArts: (prev.asciiArts || []).filter(a => a.id !== id),
      lastUpdated: new Date().toISOString(),
    }));
    showToast('Art deleted');
  }, [showToast]);

  // Explicit, user-initiated wholesale replace — the one-time seed
  // effect above only ever fires if asciiArts has never been set at
  // all, so it won't re-seed on its own after the schema's default set
  // changes. This is the deliberate escape hatch for "replace what's
  // currently there with the current defaults."
  const resetAsciiArtsToDefaults = useCallback(() => {
    setData(prev => ({
      ...prev,
      asciiArts: SEED_ASCII_ART.map(a => newAsciiArt(a)),
      lastUpdated: new Date().toISOString(),
    }));
    showToast('Library reset to defaults');
  }, [showToast]);

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

  // ── Leadership checklist ──────────────────────────────────
  // Alliance-wide checklist item list (see utils/checklist.js) — same
  // whole-array-replace pattern as saveCustomRoles. Per-plan checked
  // state lives on each plan object (plan.checklist), not here.
  const saveChecklistItems = useCallback((customChecklist) => {
    setData(prev => ({ ...prev, customChecklist, lastUpdated: new Date().toISOString() }));
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
  const notices     = data.notices     || [];
  const asciiArts   = data.asciiArts   || [];
  const settings    = data.settings    || {};
  const customRoles = data.customRoles || [];
  const roles       = withBuiltinRole(customRoles);
  const customChecklist = data.customChecklist || [];

  return {
    // Raw data
    data,

    // Derived arrays
    players,
    events,
    svsPlans,
    prepScores,
    notices,
    asciiArts,
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

    // Notice Library
    saveNotice,
    deleteNotice,

    // ASCII Art library
    saveAsciiArt,
    deleteAsciiArt,
    resetAsciiArtsToDefaults,

    // Prep scores
    updatePrepScores,

    // Settings
    saveSettings,

    // Player roles
    roles,
    saveCustomRoles,

    // Leadership checklist
    customChecklist,
    saveChecklistItems,

    // Import
    applyImport,

    // Cloud sync
    syncFromCloud,
    syncStatus,
    lastSyncedAt,
    isCloudConfigured: isCloudConfigured(),
  };
}
