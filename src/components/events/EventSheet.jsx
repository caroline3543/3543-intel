import { useState, useEffect } from 'react';
import { C, EVENT_TYPES, EVENT_ICONS } from '../../utils/constants.js';
import { vibe } from '../../utils/vibe.js';
import { newEvent } from '../../data/playerSchema.js';
import { Field, Inp, SheetHandle } from '../common/Primitives.jsx';
import { AlliancePicker } from '../common/AlliancePicker.jsx';

// ── Event Sheet ────────────────────────────────────────────────
function EventSheet({ event, open, onClose, onSave, players }) {
  const [ev, setEv] = useState(() => event || newEvent());

  useEffect(() => {
    if (open) setEv(event ? { ...event } : newEvent());
  }, [open, event?.id]);

  useEffect(() => {
    if (!open) return;
    function handler(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  function upd(k, v) { setEv(prev => ({ ...prev, [k]: v })); }
  const allTags = [...new Set(players.map(p => p.allianceTag).filter(Boolean))];
  if (!open) return null;

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'#000c', zIndex:300, display:'flex', alignItems:'flex-end' }}>
      <div onClick={e => e.stopPropagation()} style={{ background:C.card, borderRadius:'20px 20px 0 0', width:'100%', maxHeight:'88vh', overflowY:'auto', padding:'16px 20px 80px' }}>
        <SheetHandle />
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div style={{ fontSize:18, fontWeight:700, color:C.white }}>{event ? 'Edit Event' : 'New Event'}</div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.muted, fontSize:28, cursor:'pointer', lineHeight:1, padding:'0 4px' }}>✕</button>
        </div>
        <Field label="Event Type">
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            {EVENT_TYPES.map(t => (
              <button key={t} onClick={() => upd('type', t)} style={{ padding:'12px 14px', borderRadius:12, border:`1px solid ${ev.type===t?C.gold:C.border}`, background:ev.type===t?C.gold+'18':C.section, color:ev.type===t?C.gold:C.muted, fontWeight:600, fontSize:14, cursor:'pointer', textAlign:'left' }}>
                {EVENT_ICONS[t]||'📋'} {t}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Alliance">
          <AlliancePicker
            value={ev.allianceTag}
            onChange={v => upd('allianceTag', v)}
            existingTags={allTags}
          />
        </Field>
        <Field label="Event Name"><Inp value={ev.name} onChange={v => upd('name', v)} placeholder="e.g. SvS Week 3 — May 2026"/></Field>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
          <Field label="Date"><Inp type="date" value={ev.date} onChange={v => upd('date', v)}/></Field>
          <Field label="Time"><Inp type="time" value={ev.time||'12:00'} onChange={v => upd('time', v)}/></Field>
        </div>
        <Field label="Who's in this event?" hint="Tap to select who's participating">
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {players.map(p => {
              const sel = (ev.participantIds||[]).includes(p.id);
              return (
                <button key={p.id} onClick={() => { const cur=ev.participantIds||[]; upd('participantIds', sel?cur.filter(id=>id!==p.id):[...cur,p.id]); }} style={{ padding:'6px 12px', borderRadius:16, minHeight:36, border:`1px solid ${sel?C.gold:C.border}`, background:sel?C.gold+'22':C.section, color:sel?C.gold:C.muted, fontWeight:600, fontSize:13, cursor:'pointer' }}>
                  {p.username||p.alias||'?'}
                </button>
              );
            })}
          </div>
          {(ev.participantIds||[]).length > 0 && <div style={{ fontSize:12, color:C.muted, marginTop:6 }}>{ev.participantIds.length} selected</div>}
        </Field>
        <Field label="Notes">
          <textarea value={ev.notes||''} onChange={e => upd('notes', e.target.value)} placeholder="Pre-event notes…" style={{ width:'100%', minHeight:72, background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'12px 14px', fontSize:16, color:C.white, resize:'none', boxSizing:'border-box', fontFamily:'inherit' }}/>
        </Field>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={onClose} style={{ flex:1, height:54, borderRadius:12, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontWeight:600, fontSize:16, cursor:'pointer' }}>Cancel</button>
          <button onClick={() => { onSave(ev); onClose(); vibe(8); }} style={{ flex:2, height:54, borderRadius:12, background:C.gold, color:C.bg, fontWeight:700, fontSize:17, border:'none', cursor:'pointer' }}>Save Event</button>
        </div>
      </div>
    </div>
  );
}

