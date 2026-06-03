import { C, TIER_OPTIONS } from '../../utils/constants.js';

export function Field({ label, children, hint }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display:'block', fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>
        {label}
      </label>
      {children}
      {hint && <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>{hint}</div>}
    </div>
  );
}

export function Inp({ value, onChange, placeholder, type='text', inputMode, style={} }) {
  return (
    <input
      type={type}
      inputMode={inputMode}
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{ width:'100%', background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'12px 14px', fontSize:16, color:C.white, boxSizing:'border-box', fontFamily:'inherit', ...style }}
    />
  );
}

export function Sel({ value, onChange, options, placeholder }) {
  return (
    <select
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      style={{ width:'100%', background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'12px 14px', fontSize:16, color: value ? C.white : C.muted, boxSizing:'border-box', fontFamily:'inherit' }}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

export function TierPill({ value, onChange, color }) {
  return (
    <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:4 }}>
      {TIER_OPTIONS.map(t => (
        <button
          key={t}
          onClick={() => onChange(value === t ? null : t)}
          style={{ padding:'6px 12px', borderRadius:16, border:`1px solid ${value===t?color:C.border}`, background:value===t?color+'22':C.section, color:value===t?color:C.muted, fontWeight:600, fontSize:13, cursor:'pointer', whiteSpace:'nowrap', minHeight:36, flexShrink:0 }}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

export function ToggleRow({ label, value, onChange, colorOn=C.green, colorOff=C.red, tristate=false }) {
  function cycle() {
    if (!tristate) { onChange(!value); return; }
    if (value === null) onChange(true);
    else if (value === true) onChange(false);
    else onChange(null);
  }
  const d = tristate
    ? (value === null ? { label:'—', color:C.muted } : value ? { label:'✓ Yes', color:colorOn } : { label:'✗ No', color:colorOff })
    : (value ? { label:'✓ Yes', color:colorOn } : { label:'✗ No', color:colorOff });
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:`1px solid ${C.border}22` }}>
      <div style={{ fontSize:15, color:C.icy }}>{label}</div>
      <button onClick={cycle} style={{ minWidth:72, height:34, borderRadius:20, border:`1px solid ${d.color}44`, background:d.color+'18', color:d.color, fontWeight:700, fontSize:13, cursor:'pointer' }}>
        {d.label}
      </button>
    </div>
  );
}

export function Toast({ msg, type='success' }) {
  if (!msg) return null;
  const color = type==='error' ? C.red : type==='warning' ? C.gold : C.green;
  return (
    <div style={{ position:'fixed', top:20, left:'50%', transform:'translateX(-50%)', background:C.card+'ee', backdropFilter:'blur(12px)', border:`1px solid ${color}44`, borderRadius:20, padding:'10px 20px', fontSize:15, fontWeight:600, color, zIndex:500, whiteSpace:'nowrap', maxWidth:'90vw', pointerEvents:'none' }}>
      {msg}
    </div>
  );
}

export function AvailChip({ label, selected, color, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{ padding:'8px 14px', borderRadius:20, minHeight:44, border:`1px solid ${selected?color:C.border}`, background:selected?color+'18':C.section, color:selected?color:C.icy, fontWeight:600, fontSize:14, cursor:'pointer', transition:'all 150ms ease' }}
    >
      {label}
    </button>
  );
}

export function ReliabilityBadge({ score }) {
  if (score == null) return null;
  const c = score >= 80 ? C.green : score >= 50 ? C.gold : C.red;
  return (
    <div style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'3px 10px', borderRadius:20, background:c+'18', border:`1px solid ${c}44` }}>
      <span style={{ fontSize:13, fontWeight:700, color:c }}>{score}</span>
      <span style={{ fontSize:11, color:C.muted }}>reliability</span>
    </div>
  );
}

export function Warning({ text }) {
  return (
    <div style={{ background:C.red+'18', border:`1px solid ${C.red}44`, borderRadius:10, padding:'10px 14px', fontSize:13, color:C.red, marginBottom:8 }}>
      ⚠️ {text}
    </div>
  );
}

export function SectionHeader({ children }) {
  return (
    <div style={{ fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>
      {children}
    </div>
  );
}

export function SheetHandle() {
  return <div style={{ width:40, height:4, background:C.border, borderRadius:2, margin:'0 auto 16px' }} />;
}
