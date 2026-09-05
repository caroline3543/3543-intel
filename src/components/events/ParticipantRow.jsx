import { useState } from 'react';
import { C } from '../../utils/constants.js';
import { initials, noShowStreak, noShowBadge } from '../../services/eventListHelpers.js';

// Props:
//   player, activeEvent, events, snap
//   bulkMode, isSel, onToggleBulkSel, onOpenSnap
//   sibling                 – the sibling Legion event, if any (see findSiblingLegionEvent)
//   onResolveLegionConflict – (player, sibling) => void
//   lc                      – this event's Legion color (see legionColor)
//   tracksTroopPower, showsRsvp, isUpcoming
//   onSetTroopPower, onToggleSubstitute, onRemove
export function ParticipantRow({
  player, activeEvent, events, snap,
  bulkMode, isSel, onToggleBulkSel, onOpenSnap,
  sibling, onResolveLegionConflict,
  lc, tracksTroopPower, showsRsvp, isUpcoming,
  onSetTroopPower, onToggleSubstitute, onRemove,
}) {
  const dn = player.username||player.alias||'Unknown';
  const isLead = player.roles?.includes('Rally Lead');
  const legionConflict = !!sibling && (sibling.participantIds||[]).includes(player.id);
  const streak = noShowStreak(player.id, activeEvent.type, activeEvent.id, events);
  const heart = noShowBadge(streak);
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
    <div onClick={() => { if (bulkMode) onToggleBulkSel(player.id); else onOpenSnap(activeEvent, player); }} style={{ background:isSel?C.gold+'18':C.card, borderRadius:10, padding:'10px 14px', marginBottom:8, display:'flex', alignItems:'center', gap:10, cursor:'pointer', border:`1px solid ${legionConflict?C.red+'88':isSel?C.gold:isLead?C.gold+'55':(lc?lc+'44':C.border+'44')}`, WebkitTapHighlightColor:'transparent' }}>
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
          <button onClick={e => { e.stopPropagation(); onToggleSubstitute(player.id); }} title="Move to the other section"
            style={{ width:44, height:44, borderRadius:10, background:'none', border:`1px solid ${C.border}`, color:C.muted, fontSize:15, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>⇄</button>
          <button onClick={handleRemoveTap}
            style={{ height:44, minWidth:confirmingRemove?76:44, padding:confirmingRemove?'0 12px':0, borderRadius:10, background:confirmingRemove?C.red:'none', border:`1px solid ${confirmingRemove?C.red:C.red+'33'}`, color:confirmingRemove?C.white:C.red+'88', fontSize:confirmingRemove?12:15, fontWeight:confirmingRemove?700:400, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', whiteSpace:'nowrap', transition:'all 150ms ease' }}>
            {confirmingRemove ? 'Remove?' : '✕'}
          </button>
          <span style={{ fontSize:18, color:C.muted }}>›</span>
        </div>
      )}
    </div>
  );
}
