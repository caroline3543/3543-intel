import { useState, useEffect, useRef } from 'react';
import { C } from '../../../utils/constants.js';
import { vibe } from '../../../utils/vibe.js';
import {
  RALLY_COLORS, parseImpactInput,
  calcSendSecs, calcRallyOpenSecs,
  utcNowSecs, secsToHHMMSS, fmtSend,
  getTimerStage,
} from './rallyRoomHelpers.js';

// ── LeaderMode ─────────────────────────────────────────────────
// Full-screen overlay for a rally leader during live battle.
// Props:
//   timer     – the timer this leader is running
//   allTimers – all active timers (for the mini-strip at top)
//   onClose   – () => void
export function LeaderMode({ timer, allTimers = [], onClose }) {
  const [now, setNow]     = useState(utcNowSecs());
  const lastStageRef      = useRef(null);

  useEffect(() => { const id = setInterval(() => setNow(utcNowSecs()), 250); return () => clearInterval(id); }, []);
  useEffect(() => {
    function h(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const parsed     = parseImpactInput(timer.impactTime);
  const impactSecs = parsed?.totalSecs ?? null;
  const marchSecs  = calcSendSecs(impactSecs, timer.marchSecs, 0);
  const openSecs   = timer.rallyDuration ? calcRallyOpenSecs(impactSecs, timer.marchSecs, timer.rallyDuration) : null;

  const secsToOpen   = openSecs   != null ? openSecs   - now : null;
  const secsToImpact = impactSecs != null ? impactSecs - now : null;
  const stage      = getTimerStage(secsToOpen, secsToImpact);
  const color      = RALLY_COLORS[timer.type] || C.gold;
  const isRallyOpen  = stage?.stage === 'filling' || stage?.stage === 'impact';
  const bigCountdown = isRallyOpen ? secsToImpact : (secsToOpen ?? secsToImpact);
  const bigLabel     = isRallyOpen
    ? (stage?.stage === 'impact' ? '✓ Impact' : 'Impact in')
    : (openSecs != null ? 'Open rally in' : 'Countdown');

  // Vibrate on stage transitions
  useEffect(() => {
    if (!stage) return;
    if (stage.stage !== lastStageRef.current) {
      lastStageRef.current = stage.stage;
      if (stage.stage === 'open_now')  vibe([100,50,100,50,200]);
      else if (stage.stage === 'prepare')  vibe([50,30,50]);
      else if (stage.stage === 'filling')  vibe([30,20,30]);
      else vibe(20);
    }
  }, [stage?.stage]);

  return (
    <div style={{ position:'fixed', inset:0, background:'#050D1A', zIndex:900, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24, overflow:'auto' }}>
      <button onClick={onClose} style={{ position:'absolute', top:20, right:20, background:'none', border:'none', color:C.muted, fontSize:28, cursor:'pointer' }}>✕</button>

      {/* Other active timers strip */}
      {allTimers.filter(t => t.id !== timer.id).length > 0 && (
        <div style={{ position:'absolute', top:16, left:16, right:60, display:'flex', gap:8, overflowX:'auto' }}>
          {allTimers.filter(t => t.id !== timer.id).map(t => {
            const tColor   = RALLY_COLORS[t.type] || C.gold;
            const tParsed  = parseImpactInput(t.impactTime);
            const tImpact  = tParsed?.totalSecs ?? null;
            const tOpen    = t.rallyDuration ? calcRallyOpenSecs(tImpact, t.marchSecs, t.rallyDuration) : null;
            const tNow     = utcNowSecs();
            const tStage   = getTimerStage(tOpen != null ? tOpen - tNow : null, tImpact != null ? tImpact - tNow : null);
            const tIsOpen  = tStage?.stage === 'filling' || tStage?.stage === 'impact';
            const tCountdown = tIsOpen
              ? (tImpact != null ? tImpact - tNow : null)
              : (tOpen != null ? tOpen - tNow : (tImpact != null ? tImpact - tNow : null));
            return (
              <div key={t.id} style={{ background:tColor+'22', border:`1.5px solid ${tColor}`, borderRadius:10, padding:'6px 10px', flexShrink:0, textAlign:'center', minWidth:72 }}>
                <div style={{ fontSize:11, fontWeight:700, color:tColor, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:80 }}>{t.name || t.type}</div>
                <div style={{ fontSize:12, color:tStage?tStage.color:C.white, fontVariantNumeric:'tabular-nums', fontWeight:600 }}>
                  {tCountdown != null ? secsToHHMMSS(tCountdown) : '--:--'}
                </div>
                {tStage && <div style={{ fontSize:9, color:tStage.color, marginTop:1 }}>{tStage.label.replace('⚠ ','').replace('✓ ','')}</div>}
              </div>
            );
          })}
        </div>
      )}

      <div style={{ fontSize:14, fontWeight:700, color, textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:6 }}>{timer.name || timer.type}</div>
      {timer.ratio && <div style={{ fontSize:12, color:C.muted, marginBottom:12 }}>Ratio: {timer.ratio}</div>}
      {stage && <div style={{ fontSize:stage.stage==='open_now'?26:18, fontWeight:800, color:stage.color, marginBottom:16, textAlign:'center' }}>{stage.label}</div>}

      <div style={{ fontSize:11, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>{bigLabel}</div>
      <div style={{ fontSize:80, fontWeight:900, color:stage?stage.color:color, fontVariantNumeric:'tabular-nums', letterSpacing:'0.04em', lineHeight:1, marginBottom:20, textAlign:'center' }}>
        {bigCountdown != null ? secsToHHMMSS(bigCountdown) : '--:--:--'}
      </div>

      <div style={{ display:'flex', gap:20, marginBottom:20 }}>
        {openSecs != null && (
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:11, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:3 }}>Open rally</div>
            <div style={{ fontSize:18, fontWeight:700, color:isRallyOpen?C.green:color }}>{isRallyOpen ? '✓ Opened' : fmtSend(openSecs) + ' UTC'}</div>
          </div>
        )}
        {marchSecs != null && (
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:11, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:3 }}>Marches at</div>
            <div style={{ fontSize:18, fontWeight:700, color:C.icy }}>{fmtSend(marchSecs)} UTC</div>
          </div>
        )}
        {timer.impactTime && (
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:11, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:3 }}>Impact</div>
            <div style={{ fontSize:18, fontWeight:700, color:stage?.stage==='impact'?C.green:color }}>{stage?.stage==='impact'?'✓ ':''}{timer.impactTime} UTC</div>
          </div>
        )}
      </div>

      {timer.joiners?.filter(j => j.playerName).length > 0 && (
        <div style={{ background:'#0A1628', borderRadius:12, padding:'12px 20px', marginBottom:16, width:'100%', maxWidth:360 }}>
          <div style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10, textAlign:'center' }}>Priority Joiners</div>
          {timer.joiners.filter(j => j.playerName).map((j, i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'6px 0', borderBottom:i<timer.joiners.filter(x=>x.playerName).length-1?`1px solid ${C.border}22`:'none' }}>
              <div style={{ fontSize:14, fontWeight:700, color:j.confirmed===false?C.muted:C.white, textDecoration:j.confirmed===false?'line-through':'none', flex:1 }}>
                {j.replacedBy ? j.replacedBy.playerName : j.playerName}
                {j.confirmed===false && j.replacedBy && <span style={{ color:C.green }}> ← {j.replacedBy.playerName}</span>}
              </div>
              {(j.replacedBy?.heroName || j.heroName) && (
                <span style={{ fontSize:13, color:C.gold, fontWeight:700 }}>→ {j.replacedBy?.heroName || j.heroName}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {timer.notes && <div style={{ fontSize:14, color:C.icy, fontStyle:'italic', textAlign:'center', maxWidth:320, marginBottom:12 }}>"{timer.notes}"</div>}
      <button onClick={onClose} style={{ position:'absolute', bottom:40, height:48, padding:'0 32px', borderRadius:24, background:C.section, border:`1px solid ${C.border}`, color:C.muted, fontWeight:600, fontSize:15, cursor:'pointer' }}>Exit full screen</button>
    </div>
  );
}
