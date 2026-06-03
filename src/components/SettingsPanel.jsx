import { useState } from 'react';
import { C } from '../utils/constants.js';
import { Field, Inp, SheetHandle } from './common/Primitives.jsx';

export function SettingsPanel({ settings, onSave, onClose }) {
  const [s, setS] = useState(settings || {});
  function upd(k, v) { setS(prev => ({ ...prev, [k]: v })); }

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'#000c', zIndex:300, display:'flex', alignItems:'flex-end' }}>
      <div onClick={e => e.stopPropagation()} style={{ background:C.card, borderRadius:'20px 20px 0 0', width:'100%', padding:'16px 20px 60px', maxHeight:'80vh', overflowY:'auto' }}>
        <SheetHandle />
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div style={{ fontSize:18, fontWeight:700, color:C.white }}>⚙️ Alliance Settings</div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.muted, fontSize:22, cursor:'pointer', lineHeight:1 }}>✕</button>
        </div>
        <Field label="Alliance Name">
          <Inp value={s.allianceName} onChange={v => upd('allianceName', v)} placeholder="Alliance name" />
        </Field>
        <Field label="Alliance Tag">
          <Inp value={s.allianceTag} onChange={v => upd('allianceTag', v)} placeholder="R3K" />
        </Field>
        <Field label="State ID">
          <Inp value={s.stateId} onChange={v => upd('stateId', v)} placeholder="3543" inputMode="numeric" />
        </Field>
        <button onClick={() => onSave(s)} style={{ width:'100%', height:54, borderRadius:12, background:C.gold, color:C.bg, fontWeight:700, fontSize:17, border:'none', cursor:'pointer' }}>
          Save Settings
        </button>
      </div>
    </div>
  );
}
