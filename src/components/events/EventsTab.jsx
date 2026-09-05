import { useState, useEffect, useRef } from 'react';
import { C, EVENT_TYPES, EVENT_ICONS, TROOP_POWER_EVENTS, SHOWS_RSVP_TYPES, ALLIANCE_RANKS } from '../../utils/constants.js';
import { vibe } from '../../utils/vibe.js';
import { fmtDateShort } from '../../utils/dates.js';
import { newSnapshot } from '../../data/playerSchema.js';
import { searchPlayers } from '../../services/playerAutosuggest.js';
import {
  groupByRank, isArchived, findSiblingLegionEvent, legionColor,
  eventMs, evSum, generateParticipantsText,
} from '../../services/eventListHelpers.js';
import { DeleteConfirmModal } from '../common/DeleteConfirmModal.jsx';
import { SnapshotEditor } from './SnapshotEditor.jsx';
import { EventSheet } from './EventSheet.jsx';
import { EventListCard } from './EventListCard.jsx';
import { ParticipantRow } from './ParticipantRow.jsx';
import { VerifyRosterPanel } from './VerifyRosterPanel.jsx';
import { LegionConflictModal } from './LegionConflictModal.jsx';
import { AddParticipantPanel } from './AddParticipantPanel.jsx';

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
  const [swipeDX, setSwipeDX]         = useState(0);     // live drag offset while swiping between events
  const [swiping, setSwiping]         = useState(false);
  const [stickyVisible, setStickyVisible] = useState(false);
  const [confirmDoneArmed, setConfirmDoneArmed] = useState(false); // Marking Done bulk-writes attendance for everyone — this guards the single tap that triggers it
  const headerRef = useRef(null);
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

  // Sticky context bar — appears once the event's own header card has
  // scrolled out from under the app's fixed top header, so scrolling
  // deep into a long roster never loses track of which event this is.
  // rootMargin's top offset matches the app's own sticky header height
  // (~60px per CONSTITUTION.md) — adjust this if that header's actual
  // height ever changes.
  useEffect(() => {
    if (!activeEvent) { setStickyVisible(false); return; }
    const el = headerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => setStickyVisible(!entry.isIntersecting),
      { threshold: 0, rootMargin: '-60px 0px 0px 0px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [activeEvent?.id]);

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
  const sorted = [...filtered].sort((a, b) => Math.abs(eventMs(a) - nowMs) - Math.abs(eventMs(b) - nowMs));

  // An event archives itself the moment either is true — no need to
  // remember to tap "Done" for it to stop cluttering the main list.
  // Date strings are always 'YYYY-MM-DD' (see playerSchema.js), so a
  // plain string comparison against today sorts correctly with no
  // timezone math involved.
  const todayStr = new Date().toISOString().slice(0, 10);
  const listedEvents = sorted.filter(ev => eventsView === 'archive' ? isArchived(ev, todayStr) : !isArchived(ev, todayStr));

  // Swipe-eligible events — Active (non-archived) only, regardless of
  // whatever type/tag filter or Active/Archive toggle is currently
  // applied on the list screen. Swiping through an event's detail view
  // always draws from this same full active set.
  const activeSwipeList = sorted.filter(ev => !isArchived(ev, todayStr));

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
      if (tag==='attended')   s = { ...s, attendance:{ ...s.attendance, attended:true, noShow:false, excused:false } };
      if (tag==='noshow')     s = { ...s, attendance:{ ...s.attendance, attended:false, noShow:true } };
      if (tag==='excused')    s = { ...s, attendance:{ ...s.attendance, attended:false, noShow:true, excused:true } };
      if (tag==='late')       s = { ...s, attendance:{ ...s.attendance, joinedLateNoNotice:true } };
      if (tag==='voice')      s = { ...s, voice:{ ...s.voice, joined:true } };
      if (idx>=0) snaps[idx]=s; else snaps.push(s);
    });
    onUpdateEvent({ ...activeEvent, snapshots:snaps });
    setBulkSel(new Set()); setBulkMode(false); vibe(8);
  }

  // Marking an event Done auto-marks everyone still unrecorded as
  // attended — by far the common case during a live event is "everyone
  // who showed up is fine," so this saves re-tapping every single
  // person just to confirm the default. Only fills in blanks
  // (attendance.attended === null, i.e. never touched) — any snapshot
  // where someone already explicitly recorded attended/no-show is left
  // exactly as-is.
  function markStatus(newStatus) {
    if (newStatus === 'completed' && activeEvent.status !== 'completed') {
      const snaps = [...(activeEvent.snapshots || [])];
      (activeEvent.participantIds || []).forEach(pid => {
        const player = players.find(p => p.id === pid);
        if (!player) return;
        const idx = snaps.findIndex(s => s.playerId === pid);
        if (idx >= 0) {
          // Substitutes aren't part of the required roster — they
          // don't auto-attend just because the event ended. Leaving
          // their attendance untouched keeps them reliability-neutral
          // (see metrics.js) unless an officer manually records that
          // they actually showed up.
          if (snaps[idx].rsvp?.substitute) return;
          if (snaps[idx].attendance?.attended === null || snaps[idx].attendance?.attended === undefined) {
            snaps[idx] = { ...snaps[idx], attendance: { ...snaps[idx].attendance, attended: true, noShow: false } };
          }
        } else {
          const snap = newSnapshot(pid, player, activeEvent.id);
          snap.attendance.attended = true;
          snaps.push(snap);
        }
      });
      onUpdateEvent({ ...activeEvent, status: newStatus, snapshots: snaps });
    } else {
      onUpdateEvent({ ...activeEvent, status: newStatus });
    }
    vibe(8);
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

  function copyParticipants() {
    navigator.clipboard.writeText(generateParticipantsText(activeEvent, participantsList, substitutesList)).then(() => { setParticipantsCopied(true); setTimeout(() => setParticipantsCopied(false), 2000); });
  }

  const bulkTags = isUpcoming
    ? (showsRsvp ? [['🕐 Arriving late','rsvpLate',C.gold],['🏃 Leaving early','early',C.gold],['🎙️ Will join Discord','discord',C.icy],['✓ Present whole time','wholetime',C.green]] : [])
    : [['✓ Attended','attended',C.green],['✗ No-show','noshow',C.red],['📝 Excused absence','excused',C.mar],['🕐 Late (no notice)','late',C.gold],['🎙️ Voice','voice',C.icy]];

  return (
    <div style={{ padding:'16px 20px 0' }}>
      {toastMsg && (
        <div style={{ position:'fixed', top:20, left:'50%', transform:'translateX(-50%)', background:C.card+'ee', backdropFilter:'blur(12px)', border:`1px solid ${C.gold}44`, borderRadius:20, padding:'10px 20px', fontSize:13, fontWeight:600, color:C.gold, zIndex:800, maxWidth:'90%', textAlign:'center', pointerEvents:'none' }}>
          {toastMsg}
        </div>
      )}

      <LegionConflictModal
        legionModal={legionModal}
        activeEvent={activeEvent}
        onConfirmSwap={confirmLegionSwap}
        onResolveConflict={resolveLegionConflict}
        onClose={() => setLegionModal(null)}
      />

      {stickyVisible && activeEvent && (() => {
        const stickyLc = legionColor(activeEvent.type, activeEvent.legion);
        return (
          <div style={{ position:'fixed', top:60, left:0, right:0, zIndex:150, maxWidth:480, margin:'0 auto', background:C.card+'f2', backdropFilter:'blur(10px)', borderBottom:`1px solid ${stickyLc?stickyLc+'66':C.border}`, padding:'10px 20px', display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ fontSize:14, fontWeight:700, color:C.white, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>
              {EVENT_ICONS[activeEvent.type]||'📋'} {activeEvent.name||activeEvent.type}
            </div>
            {activeEvent.legion && <span style={{ fontSize:10, fontWeight:800, color:stickyLc, padding:'1px 7px', borderRadius:8, background:stickyLc+'22', flexShrink:0 }}>L{activeEvent.legion}</span>}
            <span style={{ fontSize:11, color:C.muted, flexShrink:0 }}>{fmtDateShort(activeEvent.date)}</span>
            {activeEvent.time && <span style={{ fontSize:11, fontWeight:700, color:C.gold, flexShrink:0 }}>🕐 {activeEvent.time}</span>}
          </div>
        );
      })()}

      {activeEvent ? (() => {
        const lc = legionColor(activeEvent.type, activeEvent.legion);
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
        function handleTouchStart(e) { setTouchStartX(e.touches[0].clientX); setSwiping(true); setSwipeDX(0); }
        function handleTouchMove(e) {
          if (touchStartX == null) return;
          let dx = e.touches[0].clientX - touchStartX;
          // Rubber-band at the ends of the list — dragging toward a
          // direction you can't actually swipe still moves a little,
          // so it's visibly "stuck" rather than looking unresponsive.
          if (dx > 0 && !canSwipePrev) dx *= 0.25;
          if (dx < 0 && !canSwipeNext) dx *= 0.25;
          setSwipeDX(Math.max(-140, Math.min(140, dx)));
        }
        function handleTouchEnd(e) {
          setSwiping(false);
          if (touchStartX == null) { setSwipeDX(0); return; }
          const dx = swipeDX;
          setTouchStartX(null);
          setSwipeDX(0);
          if (Math.abs(dx) < 60) return; // minimum swipe distance — avoids misfiring on ordinary taps/scrolls
          if (dx < 0 && canSwipeNext) goToEvent(activeSwipeList[swipeIdx + 1]);
          else if (dx > 0 && canSwipePrev) goToEvent(activeSwipeList[swipeIdx - 1]);
        }
        return (
        <div onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
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

          <div style={{ position:'relative' }}>
            {swiping && swipeDX < -12 && canSwipeNext && (
              <div style={{ position:'absolute', right:6, top:80, fontSize:30, fontWeight:900, color:C.gold, opacity:Math.min(Math.abs(swipeDX)/60, 1), zIndex:5, pointerEvents:'none', textShadow:`0 0 10px ${C.gold}88` }}>›</div>
            )}
            {swiping && swipeDX > 12 && canSwipePrev && (
              <div style={{ position:'absolute', left:6, top:80, fontSize:30, fontWeight:900, color:C.gold, opacity:Math.min(Math.abs(swipeDX)/60, 1), zIndex:5, pointerEvents:'none', textShadow:`0 0 10px ${C.gold}88` }}>‹</div>
            )}
            <div style={{ transform:`translateX(${swiping ? swipeDX : 0}px)`, transition: swiping ? 'none' : 'transform 0.25s ease', opacity: swiping ? 1 - Math.min(Math.abs(swipeDX)/280, 0.35) : 1 }}>

          <div ref={headerRef} style={{ background:C.card, borderRadius:14, padding:16, marginBottom:16, borderTop:lc?`4px solid ${lc}`:'none' }}>
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
              {[['upcoming','Upcoming',C.icy],['active','🔴 Live',C.green],['completed','✓ Done',C.muted]].map(([s,l,c]) => {
                const isDoneArmed = s === 'completed' && confirmDoneArmed && activeEvent.status !== 'completed';
                function handleClick() {
                  if (s === 'completed' && activeEvent.status !== 'completed') {
                    if (!confirmDoneArmed) { setConfirmDoneArmed(true); setTimeout(() => setConfirmDoneArmed(false), 3000); return; }
                    setConfirmDoneArmed(false);
                  }
                  markStatus(s);
                }
                return (
                  <button key={s} onClick={handleClick}
                    style={{ flex:1, height:44, borderRadius:20, border:`1px solid ${isDoneArmed?C.gold:activeEvent.status===s?c:C.border}`, background:isDoneArmed?C.gold+'22':activeEvent.status===s?c+'22':C.section, color:isDoneArmed?C.gold:activeEvent.status===s?c:C.muted, fontWeight:700, fontSize:isDoneArmed?12:13, cursor:'pointer' }}>
                    {isDoneArmed ? 'Tap again — marks all attended' : l}
                  </button>
                );
              })}
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

          <AddParticipantPanel
            addAsSubstitute={addAsSubstitute} setAddAsSubstitute={setAddAsSubstitute}
            addMode={addMode} setAddMode={setAddMode}
            addQuery={addQuery} addResults={addResults} onSearchAdd={searchAdd} onCommitTopMatch={commitTopMatch} onAddParticipant={addParticipant}
            pasteAddText={pasteAddText} setPasteAddText={setPasteAddText} onAddParticipantsBatch={addParticipantsBatch}
            players={players} activeEvent={activeEvent} events={events}
            onOpenLegionSwap={(player, sibling) => setLegionModal({ mode:'swap', player, sibling })}
            copyPickerOpen={copyPickerOpen} setCopyPickerOpen={setCopyPickerOpen} onCopyRosterFrom={copyRosterFrom}
          />

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

            if (allEventPlayers.length === 0) {
              return <div style={{ textAlign:'center', padding:'40px 0', color:C.muted }}>No one added yet — type a name above to add them.</div>;
            }

            const rankGroups = groupByRank(participantsList);

            function renderParticipantRow(player) {
              return (
                <ParticipantRow
                  key={player.id}
                  player={player} activeEvent={activeEvent} events={events} snap={getSnap(activeEvent, player.id)}
                  bulkMode={bulkMode} isSel={bulkSel.has(player.id)}
                  onToggleBulkSel={id => { const n = new Set(bulkSel); n.has(id) ? n.delete(id) : n.add(id); setBulkSel(n); }}
                  onOpenSnap={openSnap}
                  sibling={sibling} onResolveLegionConflict={(p, sib) => setLegionModal({ mode:'resolve', player:p, sibling:sib })}
                  lc={lc} tracksTroopPower={tracksTroopPower} showsRsvp={showsRsvp} isUpcoming={isUpcoming}
                  onSetTroopPower={setTroopPower} onToggleSubstitute={toggleSubstitute} onRemove={removeParticipant}
                />
              );
            }

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

                {verifyMode ? (
                  <VerifyRosterPanel
                    participantsList={participantsList}
                    activeEvent={activeEvent}
                    events={events}
                    confirmedIds={confirmedIds} setConfirmedIds={setConfirmedIds}
                    verifyInputMode={verifyInputMode} setVerifyInputMode={setVerifyInputMode}
                    verifyPasteText={verifyPasteText} setVerifyPasteText={setVerifyPasteText}
                    lc={lc}
                  />
                ) : (
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
                              {group.map(renderParticipantRow)}
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
                  : substitutesList.map(renderParticipantRow)}
              </>
            );
          })()}

            </div>
          </div>
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
              📁 Archive{sorted.filter(ev => isArchived(ev, todayStr)).length>0?` (${sorted.filter(ev => isArchived(ev, todayStr)).length})`:''}
            </button>
          </div>

          {(() => {
            function renderEventCard(ev) {
              return <EventListCard key={ev.id} ev={ev} onOpen={setActiveEventId} onDelete={setDeleteConfirmId} />;
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
                      <div style={{ fontSize:11, fontWeight:800, color:legionColor(l1[0].type, 1), marginBottom:6 }}>⚔️ Legion 1</div>
                      {l1.map(renderEventCard)}
                    </div>
                  )}
                  {l2.length > 0 && (
                    <div style={{ marginBottom:10 }}>
                      <div style={{ fontSize:11, fontWeight:800, color:legionColor(l2[0].type, 2), marginBottom:6 }}>⚔️ Legion 2</div>
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
