import { useState, useEffect } from 'react';
import { C, EVENT_TYPES, EVENT_ICONS, TROOP_POWER_EVENTS } from '../../utils/constants.js';
import { vibe } from '../../utils/vibe.js';
import { newEvent } from '../../data/playerSchema.js';
import { Field, Inp, SheetHandle } from '../common/Primitives.jsx';
import { AlliancePicker } from '../common/AlliancePicker.jsx';

// Builds "Type — Mon D, YYYY" from the event's current type + date, so
// the Name field starts pre-filled with something sensible instead of
// blank. Only used while the officer hasn't typed a name of their own
// (see nameTouched) — never overwrites a name someone actually chose.
function suggestName(ev) {
  const d = ev.date ? new Date(ev.date + 'T00:00:00') : null;
  const dateStr = d && !isNaN(d) ? d.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) : '';
  return [ev.type, dateStr].filter(Boolean).join(' — ');
}

// ── Event Sheet ────────────────────────────────────────────────
// Creation no longer asks "who's participating" here — that step
// moved entirely to EventsTab.jsx's type-and-enter add flow, opened
// once the event actually exists. This sheet is just the event shell:
// type, alliance, name (auto-suggested), date/time, notes.
export function EventSheet({ event, open, onClose, onSave, players }) {
  const [ev, setEv] = useState(() => event || newEvent());
  const [nameTouched, setNameTouched] = useState(false);

  useEffect(() => {
    if (open) {
      setEv(event ? { ...event } : newEvent());
      setNameTouched(!!event); // editing an existing event — don't auto-overwrite its real name
    }
  }, [open, event?.id]);

  useEffect(() => {
    if (!open) return;
    function handler(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Re-suggest the name whenever type/date change, but only until the
  // officer types something themselves.
  useEffect(() => {
    if (!nameTouched) setEv(prev => ({ ...prev, name: suggestName(prev) }));
  }, [ev.type, ev.date, nameTouched]);

  // Legion only makes sense for Foundry/Canyon Clash — clear it if the
  // officer switches to a type that doesn't use it, so a stale value
  // can't linger unseen on an event where it means nothing.
  useEffect(() => {
    if (!TROOP_POWER_EVENTS.includes(ev.type) && ev.legion) {
      setEv(prev => ({ ...prev, legion: null }));
    }
  }, [ev.type]);

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
        {TROOP_POWER_EVENTS.includes(ev.type) && (
          <Field label="Legion" hint="Foundry and Canyon Clash run as two separate events on the same date — set this now so they never get mixed up later.">
            <div style={{ display:'flex', gap:8 }}>
              {[1, 2].map(l => (
                <button key={l} onClick={() => upd('legion', ev.legion === l ? null : l)}
                  style={{ flex:1, height:48, borderRadius:12, border:`2px solid ${ev.legion===l?C.icy:C.border}`, background:ev.legion===l?C.icy+'22':C.section, color:ev.legion===l?C.icy:C.muted, fontWeight:800, fontSize:15, cursor:'pointer' }}>
                  Legion {l}
                </button>
              ))}
            </div>
          </Field>
        )}
        <Field label="Alliance">
          <AlliancePicker
            value={ev.allianceTag}
            onChange={v => upd('allianceTag', v)}
            existingTags={allTags}
          />
        </Field>
        <Field label="Event Name" hint="Auto-suggested from type + date — edit if you want something different">
          <Inp value={ev.name} onChange={v => { upd('name', v); setNameTouched(true); }} placeholder="e.g. SvS Week 3 — May 2026"/>
        </Field>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
          <Field label="Date"><Inp type="date" value={ev.date} onChange={v => upd('date', v)}/></Field>
          <Field label="Time"><Inp type="time" value={ev.time||'12:00'} onChange={v => upd('time', v)}/></Field>
        </div>
        <Field label="Notes">
          <textarea value={ev.notes||''} onChange={e => upd('notes', e.target.value)} placeholder="Pre-event notes…" style={{ width:'100%', minHeight:72, background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'12px 14px', fontSize:16, color:C.white, resize:'none', boxSizing:'border-box', fontFamily:'inherit' }}/>
        </Field>
        <div style={{ fontSize:12, color:C.muted, marginBottom:16 }}>Add participants and substitutes after creating the event.</div>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={onClose} style={{ flex:1, height:54, borderRadius:12, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontWeight:600, fontSize:16, cursor:'pointer' }}>Cancel</button>
          <button onClick={() => { onSave(ev); onClose(); vibe(8); }} style={{ flex:2, height:54, borderRadius:12, background:C.gold, color:C.bg, fontWeight:700, fontSize:17, border:'none', cursor:'pointer' }}>Save Event</button>
        </div>
      </div>
    </div>
  );
}

