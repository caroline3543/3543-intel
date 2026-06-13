import { useState, useEffect } from 'react';
import { C } from '../../../utils/constants.js';
import {
  validateMarchInput, fmtMarch,
  validateImpactInput, utcNowSecs,
} from './rallyRoomHelpers.js';

// ── MarchInput ─────────────────────────────────────────────────
// Smart march-time input. Last 2 digits = seconds, rest = minutes.
// Props:
//   value       – current marchSecs (number | null)
//   onChange    – (marchSecs: number | null) => void
//   placeholder – string
export function MarchInput({ value, onChange, placeholder = 'e.g. 118 = 1m 18s  or  1:18' }) {
  const [raw,  setRaw]  = useState('');
  const [prev, setPrev] = useState(null);
  const [err,  setErr]  = useState(null);

  useEffect(() => { if (value != null && raw === '') setRaw(fmtMarch(value)); }, [value]);

  function handle(input) {
    setRaw(input);
    if (!input) { setPrev(null); setErr(null); onChange(null); return; }
    const v = validateMarchInput(input);
    if (v.error)      { setErr(v.error); setPrev(null); onChange(null); }
    else if (v.valid) { setErr(null); setPrev(fmtMarch(v.totalSecs)); onChange(v.totalSecs); }
    else              { setErr(null); setPrev(null); onChange(null); }
  }

  return (
    <div>
      <input value={raw} onChange={e => handle(e.target.value)} placeholder={placeholder} inputMode="decimal"
        style={{ width:'100%', background:C.section, border:`1px solid ${err?C.red:prev?C.green:C.border}`, borderRadius:8, padding:'10px 12px', fontSize:15, color:C.white, boxSizing:'border-box', fontFamily:'inherit' }}/>
      {prev && <div style={{ fontSize:11, color:C.green, marginTop:3 }}>{prev}</div>}
      {err  && <div style={{ fontSize:11, color:C.red,   marginTop:3 }}>⚠ {err}</div>}
    </div>
  );
}

// ── ImpactInput ────────────────────────────────────────────────
// Smart UTC impact-time input.
// Props:
//   value    – raw string (e.g. '22:00')
//   onChange – (displayStr: string | null, totalSecs: number | null) => void
//   large    – boolean — bigger font for Calculator primary field
export function ImpactInput({ value, onChange, large = false }) {
  const [raw,  setRaw]  = useState(value || '');
  const [disp, setDisp] = useState(null);
  const [err,  setErr]  = useState(null);
  const [past, setPast] = useState(false);

  function handle(input) {
    setRaw(input);
    if (!input) { setDisp(null); setErr(null); setPast(false); onChange(null, null); return; }
    const v = validateImpactInput(input);
    if (v.error)      { setErr(v.error); setDisp(null); setPast(false); onChange(null, null); }
    else if (v.valid) { setErr(null); setDisp(v.display); setPast(v.totalSecs < utcNowSecs()); onChange(v.display, v.totalSecs); }
  }

  return (
    <div>
      <input value={raw} onChange={e => handle(e.target.value)} placeholder="HH:mm  e.g. 2200" inputMode="decimal"
        style={{ width:'100%', background:C.section, border:`1px solid ${err?C.red:disp?C.green:C.border}`, borderRadius:10, padding:large?'14px':'10px 12px', fontSize:large?22:16, color:C.white, boxSizing:'border-box', fontFamily:'monospace', letterSpacing:'0.04em' }}/>
      {disp && !err && (
        <div style={{ fontSize:12, color:past?C.red:C.green, marginTop:4 }}>
          {past ? `⚠ ${disp} UTC — already passed today` : `→ ${disp} UTC`}
        </div>
      )}
      {err && <div style={{ fontSize:12, color:C.red, marginTop:4 }}>⚠ {err}</div>}
    </div>
  );
}
