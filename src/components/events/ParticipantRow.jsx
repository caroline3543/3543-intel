import { PlayerAvatar } from '../players/PlayerAvatar.jsx';
import { useState } from 'react';
import { C, ALLIANCE_RANKS, TROOP_POWER_EVENTS } from '../../utils/constants.js';
import { recentMisses } from '../../services/eventListHelpers.js';

// Props:
//   player, activeEvent, events, snap
//   bulkMode, isSel, onToggleBulkSel, onOpenSnap
//   sibling                 – the sibling Legion event, if any (see findSiblingLegionEvent)
//   onResolveLegionConflict – (player, sibling) => void
//   lc                      – this event's Legion color (see legionColor)
//   tracksTroopPower, showsRsvp, isUpcoming
//   onSetTroopPower, onSetRank, onRemove
//
// Rank: no chip beside the name (rank is conveyed by the group heading
// in EventsTab). Tap the avatar to re-rank — writes straight to the
// roster record. The ⇄ substitute button is gone; moving someone to
// substitutes now lives in the missed-events panel of the record sheet,
// reached by tapping the ⚠ flag.
export function ParticipantRow({
  player, activeEvent, events, snap,
  bulkMode, isSel, onToggleBulkSel, onOpenSnap,
  sibling, onResolveLegionConflict,
  lc, tracksTroopPower, showsRsvp, isUpcoming,
  onSetTroopPower, onSetRank, onRemove,
}) {
  const dn = player.username||player.alias||'Unknown';
  const isLead = player.roles?.includes('Rally Lead');
  const legionConflict = !!sibling && (sibling.participantIds||[]).includes(player.id);
  // Foundry / Canyon Clash only. 1-2 misses in the last 5 = heads-up;
  // 3+ = consider blacklisting. Excused absences never count.
  const misses = TROOP_POWER_EVENTS.includes(activeEvent.type)
    ? recentMisses(player.id, activeEvent.type, activeEvent.id, events).missed.length
    : 0;
  const [rankOpen, setRankOpen] = useState(false);
  // Removing someone used to be a single mis-tap away with no way back
  // — this is a small inline two-step confirm instead (tap once to
  // arm, tap again within ~2.5s to actually remove), matching the "no
  // window.confirm, inline confirmation instead" house rule without
  // needing a separate modal for something this size.
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  function handleRemoveTap(e) {
    e.stopPropagation();
    if (confirmingRemove) { onRemove(player.id); setConfirmingRemove(false); return; }
    setConfirmingRemove(true);
    setTimeout(() => setConfirmingRemove(false), 2500);
  }

  return (
    <div style={{ marginBottom:8 }}>
    <div onClick={() => { if (bulkMode) onToggleBulkSel(player.id); else onOpenSnap(activeEvent, player); }} style={{ background:isSel?C.gold+'18':C.card, borderRadius:10, padding:'10px 14px', display:'flex', alignItems:'center', gap:10, cursor:'pointer', border:`1px solid ${legionConflict?C.red+'88':isSel?C.gold:isLead?C.gold+'55':(lc?lc+'44':C.border+'44')}`, WebkitTapHighlightColor:'transparent' }}>
      {bulkMode && <div style={{ width:22, height:22, borderRadius:'50%', border:`2px solid ${isSel?C.gold:C.border}`, background:isSel?C.gold:'none', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{isSel && <span style={{ fontSize:12, color:C.bg, fontWeight:700 }}>✓</span>}</div>}
      <button onClick={e => { e.stopPropagation(); if (!bulkMode) setRankOpen(o => !o); }} title="Tap to change rank"
        style={{ width:44, height:44, flexShrink:0, background:'none', border:'none', padding:0, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
        <PlayerAvatar player={player} size={36} color={isLead?C.gold:C.muted} bordered />
      </button>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6, overflow:'hidden' }}>
          {isLead && <span style={{ fontSize:12, flexShrink:0 }}>👑</span>}
          <div style={{ fontSize:15, fontWeight:700, color:C.white, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{dn}</div>
          {misses > 0 && (
            <span style={{ fontSize:11, fontWeight:700, flexShrink:0, padding:'0 6px', borderRadius:6, background:(misses>=3?C.red:C.gold)+'18', color:misses>=3?C.red:C.gold }}>
              {misses>=3 ? `⚠ ${misses} missed · consider blacklisting` : `⚠ missed ${misses}`}
            </span>
          )}
          {player.furnaceLevel && <span style={{ fontSize:11, color:C.icy, fontWeight:600, flexShrink:0 }}>{player.furnaceLevel}</span>}
          {legionConflict && (
            <button onClick={e => { e.stopPropagation(); onResolveLegionConflict(player, sibling); }}
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
              onChange={e => onSetTroopPower(player.id, e.target.value)}
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
                {snap?.rsvp?.intermittent && <span style={{ fontSize:11, padding:'1px 7px', borderRadius:8, background:C.gold+'18', color:C.gold, fontWeight:600 }}>🔀 Pops in</span>}
                {snap?.rsvp?.unsure && <span style={{ fontSize:11, padding:'1px 7px', borderRadius:8, background:C.muted+'18', color:C.muted, fontWeight:600 }}>? Unsure</span>}
              </>
            ) : (
              <>
                {snap?.attendance?.attended===true && <span style={{ fontSize:11, padding:'1px 7px', borderRadius:8, background:C.green+'18', color:C.green, fontWeight:600 }}>✓</span>}
                {snap?.rsvp?.substitute && snap?.attendance?.attended === null && !snap?.attendance?.noShow && (
                  <span style={{ fontSize:11, padding:'1px 7px', borderRadius:8, background:C.muted+'18', color:C.muted, fontWeight:600 }}>— not required</span>
                )}
                {snap?.attendance?.noShow && <span style={{ fontSize:11, padding:'1px 7px', borderRadius:8, background:C.red+'18', color:C.red, fontWeight:600 }}>✗</span>}
                {snap?.attendance?.noShow && snap?.attendance?.excused && <span style={{ fontSize:11, padding:'1px 7px', borderRadius:8, background:C.mar+'18', color:C.mar, fontWeight:600 }}>📝 Excused</span>}
                {snap?.attendance?.joinedLateNoNotice && <span style={{ fontSize:11, padding:'1px 7px', borderRadius:8, background:C.gold+'18', color:C.gold, fontWeight:600 }}>🕐</span>}
                {snap?.voice?.joined===true && <span style={{ fontSize:11, padding:'1px 7px', borderRadius:8, background:C.icy+'18', color:C.icy, fontWeight:600 }}>🎙️</span>}
              </>
            )}
          </div>
        )}
      </div>
      {!bulkMode && (
        <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
          <button onClick={handleRemoveTap}
            style={{ height:44, minWidth:confirmingRemove?76:44, padding:confirmingRemove?'0 12px':0, borderRadius:10, background:confirmingRemove?C.red:'none', border:`1px solid ${confirmingRemove?C.red:C.red+'33'}`, color:confirmingRemove?C.white:C.red+'88', fontSize:confirmingRemove?12:15, fontWeight:confirmingRemove?700:400, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', whiteSpace:'nowrap', transition:'all 150ms ease' }}>
            {confirmingRemove ? 'Remove?' : '✕'}
          </button>
          <span style={{ fontSize:18, color:C.muted }}>›</span>
        </div>
      )}
    </div>
    {rankOpen && !bulkMode && (
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', padding:'8px 4px 0' }}>
        {[...ALLIANCE_RANKS, null].map(r => {
          const on = (player.allianceRank || null) === r;
          return (
            <button key={r || 'none'} onClick={() => { onSetRank(player.id, r); setRankOpen(false); }}
              style={{ minWidth:52, height:44, borderRadius:10, padding:'0 12px', fontSize:14, fontWeight:700, cursor:'pointer', background:on?C.gold+'22':C.section, border:`1px solid ${on?C.gold:C.border}`, color:on?C.gold:C.icy }}>
              {r || 'None'}
            </button>
          );
        })}
      </div>
    )}
    </div>
  );
}
