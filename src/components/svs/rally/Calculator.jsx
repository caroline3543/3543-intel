import { useState, useEffect } from 'react';
import { C } from '../../../utils/constants.js';
import { vibe } from '../../../utils/vibe.js';
import {
  RALLY_TYPES, RALLY_COLORS, RALLY_DURATIONS, DEFAULT_MSG,
  COUNTDOWN_PRESETS, COUNTDOWN_MIN, COUNTDOWN_MAX, COUNTDOWN_STEP, COUNTDOWN_DEFAULT,
  uid, nowEpochSecs, computeLeaderTimes, fmtSend, fmtMarch, secsToHHMMSS,
} from './rallyRoomHelpers.js';
import { ImpactInput } from './SmartInputs.jsx';
import { LeaderRow } from './LeaderRow.jsx';
import { DeleteConfirmModal } from '../../common/DeleteConfirmModal.jsx';

// ── Calculator ─────────────────────────────────────────────────
// The "🧮 Calculator" tab.
//
// Redesigned: leaders are added ONCE to a single shared list. The user
// then picks exactly one of two timing modes — "Arrive at a specific
// time" or "Start first rally in" — which only changes the timing
// INPUT and the resulting calculation. Switching modes never touches
// the leader list.
//
// Props:
//   calc           – calculator state slice from LiveRallyRoom
//   onChange       – (updatedCalc) => void
//   registry       – march registry entries
//   onStartTimers  – (newTimers[]) => void
export function Calculator({ calc, onChange, registry, onStartTimers }) {
  const [, forceTick]                   = useState(0);
  const [copied, setCopied]             = useState(null);
  const [editingRow, setEditingRow]     = useState(null);
  const [showTemplate, setShowTemplate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Countdown-mode's preview ("now + countdownSecs") is a moving target
  // until Start Timers is actually pressed — tick every second so the
  // leader table preview doesn't silently go stale the longer someone
  // sits on this page before starting.
  useEffect(() => { const id = setInterval(() => forceTick(x => x + 1), 1000); return () => clearInterval(id); }, []);

  // ── Mode + timing inputs ───────────────────────────────────
  function setMode(mode) { onChange({ ...calc, timingMode: mode }); }

  function setImpact(display, epochSecs) {
    onChange({ ...calc, impactTimeRaw: display || '', impactEpochSecs: epochSecs });
  }

  function setCountdownSecs(secs) {
    const clamped = Math.max(COUNTDOWN_MIN, Math.min(COUNTDOWN_MAX, secs));
    onChange({ ...calc, countdownSecs: clamped });
  }

  function setRallyDuration(d) {
    onChange({ ...calc, rallyDuration: d, leaders: calc.leaders.map(l => ({ ...l, rallyDuration: d })) });
  }

  // ── Leader list ops (shared by both modes) ─────────────────
  function addFromRegistry(entry) {
    if (calc.leaders.some(l => l.registryId === entry.id)) return;
    onChange({ ...calc, leaders:[...calc.leaders, {
      id:uid(), registryId:entry.id, name:entry.name, type:entry.type||'Main Rally',
      marchSecs:entry.marchSecs, rallyDuration:calc.rallyDuration||3, offset:0, notes:'',
    }] });
    vibe(8);
  }
  function removeRow(id)     { onChange({ ...calc, leaders:calc.leaders.filter(l => l.id !== id) }); }
  function updRow(id, patch) { onChange({ ...calc, leaders:calc.leaders.map(l => l.id === id ? { ...l, ...patch } : l) }); }

  // ── Message preview / copy ─────────────────────────────────
  function copyMsg(leader) {
    const { openRallyAtUtc, impactAtUtc } = computeLeaderTimes(leader, calc);
    const joinersText = (leader.joiners || [])
      .filter(j => j.playerName)
      .map((j, i) => `${i+1}. ${j.replacedBy ? j.replacedBy.playerName : j.playerName} → ${j.replacedBy?.heroName || j.heroName || 'TBD'}`)
      .join('\n') || 'Not yet assigned';
    const template = leader.useCustomMsg && leader.customMsg ? leader.customMsg : (calc.messageTemplate || DEFAULT_MSG);
    const text = template
      .replace('{type}',    leader.type || 'Rally')
      .replace('{name}',    leader.name || '')
      .replace('{impact}',  impactAtUtc != null ? fmtSend(impactAtUtc) : '--:--')
      .replace('{open}',    openRallyAtUtc != null ? fmtSend(openRallyAtUtc) : '--:--')
      .replace('{joiners}', joinersText)
      .replace('{ratio}',   leader.ratio || '');
    navigator.clipboard.writeText(text).then(() => { setCopied(leader.id); setTimeout(() => setCopied(null), 2000); });
    vibe(8);
  }

  // ── Blocker / readiness ─────────────────────────────────────
  function getBlocker() {
    if (calc.leaders.length === 0) return 'Select at least one rally leader';
    if (calc.timingMode === 'impact' && calc.impactEpochSecs == null) return 'Enter a valid impact time';
    if (calc.timingMode === 'countdown' && !calc.countdownSecs) return 'Choose when the first rally should start';
    const missingMarch = calc.leaders.find(l => !l.marchSecs);
    if (missingMarch) return `Add a march time for ${missingMarch.name || 'this leader'}`;
    return null;
  }
  const blocker = getBlocker();

  // ── Start Timers — single unified path for both modes ──────
  function handleStartTimers() {
    if (blocker) return;
    // Countdown mode: compute ONE reference instant, shared by every
    // leader in this batch — not recomputed per-leader.
    const referenceOverride = calc.timingMode === 'countdown'
      ? nowEpochSecs() + calc.countdownSecs
      : undefined;

    const newTimers = calc.leaders.map(l => {
      const { openRallyAtUtc, marchesAtUtc, impactAtUtc, referenceTimeUtc } = computeLeaderTimes(l, calc, referenceOverride);
      const rallyDurMins = l.rallyDuration || calc.rallyDuration || 3;
      return {
        id: uid(),
        leaderId: l.registryId || null,
        leaderName: l.name || l.type,
        rallyType: l.type || 'Main Rally',
        timingMode: calc.timingMode,
        referenceTimeUtc,
        countdownDurationSecs: calc.timingMode === 'countdown' ? calc.countdownSecs : null,
        marchSecs: l.marchSecs,
        rallyDurationSecs: rallyDurMins * 60,
        offsetSecs: l.offset || 0,
        openRallyAtUtc, marchesAtUtc, impactAtUtc,
        createdAtUtc: nowEpochSecs(),
        ratio: '', notes: l.notes || '', joiners: [],
      };
    });
    onStartTimers(newTimers);
  }

  const readyCount = calc.leaders.filter(l => {
    const t = computeLeaderTimes(l, calc);
    return t.openRallyAtUtc != null;
  }).length;

  const gridCols = '1fr 56px 84px 96px';

  return (
    <div>
      <div style={{ fontSize:16, fontWeight:700, color:C.white, marginBottom:4 }}>Send Calculator</div>
      <div style={{ fontSize:13, color:C.muted, marginBottom:16 }}>Add each leader once, then choose how their rallies are timed.</div>

      {/* 1. Timing mode selector */}
      <div style={{ display:'flex', gap:8, marginBottom:16 }}>
        {[['impact','Arrive at a specific time'],['countdown','Start first rally in']].map(([id, label]) => (
          <button key={id} onClick={() => setMode(id)}
            style={{ flex:1, minHeight:56, padding:'8px 10px', borderRadius:12, border:`1px solid ${calc.timingMode===id?C.gold:C.border}`, background:calc.timingMode===id?C.gold+'22':C.section, color:calc.timingMode===id?C.gold:C.muted, fontWeight:700, fontSize:13, cursor:'pointer', lineHeight:1.3 }}>
            {label}
          </button>
        ))}
      </div>

      {/* 2. Timing input for the selected mode */}
      {calc.timingMode === 'impact' ? (
        <div style={{ marginBottom:16 }}>
          <label style={{ display:'block', fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4 }}>Target impact time (UTC)</label>
          <div style={{ fontSize:12, color:C.muted, marginBottom:8 }}>Set the UTC time when all rallies should impact the target.</div>
          <ImpactInput value={calc.impactTimeRaw} onChange={setImpact} large/>
        </div>
      ) : (
        <div style={{ marginBottom:16 }}>
          <label style={{ display:'block', fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4 }}>First rally starts in</label>
          <div style={{ fontSize:12, color:C.muted, marginBottom:8 }}>Choose how long from now until the first rally leader opens their rally.</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:10 }}>
            {COUNTDOWN_PRESETS.map(p => (
              <button key={p} onClick={() => setCountdownSecs(p)}
                style={{ padding:'0 14px', minHeight:44, borderRadius:20, border:`1px solid ${calc.countdownSecs===p?C.gold:C.border}`, background:calc.countdownSecs===p?C.gold+'22':C.section, color:calc.countdownSecs===p?C.gold:C.muted, fontWeight:700, fontSize:14, cursor:'pointer' }}>
                {p < 60 ? `${p} sec` : p % 60 === 0 ? `${p/60} min` : `${Math.floor(p/60)}m ${p%60}s`}
              </button>
            ))}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <button onClick={() => setCountdownSecs((calc.countdownSecs||COUNTDOWN_DEFAULT) - COUNTDOWN_STEP)}
              style={{ width:44, height:44, borderRadius:10, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontSize:20, fontWeight:700, cursor:'pointer' }}>−</button>
            <div style={{ flex:1, textAlign:'center', height:44, display:'flex', alignItems:'center', justifyContent:'center', background:C.section, border:`1px solid ${C.border}`, borderRadius:10, fontSize:18, fontWeight:700, color:C.white, fontVariantNumeric:'tabular-nums' }}>
              {secsToHHMMSS(calc.countdownSecs||COUNTDOWN_DEFAULT).replace(/^00:/,'')}
            </div>
            <button onClick={() => setCountdownSecs((calc.countdownSecs||COUNTDOWN_DEFAULT) + COUNTDOWN_STEP)}
              style={{ width:44, height:44, borderRadius:10, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontSize:20, fontWeight:700, cursor:'pointer' }}>+</button>
          </div>
        </div>
      )}

      {/* 3. Global rally duration default */}
      <div style={{ marginBottom:16 }}>
        <label style={{ display:'block', fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>Rally duration <span style={{ fontWeight:400, color:C.muted }}>(apply to all)</span></label>
        <div style={{ display:'flex', gap:8 }}>
          {RALLY_DURATIONS.map(d => (
            <button key={d} onClick={() => setRallyDuration(d)}
              style={{ flex:1, height:44, borderRadius:10, border:`1px solid ${calc.rallyDuration===d?C.gold:C.border}`, background:calc.rallyDuration===d?C.gold+'22':C.section, color:calc.rallyDuration===d?C.gold:C.muted, fontWeight:700, fontSize:15, cursor:'pointer' }}>
              {d} min
            </button>
          ))}
        </div>
      </div>

      {/* 4. Saved leaders — quick add */}
      {registry.filter(r => r.marchSecs).length > 0 && (
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>Saved leaders — tap to add</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {registry.filter(r => r.marchSecs).map(entry => {
              const already = calc.leaders.some(l => l.registryId === entry.id);
              return (
                <button key={entry.id} onClick={() => addFromRegistry(entry)} disabled={already}
                  style={{ padding:'0 14px', minHeight:44, borderRadius:20, border:`1px solid ${already?C.border:C.gold}`, background:already?C.section:C.gold+'18', color:already?C.muted:C.gold, fontWeight:700, fontSize:14, cursor:already?'default':'pointer' }}>
                  {already ? '✓ ' : ''}{entry.name} <span style={{ fontSize:12, opacity:0.7 }}>{fmtMarch(entry.marchSecs)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. Shared selected-leader table */}
      {calc.leaders.length > 0 && (
        <div style={{ background:C.section, borderRadius:12, overflow:'hidden', marginBottom:16 }}>
          <div style={{ display:'grid', gridTemplateColumns:gridCols, padding:'8px 14px', borderBottom:`1px solid ${C.border}` }}>
            {['Leader','March','Impact',''].map(h => (
              <div key={h} style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.07em' }}>{h}</div>
            ))}
          </div>
          {calc.leaders.map((leader, i) => (
            <LeaderRow
              key={leader.id}
              leader={leader}
              index={i}
              isLast={i === calc.leaders.length - 1}
              isEditing={editingRow === i}
              onToggleEdit={() => setEditingRow(editingRow === i ? null : i)}
              calc={calc}
              copied={copied === leader.id}
              onCopy={() => copyMsg(leader)}
              onDeleteRequest={() => setDeleteTarget(leader)}
              onUpdate={patch => updRow(leader.id, patch)}
            />
          ))}
          <button onClick={() => { onChange({ ...calc, leaders:[...calc.leaders, { id:uid(), name:'', type:'Main Rally', marchSecs:null, rallyDuration:calc.rallyDuration||3, offset:0, notes:'' }] }); setEditingRow(calc.leaders.length); }}
            style={{ width:'100%', height:44, background:'none', border:'none', borderTop:`1px solid ${C.border}22`, color:C.muted, fontWeight:600, fontSize:13, cursor:'pointer' }}>
            ＋ Add leader
          </button>
        </div>
      )}

      {calc.leaders.length === 0 && registry.filter(r => r.marchSecs).length === 0 && (
        <div style={{ textAlign:'center', padding:'20px 0', color:C.muted, fontSize:13, marginBottom:16 }}>Add leaders in 💾 March Times, then tap their chips here.</div>
      )}

      {/* 6. Start Timers */}
      <button onClick={handleStartTimers} disabled={!!blocker}
        style={{ width:'100%', height:56, borderRadius:12, background:blocker?C.section:C.gold, color:blocker?C.muted:C.bg, fontWeight:800, fontSize:17, border:blocker?`1px solid ${C.border}`:'none', cursor:blocker?'default':'pointer', marginBottom:blocker?8:16, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
        {blocker ? 'Start Timers' : `Start ${calc.leaders.length} Timer${calc.leaders.length !== 1 ? 's' : ''}`}
      </button>
      {blocker && (
        <div style={{ fontSize:12, color:C.muted, textAlign:'center', marginBottom:16 }}>{blocker}</div>
      )}

      {/* 7. Message template */}
      <button onClick={() => setShowTemplate(!showTemplate)}
        style={{ minHeight:44, display:'flex', alignItems:'center', background:'none', border:'none', color:C.gold, fontSize:13, cursor:'pointer', padding:'4px 0', marginBottom:8 }}>
        {showTemplate ? '▾' : '▸'}&nbsp;Edit message template
      </button>
      {showTemplate && (
        <div style={{ background:C.section, borderRadius:10, padding:12 }}>
          <div style={{ fontSize:11, color:C.muted, marginBottom:8 }}>Variables: {'{type}'} {'{name}'} {'{impact}'} {'{open}'} {'{joiners}'} {'{ratio}'}</div>
          <textarea value={calc.messageTemplate || DEFAULT_MSG} onChange={e => onChange({ ...calc, messageTemplate:e.target.value })}
            style={{ width:'100%', minHeight:120, background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:'10px 12px', fontSize:13, color:C.white, resize:'vertical', boxSizing:'border-box', fontFamily:'monospace' }}/>
          <button onClick={() => onChange({ ...calc, messageTemplate:DEFAULT_MSG })}
            style={{ minHeight:44, display:'flex', alignItems:'center', fontSize:12, color:C.muted, background:'none', border:'none', cursor:'pointer', padding:'4px 0' }}>
            Reset to default
          </button>
        </div>
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          message={`Remove ${deleteTarget.name || 'this'} rally row from the calculator? This does not affect the March Times registry.`}
          onConfirm={() => { removeRow(deleteTarget.id); setDeleteTarget(null); }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
