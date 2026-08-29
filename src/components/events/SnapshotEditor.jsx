import { useState, useEffect } from 'react';
import { C } from '../../utils/constants.js';
import { vibe } from '../../utils/vibe.js';
import { ToggleRow, SheetHandle } from '../common/Primitives.jsx';

// ── SnapshotEditor ─────────────────────────────────────────────
// Per-player event record. Shows ONE of two mutually-exclusive
// sections depending on the event's status — never both:
//   upcoming            -> RSVP (a prediction, never used for reliabilityScore)
//   active / completed  -> post-event actuals (the ONLY data
//                          reliabilityScore is computed from — see metrics.js)
// No Combat section — removed entirely, not just the judgment fields.
//
// Props:
//   snapshot     – the snapshot object being edited
//   playerName   – display name
//   eventStatus  – 'upcoming' | 'active' | 'completed'
//   open, onClose, onSave
export function SnapshotEditor({ snapshot, playerName, eventStatus, open, onClose, onSave }) {
  const [s, setS] = useState(() => snapshot || {});
  const isUpcoming = eventStatus === 'upcoming';

  useEffect(() => {
    if (open && snapshot) setS({ ...snapshot });
  }, [open, snapshot?.snapshotId]);

  useEffect(() => {
    if (!open) return;
    function handler(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  function updR(p) { setS(prev => ({ ...prev, rsvp: { ...prev.rsvp, ...p } })); }
  function updA(p) { setS(prev => ({ ...prev, attendance: { ...prev.attendance, ...p } })); }
  function updV(p) { setS(prev => ({ ...prev, voice: { ...prev.voice, ...p } })); }

  if (!open || !snapshot) return null;

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'#000c', zIndex:400, display:'flex', alignItems:'flex-end' }}>
      <div onClick={e => e.stopPropagation()} style={{ background:C.card, borderRadius:'20px 20px 0 0', width:'100%', maxHeight:'92vh', overflowY:'auto', padding:'16px 20px 100px' }}>
        <SheetHandle />
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div>
            <div style={{ fontSize:18, fontWeight:700, color:C.white }}>{playerName}</div>
            <div style={{ fontSize:13, color:C.muted }}>{isUpcoming ? 'RSVP' : 'Event record'}</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.muted, fontSize:28, cursor:'pointer', lineHeight:1, padding:'0 4px' }}>✕</button>
        </div>

        {isUpcoming ? (
          <div style={{ background:C.section, borderRadius:12, padding:16, marginBottom:16 }}>
            <div style={{ fontSize:14, fontWeight:700, color:C.white, marginBottom:12 }}>📋 RSVP</div>
            <ToggleRow label="Participating"          value={s.rsvp?.participating}    onChange={v=>updR({participating:v})}    colorOn={C.green} colorOff={C.muted}/>
            <ToggleRow label="On time"                value={s.rsvp?.onTime}           onChange={v=>updR({onTime:v})}/>
            <ToggleRow label="Will be late"            value={s.rsvp?.willBeLate}       onChange={v=>updR({willBeLate:v})}       colorOn={C.gold} colorOff={C.muted}/>
            <ToggleRow label="Will leave early"        value={s.rsvp?.willLeaveEarly}   onChange={v=>updR({willLeaveEarly:v})}   colorOn={C.mar}  colorOff={C.muted}/>
            <ToggleRow label="Will join Discord"       value={s.rsvp?.willJoinDiscord}  onChange={v=>updR({willJoinDiscord:v})}  colorOn={C.icy}  colorOff={C.muted}/>
            <ToggleRow label="Present the whole time"  value={s.rsvp?.presentWholeTime} onChange={v=>updR({presentWholeTime:v})}/>
          </div>
        ) : (
          <>
            <div style={{ background:C.section, borderRadius:12, padding:16, marginBottom:16 }}>
              <div style={{ fontSize:14, fontWeight:700, color:C.white, marginBottom:12 }}>📅 Attendance</div>
              <ToggleRow label="Attended"                    value={s.attendance?.attended}           onChange={v=>updA({attended:v})}           tristate={true}/>
              <ToggleRow label="No-show"                     value={s.attendance?.noShow}             onChange={v=>updA({noShow:v})}             colorOn={C.red}  colorOff={C.muted}/>
              <ToggleRow label="Joined late without notice"  value={s.attendance?.joinedLateNoNotice} onChange={v=>updA({joinedLateNoNotice:v})} colorOn={C.gold} colorOff={C.muted}/>
            </div>
            <div style={{ background:C.section, borderRadius:12, padding:16, marginBottom:16 }}>
              <div style={{ fontSize:14, fontWeight:700, color:C.white, marginBottom:12 }}>🎙️ Voice</div>
              <ToggleRow label="Joined voice" value={s.voice?.joined} onChange={v=>updV({joined:v})} colorOn={C.icy} colorOff={C.muted}/>
            </div>
          </>
        )}

        <div style={{ marginBottom:20 }}>
          <label style={{ fontSize:12, color:C.muted, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:8 }}>Officer Notes</label>
          <textarea value={s.notes||''} onChange={e => setS(prev => ({ ...prev, notes:e.target.value }))} placeholder="Notes…" style={{ width:'100%', minHeight:80, background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'12px 14px', fontSize:16, color:C.white, resize:'none', boxSizing:'border-box', fontFamily:'inherit' }}/>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={onClose} style={{ flex:1, height:54, borderRadius:12, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontWeight:600, fontSize:16, cursor:'pointer' }}>Cancel</button>
          <button onClick={() => { onSave(s); onClose(); vibe(8); }} style={{ flex:2, height:54, borderRadius:12, background:C.gold, color:C.bg, fontWeight:700, fontSize:17, border:'none', cursor:'pointer' }}>Save Record</button>
        </div>
      </div>
    </div>
  );
}
