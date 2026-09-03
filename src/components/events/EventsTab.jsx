import { useState } from 'react';
import { C, EVENT_TYPES, EVENT_ICONS, TROOP_POWER_EVENTS, SHOWS_RSVP_TYPES, ALLIANCE_RANKS } from '../../utils/constants.js';
import { vibe } from '../../utils/vibe.js';
import { fmtDateShort } from '../../utils/dates.js';
import { newSnapshot } from '../../data/playerSchema.js';
import { searchPlayers } from '../../services/playerAutosuggest.js';
import { matchNamesToPlayers, findCloseMatches, parseNames } from '../../utils/nameList.js';
import { DeleteConfirmModal } from '../common/DeleteConfirmModal.jsx';
import { SnapshotEditor } from './SnapshotEditor.jsx';
import { EventSheet } from './EventSheet.jsx';

function initials(n) { return (n||'?').split(/\s+/).map(w=>w[0]||'').join('').slice(0,2).toUpperCase()||'?'; }

// Groups a player list by allianceRank, R5 first, unranked last —
// used both for the on-screen subheadings and the copy-as-text output,
// so the two never drift out of sync.
function groupByRank(list) {
  const groups = {};
  ALLIANCE_RANKS.forEach(r => { groups[r] = []; });
  groups.Unranked = [];
  list.forEach(p => {
    const key = ALLIANCE_RANKS.includes(p.allianceRank) ? p.allianceRank : 'Unranked';
    groups[key].push(p);
  });
  return groups;
}

// ── EventsTab ──────────────────────────────────────────────────
//
// Participant lists are now an EXPLICIT roster, not "empty = show
// everyone" — an event starts with nobody and you add people one at a
// time via the type-and-enter search below. This means any event
// created before this change, if it relied on the old empty-list
// fallback, will show zero participants until names are re-added.
//
// Being added to the roster at all now IS the participation signal —
// there's no separate "participating" toggle in the UI. rsvp.participating
// still exists in the data (Battle Plan's isAttending() reads it as the
// hard eligibility filter for leader/joiner picks), it's just set
// automatically the moment someone is added here, not chosen manually.
export function EventsTab({ events, players, onCreateEvent, onUpdateEvent, onDeleteEvent }) {
  const [filterType, setFilterType]   = useState('All');
  const [toastMsg, setToastMsg]       = useState(null);
  function showToast(msg) { setToastMsg(msg); setTimeout(() => setToastMsg(null), 3500); }
  // { mode:'swap', player, sibling } — trying to add someone already in
  // the other Legion. { mode:'resolve', player, sibling } — someone
  // already sitting in BOTH (data predates this rule). Either way this
  // is a real decision, not a dismissible notice — no auto-timeout.
  const [legionModal, setLegionModal] = useState(null);
  // Roster verification — session-only, not persisted. Resets when you
  // leave the event or turn it off; there's no saved "verified as of"
  // record. Confirmed names move into their own section rather than
  // just getting a checkmark in place, so the unconfirmed list
  // visibly shrinks as you work through the in-game roster.
  const [verifyMode, setVerifyMode]   = useState(false);
  const [confirmedIds, setConfirmedIds] = useState(new Set());
  const [verifyInputMode, setVerifyInputMode] = useState('tap'); // 'tap' | 'paste'
  const [verifyPasteText, setVerifyPasteText] = useState('');
  const [touchStartX, setTouchStartX] = useState(null);
  const [filterTag, setFilterTag]     = useState('');
  const [editingEvent, setEditingEvent] = useState(null);
  const [eventSheetOpen, setEventSheetOpen] = useState(false);
  const [activeEventId, setActiveEventId]   = useState(null);
  const [snapEditing, setSnapEditing] = useState(null);
  const [snapOpen, setSnapOpen]       = useState(false);
  const [bulkMode, setBulkMode]       = useState(false);
  const [bulkSel, setBulkSel]         = useState(new Set());
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [sortMode, setSortMode]       = useState('alpha'); // 'alpha' | 'troopPower' | 'lastAdded'
  const [addQuery, setAddQuery]       = useState('');
  const [addResults, setAddResults]   = useState([]);
  const [addAsSubstitute, setAddAsSubstitute] = useState(false);
  const [addMode, setAddMode]         = useState('type'); // 'type' | 'paste'
  const [pasteAddText, setPasteAddText] = useState('');
  const [copyPickerOpen, setCopyPickerOpen] = useState(false);
  const [participantsCopied, setParticipantsCopied] = useState(false);
  const [eventsView, setEventsView] = useState('active'); // 'active' | 'archive'

  const activeEvent = events.find(e => e.id === activeEventId);
  const allTags = [...new Set(events.map(e => e.allianceTag).filter(Boolean))];
  let filtered = filterType==='All' ? events : events.filter(e => e.type===filterType);
  if (filterTag) filtered = filtered.filter(e => e.allianceTag===filterTag);
  // Date, then time — events sharing a date (e.g. Legion 1/2) previously
  // fell back to insertion order among themselves since only .date was
  // compared. Date strings are 'YYYY-MM-DD' and times are 'HH:MM' 24hr,
  // so a plain string comparison on the combined key sorts correctly.
  // Sorted by proximity to right now, not pure chronological — an
  // event happening today sits above one three weeks out OR three
  // weeks past, radiating outward in both directions. This replaces
  // the earlier newest-first convention; confirmed as an intentional
  // change, not a bug.
  const nowMs = Date.now();
  function eventMs(ev) { return new Date(`${ev.date}T${ev.time || '00:00'}:00`).getTime(); }
  const sorted = [...filtered].sort((a, b) => Math.abs(eventMs(a) - nowMs) - Math.abs(eventMs(b) - nowMs));

  // An event archives itself the moment either is true — no need to
  // remember to tap "Done" for it to stop cluttering the main list.
  // Date strings are always 'YYYY-MM-DD' (see playerSchema.js), so a
  // plain string comparison against today sorts correctly with no
  // timezone math involved.
  const todayStr = new Date().toISOString().slice(0, 10);
  function isArchived(ev) { return ev.status === 'completed' || ev.date < todayStr; }

  // Legion 1 and Legion 2 events on the same date are the SAME real
  // occasion split into two groups — a player can only physically be
  // in one. "Sibling" = same date, same type, the opposite Legion.
  function findSiblingLegionEvent(ev, allEvents) {
    if (!ev?.legion) return null;
    const otherLegion = ev.legion === 1 ? 2 : 1;
    return allEvents.find(e => e.id !== ev.id && e.date === ev.date && e.type === ev.type && e.legion === otherLegion) || null;
  }
  const listedEvents = sorted.filter(ev => eventsView === 'archive' ? isArchived(ev) : !isArchived(ev));

  // Persistent per-Legion color — applied everywhere on an event page
  // (header, participant borders, list card accents) so which Legion
  // you're looking at is a color you register at a glance, not text
  // you have to read.
  function legionColor(legion) {
    if (legion === 1) return C.icy;
    if (legion === 2) return C.lan;
    return null;
  }

  // Swipe-eligible events — Active (non-archived) only, regardless of
  // whatever type/tag filter or Active/Archive toggle is currently
  // applied on the list screen. Swiping through an event's detail view
  // always draws from this same full active set.
  const activeSwipeList = sorted.filter(ev => !isArchived(ev));

  // Consecutive no-shows for one player, at one event TYPE only — a
  // Foundry streak and an SvS streak are tracked independently, never
  // mixed. Walks backward through past (non-upcoming) events of the
  // same type, most recent first, counting while they were marked
  // no-show; stops at the first event they weren't. An event where the
  // player has no snapshot at all (wasn't part of that event) is
  // skipped rather than breaking the streak — we simply don't know
  // anything about their attendance there.
  function noShowStreak(playerId, eventType, excludeEventId) {
    const sameType = events
      .filter(e => e.type === eventType && e.id !== excludeEventId && e.status !== 'upcoming')
      .sort((a,b) => `${b.date}T${b.time||'00:00'}`.localeCompare(`${a.date}T${a.time||'00:00'}`));
    let streak = 0;
    for (const ev of sameType) {
      const snap = (ev.snapshots||[]).find(s => s.playerId === playerId);
      if (!snap) continue;
      if (snap.attendance?.noShow) streak++;
      else break;
    }
    return streak;
  }

  // Capped display — a wall of hearts past 3 stops being informative
  // and starts breaking the row layout. This cap wasn't specified;
  // easy to change.
  function noShowBadge(streak) {
    if (streak <= 0) return null;
    return streak <= 3 ? '💔'.repeat(streak) : `💔×${streak}`;
  }

  function getSnap(ev, pid) { return (ev.snapshots||[]).find(s => s.playerId===pid); }

  function openSnap(ev, player) {
    const s = getSnap(ev, player.id) || newSnapshot(player.id, player, ev.id);
    setSnapEditing({ snapshot:s, playerName:player.username||player.alias||'Unknown', eventId:ev.id, playerId:player.id });
    setSnapOpen(true);
  }

  function saveSnap(upd) {
    const { eventId, playerId } = snapEditing;
    const ev = events.find(e => e.id===eventId);
    if (!ev) return;
    const snaps = [...(ev.snapshots||[])];
    const idx = snaps.findIndex(s => s.playerId===playerId);
    if (idx>=0) snaps[idx]=upd; else snaps.push(upd);
    onUpdateEvent({ ...ev, snapshots:snaps });
  }

  // ── Add participant by name — type + Enter commits the top match ──
  function searchAdd(q) {
    setAddQuery(q);
    if (!q.trim() || !activeEvent) { setAddResults([]); return; }
    const already = new Set(activeEvent.participantIds || []);
    const pool = players.filter(p => !already.has(p.id));
    setAddResults(searchPlayers(pool, q, 5));
  }

  function addParticipant(player) {
    if (!activeEvent) return;
    const sibling = findSiblingLegionEvent(activeEvent, events);
    if (sibling && (sibling.participantIds || []).includes(player.id)) {
      setLegionModal({ mode:'swap', player, sibling });
      return;
    }
    const participantIds = [...new Set([...(activeEvent.participantIds || []), player.id])];
    const snaps = [...(activeEvent.snapshots || [])];
    const idx = snaps.findIndex(s => s.playerId === player.id);
    if (idx >= 0) {
      snaps[idx] = { ...snaps[idx], rsvp: { ...snaps[idx].rsvp, participating: true, substitute: addAsSubstitute } };
    } else {
      const snap = newSnapshot(player.id, player, activeEvent.id);
      snap.rsvp.participating = true; // being added IS participating — no separate toggle
      snap.rsvp.substitute = addAsSubstitute;
      snaps.push(snap);
    }
    onUpdateEvent({ ...activeEvent, participantIds, snapshots: snaps });
    setAddQuery(''); setAddResults([]);
    vibe(8);
  }

  // Paste-list add — computes participantIds/snapshots once for the
  // whole batch in a single onUpdateEvent call. Looping addParticipant()
  // per name would read the same stale activeEvent on every iteration
  // and silently drop all but the last person.
  //
  // Callers are expected to have already filtered out anyone in the
  // sibling Legion event — the paste-list UI does this itself, giving
  // each conflicting name its own tap-to-swap chip instead of silently
  // dropping them here.
  function addParticipantsBatch(playersToAdd) {
    if (!activeEvent || playersToAdd.length === 0) return;
    const participantIds = [...new Set([...(activeEvent.participantIds || []), ...playersToAdd.map(p => p.id)])];
    const snaps = [...(activeEvent.snapshots || [])];
    playersToAdd.forEach(player => {
      const idx = snaps.findIndex(s => s.playerId === player.id);
      if (idx >= 0) {
        snaps[idx] = { ...snaps[idx], rsvp: { ...snaps[idx].rsvp, participating: true, substitute: addAsSubstitute } };
      } else {
        const snap = newSnapshot(player.id, player, activeEvent.id);
        snap.rsvp.participating = true;
        snap.rsvp.substitute = addAsSubstitute;
        snaps.push(snap);
      }
    });
    onUpdateEvent({ ...activeEvent, participantIds, snapshots: snaps });
    setPasteAddText('');
    vibe(8);
  }

  // Confirmed swap — moves a player from the sibling Legion event into
  // the current one. Both onUpdateEvent calls are built from data known
  // at call time rather than one reading the result of the other, since
  // parent state won't reflect the first update until next render.
  function confirmLegionSwap() {
    if (!legionModal) return;
    const { player, sibling } = legionModal;
    onUpdateEvent({ ...sibling, participantIds: (sibling.participantIds || []).filter(id => id !== player.id) });
    const participantIds = [...new Set([...(activeEvent.participantIds || []), player.id])];
    const snaps = [...(activeEvent.snapshots || [])];
    const idx = snaps.findIndex(s => s.playerId === player.id);
    if (idx >= 0) {
      snaps[idx] = { ...snaps[idx], rsvp: { ...snaps[idx].rsvp, participating: true, substitute: addAsSubstitute } };
    } else {
      const snap = newSnapshot(player.id, player, activeEvent.id);
      snap.rsvp.participating = true;
      snap.rsvp.substitute = addAsSubstitute;
      snaps.push(snap);
    }
    onUpdateEvent({ ...activeEvent, participantIds, snapshots: snaps });
    showToast(`${player.username || player.alias || 'Player'} moved to Legion ${activeEvent.legion}`);
    setLegionModal(null);
    vibe(8);
  }

  // Resolving a pre-existing conflict (someone already in both) — pick
  // which event to keep them in; they're removed from the other.
  function resolveLegionConflict(keepEvent) {
    if (!legionModal) return;
    const { player, sibling } = legionModal;
    const removeEvent = keepEvent.id === activeEvent.id ? sibling : activeEvent;
    onUpdateEvent({ ...removeEvent, participantIds: (removeEvent.participantIds || []).filter(id => id !== player.id) });
    showToast(`${player.username || player.alias || 'Player'} kept in Legion ${keepEvent.legion} only`);
    setLegionModal(null);
  }

  function commitTopMatch() {
    if (addResults.length > 0) addParticipant(addResults[0]);
  }

  function removeParticipant(playerId) {
    if (!activeEvent) return;
    onUpdateEvent({ ...activeEvent, participantIds: (activeEvent.participantIds || []).filter(id => id !== playerId) });
  }

  // Moves someone between the Participants and Substitutes sections —
  // a persistent category, not a bulk-settable prediction, so it lives
  // as a per-row toggle rather than in bulkTags.
  function toggleSubstitute(playerId) {
    if (!activeEvent) return;
    const player = players.find(p => p.id === playerId);
    if (!player) return;
    const snaps = [...(activeEvent.snapshots || [])];
    const idx = snaps.findIndex(s => s.playerId === playerId);
    if (idx >= 0) {
      snaps[idx] = { ...snaps[idx], rsvp: { ...snaps[idx].rsvp, substitute: !snaps[idx].rsvp?.substitute } };
    } else {
      const snap = newSnapshot(playerId, player, activeEvent.id);
      snap.rsvp.participating = true;
      snap.rsvp.substitute = true;
      snaps.push(snap);
    }
    onUpdateEvent({ ...activeEvent, snapshots: snaps });
  }

  // Inline troop power — editable directly on the row, no need to open
  // a separate editor sheet just to record one number.
  function setTroopPower(playerId, rawValue) {
    if (!activeEvent) return;
    const player = players.find(p => p.id === playerId);
    if (!player) return;
    const value = rawValue === '' ? null : Number(rawValue);
    const snaps = [...(activeEvent.snapshots || [])];
    const idx = snaps.findIndex(s => s.playerId === playerId);
    if (idx >= 0) snaps[idx] = { ...snaps[idx], troopPower: value };
    else {
      const snap = newSnapshot(playerId, player, activeEvent.id);
      snap.troopPower = value;
      snaps.push(snap);
    }
    onUpdateEvent({ ...activeEvent, snapshots: snaps });
  }

  // Brings over the roster only — never RSVP predictions from the
  // source event, since "was arriving late last week" says nothing
  // about this week. Saves re-typing everyone's name for a recurring
  // event type (SvS Castle Battle, Foundry, etc.) now that events
  // start with an explicit, empty participant list.
  function copyRosterFrom(sourceEvent) {
    if (!activeEvent) return;
    const already = new Set(activeEvent.participantIds || []);
    const toAdd = (sourceEvent.participantIds || []).filter(id => !already.has(id));
    const participantIds = [...(activeEvent.participantIds || []), ...toAdd];
    const snaps = [...(activeEvent.snapshots || [])];
    toAdd.forEach(pid => {
      const player = players.find(p => p.id === pid);
      if (!player) return;
      const snap = newSnapshot(pid, player, activeEvent.id);
      snap.rsvp.participating = true;
      snaps.push(snap);
    });
    onUpdateEvent({ ...activeEvent, participantIds, snapshots: snaps });
    setCopyPickerOpen(false);
    vibe(8);
  }

  // Bulk tags differ by event phase — RSVP-relevant tags for upcoming
  // events (only for the two SvS-related types — see SHOWS_RSVP_TYPES),
  // post-event actuals for active/completed ones. "Substitute" isn't
  // here — it's a persistent category (see toggleSubstitute), not a
  // bulk-settable prediction. "rsvpLate" (upcoming, a prediction) and
  // "late" (post-event, an actual with no notice) are deliberately
  // different tag keys — the if-chain below doesn't know which button
  // set fired it, so reusing one key for both would let an upcoming
  // "Arriving late" tap also set the unrelated post-event field.
  function applyBulk(tag) {
    if (!activeEvent || !bulkSel.size) return;
    const snaps = [...(activeEvent.snapshots||[])];
    bulkSel.forEach(pid => {
      const player = players.find(p => p.id===pid); if (!player) return;
      const idx = snaps.findIndex(s => s.playerId===pid);
      let s = idx>=0 ? { ...snaps[idx] } : newSnapshot(pid, player, activeEvent.id);
      if (tag==='rsvpLate')    s = { ...s, rsvp:{ ...s.rsvp, willBeLate:true } };
      if (tag==='early')      s = { ...s, rsvp:{ ...s.rsvp, willLeaveEarly:true } };
      if (tag==='discord')    s = { ...s, rsvp:{ ...s.rsvp, willJoinDiscord:true } };
      if (tag==='wholetime')  s = { ...s, rsvp:{ ...s.rsvp, presentWholeTime:true } };
      if (tag==='attended')   s = { ...s, attendance:{ ...s.attendance, attended:true, noShow:false } };
      if (tag==='noshow')     s = { ...s, attendance:{ ...s.attendance, attended:false, noShow:true } };
      if (tag==='late')       s = { ...s, attendance:{ ...s.attendance, joinedLateNoNotice:true } };
      if (tag==='voice')      s = { ...s, voice:{ ...s.voice, joined:true } };
      if (idx>=0) snaps[idx]=s; else snaps.push(s);
    });
    onUpdateEvent({ ...activeEvent, snapshots:snaps });
    setBulkSel(new Set()); setBulkMode(false); vibe(8);
  }

  // Filtered to CURRENT participantIds membership — removing someone
  // via the ✕ button only strips them from participantIds, it doesn't
  // delete their snapshot, so counting raw snapshots here would let a
  // removed person's stale data keep inflating "participating"/"total"
  // even though they no longer appear anywhere in the visible list.
  function evSum(ev) {
    const idSet = new Set(ev.participantIds || []);
    const sn = (ev.snapshots||[]).filter(s => idSet.has(s.playerId));
    if (ev.status === 'upcoming') {
      return { total:sn.length, participating:sn.filter(s=>s.rsvp?.participating).length };
    }
    return { total:sn.length, attended:sn.filter(s=>s.attendance?.attended===true).length, noShow:sn.filter(s=>s.attendance?.noShow).length, voice:sn.filter(s=>s.voice?.joined===true).length };
  }

  const isUpcoming = activeEvent?.status === 'upcoming';
  const tracksTroopPower = TROOP_POWER_EVENTS.includes(activeEvent?.type);
  const showsRsvp = SHOWS_RSVP_TYPES.includes(activeEvent?.type);

  // Explicit roster — strictly the participantIds list, no "empty means
  // everyone" fallback. Split into Participants vs Substitutes (two
  // distinct categories, not one list with a badge), each with Rally
  // Leads sorted to the top before the chosen secondary sort.
  const allEventPlayers = activeEvent ? players.filter(p => (activeEvent.participantIds||[]).includes(p.id)) : [];

  function sortGroup(list) {
    return [...list].sort((a, b) => {
      const aLead = a.roles?.includes('Rally Lead') ? 0 : 1;
      const bLead = b.roles?.includes('Rally Lead') ? 0 : 1;
      if (aLead !== bLead) return aLead - bLead;
      if (sortMode === 'lastAdded') {
        const ca = getSnap(activeEvent, a.id)?.createdAt || '';
        const cb = getSnap(activeEvent, b.id)?.createdAt || '';
        return new Date(cb) - new Date(ca);
      }
      if (sortMode === 'troopPower' && tracksTroopPower) {
        const ta = getSnap(activeEvent, a.id)?.troopPower ?? -1;
        const tb = getSnap(activeEvent, b.id)?.troopPower ?? -1;
        return tb - ta;
      }
      return (a.username||a.alias||'').localeCompare(b.username||b.alias||'');
    });
  }

  const participantsList = sortGroup(allEventPlayers.filter(p => !getSnap(activeEvent, p.id)?.rsvp?.substitute));
  const substitutesList  = sortGroup(allEventPlayers.filter(p => getSnap(activeEvent, p.id)?.rsvp?.substitute));

  // Copyable, Discord-ready code block of the full roster — grouped by
  // rank the same way the on-screen list is, so what you copy always
  // matches what you see.
  // Copyable, Discord-ready code block of the full roster — grouped by
  // rank the same way the on-screen list is, so what you copy always
  // matches what you see. Header includes time and Legion (when set)
  // so the code block is self-identifying once posted in Discord —
  // otherwise a Legion 1 and Legion 2 roster posted the same day are
  // indistinguishable once separated from the app. Rally Leads get the
  // same 👑 marker the on-screen row uses.
  function generateParticipantsText() {
    if (!activeEvent) return '';
    const headerParts = [activeEvent.name || activeEvent.type, fmtDateShort(activeEvent.date)];
    if (activeEvent.time)   headerParts.push(`🕐 ${activeEvent.time}`);
    if (activeEvent.legion) headerParts.push(`Legion ${activeEvent.legion}`);
    const lines = [`📋 ${headerParts.join(' — ')}`, ''];
    const nameLine = p => `  ${p.roles?.includes('Rally Lead') ? '👑 ' : ''}${p.username || p.alias || '?'}`;
    const groups = groupByRank(participantsList);
    lines.push(`PARTICIPANTS (${participantsList.length})`);
    [...ALLIANCE_RANKS, 'Unranked'].forEach(rank => {
      const group = groups[rank];
      if (!group.length) return;
      lines.push(`${rank} (${group.length})`);
      group.forEach(p => lines.push(nameLine(p)));
    });
    if (substitutesList.length > 0) {
      lines.push('', `SUBSTITUTES (${substitutesList.length})`);
      substitutesList.forEach(p => lines.push(nameLine(p)));
    }
    return '```\n' + lines.join('\n').trim() + '\n```';
  }
  function copyParticipants() {
    navigator.clipboard.writeText(generateParticipantsText()).then(() => { setParticipantsCopied(true); setTimeout(() => setParticipantsCopied(false), 2000); });
  }

  const bulkTags = isUpcoming
    ? (showsRsvp ? [['🕐 Arriving late','rsvpLate',C.gold],['🏃 Leaving early','early',C.gold],['🎙️ Will join Discord','discord',C.icy],['✓ Present whole time','wholetime',C.green]] : [])
    : [['✓ Attended','attended',C.green],['✗ No-show','noshow',C.red],['🕐 Late (no notice)','late',C.gold],['🎙️ Voice','voice',C.icy]];

  return (
    <div style={{ padding:'16px 20px 0' }}>
      {toastMsg && (
        <div style={{ position:'fixed', top:20, left:'50%', transform:'translateX(-50%)', background:C.card+'ee', backdropFilter:'blur(12px)', border:`1px solid ${C.gold}44`, borderRadius:20, padding:'10px 20px', fontSize:13, fontWeight:600, color:C.gold, zIndex:800, maxWidth:'90%', textAlign:'center', pointerEvents:'none' }}>
          {toastMsg}
        </div>
      )}

      {legionModal && (
        <div onClick={() => setLegionModal(null)} style={{ position:'fixed', inset:0, background:'#000c', zIndex:700, display:'flex', alignItems:'flex-end' }}>
          <div onClick={e => e.stopPropagation()} style={{ background:C.card, borderRadius:'20px 20px 0 0', width:'100%', maxWidth:480, margin:'0 auto', padding:'20px 20px 28px' }}>
            <div style={{ fontSize:17, fontWeight:800, color:C.red, marginBottom:10 }}>⚠ Legion Conflict</div>
            {legionModal.mode === 'swap' ? (
              <>
                <div style={{ fontSize:14, color:C.white, marginBottom:20, lineHeight:1.5 }}>
                  <strong>{legionModal.player.username || legionModal.player.alias}</strong> is currently in <strong>Legion {legionModal.sibling.legion}</strong> for this event. Are they switching to <strong>Legion {activeEvent?.legion}</strong>?
                </div>
                <button onClick={confirmLegionSwap} style={{ width:'100%', height:50, borderRadius:12, background:C.gold, color:C.bg, fontWeight:800, fontSize:15, border:'none', cursor:'pointer', marginBottom:10 }}>
                  Yes — move to Legion {activeEvent?.legion}
                </button>
                <button onClick={() => setLegionModal(null)} style={{ width:'100%', height:46, borderRadius:12, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontWeight:600, fontSize:14, cursor:'pointer' }}>
                  Cancel
                </button>
              </>
            ) : (
              <>
                <div style={{ fontSize:14, color:C.white, marginBottom:20, lineHeight:1.5 }}>
                  <strong>{legionModal.player.username || legionModal.player.alias}</strong> is in <strong>both Legion 1 and Legion 2</strong> for this event. Which one should they actually be in?
                </div>
                <button onClick={() => resolveLegionConflict(activeEvent)} style={{ width:'100%', height:50, borderRadius:12, background:C.gold+'22', border:`1px solid ${C.gold}`, color:C.gold, fontWeight:700, fontSize:15, cursor:'pointer', marginBottom:8 }}>
                  Keep in Legion {activeEvent?.legion} <span style={{ opacity:0.7 }}>(remove from Legion {legionModal.sibling.legion})</span>
                </button>
                <button onClick={() => resolveLegionConflict(legionModal.sibling)} style={{ width:'100%', height:50, borderRadius:12, background:C.gold+'22', border:`1px solid ${C.gold}`, color:C.gold, fontWeight:700, fontSize:15, cursor:'pointer', marginBottom:10 }}>
                  Keep in Legion {legionModal.sibling.legion} <span style={{ opacity:0.7 }}>(remove from Legion {activeEvent?.legion})</span>
                </button>
                <button onClick={() => setLegionModal(null)} style={{ width:'100%', height:46, borderRadius:12, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontWeight:600, fontSize:14, cursor:'pointer' }}>
                  Decide later
                </button>
              </>
            )}
          </div>
        </div>
      )}
      {activeEvent ? (() => {
        const lc = legionColor(activeEvent.legion);
        const swipeIdx = activeSwipeList.findIndex(ev => ev.id === activeEvent.id);
        const canSwipeNext = swipeIdx !== -1 && swipeIdx < activeSwipeList.length - 1;
        const canSwipePrev = swipeIdx > 0;
        function goToEvent(ev) {
          if (!ev) return;
          setActiveEventId(ev.id);
          setBulkMode(false); setBulkSel(new Set()); setAddQuery(''); setAddResults([]);
          setVerifyMode(false); setConfirmedIds(new Set()); setVerifyPasteText('');
          vibe(8);
        }
        function handleTouchStart(e) { setTouchStartX(e.touches[0].clientX); }
        function handleTouchEnd(e) {
          if (touchStartX == null) return;
          const dx = e.changedTouches[0].clientX - touchStartX;
          setTouchStartX(null);
          if (Math.abs(dx) < 60) return; // minimum swipe distance — avoids misfiring on ordinary taps/scrolls
          if (dx < 0 && canSwipeNext) goToEvent(activeSwipeList[swipeIdx + 1]);
          else if (dx > 0 && canSwipePrev) goToEvent(activeSwipeList[swipeIdx - 1]);
        }
        return (
        <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <button onClick={() => { setActiveEventId(null); setBulkMode(false); setBulkSel(new Set()); setAddQuery(''); setAddResults([]); setVerifyMode(false); setConfirmedIds(new Set()); setVerifyPasteText(''); }} style={{ display:'flex', alignItems:'center', gap:8, background:'none', border:'none', color:C.gold, fontSize:14, fontWeight:600, cursor:'pointer', padding:0 }}>
              ← Back to Events
            </button>
            {swipeIdx !== -1 && (
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <button onClick={() => goToEvent(activeSwipeList[swipeIdx - 1])} disabled={!canSwipePrev} style={{ background:'none', border:'none', color:canSwipePrev?C.gold:C.border, fontSize:18, cursor:canSwipePrev?'pointer':'default', padding:0 }}>‹</button>
                <span style={{ fontSize:11, color:C.muted }}>{swipeIdx + 1} of {activeSwipeList.length}</span>
                <button onClick={() => goToEvent(activeSwipeList[swipeIdx + 1])} disabled={!canSwipeNext} style={{ background:'none', border:'none', color:canSwipeNext?C.gold:C.border, fontSize:18, cursor:canSwipeNext?'pointer':'default', padding:0 }}>›</button>
              </div>
            )}
          </div>
          <div style={{ background:C.card, borderRadius:14, padding:16, marginBottom:16, borderTop:lc?`4px solid ${lc}`:'none' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                  <div style={{ fontSize:20, fontWeight:700, color:C.white }}>{EVENT_ICONS[activeEvent.type]||'📋'} {activeEvent.name||activeEvent.type}</div>
                  {activeEvent.legion && (
                    <span style={{ fontSize:12, fontWeight:800, color:lc, padding:'2px 9px', borderRadius:10, background:lc+'22', border:`1px solid ${lc}55` }}>Legion {activeEvent.legion}</span>
                  )}
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginTop:4 }}>
                  <span style={{ fontSize:13, color:C.muted }}>{fmtDateShort(activeEvent.date)}</span>
                  {activeEvent.time && (
                    <span style={{ fontSize:16, fontWeight:800, color:C.gold, padding:'1px 10px', borderRadius:10, background:C.gold+'18' }}>🕐 {activeEvent.time} UTC</span>
                  )}
                  {activeEvent.allianceTag && <span style={{ fontSize:13, color:C.muted }}>[{activeEvent.allianceTag}]</span>}
                </div>
              </div>
              <button onClick={() => { setEditingEvent(activeEvent); setEventSheetOpen(true); }} style={{ height:34, padding:'0 12px', borderRadius:20, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontSize:13, cursor:'pointer', flexShrink:0 }}>Edit</button>
            </div>
            <div style={{ display:'flex', gap:6, marginBottom:12 }}>
              {[['upcoming','Upcoming',C.icy],['active','🔴 Live',C.green],['completed','✓ Done',C.muted]].map(([s,l,c]) => (
                <button key={s} onClick={() => onUpdateEvent({ ...activeEvent, status:s })}
                  style={{ flex:1, height:34, borderRadius:20, border:`1px solid ${activeEvent.status===s?c:C.border}`, background:activeEvent.status===s?c+'22':C.section, color:activeEvent.status===s?c:C.muted, fontWeight:700, fontSize:13, cursor:'pointer' }}>
                  {l}
                </button>
              ))}
            </div>
            {(() => {
              const s = evSum(activeEvent);
              if (s.total === 0) return null;
              return isUpcoming ? (
                <div style={{ fontSize:13, color:C.green }}>✓ {s.participating} participating</div>
              ) : (
                <div style={{ display:'flex', gap:12 }}>
                  <span style={{ fontSize:13, color:C.green }}>✓ {s.attended}</span>
                  <span style={{ fontSize:13, color:C.red }}>✗ {s.noShow}</span>
                  <span style={{ fontSize:13, color:C.icy }}>🎙️ {s.voice}</span>
                </div>
              );
            })()}
          </div>

          {/* Add participant — type a name (Enter commits the top match)
              or paste a whole list at once. Adding-as toggle decides
              which section they land in, for either mode. */}
          <div style={{ display:'flex', gap:6, marginBottom:8 }}>
            <button onClick={() => setAddAsSubstitute(false)} style={{ flex:1, height:36, borderRadius:10, border:`1px solid ${!addAsSubstitute?C.gold:C.border}`, background:!addAsSubstitute?C.gold+'22':C.section, color:!addAsSubstitute?C.gold:C.muted, fontWeight:600, fontSize:13, cursor:'pointer' }}>Add as Participant</button>
            <button onClick={() => setAddAsSubstitute(true)} style={{ flex:1, height:36, borderRadius:10, border:`1px solid ${addAsSubstitute?C.gold:C.border}`, background:addAsSubstitute?C.gold+'22':C.section, color:addAsSubstitute?C.gold:C.muted, fontWeight:600, fontSize:13, cursor:'pointer' }}>Add as Substitute</button>
          </div>
          <div style={{ display:'flex', gap:6, marginBottom:8 }}>
            <button onClick={() => setAddMode('type')} style={{ flex:1, height:32, borderRadius:16, background:addMode==='type'?C.gold+'22':C.section, border:`1px solid ${addMode==='type'?C.gold:C.border}`, color:addMode==='type'?C.gold:C.muted, fontWeight:600, fontSize:12, cursor:'pointer' }}>🔍 Type one</button>
            <button onClick={() => setAddMode('paste')} style={{ flex:1, height:32, borderRadius:16, background:addMode==='paste'?C.gold+'22':C.section, border:`1px solid ${addMode==='paste'?C.gold:C.border}`, color:addMode==='paste'?C.gold:C.muted, fontWeight:600, fontSize:12, cursor:'pointer' }}>📋 Paste a list</button>
          </div>
          {addMode === 'type' ? (
          <div style={{ position:'relative', marginBottom:12 }}>
            <input
              value={addQuery}
              onChange={e => searchAdd(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitTopMatch(); } }}
              placeholder="Type a name to add…"
              style={{ width:'100%', height:44, background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'0 14px', fontSize:15, color:C.white, boxSizing:'border-box', fontFamily:'inherit' }}
            />
            {addResults.length > 0 && (
              <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, right:0, background:C.card, border:`1px solid ${C.border}`, borderRadius:12, overflow:'hidden', zIndex:20, boxShadow:'0 8px 24px #000a' }}>
                {addResults.map((p, i) => (
                  <button key={p.id} onClick={() => addParticipant(p)}
                    style={{ display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%', padding:'10px 14px', background:i===0?C.gold+'12':'none', border:'none', borderBottom:`1px solid ${C.border}22`, cursor:'pointer', textAlign:'left' }}>
                    <span style={{ fontSize:14, fontWeight:700, color:C.white }}>{p.username||p.alias||'?'}</span>
                    <span style={{ fontSize:11, color:C.muted }}>{p.furnaceLevel||''}{i===0?'  ↵ Enter':''}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          ) : (() => {
            const already = new Set(activeEvent.participantIds || []);
            const pool = players.filter(p => !already.has(p.id));
            const { matched: rawMatched, unmatched: addUnmatched } = matchNamesToPlayers(pasteAddText, pool);
            const sibling = findSiblingLegionEvent(activeEvent, events);
            const siblingIds = new Set(sibling?.participantIds || []);
            const addMatched = rawMatched.filter(p => !siblingIds.has(p.id));
            const addBlocked = rawMatched.filter(p => siblingIds.has(p.id));
            return (
              <div style={{ marginBottom:12 }}>
                <textarea
                  value={pasteAddText}
                  onChange={e => setPasteAddText(e.target.value)}
                  placeholder={'Paste names, comma or newline separated…'}
                  rows={3}
                  style={{ width:'100%', background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'10px 14px', fontSize:14, color:C.white, boxSizing:'border-box', fontFamily:'inherit', resize:'vertical', marginBottom:8 }}
                />
                {(addMatched.length > 0 || addUnmatched.length > 0 || addBlocked.length > 0) && (
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:8 }}>
                    {addMatched.map(p => (
                      <span key={p.id} style={{ padding:'5px 10px', borderRadius:14, background:C.green+'18', border:`1px solid ${C.green}44`, color:C.green, fontSize:12 }}>✓ {p.username||p.alias}</span>
                    ))}
                    {addBlocked.map(p => (
                      <button key={p.id} onClick={() => setLegionModal({ mode:'swap', player:p, sibling })}
                        title={`Tap to move from Legion ${sibling?.legion}`}
                        style={{ padding:'5px 10px', borderRadius:14, background:C.red+'14', border:`1px solid ${C.red}44`, color:C.red+'cc', fontSize:12, cursor:'pointer' }}>
                        ⚠ {p.username||p.alias} (Legion {sibling?.legion}) — swap?
                      </button>
                    ))}
                    {addUnmatched.map((n, i) => (
                      <span key={i} title="No roster match for this name" style={{ padding:'5px 10px', borderRadius:14, background:C.red+'14', border:`1px solid ${C.red}44`, color:C.red+'cc', fontSize:12 }}>? {n}</span>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => addParticipantsBatch(addMatched)}
                  disabled={addMatched.length === 0}
                  style={{ width:'100%', height:44, borderRadius:10, background:addMatched.length?C.gold+'22':C.section, border:`1px solid ${addMatched.length?C.gold:C.border}`, color:addMatched.length?C.gold:C.muted, fontWeight:700, fontSize:14, cursor:addMatched.length?'pointer':'default' }}
                >
                  Add {addMatched.length || ''} as {addAsSubstitute ? 'Substitute' : 'Participant'}{addMatched.length!==1?'s':''}
                </button>
              </div>
            );
          })()}

          {/* Copy roster from a previous event — participant list only,
              never RSVP predictions from that event */}
          {events.filter(e => e.id !== activeEvent.id && (e.participantIds||[]).length > 0).length > 0 && (
            <div style={{ marginBottom:12 }}>
              <button onClick={() => setCopyPickerOpen(!copyPickerOpen)}
                style={{ background:'none', border:'none', color:C.gold, fontSize:13, fontWeight:600, cursor:'pointer', padding:0 }}>
                {copyPickerOpen ? 'Cancel' : '📋 Copy roster from a previous event'}
              </button>
              {copyPickerOpen && (
                <div style={{ marginTop:8, maxHeight:200, overflowY:'auto' }}>
                  {events.filter(e => e.id !== activeEvent.id && (e.participantIds||[]).length > 0)
                    .sort((a,b) => new Date(b.date) - new Date(a.date))
                    .map(ev => (
                      <button key={ev.id} onClick={() => copyRosterFrom(ev)}
                        style={{ display:'block', width:'100%', textAlign:'left', padding:'10px 12px', borderRadius:8, background:C.section, border:`1px solid ${C.border}`, color:C.white, fontSize:13, marginBottom:6, cursor:'pointer' }}>
                        {EVENT_ICONS[ev.type]||'📋'} {ev.name||ev.type} · {fmtDateShort(ev.date)} · {ev.participantIds.length} people
                      </button>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* Sort toggle */}
          {allEventPlayers.length > 1 && (
            <div style={{ display:'flex', gap:6, marginBottom:12, flexWrap:'wrap' }}>
              <button onClick={() => setSortMode('alpha')} style={{ height:32, padding:'0 12px', borderRadius:16, background:sortMode==='alpha'?C.gold+'22':C.section, border:`1px solid ${sortMode==='alpha'?C.gold:C.border}`, color:sortMode==='alpha'?C.gold:C.muted, fontWeight:600, fontSize:12, cursor:'pointer' }}>A–Z</button>
              <button onClick={() => setSortMode('lastAdded')} style={{ height:32, padding:'0 12px', borderRadius:16, background:sortMode==='lastAdded'?C.gold+'22':C.section, border:`1px solid ${sortMode==='lastAdded'?C.gold:C.border}`, color:sortMode==='lastAdded'?C.gold:C.muted, fontWeight:600, fontSize:12, cursor:'pointer' }}>🕐 Last Added</button>
              {tracksTroopPower && (
                <button onClick={() => setSortMode('troopPower')} style={{ height:32, padding:'0 12px', borderRadius:16, background:sortMode==='troopPower'?C.gold+'22':C.section, border:`1px solid ${sortMode==='troopPower'?C.gold:C.border}`, color:sortMode==='troopPower'?C.gold:C.muted, fontWeight:600, fontSize:12, cursor:'pointer' }}>💪 Troop Power</button>
              )}
            </div>
          )}

          {(bulkTags.length > 0 || !isUpcoming) && (
            <div style={{ display:'flex', gap:8, marginBottom:16, overflowX:'auto' }}>
              <button onClick={() => { setBulkMode(!bulkMode); setBulkSel(new Set()); }} style={{ height:36, padding:'0 14px', borderRadius:20, background:bulkMode?C.gold+'22':C.section, border:`1px solid ${bulkMode?C.gold:C.border}`, color:bulkMode?C.gold:C.muted, fontWeight:600, fontSize:13, cursor:'pointer', whiteSpace:'nowrap' }}>
                {bulkMode ? `✓ ${bulkSel.size} selected` : '⚡ Update multiple'}
              </button>
              {bulkMode && allEventPlayers.length>0 && (
                <button onClick={() => setBulkSel(bulkSel.size===allEventPlayers.length ? new Set() : new Set(allEventPlayers.map(p=>p.id)))}
                  style={{ height:36, padding:'0 14px', borderRadius:20, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontWeight:600, fontSize:13, cursor:'pointer', whiteSpace:'nowrap' }}>
                  {bulkSel.size===allEventPlayers.length ? 'Deselect all' : 'Select all'}
                </button>
              )}
              {bulkMode && bulkSel.size>0 && bulkTags.map(([l,t,c]) => (
                <button key={t} onClick={() => applyBulk(t)} style={{ height:36, padding:'0 12px', borderRadius:20, background:c+'18', border:`1px solid ${c}44`, color:c, fontWeight:600, fontSize:13, cursor:'pointer', whiteSpace:'nowrap' }}>{l}</button>
              ))}
            </div>
          )}

          {(() => {
            const sibling = findSiblingLegionEvent(activeEvent, events);
            const siblingConflictIds = new Set(sibling?.participantIds || []);
            function renderRow(player) {
              const snap = getSnap(activeEvent, player.id);
              const dn = player.username||player.alias||'Unknown';
              const isSel = bulkSel.has(player.id);
              const isLead = player.roles?.includes('Rally Lead');
              const legionConflict = siblingConflictIds.has(player.id);
              const streak = noShowStreak(player.id, activeEvent.type, activeEvent.id);
              const heart = noShowBadge(streak);
              return (
                <div key={player.id} onClick={() => { if (bulkMode) { const n=new Set(bulkSel); isSel?n.delete(player.id):n.add(player.id); setBulkSel(n); } else openSnap(activeEvent, player); }} style={{ background:isSel?C.gold+'18':C.card, borderRadius:10, padding:'10px 14px', marginBottom:8, display:'flex', alignItems:'center', gap:10, cursor:'pointer', border:`1px solid ${legionConflict?C.red+'88':isSel?C.gold:isLead?C.gold+'55':(lc?lc+'44':C.border+'44')}`, WebkitTapHighlightColor:'transparent' }}>
                  {bulkMode && <div style={{ width:22, height:22, borderRadius:'50%', border:`2px solid ${isSel?C.gold:C.border}`, background:isSel?C.gold:'none', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{isSel && <span style={{ fontSize:12, color:C.bg, fontWeight:700 }}>✓</span>}</div>}
                  <div style={{ width:36, height:36, borderRadius:'50%', background:(isLead?C.gold:C.muted)+'33', border:`1.5px solid ${isLead?C.gold:C.muted}`, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:14, color:C.white, flexShrink:0 }}>{initials(dn)}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6, overflow:'hidden' }}>
                      {isLead && <span style={{ fontSize:12, flexShrink:0 }}>👑</span>}
                      <div style={{ fontSize:15, fontWeight:700, color:C.white, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{dn}</div>
                      {heart && <span title={`${streak} consecutive ${activeEvent.type} no-shows`} style={{ fontSize:12, flexShrink:0 }}>{heart}</span>}
                      {player.allianceRank && <span style={{ fontSize:11, color:C.gold, fontWeight:700, flexShrink:0, padding:'0 6px', borderRadius:6, background:C.gold+'18' }}>{player.allianceRank}</span>}
                      {player.furnaceLevel && <span style={{ fontSize:11, color:C.icy, fontWeight:600, flexShrink:0 }}>{player.furnaceLevel}</span>}
                      {legionConflict && (
                        <button onClick={e => { e.stopPropagation(); setLegionModal({ mode:'resolve', player, sibling }); }}
                          title={`Also in Legion ${sibling?.legion} — tap to resolve`}
                          style={{ fontSize:11, color:C.red, fontWeight:700, flexShrink:0, padding:'0 6px', borderRadius:6, background:C.red+'18', border:'none', cursor:'pointer' }}>
                          ⚠ Also Legion {sibling?.legion}
                        </button>
                      )}
                    </div>
                    {tracksTroopPower && (
                      <div style={{ display:'flex', gap:6, alignItems:'center', marginTop:4 }}>
                        <input
                          type="number"
                          value={snap?.troopPower ?? ''}
                          onChange={e => setTroopPower(player.id, e.target.value)}
                          onClick={e => e.stopPropagation()}
                          placeholder="Troop power"
                          style={{ width:110, height:28, background:C.section, border:`1px solid ${C.border}`, borderRadius:8, padding:'0 8px', fontSize:12, color:C.gold, fontWeight:700, fontFamily:'inherit' }}
                        />
                      </div>
                    )}
                    {showsRsvp && (
                      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:3 }}>
                        {isUpcoming ? (
                          <>
                            {snap?.rsvp?.willBeLate && <span style={{ fontSize:11, padding:'1px 7px', borderRadius:8, background:C.gold+'18', color:C.gold, fontWeight:600 }}>🕐 Late</span>}
                            {snap?.rsvp?.willLeaveEarly && <span style={{ fontSize:11, padding:'1px 7px', borderRadius:8, background:C.gold+'18', color:C.gold, fontWeight:600 }}>🏃 Early</span>}
                            {snap?.rsvp?.willJoinDiscord && <span style={{ fontSize:11, padding:'1px 7px', borderRadius:8, background:C.icy+'18', color:C.icy, fontWeight:600 }}>🎙️</span>}
                            {snap?.rsvp?.presentWholeTime && <span style={{ fontSize:11, padding:'1px 7px', borderRadius:8, background:C.green+'18', color:C.green, fontWeight:600 }}>✓ Full</span>}
                          </>
                        ) : (
                          <>
                            {snap?.attendance?.attended===true && <span style={{ fontSize:11, padding:'1px 7px', borderRadius:8, background:C.green+'18', color:C.green, fontWeight:600 }}>✓</span>}
                            {snap?.attendance?.noShow && <span style={{ fontSize:11, padding:'1px 7px', borderRadius:8, background:C.red+'18', color:C.red, fontWeight:600 }}>✗</span>}
                            {snap?.attendance?.joinedLateNoNotice && <span style={{ fontSize:11, padding:'1px 7px', borderRadius:8, background:C.gold+'18', color:C.gold, fontWeight:600 }}>🕐</span>}
                            {snap?.voice?.joined===true && <span style={{ fontSize:11, padding:'1px 7px', borderRadius:8, background:C.icy+'18', color:C.icy, fontWeight:600 }}>🎙️</span>}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  {!bulkMode && (
                    <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
                      <button onClick={e => { e.stopPropagation(); toggleSubstitute(player.id); }} title="Move to the other section"
                        style={{ width:28, height:28, borderRadius:8, background:'none', border:`1px solid ${C.border}`, color:C.muted, fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>⇄</button>
                      <button onClick={e => { e.stopPropagation(); removeParticipant(player.id); }}
                        style={{ width:28, height:28, borderRadius:8, background:'none', border:`1px solid ${C.red}33`, color:C.red+'88', fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
                      <span style={{ fontSize:18, color:C.muted }}>›</span>
                    </div>
                  )}
                </div>
              );
            }

            // Verify-mode row — tapping moves a name between the
            // Unconfirmed and Confirmed sections instead of opening
            // the snapshot editor. Session-only: nothing here is saved.
            function renderVerifyRow(player, confirmed) {
              const dn = player.username||player.alias||'Unknown';
              const streak = noShowStreak(player.id, activeEvent.type, activeEvent.id);
              const heart = noShowBadge(streak);
              return (
                <div key={player.id} onClick={() => {
                    setConfirmedIds(prev => {
                      const n = new Set(prev);
                      confirmed ? n.delete(player.id) : n.add(player.id);
                      return n;
                    });
                    vibe(6);
                  }}
                  style={{ background:confirmed?C.green+'14':C.card, borderRadius:12, padding:'18px 20px', marginBottom:12, minHeight:64, display:'flex', alignItems:'center', gap:16, cursor:'pointer', border:`1.5px solid ${confirmed?C.green+'66':(lc?lc+'44':C.border+'44')}`, WebkitTapHighlightColor:'transparent' }}>
                  <div style={{ width:38, height:38, borderRadius:'50%', border:`2.5px solid ${confirmed?C.green:C.border}`, background:confirmed?C.green:'none', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    {confirmed && <span style={{ fontSize:18, color:C.bg, fontWeight:700 }}>✓</span>}
                  </div>
                  <div style={{ flex:1, minWidth:0, display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ fontSize:18, fontWeight:700, color:confirmed?C.green:C.white, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{dn}</div>
                    {heart && <span title={`${streak} consecutive ${activeEvent.type} no-shows`} style={{ fontSize:13, flexShrink:0 }}>{heart}</span>}
                  </div>
                </div>
              );
            }

            if (allEventPlayers.length === 0) {
              return <div style={{ textAlign:'center', padding:'40px 0', color:C.muted }}>No one added yet — type a name above to add them.</div>;
            }

            const rankGroups = groupByRank(participantsList);

            return (
              <>
                <div style={{ display:'flex', gap:8, marginBottom:14 }}>
                  <button onClick={copyParticipants}
                    style={{ flex:1, height:40, borderRadius:10, background:participantsCopied?C.green+'18':C.gold+'18', border:`1px solid ${participantsCopied?C.green:C.gold}44`, color:participantsCopied?C.green:C.gold, fontWeight:700, fontSize:13, cursor:'pointer' }}>
                    {participantsCopied ? '✓ Copied' : '📋 Copy participants as code block'}
                  </button>
                  <button onClick={() => { setVerifyMode(v => !v); setBulkMode(false); setBulkSel(new Set()); setConfirmedIds(new Set()); setVerifyPasteText(''); }}
                    style={{ height:40, padding:'0 14px', borderRadius:10, background:verifyMode?C.gold+'22':C.section, border:`1px solid ${verifyMode?C.gold:C.border}`, color:verifyMode?C.gold:C.muted, fontWeight:700, fontSize:13, cursor:'pointer', whiteSpace:'nowrap' }}>
                    🔒 {verifyMode ? 'Exit Verify' : 'Verify Roster'}
                  </button>
                </div>

                {verifyMode && (
                  <div style={{ display:'flex', gap:8, marginBottom:14 }}>
                    <button onClick={() => setVerifyInputMode('tap')} style={{ flex:1, height:34, borderRadius:16, background:verifyInputMode==='tap'?C.gold+'22':C.section, border:`1px solid ${verifyInputMode==='tap'?C.gold:C.border}`, color:verifyInputMode==='tap'?C.gold:C.muted, fontWeight:600, fontSize:12, cursor:'pointer' }}>👆 Tap through</button>
                    <button onClick={() => setVerifyInputMode('paste')} style={{ flex:1, height:34, borderRadius:16, background:verifyInputMode==='paste'?C.gold+'22':C.section, border:`1px solid ${verifyInputMode==='paste'?C.gold:C.border}`, color:verifyInputMode==='paste'?C.gold:C.muted, fontWeight:600, fontSize:12, cursor:'pointer' }}>📋 Paste to check</button>
                  </div>
                )}

                {verifyMode ? (() => {
                  if (verifyInputMode === 'paste') {
                    const pastedNames = parseNames(verifyPasteText);
                    const { matched, unmatched: exactUnmatched } = matchNamesToPlayers(verifyPasteText, participantsList);
                    const matchedIds = new Set(matched.map(p => p.id));
                    // Names that didn't exact-match get one more pass
                    // against whoever's still unmatched, to catch a
                    // likely typo rather than call it a true "extra"
                    // name the app has never heard of.
                    const remainingPool = participantsList.filter(p => !matchedIds.has(p.id));
                    const closeFlags = [];
                    const trueExtras = [];
                    exactUnmatched.forEach(name => {
                      const pool = remainingPool.filter(p => !closeFlags.some(cf => cf.player.id === p.id));
                      const close = findCloseMatches(name, pool);
                      if (close.length > 0) closeFlags.push({ name, player: close[0].player });
                      else trueExtras.push(name);
                    });
                    const closePlayerIds = new Set(closeFlags.map(cf => cf.player.id));
                    const missingFromPaste = remainingPool.filter(p => !closePlayerIds.has(p.id));
                    const allClear = pastedNames.length > 0 && missingFromPaste.length === 0 && closeFlags.length === 0 && trueExtras.length === 0;

                    return (
                      <>
                        <div style={{ background:C.gold+'14', border:`1px solid ${C.gold}55`, borderRadius:10, padding:'10px 14px', marginBottom:14, fontSize:12, color:C.white }}>
                          🔒 Paste the in-game participant list — one name per line or comma separated. Both directions get flagged: who's missing, and who's extra.
                        </div>
                        <textarea
                          value={verifyPasteText}
                          onChange={e => setVerifyPasteText(e.target.value)}
                          placeholder="Paste the in-game list here…"
                          rows={4}
                          style={{ width:'100%', background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'10px 14px', fontSize:14, color:C.white, boxSizing:'border-box', fontFamily:'inherit', resize:'vertical', marginBottom:14 }}
                        />
                        {allClear && (
                          <div style={{ fontSize:13, color:C.green, fontWeight:600 }}>✓ Lists match — no differences found.</div>
                        )}
                        {missingFromPaste.length > 0 && (
                          <div style={{ marginBottom:16 }}>
                            <div style={{ fontSize:11, fontWeight:700, color:C.red, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8 }}>
                              ⚠ In app, not seen in-game · {missingFromPaste.length}
                            </div>
                            {missingFromPaste.map(p => (
                              <div key={p.id} style={{ background:C.red+'14', border:`1px solid ${C.red}44`, borderRadius:10, padding:'12px 16px', marginBottom:8, fontSize:15, fontWeight:600, color:C.white }}>
                                {p.username||p.alias}
                              </div>
                            ))}
                          </div>
                        )}
                        {closeFlags.length > 0 && (
                          <div style={{ marginBottom:16 }}>
                            <div style={{ fontSize:11, fontWeight:700, color:C.gold, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8 }}>
                              ≈ Possible typo · {closeFlags.length}
                            </div>
                            {closeFlags.map((cf,i) => (
                              <div key={i} style={{ background:C.gold+'14', border:`1px solid ${C.gold}44`, borderRadius:10, padding:'12px 16px', marginBottom:8, fontSize:13, color:C.white }}>
                                "{cf.name}" in your paste looks like <strong>{cf.player.username||cf.player.alias}</strong>
                              </div>
                            ))}
                          </div>
                        )}
                        {trueExtras.length > 0 && (
                          <div style={{ marginBottom:16 }}>
                            <div style={{ fontSize:11, fontWeight:700, color:C.icy, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8 }}>
                              ⚠ In-game, not tracked in app · {trueExtras.length}
                            </div>
                            {trueExtras.map((n,i) => (
                              <div key={i} style={{ background:C.icy+'14', border:`1px solid ${C.icy}44`, borderRadius:10, padding:'12px 16px', marginBottom:8, fontSize:15, fontWeight:600, color:C.white }}>
                                {n}
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    );
                  }
                  const unconfirmed = participantsList.filter(p => !confirmedIds.has(p.id));
                  const confirmedPlayers = participantsList.filter(p => confirmedIds.has(p.id));
                  return (
                    <>
                      <div style={{ background:C.gold+'14', border:`1px solid ${C.gold}55`, borderRadius:10, padding:'10px 14px', marginBottom:14, fontSize:12, color:C.white }}>
                        🔒 Tap a name as you find them in-game — it moves down to Confirmed.
                      </div>
                      <div style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8 }}>
                        Unconfirmed · {unconfirmed.length}
                      </div>
                      {unconfirmed.length === 0
                        ? <div style={{ fontSize:13, color:C.green, marginBottom:16 }}>✓ Everyone confirmed.</div>
                        : unconfirmed.map(p => renderVerifyRow(p, false))}
                      {confirmedPlayers.length > 0 && (
                        <>
                          <div style={{ fontSize:11, fontWeight:700, color:C.green, textTransform:'uppercase', letterSpacing:'0.07em', marginTop:16, marginBottom:8 }}>
                            ✓ Confirmed · {confirmedPlayers.length}
                          </div>
                          {confirmedPlayers.map(p => renderVerifyRow(p, true))}
                        </>
                      )}
                    </>
                  );
                })() : (
                  <>
                    <div style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8 }}>
                      Participants · {participantsList.length}
                    </div>
                    {participantsList.length === 0
                      ? <div style={{ fontSize:13, color:C.muted, marginBottom:16 }}>None yet.</div>
                      : [...ALLIANCE_RANKS, 'Unranked'].map(rank => {
                          const group = rankGroups[rank];
                          if (!group.length) return null;
                          return (
                            <div key={rank}>
                              <div style={{ fontSize:10, fontWeight:700, color:C.gold, textTransform:'uppercase', letterSpacing:'0.06em', marginTop:10, marginBottom:6 }}>
                                {rank} ({group.length})
                              </div>
                              {group.map(renderRow)}
                            </div>
                          );
                        })}
                  </>
                )}

                <div style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.07em', marginTop:16, marginBottom:8 }}>
                  Substitutes · {substitutesList.length}
                </div>
                {substitutesList.length === 0
                  ? <div style={{ fontSize:13, color:C.muted }}>None yet.</div>
                  : substitutesList.map(renderRow)}
              </>
            );
          })()}
        </div>
        );
      })() : (
        <>
          <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:10, marginBottom:8 }}>
            {['All',...EVENT_TYPES].map(t => (
              <button key={t} onClick={() => setFilterType(t)} style={{ padding:'7px 14px', borderRadius:20, whiteSpace:'nowrap', background:filterType===t?C.gold+'22':C.section, border:`1px solid ${filterType===t?C.gold:C.border}`, color:filterType===t?C.gold:C.muted, fontWeight:600, fontSize:13, cursor:'pointer', minHeight:36 }}>
                {EVENT_ICONS[t]||''} {t}
              </button>
            ))}
          </div>
          {allTags.length>0 && (
            <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:8, marginBottom:8 }}>
              <button onClick={() => setFilterTag('')} style={{ padding:'5px 12px', borderRadius:20, background:filterTag===''?C.icy+'22':C.section, border:`1px solid ${filterTag===''?C.icy:C.border}`, color:filterTag===''?C.icy:C.muted, fontWeight:600, fontSize:12, cursor:'pointer', minHeight:30 }}>All</button>
              {allTags.map(t => (
                <button key={t} onClick={() => setFilterTag(filterTag===t?'':t)} style={{ padding:'5px 12px', borderRadius:20, background:filterTag===t?C.icy+'22':C.section, border:`1px solid ${filterTag===t?C.icy:C.border}`, color:filterTag===t?C.icy:C.muted, fontWeight:600, fontSize:12, cursor:'pointer', minHeight:30 }}>[{t}]</button>
              ))}
            </div>
          )}
          <button onClick={() => { setEditingEvent(null); setEventSheetOpen(true); }} style={{ width:'100%', height:48, borderRadius:12, background:C.gold, color:C.bg, fontWeight:700, fontSize:15, border:'none', cursor:'pointer', marginBottom:16 }}>
            ＋ New Event
          </button>

          {/* Active vs Archive — a past-dated or Done event no longer
              sits in the same list as what's actually coming up. */}
          <div style={{ display:'flex', gap:8, marginBottom:16 }}>
            <button onClick={() => setEventsView('active')} style={{ flex:1, height:36, borderRadius:20, background:eventsView==='active'?C.gold+'22':C.section, border:`1px solid ${eventsView==='active'?C.gold:C.border}`, color:eventsView==='active'?C.gold:C.muted, fontWeight:600, fontSize:13, cursor:'pointer' }}>
              🗓 Active
            </button>
            <button onClick={() => setEventsView('archive')} style={{ flex:1, height:36, borderRadius:20, background:eventsView==='archive'?C.gold+'22':C.section, border:`1px solid ${eventsView==='archive'?C.gold:C.border}`, color:eventsView==='archive'?C.gold:C.muted, fontWeight:600, fontSize:13, cursor:'pointer' }}>
              📁 Archive{sorted.filter(isArchived).length>0?` (${sorted.filter(isArchived).length})`:''}
            </button>
          </div>

          {(() => {
            function renderEventCard(ev) {
              const s = evSum(ev);
              const sc = ev.status==='active'?C.green:ev.status==='completed'?C.muted:C.icy;
              const lc = legionColor(ev.legion);
              return (
                <div key={ev.id} onClick={() => setActiveEventId(ev.id)} style={{ background:C.card, borderRadius:12, padding:'14px 16px', marginBottom:10, cursor:'pointer', border:`1px solid ${ev.status==='active'?C.green+'44':C.border+'44'}`, borderLeft:lc?`4px solid ${lc}`:undefined, WebkitTapHighlightColor:'transparent' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <div style={{ fontSize:16, fontWeight:700, color:C.white, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{EVENT_ICONS[ev.type]||'📋'} {ev.name||ev.type}</div>
                        {ev.legion && <span style={{ fontSize:10, fontWeight:800, color:lc, padding:'1px 7px', borderRadius:8, background:lc+'22', flexShrink:0 }}>L{ev.legion}</span>}
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginTop:3 }}>
                        <span style={{ fontSize:12, color:C.muted }}>{fmtDateShort(ev.date)}</span>
                        {ev.time && <span style={{ fontSize:13, fontWeight:800, color:C.gold, padding:'0 7px', borderRadius:8, background:C.gold+'18' }}>🕐 {ev.time} UTC</span>}
                        {ev.allianceTag && <span style={{ fontSize:12, color:C.muted }}>[{ev.allianceTag}]</span>}
                      </div>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
                      <span style={{ fontSize:11, fontWeight:700, color:sc, padding:'2px 8px', borderRadius:10, background:sc+'18' }}>{ev.status==='active'?'🔴 Live':ev.status==='completed'?'✓ Done':'Upcoming'}</span>
                      <button onClick={e => { e.stopPropagation(); setDeleteConfirmId(ev.id); }} style={{ fontSize:11, color:C.red+'88', background:'none', border:'none', cursor:'pointer' }}>Delete</button>
                    </div>
                  </div>
                  {s.total>0 && (
                    ev.status==='upcoming'
                      ? <div style={{ fontSize:12, color:C.green }}>✓ {s.participating} participating</div>
                      : <div style={{ display:'flex', gap:10 }}><span style={{ fontSize:12, color:C.green }}>✓ {s.attended}</span><span style={{ fontSize:12, color:C.red }}>✗ {s.noShow}</span><span style={{ fontSize:12, color:C.icy }}>🎙️ {s.voice}</span><span style={{ fontSize:12, color:C.muted }}>{s.total} recorded</span></div>
                  )}
                </div>
              );
            }

            if (listedEvents.length === 0) {
              return (
                <div style={{ textAlign:'center', padding:'60px 20px' }}>
                  <div style={{ fontSize:40, marginBottom:12 }}>{eventsView==='archive'?'📁':'📋'}</div>
                  <div style={{ fontSize:16, fontWeight:700, color:C.white }}>{eventsView==='archive' ? 'No archived events yet' : 'No events yet'}</div>
                </div>
              );
            }

            // Group by date, then by Legion within the date — this is
            // exactly where Legion 1 and Legion 2 (same day, different
            // event) were easy to mix up. A date with no Legion split
            // just lists its events normally underneath.
            const dateGroups = [];
            const byDate = new Map();
            listedEvents.forEach(ev => {
              if (!byDate.has(ev.date)) { byDate.set(ev.date, { date: ev.date, dayEvents: [] }); dateGroups.push(byDate.get(ev.date)); }
              byDate.get(ev.date).dayEvents.push(ev);
            });

            return dateGroups.map(({ date, dayEvents }) => {
              const hasLegionSplit = dayEvents.some(e => e.legion);
              if (!hasLegionSplit) {
                return (
                  <div key={date} style={{ marginBottom:18 }}>
                    <div style={{ fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>{fmtDateShort(date)}</div>
                    {dayEvents.map(renderEventCard)}
                  </div>
                );
              }
              const l1 = dayEvents.filter(e => e.legion === 1);
              const l2 = dayEvents.filter(e => e.legion === 2);
              const rest = dayEvents.filter(e => !e.legion);
              return (
                <div key={date} style={{ marginBottom:18 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>{fmtDateShort(date)}</div>
                  {l1.length > 0 && (
                    <div style={{ marginBottom:10 }}>
                      <div style={{ fontSize:11, fontWeight:800, color:legionColor(1), marginBottom:6 }}>⚔️ Legion 1</div>
                      {l1.map(renderEventCard)}
                    </div>
                  )}
                  {l2.length > 0 && (
                    <div style={{ marginBottom:10 }}>
                      <div style={{ fontSize:11, fontWeight:800, color:legionColor(2), marginBottom:6 }}>⚔️ Legion 2</div>
                      {l2.map(renderEventCard)}
                    </div>
                  )}
                  {rest.map(renderEventCard)}
                </div>
              );
            });
          })()}
        </>
      )}
      <EventSheet event={editingEvent} open={eventSheetOpen} onClose={() => setEventSheetOpen(false)} onSave={ev => { if (editingEvent) onUpdateEvent(ev); else onCreateEvent(ev); }} players={players}/>
      <SnapshotEditor snapshot={snapEditing?.snapshot} playerName={snapEditing?.playerName} eventType={activeEvent?.type} eventStatus={activeEvent?.status} open={snapOpen} onClose={() => setSnapOpen(false)} onSave={saveSnap}/>
      {deleteConfirmId && (
        <DeleteConfirmModal
          message="Delete this event? This cannot be undone."
          onConfirm={() => { onDeleteEvent(deleteConfirmId); setDeleteConfirmId(null); }}
          onCancel={() => setDeleteConfirmId(null)}
        />
      )}
    </div>
  );
}
