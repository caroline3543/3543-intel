import { useState, useEffect } from 'react';
import { C } from '../../../utils/constants.js';
import {
  RALLY_COLORS, nowEpochSecs, secsToHHMMSS, fmtSend,
  getTimerStage,
} from './rallyRoomHelpers.js';

// ── TimerCard ──────────────────────────────────────────────────
// Single live countdown card shown in the Live Timers tab.
//
// Unified timer schema: every timer (regardless of which timing mode
// created it) carries pre-computed openRallyAtUtc / marchesAtUtc /
// impactAtUtc — this card just reads them and diffs against "now". No
// per-mode branching, no re-deriving from impactTime/marchSecs at
// render time (that used to happen here; now it happens once, at
// Start Timers, in Calculator.jsx).
//
// Props:
//   timer           – timer object
//   onEdit          – (timer) => void
//   onDelete        – (timerId) => void
//   onLeaderMode    – (timer) => void   (open full-screen)
//   onUpdateJoiner  – (timerId, joinerIdx, patch) => void
export function TimerCard({ timer, onEdit, onDelete, onLeaderMode, onUpdateJoiner }) {
  const [now, setNow] = useState(nowEpochSecs());
  useEffect(() => { const id = setInterval(() => setNow(nowEpochSecs()), 250); return () => clearInterval(id); }, []);

  const { openRallyAtUtc, marchesAtUtc, impactAtUtc } = timer;

  const secsToOpen   = openRallyAtUtc != null ? openRallyAtUtc - now : null;
  const secsToImpact = impactAtUtc    != null ? impactAtUtc    - now : null;
  const stage  = getTimerStage(secsToOpen, secsToImpact);
  const color  = RALLY_COLORS[timer.rallyType] || C.gold;
  const cardBg = stage?.bg ?? C.card;

  const progressTarget = openRallyAtUtc ?? impactAtUtc;
  const secsToTarget   = progressTarget != null ? progressTarget - now : null;
  const WINDOW   = 300;
  const progress = secsToTarget != null ? Math.max(0, Math.min(100, ((WINDOW - Math.max(0, secsToTarget)) / WINDOW) * 100)) : 0;

  const isRallyOpen  = stage?.stage === 'filling' || stage?.stage === 'impact';
  const bigCountdown = isRallyOpen ? secsToImpact : (secsToOpen ?? secsToImpact);
  const bigLabel     = isRallyOpen
    ? (stage?.stage === 'impact' ? '✓ Impact' : 'Impact in')
    : (openRallyAtUtc != null ? 'Open rally in' : 'Countdown');

  return (
    <div style={{ background:cardBg, borderRadius:14, overflow:'hidden', marginBottom:12, border:`1px solid ${stage?stage.color+'66':C.border}`, boxShadow:stage&&stage.stage!=='standby'?`0 0 12px ${stage.color}22`:'none', transition:'background 600ms ease, border-color 600ms ease' }}>
      <div style={{ height:3, background:C.border }}>
        <div style={{ height:'100%', width:`${progress}%`, background:stage?stage.color:color, transition:'width 250ms linear' }}/>
      </div>

      <div style={{ padding:'12px 14px' }}>
        {/* Header row */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:10, height:10, borderRadius:'50%', background:color, flexShrink:0 }}/>
            <div>
              <div style={{ fontSize:15, fontWeight:700, color:C.white }}>{timer.leaderName || timer.rallyType}</div>
              <div style={{ fontSize:11, color:C.muted, marginTop:1 }}>
                {timer.rallyType}{timer.rallyDurationSecs && <span> · {Math.round(timer.rallyDurationSecs/60)}min</span>}{timer.ratio && <span> · {timer.ratio}</span>}
              </div>
            </div>
          </div>
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={() => onLeaderMode(timer)} style={{ height:30, padding:'0 8px', borderRadius:14, background:color+'22', border:`1px solid ${color}44`, color, fontWeight:600, fontSize:11, cursor:'pointer' }}>Full screen</button>
            <button onClick={() => onEdit(timer)} style={{ height:30, padding:'0 8px', borderRadius:14, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontSize:11, cursor:'pointer' }}>Edit</button>
            <button onClick={() => onDelete(timer.id)} style={{ height:30, width:30, borderRadius:14, background:'none', border:'none', color:C.red+'88', fontSize:15, cursor:'pointer' }}>✕</button>
          </div>
        </div>

        {/* Phase badge */}
        {stage && (
          <div style={{ background:stage.color+'22', border:`1px solid ${stage.color}55`, borderRadius:8, padding:'7px 14px', marginBottom:8, textAlign:'center' }}>
            <div style={{ fontSize:stage.stage==='open_now'?18:14, fontWeight:800, color:stage.color, letterSpacing:stage.stage==='open_now'?'0.04em':0 }}>
              {stage.label}
            </div>
          </div>
        )}

        {/* Big countdown */}
        <div style={{ textAlign:'center', marginBottom:10 }}>
          <div style={{ fontSize:10, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4 }}>{bigLabel}</div>
          <div style={{ fontSize:48, fontWeight:900, color:stage?stage.color:C.white, fontVariantNumeric:'tabular-nums', lineHeight:1, letterSpacing:'0.02em' }}>
            {bigCountdown != null ? secsToHHMMSS(bigCountdown) : '--:--:--'}
          </div>
        </div>

        {/* Time grid */}
        <div style={{ display:'grid', gridTemplateColumns:openRallyAtUtc!=null?'1fr 1fr 1fr':'1fr 1fr', gap:6, marginBottom:timer.joiners?.filter(j=>j.playerName).length>0?10:0 }}>
          {openRallyAtUtc != null && (
            <div style={{ background:C.section, borderRadius:8, padding:'7px 10px', textAlign:'center' }}>
              <div style={{ fontSize:9, color:C.muted, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:2 }}>Open rally</div>
              <div style={{ fontSize:13, fontWeight:700, color:isRallyOpen?C.green:C.gold, fontVariantNumeric:'tabular-nums' }}>
                {isRallyOpen ? '✓ Opened' : fmtSend(openRallyAtUtc) + ' UTC'}
              </div>
            </div>
          )}
          <div style={{ background:C.section, borderRadius:8, padding:'7px 10px', textAlign:'center' }}>
            <div style={{ fontSize:9, color:C.muted, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:2 }}>Rally marches</div>
            <div style={{ fontSize:13, fontWeight:700, color:C.icy, fontVariantNumeric:'tabular-nums' }}>{marchesAtUtc != null ? fmtSend(marchesAtUtc) + ' UTC' : '—'}</div>
          </div>
          <div style={{ background:C.section, borderRadius:8, padding:'7px 10px', textAlign:'center' }}>
            <div style={{ fontSize:9, color:C.muted, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:2 }}>Impact</div>
            <div style={{ fontSize:13, fontWeight:700, color:stage?.stage==='impact'?C.green:C.gold, fontVariantNumeric:'tabular-nums' }}>
              {stage?.stage === 'impact' ? '✓ ' : ''}{impactAtUtc != null ? fmtSend(impactAtUtc) + ' UTC' : '--:--'}
            </div>
          </div>
        </div>

        {/* Joiners */}
        {timer.joiners?.filter(j => j.playerName).length > 0 && (
          <div style={{ background:C.section, borderRadius:10, padding:'10px 12px', marginTop:4 }}>
            <div style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>
              Priority joiners{timer.ratio ? ` · ${timer.ratio}` : ''}
            </div>
            {timer.joiners.filter(j => j.playerName).map((j, i) => (
              <div key={j.id || i} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 0', borderBottom:i<timer.joiners.filter(x=>x.playerName).length-1?`1px solid ${C.border}22`:'none' }}>
                <div style={{ width:18, height:18, borderRadius:'50%', background:j.confirmed===false?C.red+'33':C.gold+'22', border:`1px solid ${j.confirmed===false?C.red:C.gold}44`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:j.confirmed===false?C.red:C.gold, flexShrink:0 }}>{i+1}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <span style={{ fontSize:13, fontWeight:700, color:j.confirmed===false?C.muted:C.white, textDecoration:j.confirmed===false?'line-through':'none' }}>
                    {j.replacedBy ? j.replacedBy.playerName : j.playerName}
                  </span>
                  {j.confirmed===false && j.replacedBy && <span style={{ fontSize:11, color:C.green }}> ← sub</span>}
                </div>
                {(j.replacedBy?.heroName || j.heroName) && (
                  <span style={{ fontSize:12, color:C.gold, fontWeight:600, flexShrink:0 }}>→ {j.replacedBy?.heroName || j.heroName}</span>
                )}
                {onUpdateJoiner && (
                  <button onClick={() => onUpdateJoiner(timer.id, i, { confirmed: j.confirmed === false ? true : false })}
                    style={{ fontSize:10, height:22, padding:'0 6px', borderRadius:6, border:`1px solid ${j.confirmed===false?C.green+'44':C.red+'44'}`, background:'none', color:j.confirmed===false?C.green:C.red, cursor:'pointer', flexShrink:0 }}>
                    {j.confirmed === false ? 'In' : 'Out'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {timer.notes && <div style={{ fontSize:12, color:C.icy, marginTop:8, fontStyle:'italic' }}>"{timer.notes}"</div>}
      </div>
    </div>
  );
}
