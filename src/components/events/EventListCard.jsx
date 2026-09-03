import { C, EVENT_ICONS } from '../../utils/constants.js';
import { fmtDateShort } from '../../utils/dates.js';
import { evSum, legionColor } from '../../services/eventListHelpers.js';

export function EventListCard({ ev, onOpen, onDelete }) {
  const s = evSum(ev);
  const sc = ev.status==='active'?C.green:ev.status==='completed'?C.muted:C.icy;
  const lc = legionColor(ev.legion);
  return (
    <div onClick={() => onOpen(ev.id)} style={{ background:C.card, borderRadius:12, padding:'14px 16px', marginBottom:10, cursor:'pointer', border:`1px solid ${ev.status==='active'?C.green+'44':C.border+'44'}`, borderLeft:lc?`4px solid ${lc}`:undefined, WebkitTapHighlightColor:'transparent' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <div style={{ fontSize:16, fontWeight:700, color:C.white, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{EVENT_ICONS[ev.type]||'📋'} {ev.name||ev.type}</div>
            {ev.legion && <span style={{ fontSize:10, fontWeight:800, color:lc, padding:'1px 7px', borderRadius:8, background:lc+'22', flexShrink:0 }}>L{ev.legion}</span>}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginTop:3 }}>
            <span style={{ fontSize:12, color:C.muted }}>{fmtDateShort(ev.date)}</span>
            {ev.time && <span style={{ fontSize:13, fontWeight:800, color:C.gold, padding:'0 7px', borderRadius:8, background:C.gold+'18' }}>🕐 {ev.time} UTC</span>}
            {ev.allianceTag && <span style={{ fontSize:12, color:C.muted }}>[{ev.allianceTag}]</span>}
          </div>
        </div>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
          <span style={{ fontSize:11, fontWeight:700, color:sc, padding:'2px 8px', borderRadius:10, background:sc+'18' }}>{ev.status==='active'?'🔴 Live':ev.status==='completed'?'✓ Done':'Upcoming'}</span>
          <button onClick={e => { e.stopPropagation(); onDelete(ev.id); }} style={{ fontSize:11, color:C.red+'88', background:'none', border:'none', cursor:'pointer' }}>Delete</button>
        </div>
      </div>
      {s.total>0 && (
        ev.status==='upcoming'
          ? <div style={{ fontSize:12, color:C.green }}>✓ {s.participating} participating</div>
          : <div style={{ display:'flex', gap:10 }}><span style={{ fontSize:12, color:C.green }}>✓ {s.attended}</span><span style={{ fontSize:12, color:C.red }}>✗ {s.noShow}</span><span style={{ fontSize:12, color:C.icy }}>🎙️ {s.voice}</span><span style={{ fontSize:12, color:C.muted }}>{s.total} recorded</span></div>
      )}
    </div>
  );
}
