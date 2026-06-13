import { useState, useEffect } from 'react';
import { C } from '../../../utils/constants.js';
import {
  RALLY_COLORS, parseImpactInput,
  calcSendSecs, calcRallyOpenSecs,
  utcNowSecs, secsToHHMMSS, fmtSend,
  getTimerStage,
} from './rallyRoomHelpers.js';

// ── TimerCard ──────────────────────────────────────────────────
// Single live countdown card shown in the Live Timers tab.
// Props:
//   timer           – timer object
//   onEdit          – (timer) => void
//   onDelete        – (timerId) => void
//   onLeaderMode    – (timer) => void   (open full-screen)
//   onUpdateJoiner  – (timerId, joinerIdx, patch) => void
export function TimerCard({ timer, onEdit, onDelete, onLeaderMode, onUpdateJoiner }) {
  const [now, setNow] = useState(utcNowSecs());
  useEffect(() => { const id = setInterval(() => setNow(utcNowSecs()), 250); return () => clearInterval(id); }, []);

  // ── ASAP mode: countdown directly to asapLaunchAt ─────────────
  if (timer.asap && timer.asapLaunchAt != null) {
    return (
      <AsapTimerCard
        timer={timer}
        now={now}
        onDelete={onDelete}
        onLeaderMode={onLeaderMode}
      />
    );
  }

  const parsed     = parseImpactInput(timer.impactTime);
  const impactSecs = parsed?.totalSecs ?? null;
  const marchSecs  = calcSendSecs(impactSecs, timer.marchSecs, 0);
  const openSecs   = timer.rallyDuration ? calcRallyOpenSecs(impactSecs, timer.marchSecs, timer.rallyDuration) : null;

  const secsToOpen   = openSecs   != null ? openSecs   - now : null;
  const secsToImpact = impactSecs != null ? impactSecs - now : null;
  const stage  = getTimerStage(secsToOpen, secsToImpact);
  const color  = RALLY_COLORS[timer.type] || C.gold;
  const cardBg = stage?.bg ?? C.card;

  const progressTarget = openSecs ?? impactSecs;
  const secsToTarget   = progressTarget != null ? progressTarget - now : null;
  const WINDOW   = 300;
  const progress = secsToTarget != null ? Math.max(0, Math.min(100, ((WINDOW - Math.max(0, secsToTarget)) / WINDOW) * 100)) : 0;

  const isRallyOpen  = stage?.stage === 'filling' || stage?.stage === 'impact';
  const bigCountdown = isRallyOpen ? secsToImpact : (secsToOpen ?? secsToImpact);
  const bigLabel     = isRallyOpen
    ? (stage?.stage === 'impact' ? '✓ Impact' : 'Impact in')
    : (openSecs != null ? 'Open rally in' : 'Countdown');

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
              <div style={{ fontSize:15, fontWeight:700, color:C.white }}>{timer.name || timer.type}</div>
              <div style={{ fontSize:11, color:C.muted, marginTop:1 }}>
                {timer.type}{timer.rallyDuration && <span> · {timer.rallyDuration}min</span>}{timer.ratio && <span> · {timer.ratio}</span>}
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
        <div style={{ display:'grid', gridTemplateColumns:openSecs!=null?'1fr 1fr 1fr':'1fr 1fr', gap:6, marginBottom:timer.joiners?.filter(j=>j.playerName).length>0?10:0 }}>
          {openSecs != null && (
            <div style={{ background:C.section, borderRadius:8, padding:'7px 10px', textAlign:'center' }}>
              <div style={{ fontSize:9, color:C.muted, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:2 }}>Open rally</div>
              <div style={{ fontSize:13, fontWeight:700, color:isRallyOpen?C.green:C.gold, fontVariantNumeric:'tabular-nums' }}>
                {isRallyOpen ? '✓ Opened' : fmtSend(openSecs) + ' UTC'}
              </div>
            </div>
          )}
          <div style={{ background:C.section, borderRadius:8, padding:'7px 10px', textAlign:'center' }}>
            <div style={{ fontSize:9, color:C.muted, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:2 }}>Marches at</div>
            <div style={{ fontSize:13, fontWeight:700, color:C.icy, fontVariantNumeric:'tabular-nums' }}>{marchSecs != null ? fmtSend(marchSecs) + ' UTC' : '—'}</div>
          </div>
          <div style={{ background:C.section, borderRadius:8, padding:'7px 10px', textAlign:'center' }}>
            <div style={{ fontSize:9, color:C.muted, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:2 }}>Impact</div>
            <div style={{ fontSize:13, fontWeight:700, color:stage?.stage==='impact'?C.green:C.gold, fontVariantNumeric:'tabular-nums' }}>
              {stage?.stage === 'impact' ? '✓ ' : ''}{timer.impactTime || '--:--'} UTC
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

// ── AsapTimerCard ──────────────────────────────────────────────
// Minimal countdown card for ASAP launches. Counts 5→0→LAUNCH.
function AsapTimerCard({ timer, now, onDelete, onLeaderMode }) {
  const secsLeft = Math.round(timer.asapLaunchAt - now);
  const launched = secsLeft <= 0;
  const color    = RALLY_COLORS[timer.type] || C.gold;

  const progress = launched ? 100 : Math.max(0, Math.min(100, ((5 - secsLeft) / 5) * 100));

  const bg      = launched ? '#0A2A14' : secsLeft <= 3 ? '#3A0A0A' : '#1E1200';
  const border  = launched ? '#30D158' : secsLeft <= 3 ? '#FF453A' : C.gold;
  const display = launched ? 'OPEN RALLY NOW' : String(secsLeft);
  const dispCol = launched ? '#30D158' : secsLeft <= 3 ? '#FF453A' : C.gold;

  return (
    <div style={{ background:bg, borderRadius:14, overflow:'hidden', marginBottom:12, border:`1.5px solid ${border}66`, boxShadow:`0 0 16px ${border}33`, transition:'background 300ms, border-color 300ms' }}>
      <div style={{ height:3, background:C.border }}>
        <div style={{ height:'100%', width:`${progress}%`, background:border, transition:'width 250ms linear' }}/>
      </div>
      <div style={{ padding:'14px 14px 12px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ width:10, height:10, borderRadius:'50%', background:color, flexShrink:0 }}/>
              <div style={{ fontSize:15, fontWeight:700, color:C.white }}>{timer.name || timer.type}</div>
              <span style={{ fontSize:11, padding:'2px 8px', borderRadius:10, background:C.red+'33', color:C.red, fontWeight:700 }}>⚡ ASAP</span>
            </div>
            <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>{timer.type}</div>
          </div>
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={() => onLeaderMode(timer)} style={{ height:30, padding:'0 8px', borderRadius:14, background:color+'22', border:`1px solid ${color}44`, color, fontWeight:600, fontSize:11, cursor:'pointer' }}>Full screen</button>
            <button onClick={() => onDelete(timer.id)} style={{ height:30, width:30, borderRadius:14, background:'none', border:'none', color:C.red+'88', fontSize:15, cursor:'pointer' }}>✕</button>
          </div>
        </div>

        {/* Big number */}
        <div style={{ textAlign:'center', padding:'8px 0 12px' }}>
          <div style={{ fontSize:11, color:C.muted, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:6 }}>
            {launched ? '⚠ OPEN RALLY NOW' : 'Opening in'}
          </div>
          <div style={{ fontSize: launched ? 32 : 80, fontWeight:900, color:dispCol, fontVariantNumeric:'tabular-nums', lineHeight:1, letterSpacing:'0.02em', transition:'color 300ms' }}>
            {display}
          </div>
        </div>
      </div>
    </div>
  );
}
