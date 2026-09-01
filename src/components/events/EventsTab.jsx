import { useState } from 'react';
import { C, EVENT_TYPES, EVENT_ICONS, TROOP_POWER_EVENTS } from '../../utils/constants.js';
import { vibe } from '../../utils/vibe.js';
import { fmtDateShort } from '../../utils/dates.js';
import { newSnapshot } from '../../data/playerSchema.js';
import { searchPlayers } from '../../services/playerAutosuggest.js';
import { DeleteConfirmModal } from '../common/DeleteConfirmModal.jsx';
import { SnapshotEditor } from './SnapshotEditor.jsx';
import { EventSheet } from './EventSheet.jsx';

function initials(n) { return (n||'?').split(/\s+/).map(w=>w[0]||'').join('').slice(0,2).toUpperCase()||'?'; }

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
  const [sortMode, setSortMode]       = useState('alpha'); // 'alpha' | 'troopPower'
  const [addQuery, setAddQuery]       = useState('');
  const [addResults, setAddResults]   = useState([]);

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
      snaps[idx] = { ...snaps[idx], rsvp: { ...snaps[idx].rsvp, participating: true } };
    } else {
      const snap = newSnapshot(player.id, player, activeEvent.id);
      snap.rsvp.participating = true; // being added IS participating — no separate toggle
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

  // Bulk tags differ by event phase — RSVP-relevant tags for upcoming
  // events, post-event actuals for active/completed ones. Never both.
  // "rsvpLate" (upcoming, a prediction) and "late" (post-event, an
  // actual with no notice) are deliberately different tag keys — the
  // if-chain below doesn't know which button set fired it, so reusing
  // one key for both would let an upcoming "Arriving late" tap also
  // set the unrelated post-event "joined late with no notice" field.
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
      if (tag==='substitute') s = { ...s, rsvp:{ ...s.rsvp, substitute:true } };
      if (tag==='attended')   s = { ...s, attendance:{ ...s.attendance, attended:true, noShow:false } };
      if (tag==='noshow')     s = { ...s, attendance:{ ...s.attendance, attended:false, noShow:true } };
      if (tag==='late')       s = { ...s, attendance:{ ...s.attendance, joinedLateNoNotice:true } };
      if (tag==='voice')      s = { ...s, voice:{ ...s.voice, joined:true } };
      if (idx>=0) snaps[idx]=s; else snaps.push(s);
    });
    onUpdateEvent({ ...activeEvent, snapshots:snaps });
    setBulkSel(new Set()); setBulkMode(false); vibe(8);
  }

  function evSum(ev) {
    const sn = ev.snapshots||[];
    if (ev.status === 'upcoming') {
      return { total:sn.length, participating:sn.filter(s=>s.rsvp?.participating).length };
    }
    return { total:sn.length, attended:sn.filter(s=>s.attendance?.attended===true).length, noShow:sn.filter(s=>s.attendance?.noShow).length, voice:sn.filter(s=>s.voice?.joined===true).length };
  }

  const isUpcoming = activeEvent?.status === 'upcoming';
  const tracksTroopPower = TROOP_POWER_EVENTS.includes(activeEvent?.type);

  // Explicit roster — strictly the participantIds list, no "empty means
  // everyone" fallback.
  let eventPlayers = activeEvent ? players.filter(p => (activeEvent.participantIds||[]).includes(p.id)) : [];
  eventPlayers = [...eventPlayers].sort((a, b) => {
    if (sortMode === 'troopPower' && tracksTroopPower) {
      const ta = getSnap(activeEvent, a.id)?.troopPower ?? -1;
      const tb = getSnap(activeEvent, b.id)?.troopPower ?? -1;
      return tb - ta;
    }
    return (a.username||a.alias||'').localeCompare(b.username||b.alias||'');
  });

  const bulkTags = isUpcoming
    ? [['🕐 Arriving late','rsvpLate',C.gold],['🏃 Leaving early','early',C.gold],['🎙️ Will join Discord','discord',C.icy],['✓ Present whole time','wholetime',C.green],['🔄 Substitute','substitute',C.muted]]
    : [['✓ Attended','attended',C.green],['✗ No-show','noshow',C.red],['🕐 Late (no notice)','late',C.gold],['🎙️ Voice','voice',C.icy]];

  return (
    <div style={{ padding:'16px 20px 0' }}>
      {activeEvent ? (
        <div>
          <button onClick={() => { setActiveEventId(null); setBulkMode(false); setBulkSel(new Set()); setAddQuery(''); setAddResults([]); }} style={{ display:'flex', alignItems:'center', gap:8, background:'none', border:'none', color:C.gold, fontSize:14, fontWeight:600, cursor:'pointer', marginBottom:16, padding:0 }}>
            ← Back to Events
          </button>
          <div style={{ background:C.card, borderRadius:14, padding:16, marginBottom:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
              <div>
                <div style={{ fontSize:20, fontWeight:700, color:C.white }}>{EVENT_ICONS[activeEvent.type]||'📋'} {activeEvent.name||activeEvent.type}</div>
                <div style={{ fontSize:13, color:C.muted }}>{fmtDateShort(activeEvent.date)}{activeEvent.time?` ${activeEvent.time}`:''}{activeEvent.allianceTag?` · [${activeEvent.allianceTag}]`:''}</div>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={() => { setEditingEvent(activeEvent); setEventSheetOpen(true); }} style={{ height:34, padding:'0 12px', borderRadius:20, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontSize:13, cursor:'pointer' }}>Edit</button>
                <button onClick={() => { const n=activeEvent.status==='active'?'completed':activeEvent.status==='completed'?'upcoming':'active'; onUpdateEvent({ ...activeEvent, status:n }); }} style={{ height:34, padding:'0 12px', borderRadius:20, background:activeEvent.status==='active'?C.green+'22':C.section, border:`1px solid ${activeEvent.status==='active'?C.green:C.border}`, color:activeEvent.status==='active'?C.green:C.muted, fontSize:13, fontWeight:600, cursor:'pointer' }}>
                  {activeEvent.status==='active'?'🔴 Live':activeEvent.status==='completed'?'✓ Done':'Upcoming'}
                </button>
              </div>
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

          {/* Add participant — type a name, Enter commits the top match */}
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

          {/* Sort toggle */}
          {eventPlayers.length > 1 && (
            <div style={{ display:'flex', gap:6, marginBottom:12 }}>
              <button onClick={() => setSortMode('alpha')} style={{ height:32, padding:'0 12px', borderRadius:16, background:sortMode==='alpha'?C.gold+'22':C.section, border:`1px solid ${sortMode==='alpha'?C.gold:C.border}`, color:sortMode==='alpha'?C.gold:C.muted, fontWeight:600, fontSize:12, cursor:'pointer' }}>A–Z</button>
              {tracksTroopPower && (
                <button onClick={() => setSortMode('troopPower')} style={{ height:32, padding:'0 12px', borderRadius:16, background:sortMode==='troopPower'?C.gold+'22':C.section, border:`1px solid ${sortMode==='troopPower'?C.gold:C.border}`, color:sortMode==='troopPower'?C.gold:C.muted, fontWeight:600, fontSize:12, cursor:'pointer' }}>💪 Troop Power</button>
              )}
            </div>
          )}

          <div style={{ display:'flex', gap:8, marginBottom:16, overflowX:'auto' }}>
            <button onClick={() => { setBulkMode(!bulkMode); setBulkSel(new Set()); }} style={{ height:36, padding:'0 14px', borderRadius:20, background:bulkMode?C.gold+'22':C.section, border:`1px solid ${bulkMode?C.gold:C.border}`, color:bulkMode?C.gold:C.muted, fontWeight:600, fontSize:13, cursor:'pointer', whiteSpace:'nowrap' }}>
              {bulkMode ? `✓ ${bulkSel.size} selected` : '⚡ Update multiple'}
            </button>
            {bulkMode && bulkSel.size>0 && bulkTags.map(([l,t,c]) => (
              <button key={t} onClick={() => applyBulk(t)} style={{ height:36, padding:'0 12px', borderRadius:20, background:c+'18', border:`1px solid ${c}44`, color:c, fontWeight:600, fontSize:13, cursor:'pointer', whiteSpace:'nowrap' }}>{l}</button>
            ))}
          </div>
          {eventPlayers.length===0
            ? <div style={{ textAlign:'center', padding:'40px 0', color:C.muted }}>No one added yet — type a name above to add them.</div>
            : eventPlayers.map(player => {
                const snap = getSnap(activeEvent, player.id);
                const dn = player.username||player.alias||'Unknown';
                const isSel = bulkSel.has(player.id);
                return (
                  <div key={player.id} onClick={() => { if (bulkMode) { const n=new Set(bulkSel); isSel?n.delete(player.id):n.add(player.id); setBulkSel(n); } else openSnap(activeEvent, player); }} style={{ background:isSel?C.gold+'18':C.card, borderRadius:10, padding:'10px 14px', marginBottom:8, display:'flex', alignItems:'center', gap:10, cursor:'pointer', border:`1px solid ${isSel?C.gold:C.border+'44'}`, WebkitTapHighlightColor:'transparent' }}>
                    {bulkMode && <div style={{ width:22, height:22, borderRadius:'50%', border:`2px solid ${isSel?C.gold:C.border}`, background:isSel?C.gold:'none', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{isSel && <span style={{ fontSize:12, color:C.bg, fontWeight:700 }}>✓</span>}</div>}
                    <div style={{ width:36, height:36, borderRadius:'50%', background:C.muted+'33', border:`1.5px solid ${C.muted}`, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:14, color:C.white, flexShrink:0 }}>{initials(dn)}</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6, overflow:'hidden' }}>
                        <div style={{ fontSize:15, fontWeight:700, color:C.white, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{dn}</div>
                        {player.furnaceLevel && <span style={{ fontSize:11, color:C.icy, fontWeight:600, flexShrink:0 }}>{player.furnaceLevel}</span>}
                        {tracksTroopPower && snap?.troopPower != null && (
                          <span style={{ fontSize:11, color:C.gold, fontWeight:700, flexShrink:0 }}>💪 {snap.troopPower.toLocaleString()}</span>
                        )}
                      </div>
                      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:3 }}>
                        {isUpcoming ? (
                          <>
                            {snap?.rsvp?.willBeLate && <span style={{ fontSize:11, padding:'1px 7px', borderRadius:8, background:C.gold+'18', color:C.gold, fontWeight:600 }}>🕐 Late</span>}
                            {snap?.rsvp?.willLeaveEarly && <span style={{ fontSize:11, padding:'1px 7px', borderRadius:8, background:C.gold+'18', color:C.gold, fontWeight:600 }}>🏃 Early</span>}
                            {snap?.rsvp?.willJoinDiscord && <span style={{ fontSize:11, padding:'1px 7px', borderRadius:8, background:C.icy+'18', color:C.icy, fontWeight:600 }}>🎙️</span>}
                            {snap?.rsvp?.presentWholeTime && <span style={{ fontSize:11, padding:'1px 7px', borderRadius:8, background:C.green+'18', color:C.green, fontWeight:600 }}>✓ Full</span>}
                            {snap?.rsvp?.substitute && <span style={{ fontSize:11, padding:'1px 7px', borderRadius:8, background:C.muted+'22', color:C.muted, fontWeight:600 }}>🔄 Sub</span>}
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
                    </div>
                    {!bulkMode && (
                      <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
                        <button onClick={e => { e.stopPropagation(); removeParticipant(player.id); }}
                          style={{ width:28, height:28, borderRadius:8, background:'none', border:`1px solid ${C.red}33`, color:C.red+'88', fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
                        <span style={{ fontSize:18, color:C.muted }}>›</span>
                      </div>
                    )}
                  </div>
                );
              })
          }
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
