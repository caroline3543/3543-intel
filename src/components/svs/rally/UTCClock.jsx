import { useState, useEffect } from 'react';
import { C } from '../../../utils/constants.js';
import { utcNowStr, secsToHHMMSS } from './rallyRoomHelpers.js';

// ── UTCClock ───────────────────────────────────────────────────
// Displays current UTC time and time until midnight reset.
// No props required.
export function UTCClock() {
  const [time, setTime] = useState(utcNowStr());
  useEffect(() => { const id = setInterval(() => setTime(utcNowStr()), 1000); return () => clearInterval(id); }, []);

  const n    = new Date();
  const left = 86400 - (n.getUTCHours()*3600 + n.getUTCMinutes()*60 + n.getUTCSeconds());

  return (
    <div style={{ background:C.section, borderRadius:10, padding:'10px 16px', marginBottom:16, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
      <div>
        <div style={{ fontSize:11, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:2 }}>UTC Time</div>
        <div style={{ fontSize:22, fontWeight:700, color:C.gold, fontVariantNumeric:'tabular-nums' }}>{time}</div>
      </div>
      <div style={{ textAlign:'right' }}>
        <div style={{ fontSize:11, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:2 }}>Reset in</div>
        <div style={{ fontSize:14, fontWeight:600, color:C.icy }}>{secsToHHMMSS(left)}</div>
      </div>
    </div>
  );
}
