import { useState } from 'react';
import { C, EVENT_TYPES, EVENT_ICONS, TROOP_POWER_EVENTS, SHOWS_RSVP_TYPES, ALLIANCE_RANKS } from '../../utils/constants.js';
import { vibe } from '../../utils/vibe.js';
import { fmtDateShort } from '../../utils/dates.js';
import { newSnapshot } from '../../data/playerSchema.js';
import { searchPlayers } from '../../services/playerAutosuggest.js';
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
  const [copyPickerOpen, setCopyPickerOpen] = useState(false);
  const [participantsCopied, setParticipantsCopied] = useState(false);

  const activeEvent = events.find(e => e.id === activeEventId);
  const allTags = [...new Set(events.map(e => e.allianceTag).filter(Boolean))];
  let filtered = filterType==='All' ? events : events.filter(e => e.type===filterType);
  if (filterTag) filtered = filtered.filter(e => e.allianceTag===filterTag);
  const sorted = [...filtered].sort((a,b) => new Date(b.date) - new Date(a.date));

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

  // Legion 1/2 — Foundry/Canyon Clash only (same gate as troop power).
  // Tap again to clear.
  function setLegion(playerId, legion) {
    if (!activeEvent) return;
    const player = players.find(p => p.id === playerId);
    if (!player) return;
    const snaps = [...(activeEvent.snapshots || [])];
    const idx = snaps.findIndex(s => s.playerId === playerId);
    const current = idx >= 0 ? snaps[idx].legion : null;
    const next = current === legion ? null : legion;
    if (idx >= 0) snaps[idx] = { ...snaps[idx], legion: next };
    else {
      const snap = newSnapshot(playerId, player, activeEvent.id);
      snap.legion = next;
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
  function generateParticipantsText() {
    if (!activeEvent) return '';
    const lines = [`📋 ${activeEvent.name || activeEvent.type} — ${fmtDateShort(activeEvent.date)}`, ''];
    const groups = groupByRank(participantsList);
    lines.push(`PARTICIPANTS (${participantsList.length})`);
    [...ALLIANCE_RANKS, 'Unranked'].forEach(rank => {
      const group = groups[rank];
      if (!group.length) return;
      lines.push(`${rank} (${group.length})`);
      group.forEach(p => lines.push(`  ${p.username || p.alias || '?'}`));
    });
    if (substitutesList.length > 0) {
      lines.push('', `SUBSTITUTES (${substitutesList.length})`);
      substitutesList.forEach(p => lines.push(`  ${p.username || p.alias || '?'}`));
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
      {activeEvent ? (
        <div>
          <button onClick={() => { setActiveEventId(null); setBulkMode(false); setBulkSel(new Set()); setAddQuery(''); setAddResults([]); }} style={{ display:'flex', alignItems:'center', gap:8, background:'none', border:'none', color:C.gold, fontSize:14, fontWeight:600, cursor:'pointer', marginBottom:16, padding:0 }}>
            ← Back to Events
          </button>
          <div style={{ background:C.card, borderRadius:14, padding:16, marginBottom:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
              <div>
                <div style={{ fontSize:20, fontWeight:700, color:C.white }}>{EVENT_ICONS[activeEvent.type]||'📋'} {activeEvent.name||activeEvent.type}</div>
                <div style={{ fontSize:16, fontWeight:700, color:C.icy }}>{fmtDateShort(activeEvent.date)}{activeEvent.time?` ${activeEvent.time}`:''}{activeEvent.allianceTag?` · [${activeEvent.allianceTag}]`:''}</div>
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

          {/* Add participant — type a name, Enter commits the top match.
              Adding-as toggle decides which section they land in. */}
          <div style={{ display:'flex', gap:6, marginBottom:8 }}>
            <button onClick={() => setAddAsSubstitute(false)} style={{ flex:1, height:36, borderRadius:10, border:`1px solid ${!addAsSubstitute?C.gold:C.border}`, background:!addAsSubstitute?C.gold+'22':C.section, color:!addAsSubstitute?C.gold:C.muted, fontWeight:600, fontSize:13, cursor:'pointer' }}>Add as Participant</button>
            <button onClick={() => setAddAsSubstitute(true)} style={{ flex:1, height:36, borderRadius:10, border:`1px solid ${addAsSubstitute?C.gold:C.border}`, background:addAsSubstitute?C.gold+'22':C.section, color:addAsSubstitute?C.gold:C.muted, fontWeight:600, fontSize:13, cursor:'pointer' }}>Add as Substitute</button>
          </div>
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
            function renderRow(player) {
              const snap = getSnap(activeEvent, player.id);
              const dn = player.username||player.alias||'Unknown';
              const isSel = bulkSel.has(player.id);
              const isLead = player.roles?.includes('Rally Lead');
              return (
                <div key={player.id} onClick={() => { if (bulkMode) { const n=new Set(bulkSel); isSel?n.delete(player.id):n.add(player.id); setBulkSel(n); } else openSnap(activeEvent, player); }} style={{ background:isSel?C.gold+'18':C.card, borderRadius:10, padding:'10px 14px', marginBottom:8, display:'flex', alignItems:'center', gap:10, cursor:'pointer', border:`1px solid ${isSel?C.gold:isLead?C.gold+'55':C.border+'44'}`, WebkitTapHighlightColor:'transparent' }}>
                  {bulkMode && <div style={{ width:22, height:22, borderRadius:'50%', border:`2px solid ${isSel?C.gold:C.border}`, background:isSel?C.gold:'none', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{isSel && <span style={{ fontSize:12, color:C.bg, fontWeight:700 }}>✓</span>}</div>}
                  <div style={{ width:36, height:36, borderRadius:'50%', background:(isLead?C.gold:C.muted)+'33', border:`1.5px solid ${isLead?C.gold:C.muted}`, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:14, color:C.white, flexShrink:0 }}>{initials(dn)}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6, overflow:'hidden' }}>
                      {isLead && <span style={{ fontSize:12, flexShrink:0 }}>👑</span>}
                      <div style={{ fontSize:15, fontWeight:700, color:C.white, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{dn}</div>
                      {player.allianceRank && <span style={{ fontSize:11, color:C.gold, fontWeight:700, flexShrink:0, padding:'0 6px', borderRadius:6, background:C.gold+'18' }}>{player.allianceRank}</span>}
                      {player.furnaceLevel && <span style={{ fontSize:11, color:C.icy, fontWeight:600, flexShrink:0 }}>{player.furnaceLevel}</span>}
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
                        {[1,2].map(l => (
                          <button key={l} onClick={e => { e.stopPropagation(); setLegion(player.id, l); }}
                            style={{ width:32, height:28, borderRadius:8, border:`1px solid ${snap?.legion===l?C.icy:C.border}`, background:snap?.legion===l?C.icy+'22':C.section, color:snap?.legion===l?C.icy:C.muted, fontWeight:700, fontSize:11, cursor:'pointer' }}>
                            L{l}
                          </button>
                        ))}
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

            if (allEventPlayers.length === 0) {
              return <div style={{ textAlign:'center', padding:'40px 0', color:C.muted }}>No one added yet — type a name above to add them.</div>;
            }

            const rankGroups = groupByRank(participantsList);

            return (
              <>
                <button onClick={copyParticipants}
                  style={{ width:'100%', height:40, borderRadius:10, marginBottom:14, background:participantsCopied?C.green+'18':C.gold+'18', border:`1px solid ${participantsCopied?C.green:C.gold}44`, color:participantsCopied?C.green:C.gold, fontWeight:700, fontSize:13, cursor:'pointer' }}>
                  {participantsCopied ? '✓ Copied' : '📋 Copy participants as code block'}
                </button>

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
      ) : (
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
          {sorted.length===0
            ? <div style={{ textAlign:'center', padding:'60px 20px' }}><div style={{ fontSize:40, marginBottom:12 }}>📋</div><div style={{ fontSize:16, fontWeight:700, color:C.white }}>No events yet</div></div>
            : sorted.map(ev => {
                const s = evSum(ev);
                const sc = ev.status==='active'?C.green:ev.status==='completed'?C.muted:C.icy;
                return (
                  <div key={ev.id} onClick={() => setActiveEventId(ev.id)} style={{ background:C.card, borderRadius:12, padding:'14px 16px', marginBottom:10, cursor:'pointer', border:`1px solid ${ev.status==='active'?C.green+'44':C.border+'44'}`, WebkitTapHighlightColor:'transparent' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:16, fontWeight:700, color:C.white, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{EVENT_ICONS[ev.type]||'📋'} {ev.name||ev.type}</div>
                        <div style={{ fontSize:12, color:C.muted }}>{fmtDateShort(ev.date)}{ev.time?` ${ev.time}`:''}{ev.allianceTag?` · [${ev.allianceTag}]`:''}</div>
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
              })
          }
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
