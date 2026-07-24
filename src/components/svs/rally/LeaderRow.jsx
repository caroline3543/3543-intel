import { C } from '../../../utils/constants.js';
import {
  RALLY_TYPES, RALLY_COLORS, RALLY_DURATIONS, OFFSETS, DEFAULT_MSG,
  computeLeaderTimes, fmtSend, fmtMarch,
} from './rallyRoomHelpers.js';
import { MarchInput } from './SmartInputs.jsx';

// ── LeaderRow ──────────────────────────────────────────────────
// One row in the Calculator's shared leader table — collapsed summary +
// the expanded edit panel. Shared by BOTH timing modes; the row itself
// never knows or cares which mode is active beyond reading `calc`.
//
// Props:
//   leader, index, isLast          – row data + position
//   isEditing, onToggleEdit        – expand/collapse state (owned by Calculator)
//   calc                           – full calculator state (mode-aware preview)
//   copied                         – true if this row's message was just copied
//   onCopy, onDeleteRequest        – (leader) => void
//   onUpdate                       – (patch) => void, patches this leader only
export function LeaderRow({
  leader, index, isLast, isEditing, onToggleEdit,
  calc, copied, onCopy, onDeleteRequest, onUpdate,
}) {
  const { openRallyAtUtc, impactAtUtc } = computeLeaderTimes(leader, calc);
  const lcolor  = RALLY_COLORS[leader.type] || C.gold;

  const effectiveDuration = leader.rallyDuration || calc.rallyDuration || 3;
  const isDurationOverride = leader.rallyDuration != null && leader.rallyDuration !== (calc.rallyDuration || 3);

  const gridCols = '1fr 56px 84px 96px';

  const offsetHelp = calc.timingMode === 'countdown'
    ? 'Adjusts when this leader opens relative to the first rally (+ later, − earlier).'
    : 'Adjusts when this leader opens — and impacts — relative to the shared target time.';

  return (
    <div style={{ borderBottom:isLast?'none':`1px solid ${C.border}22` }}>
      <div onClick={onToggleEdit}
        style={{ display:'grid', gridTemplateColumns:gridCols, padding:'10px 14px', cursor:'pointer', background:isEditing?C.card:'none', alignItems:'center' }}>
        <div style={{ minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:6 }}>
            <div style={{ display:'flex', alignItems:'center', gap:5, minWidth:0 }}>
              <div style={{ width:7, height:7, borderRadius:'50%', background:lcolor, flexShrink:0 }}/>
              <div style={{ fontSize:14, fontWeight:700, color:C.white, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{leader.name || '—'}</div>
            </div>
            <span style={{ fontSize:11, color:C.muted, flexShrink:0 }}>{isEditing ? '▾' : '▸'}</span>
          </div>
          <div style={{ fontSize:10, color:C.muted, marginTop:1, display:'flex', alignItems:'center', gap:4 }}>
            <span>{leader.type} ·</span>
            {isDurationOverride ? (
              <span style={{ color:C.gold, fontWeight:700, display:'flex', alignItems:'center', gap:3 }}>
                <span style={{ fontSize:6 }}>●</span>{effectiveDuration}min
              </span>
            ) : (
              <span>{effectiveDuration}min</span>
            )}
          </div>
        </div>
        <div style={{ fontSize:13, fontWeight:600, color:C.icy, fontVariantNumeric:'tabular-nums' }}>{leader.marchSecs ? fmtMarch(leader.marchSecs) : '—'}</div>
        <div>
          {openRallyAtUtc != null && <div style={{ fontSize:11, color:C.gold, fontVariantNumeric:'tabular-nums' }}>Open {fmtSend(openRallyAtUtc)}</div>}
          {impactAtUtc != null && (
            <div style={{ fontSize:12, fontWeight:700, color:C.green, fontVariantNumeric:'tabular-nums' }}>
              {fmtSend(impactAtUtc)}{leader.offset ? <span style={{ fontSize:10, color:C.muted, fontWeight:600 }}> ({leader.offset > 0 ? `+${leader.offset}` : leader.offset})</span> : null}
            </div>
          )}
          {impactAtUtc == null && <div style={{ fontSize:12, color:C.muted }}>—</div>}
        </div>
        <div style={{ display:'flex', gap:6, justifyContent:'flex-end' }}>
          <button onClick={e => { e.stopPropagation(); onCopy(); }}
            style={{ width:44, height:44, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', background:copied?C.green+'22':C.card, border:`1px solid ${copied?C.green:C.border}`, color:copied?C.green:C.muted, fontSize:16, cursor:'pointer' }}>
            {copied ? '✓' : '📋'}
          </button>
          <button onClick={e => { e.stopPropagation(); onDeleteRequest(); }}
            style={{ width:44, height:44, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', background:C.red+'18', border:`1px solid ${C.red}44`, color:C.red, fontSize:16, cursor:'pointer' }}>
            ✕
          </button>
        </div>
      </div>

      {/* Expanded row */}
      {isEditing && (
        <div style={{ padding:'8px 14px 12px', background:C.card, borderTop:`1px solid ${C.border}22` }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
            <div>
              <label style={{ fontSize:10, color:C.muted, display:'block', marginBottom:4 }}>March time</label>
              <MarchInput value={leader.marchSecs} onChange={v => onUpdate({ marchSecs:v })}/>
            </div>
            <div>
              <label style={{ fontSize:10, color:C.muted, display:'block', marginBottom:4 }}>Open offset</label>
              <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                {OFFSETS.map(o => (
                  <button key={o} onClick={() => onUpdate({ offset:o })}
                    style={{ minWidth:44, height:44, padding:'0 6px', borderRadius:8, border:`1px solid ${leader.offset===o?C.gold:C.border}`, background:leader.offset===o?C.gold+'22':C.section, color:leader.offset===o?C.gold:C.muted, fontWeight:600, fontSize:12, cursor:'pointer' }}>
                    {o > 0 ? `+${o}` : o}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div style={{ fontSize:10, color:C.muted, marginBottom:10, lineHeight:1.4 }}>{offsetHelp}</div>
          <div style={{ marginBottom:8 }}>
            <label style={{ fontSize:10, color:C.muted, display:'block', marginBottom:4 }}>
              Rally duration (override){isDurationOverride && <span style={{ color:C.gold, fontWeight:700 }}> · active</span>}
            </label>
            <div style={{ display:'flex', gap:6 }}>
              {RALLY_DURATIONS.map(d => (
                <button key={d} onClick={() => onUpdate({ rallyDuration:d })}
                  style={{ flex:1, height:44, borderRadius:8, border:`1px solid ${effectiveDuration===d?C.gold:C.border}`, background:effectiveDuration===d?C.gold+'22':C.section, color:effectiveDuration===d?C.gold:C.muted, fontWeight:700, fontSize:13, cursor:'pointer' }}>
                  {d}min
                </button>
              ))}
            </div>
          </div>
          <div style={{ display:'flex', gap:6, marginBottom:8, overflowX:'auto', paddingBottom:2 }}>
            {RALLY_TYPES.slice(0, 5).map(type => {
              const sel = leader.type === type;
              const c   = RALLY_COLORS[type];
              return (
                <button key={type} onClick={() => onUpdate({ type })}
                  style={{ padding:'0 10px', height:44, borderRadius:12, whiteSpace:'nowrap', border:`1px solid ${sel?c:C.border}`, background:sel?c+'22':C.section, color:sel?c:C.muted, fontWeight:600, fontSize:11, cursor:'pointer', flexShrink:0 }}>
                  {type}
                </button>
              );
            })}
          </div>
          <input value={leader.notes || ''} onChange={e => onUpdate({ notes:e.target.value })} placeholder="Notes…"
            style={{ width:'100%', minHeight:44, background:C.section, border:`1px solid ${C.border}`, borderRadius:7, padding:'7px 10px', fontSize:12, color:C.icy, boxSizing:'border-box', fontFamily:'inherit' }}/>
          <div style={{ marginTop:8 }}>
            <button onClick={() => onUpdate({ useCustomMsg:!leader.useCustomMsg })}
              style={{ minHeight:44, display:'flex', alignItems:'center', background:'none', border:'none', color:C.gold, fontSize:12, cursor:'pointer', padding:'2px 0' }}>
              {leader.useCustomMsg ? '▾' : '▸'}&nbsp;Custom message for this leader
            </button>
            {leader.useCustomMsg && (
              <div style={{ marginTop:6 }}>
                <div style={{ fontSize:10, color:C.muted, marginBottom:4 }}>Variables: {'{type}'} {'{name}'} {'{impact}'} {'{open}'} {'{joiners}'} {'{ratio}'}</div>
                <textarea value={leader.customMsg || calc.messageTemplate || DEFAULT_MSG} onChange={e => onUpdate({ customMsg:e.target.value })}
                  style={{ width:'100%', minHeight:100, background:C.card, border:`1px solid ${C.border}`, borderRadius:7, padding:'8px 10px', fontSize:12, color:C.white, resize:'vertical', boxSizing:'border-box', fontFamily:'monospace' }}/>
                <button onClick={() => onUpdate({ customMsg:calc.messageTemplate || DEFAULT_MSG })}
                  style={{ minHeight:44, display:'flex', alignItems:'center', fontSize:11, color:C.muted, background:'none', border:'none', cursor:'pointer', padding:'2px 0' }}>
                  Reset to alliance default
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
